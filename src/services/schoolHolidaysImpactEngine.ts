/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SchoolHolidayPeriod,
  SchoolHolidaysImpactScoreResult,
  HolidayOverlapSummary,
  HolidayImpactClassification,
} from '../types/schoolHolidays';
import { Hotel } from '../types';
import { getHotelInventoryProfile } from '../data/hotelRoomTypologies';

/**
 * Moteur d'Analyse d'Impact Hôtelier des Vacances Scolaires & Revenue Management
 */

export function calculateSchoolHolidayImpactScore(
  holiday: SchoolHolidayPeriod,
  hotel: Hotel,
  allHolidays: SchoolHolidayPeriod[]
): SchoolHolidaysImpactScoreResult {
  const profile = getHotelInventoryProfile(hotel.id);
  const roomBreakdown = profile.roomBreakdown;

  // 1. Importance du marché émetteur pour cet hôtel (0 - 25 pts)
  const feeder = profile.feederMarkets.find((m) => m.countryCode === holiday.countryCode);
  let feederMarketScore = 0;
  if (feeder) {
    if (feeder.sharePercent >= 25) feederMarketScore = 25;
    else if (feeder.sharePercent >= 15) feederMarketScore = 20;
    else if (feeder.sharePercent >= 8) feederMarketScore = 15;
    else if (feeder.sharePercent >= 4) feederMarketScore = 10;
    else feederMarketScore = 5;
  } else {
    // Marché secondaire sans part significative
    feederMarketScore = 4;
  }

  // 2. Proximité géographique et accessibilité (0 - 15 pts)
  // Distance et liaisons directes vers Paris/Nice/Lyon
  let proximityScore = 8;
  const directEurostarOrTrain = ['FR', 'BE', 'GB', 'NL', 'DE', 'CH', 'LU'];
  if (holiday.countryCode === 'FR') proximityScore = 15;
  else if (directEurostarOrTrain.includes(holiday.countryCode)) proximityScore = 13;
  else if (['ES', 'IT'].includes(holiday.countryCode)) proximityScore = 10;
  else proximityScore = 6; // Long-courrier (US, JP, SA)

  // 3. Chevauchement multi-pays (0 - 20 pts)
  // Nombre d'autres pays simultanément en vacances scolaires sur cette période
  const overlappingPeriods = allHolidays.filter((other) => {
    if (other.id === holiday.id || other.countryCode === holiday.countryCode) return false;
    return holiday.startDate <= other.endDate && holiday.endDate >= other.startDate;
  });

  const uniqueOverlappingCountriesMap = new Map<string, { code: string; name: string; flag: string; holidayName: string }>();
  overlappingPeriods.forEach((p) => {
    if (!uniqueOverlappingCountriesMap.has(p.countryCode)) {
      uniqueOverlappingCountriesMap.set(p.countryCode, {
        code: p.countryCode,
        name: p.countryName,
        flag: p.flag,
        holidayName: p.name,
      });
    }
  });

  const overlappingCountries = Array.from(uniqueOverlappingCountriesMap.values());
  const overlapCount = overlappingCountries.length;

  let countryOverlapScore = 0;
  if (overlapCount >= 6) countryOverlapScore = 20;
  else if (overlapCount >= 4) countryOverlapScore = 16;
  else if (overlapCount >= 2) countryOverlapScore = 12;
  else if (overlapCount === 1) countryOverlapScore = 7;
  else countryOverlapScore = 3;

  // 4. Compatibilité avec la typologie du parc de chambres (0 - 25 pts)
  // CRITIQUE : un hôtel avec 35% de chambres familiales marque beaucoup plus qu'un hôtel à 100% doubles !
  const familyShare = roomBreakdown.familyCapacitySharePercent;
  let roomTypologyScore = 0;
  if (familyShare >= 35) roomTypologyScore = 25;
  else if (familyShare >= 25) roomTypologyScore = 20;
  else if (familyShare >= 15) roomTypologyScore = 13;
  else if (familyShare >= 8) roomTypologyScore = 7;
  else roomTypologyScore = 2; // Hôtel quasiment sans chambres familiales

  // 5. Historique de fréquentation, niveau de demande et pickup (0 - 15 pts)
  let historicalPaceScore = 0;
  if (profile.historicalHolidayOccRate >= 85) historicalPaceScore = 15;
  else if (profile.historicalHolidayOccRate >= 78) historicalPaceScore = 12;
  else if (profile.historicalHolidayOccRate >= 65) historicalPaceScore = 8;
  else historicalPaceScore = 4;

  // Calcul du score global (0 - 100)
  const totalScore = feederMarketScore + proximityScore + countryOverlapScore + roomTypologyScore + historicalPaceScore;

  // Classification visuelle conforme à la consigne :
  // Vert : impact potentiel élevé (>= 70)
  // Orange : impact potentiel modéré (40 - 69)
  // Rouge : impact potentiel faible (< 40) (faible opportunité, pas baisse automatique)
  // Données insuffisantes si hôtel sans paramétrage
  let classification: HolidayImpactClassification = 'orange';
  let classificationLabel = 'Impact potentiel modéré';

  if (!profile || profile.roomBreakdown.familyCapacityRooms === undefined) {
    classification = 'donnees_insuffisantes';
    classificationLabel = 'Données insuffisantes';
  } else if (totalScore >= 70) {
    classification = 'vert';
    classificationLabel = 'Impact potentiel élevé';
  } else if (totalScore >= 42) {
    classification = 'orange';
    classificationLabel = 'Impact potentiel modéré';
  } else {
    classification = 'rouge';
    classificationLabel = 'Impact potentiel faible';
  }

  // Typologies ciblées
  const targetedRoomTypes: string[] = [];
  if (roomBreakdown.tripleRooms > 0) targetedRoomTypes.push(`${roomBreakdown.tripleRooms} Chambres Triples`);
  if (roomBreakdown.quadrupleRooms > 0) targetedRoomTypes.push(`${roomBreakdown.quadrupleRooms} Chambres Quadruples`);
  if (roomBreakdown.familyRooms > 0) targetedRoomTypes.push(`${roomBreakdown.familyRooms} Chambres Familiales`);
  if (roomBreakdown.connectingRooms > 0) targetedRoomTypes.push(`${roomBreakdown.connectingRooms} Communicantes`);
  if (roomBreakdown.suites > 0) targetedRoomTypes.push(`${roomBreakdown.suites} Suites`);

  // Génération des recommandations explicables adaptées aux 3 situations métiers décrites
  let recommendation = '';
  let commercialStrategy = '';
  let yieldAction = '';

  const isBritishOrBelgian = holiday.countryCode === 'GB' || holiday.countryCode === 'BE';
  const isFrenchOnly = holiday.countryCode === 'FR' && overlapCount <= 1;

  if (overlapCount >= 3 && familyShare >= 25) {
    // Situation 1 : Chevauchement de plusieurs vacances scolaires + hôtel avec capacité familiale
    recommendation =
      `Forte convergence de ${overlapCount + 1} marchés émetteurs simultanément en vacances. Avec ${roomBreakdown.familyCapacityRooms} chambres familiales (${familyShare}% du parc), surveiller attentivement le pickup à J-45. Anticiper la montée en charge familiale et adapter progressivement les tarifs BAR sur les triples et quadruples si le rythme de réservation le confirme.`;
    commercialStrategy =
      `Mettre en avant les forfaits famille (petit-déjeuner enfant offert, pass musées/billetterie) sur les canaux directs pour les clientèles ${holiday.countryName} et marchés en chevauchement.`;
    yieldAction =
      `Protéger les contingents de chambres triples et communicantes contre les réservations corporate à tarif négocié non yieldable. Activer un séjour minimum (MLOS) de 2 ou 3 nuits sur les weekends.`;
  } else if (isFrenchOnly && familyShare < 20) {
    // Situation 2 : Vacances scolaires françaises uniquement + hôtel principalement en chambres doubles
    recommendation =
      `Vacances scolaires françaises sans chevauchement majeur. L'établissement possédant principalement des chambres doubles (${roomBreakdown.doubleRooms} ch.) et une clientèle orientée affaires, l'impact de la demande familiale restera limité. Ne pas appliquer de hausse tarifaire automatique.`;
    commercialStrategy =
      `Maintenir la visibilité sur les segments corporate et individuels pour compenser le ralentissement potentiel des déplacements d'affaires scolaires.`;
    yieldAction =
      `Conserver la grille tarifaire BAR standard. Éviter toute hausse spéculative qui pénaliserait la conversion.`;
  } else if (isBritishOrBelgian && (roomBreakdown.tripleRooms > 0 || roomBreakdown.familyRooms > 0)) {
    // Situation 3 : Vacances britanniques ou belges + hôtel disposant de chambres adaptées
    recommendation =
      `Période propice aux courts séjours familiaux en provenance du ${holiday.countryName} (${feeder?.sharePercent || 15}% de vos nuitées habituelles). Vos ${roomBreakdown.familyCapacityRooms} chambres triples, quadruples et communicantes correspondent idéalement aux attentes de cette clientèle.`;
    commercialStrategy =
      `Renforcer la visibilité des offres familiales sur les OTA du marché ${holiday.countryName} (Booking.com UK/BE, Expedia, Eurostar Packages).`;
    yieldAction =
      `Surveiller le pickup hebdomadaire. Dès que 60% des chambres familiales sont réservées, remonter le palier tarifaire de +15% à +25% sur les catégories triples et familiales.`;
  } else {
    // Recommandation générale pondérée
    recommendation =
      `Impact modéré attendu. Le calendrier scolaire du ${holiday.countryName} représente une opportunité complémentaire. Analyser la montée en charge avant toute modification tarifaire.`;
    commercialStrategy =
      `Surveiller l'évolution des réservations en provenance du marché ${holiday.countryName}.`;
    yieldAction =
      `Ajustement dynamique standard basé sur l'occupation globale de l'hôtel.`;
  }

  const pmsReadiness =
    'Indicateur calculé à partir de la structure du parc de chambres, de la matrice des marchés émetteurs et des calendriers officiels. Prêt pour couplage en temps réel avec le pickup PMS (Opera, Mews, Apaleo, Protel).';

  return {
    periodId: holiday.id,
    holidayName: holiday.name,
    countryCode: holiday.countryCode,
    countryName: holiday.countryName,
    flag: holiday.flag,
    season: holiday.season,
    startDate: holiday.startDate,
    endDate: holiday.endDate,
    durationDays: holiday.durationDays,
    score: Math.min(100, Math.max(0, totalScore)),
    classification,
    classificationLabel,
    scoreBreakdown: {
      feederMarketScore,
      proximityScore,
      countryOverlapScore,
      roomTypologyScore,
      historicalPaceScore,
    },
    overlappingCountries,
    hotelFamilyCapacityShare: familyShare,
    targetedRoomTypes,
    recommendation,
    commercialStrategy,
    yieldAction,
    pmsReadiness,
  };
}

/**
 * Détecteur des périodes clés de chevauchement multi-pays
 */
export function detectMajorOverlaps(
  holidays: SchoolHolidayPeriod[],
  hotel: Hotel
): HolidayOverlapSummary[] {
  // Périodes stratégiques de convergence
  const sampleDates = [
    { start: '2026-02-16', end: '2026-02-23', season: 'hiver' as const, label: 'Convergence Hiver / Half-term (Fév. 2026)', peak: 'Vacances d’Hiver Européennes' },
    { start: '2026-04-06', end: '2026-04-17', season: 'printemps' as const, label: 'Grand Pont de Pâques / Spring Break (Avr. 2026)', peak: 'Pâques & Spring Break Multi-Marchés' },
    { start: '2026-07-15', end: '2026-08-20', season: 'ete' as const, label: 'Pic Estival Européen (Juil. - Août 2026)', peak: 'Grandes Vacances d’Été Européennes' },
    { start: '2026-10-24', end: '2026-11-02', season: 'automne' as const, label: 'Toussaint & Half-term d’Automne (Oct. - Nov. 2026)', peak: 'Toussaint, Half-term & Automne' },
    { start: '2026-12-24', end: '2027-01-03', season: 'hiver' as const, label: 'Trêve des Confiseurs & Fêtes de Fin d’Année', peak: 'Noël & Nouvel An International' },
  ];

  return sampleDates.map((item) => {
    const overlapping = holidays.filter((h) => {
      return item.start <= h.endDate && item.end >= h.startDate;
    });

    const uniqueCountriesMap = new Map<string, { code: string; name: string; flag: string; holidayName: string }>();
    overlapping.forEach((h) => {
      if (!uniqueCountriesMap.has(h.countryCode)) {
        uniqueCountriesMap.set(h.countryCode, {
          code: h.countryCode,
          name: h.countryName,
          flag: h.flag,
          holidayName: h.name,
        });
      }
    });

    const countries = Array.from(uniqueCountriesMap.values());
    const totalCountries = countries.length;

    let impactScoreAvg = 50;
    if (totalCountries >= 8) impactScoreAvg = 92;
    else if (totalCountries >= 5) impactScoreAvg = 78;
    else if (totalCountries >= 3) impactScoreAvg = 64;

    return {
      startDate: item.start,
      endDate: item.end,
      season: item.season,
      countries,
      totalCountries,
      overlapLabel: item.label,
      peakPeriodName: item.peak,
      impactScoreAvg,
      recommendedFocus: totalCountries >= 5
        ? 'Période prioritaire Yield : fermer les remises groupe, pousser les chambres familiales et conditionner à un séjour minimum 2 nuits.'
        : 'Surveiller le pickup par nationalité. Ajuster la grille BAR selon la vitesse de réservation.',
    };
  });
}
