/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchoolHolidayPeriod } from '../types/schoolHolidays';
import { EventItem, Hotel, RMImpactLevel } from '../types';
import { calculateSchoolHolidayImpactScore } from './schoolHolidaysImpactEngine';

/**
 * Génère automatiquement les événements récurrents de catégorie « Périodes saisonnières et fêtes »
 * pour les hôtels parisiens (notamment Réveillon & Fêtes de Fin d’Année du 26 décembre au 1er janvier).
 */
export function generateRecurringSeasonalFestiveEventsForHotel(
  years: number[],
  hotel: Hotel
): EventItem[] {
  const isParisHotel =
    (hotel.city || '').toLowerCase().includes('paris') ||
    hotel.id === 'hotel-opera' ||
    hotel.id === 'hotel-marais';

  if (!isParisHotel) return [];

  const uniqueYears = Array.from(new Set(years)).sort((a, b) => a - b);
  const generated: EventItem[] = [];

  for (const year of uniqueYears) {
    const nextYear = year + 1;
    const nyeId = `seasonal-paris-nye-${year}`;
    const noelId = `seasonal-paris-noel-${year}`;

    generated.push({
      id: nyeId,
      title: `Fêtes de Fin d’Année & Réveillon du Nouvel An Paris (${year}/${nextYear})`,
      subtitle: 'Très forte demande touristique & internationale — Pic du 26 décembre au 1er janvier',
      category: 'periodes_saisonnieres_fetes',
      venueId: 'venue-grand-palais',
      venueName: 'Champs-Élysées, Opéra & Hyper-centre Paris',
      city: 'Paris',
      country: 'France',
      startDate: `${year}-12-26`,
      endDate: `${nextYear}-01-01`,
      expectedAttendance: 320000,
      internationalRatioPercent: 68,
      status: 'confirmed',
      impactLevel: 'hyper',
      scoreBreakdown: {
        attendanceScore: 19,
        internationalScore: 18,
        saturationScore: 19,
        proximityScore: 18,
        compressionScore: 19,
        finalRMScore: 93,
        confidenceScore: 98,
      },
      sources: [
        'Paris Je t’aime — Office du Tourisme',
        'Mairie de Paris — Programmation Saint-Sylvestre',
        'Historique RM Flowtym N-1/N-2',
      ],
      evidences: [
        {
          id: `evid-${nyeId}`,
          sourceName: 'Calendrier Saisonnier Officiel Paris',
          sourceUrl: 'https://parisjetaime.com',
          sourceType: 'city_agenda',
          verifiedAt: `${year}-11-01`,
          excerpt:
            'Période critique de fin d’année à Paris (26 déc. au 1er jan.). Demande loisirs internationale + célébrations Champs-Élysées / Opéra générant une compression compset généralisée.',
          trustScore: 98,
        },
      ],
      hotelImpacts: {
        [hotel.id]: {
          hotelId: hotel.id,
          distanceKm: 1.4,
          distanceMins: 9,
          directDemandShare: 46,
          compressionIndex: 10,
          recommendedAction:
            'Palier tarifaire Réveillon : hausse dynamique BAR (+35% à +55% selon pickup J-14), Min Stay 3 nuits sur 29/12–01/01, fermeture des tarifs promotionnels OTA et garantie prépaiement 100%.',
          estimatedADRBoostPercent: 48,
          minStayRecommended: 3,
          stopSellSuggested: true,
        },
      },
      isRecurring: true,
      recurrenceFrequency: 'annual',
      isWatchlist: true,
      notes:
        'Événement récurrent majeur généré automatiquement pour les hôtels parisiens (26 déc. – 1er jan.). Chevauchement annuel Décembre / Janvier géré automatiquement.',
      createdAt: `${year}-01-01`,
      lastVerifiedAt: '2026-11-12',
    });

    generated.push({
      id: noelId,
      title: `Période des Fêtes de Noël & Illuminations à Paris ${year}`,
      subtitle: 'Vitrines Haussmann, Marchés de Noël & vacances familiales internationales',
      category: 'periodes_saisonnieres_fetes',
      venueId: 'venue-olympia',
      venueName: 'Grands Boulevards, Opéra & Haussmann',
      city: 'Paris',
      country: 'France',
      startDate: `${year}-12-18`,
      endDate: `${year}-12-25`,
      expectedAttendance: 145000,
      internationalRatioPercent: 52,
      status: 'confirmed',
      impactLevel: 'critique',
      scoreBreakdown: {
        attendanceScore: 16,
        internationalScore: 15,
        saturationScore: 16,
        proximityScore: 17,
        compressionScore: 17,
        finalRMScore: 81,
        confidenceScore: 96,
      },
      sources: ['Paris Je t’aime', 'Comité Haussmann Paris'],
      evidences: [
        {
          id: `evid-${noelId}`,
          sourceName: 'Comité Haussmann Paris',
          sourceUrl: 'https://parisjetaime.com',
          sourceType: 'city_agenda',
          verifiedAt: `${year}-11-01`,
          excerpt:
            'Semaine précédant Noël très porteuse dans le quartier Opéra / Grands Magasins.',
          trustScore: 95,
        },
      ],
      hotelImpacts: {
        [hotel.id]: {
          hotelId: hotel.id,
          distanceKm: 0.9,
          distanceMins: 6,
          directDemandShare: 36,
          compressionIndex: 8,
          recommendedAction:
            'Maintenir une prime ADR (+18% à +28%) sur les typologies Supérieure et Familiale, surveiller le pickup 7j et appliquer Min Stay 2 nuits les 24–25 décembre.',
          estimatedADRBoostPercent: 24,
          minStayRecommended: 2,
          stopSellSuggested: false,
        },
      },
      isRecurring: true,
      recurrenceFrequency: 'annual',
      isWatchlist: true,
      notes: 'Période saisonnière récurrente de Noël générée automatiquement pour Paris.',
      createdAt: `${year}-01-01`,
      lastVerifiedAt: '2026-11-12',
    });
  }

  return generated;
}

/**
 * Convertit les vacances scolaires officielles en EventItem de catégorie 'vacances_scolaires'
 * et génère automatiquement les événements majeurs de « Périodes saisonnières et fêtes »
 * (dont le Réveillon & fêtes de fin d'année du 26 déc. au 1er jan. pour les hôtels parisiens).
 */
export function convertSchoolHolidaysToEventItems(
  holidays: SchoolHolidayPeriod[],
  hotel: Hotel
): EventItem[] {
  const holidayEvents: EventItem[] = holidays.map((h) => {
    const analysis = calculateSchoolHolidayImpactScore(h, hotel, holidays);

    let impactLevel: RMImpactLevel = 'modere';
    if (analysis.classification === 'vert') impactLevel = 'critique';
    else if (analysis.classification === 'rouge') impactLevel = 'faible';

    return {
      id: `holiday-ev-${h.id}`,
      title: `${h.name} (${h.countryName})`,
      subtitle: `${h.flag} Vacances scolaires · ${h.durationDays} jours · Score RM: ${analysis.score}/100`,
      category: 'vacances_scolaires',
      venueId: `venue-holiday-${h.countryCode.toLowerCase()}`,
      venueName: `Marché émetteur ${h.countryName} ${h.zoneLabel ? `(${h.zoneLabel})` : ''}`,
      city: hotel.city,
      country: h.countryName,
      startDate: h.startDate,
      endDate: h.endDate,
      expectedAttendance: Math.round(analysis.hotelFamilyCapacityShare * 400),
      internationalRatioPercent: h.countryCode === 'FR' ? 10 : 85,
      status: h.isOfficial ? 'confirmed' : 'estimated_recurrent',
      impactLevel,
      scoreBreakdown: {
        attendanceScore: Math.round(analysis.scoreBreakdown.feederMarketScore * 0.9),
        internationalScore: Math.round(analysis.scoreBreakdown.proximityScore * 1.1),
        saturationScore: Math.round(analysis.scoreBreakdown.countryOverlapScore * 0.9),
        proximityScore: Math.round(analysis.scoreBreakdown.roomTypologyScore * 0.8),
        compressionScore: Math.round(analysis.scoreBreakdown.historicalPaceScore * 0.9),
        finalRMScore: analysis.score,
        confidenceScore: h.isOfficial ? 96 : 85,
      },
      sources: [h.officialSource],
      evidences: [
        {
          id: `evid-hol-${h.id}`,
          sourceName: h.officialSource,
          sourceUrl: h.sourceUrl,
          sourceType: 'official_organizer',
          verifiedAt: h.lastSync,
          excerpt: `Calendrier officiel des vacances scolaires du ${h.countryName}. ${h.notes || ''}`,
          trustScore: 98,
        },
      ],
      hotelImpacts: {
        [hotel.id]: {
          hotelId: hotel.id,
          distanceKm: 0,
          distanceMins: 0,
          directDemandShare: Math.round(analysis.scoreBreakdown.roomTypologyScore * 1.2),
          compressionIndex: Math.min(10, Math.round(analysis.score / 10)),
          recommendedAction: analysis.recommendation,
          estimatedADRBoostPercent: analysis.classification === 'vert' ? 25 : analysis.classification === 'orange' ? 12 : 0,
          minStayRecommended: analysis.overlappingCountries.length >= 3 ? 2 : 1,
        },
      },
      isRecurring: true,
      recurrenceFrequency: 'annual',
      createdAt: '2026-01-01',
      lastVerifiedAt: h.lastSync,
    };
  });

  const yearsInHolidays = holidays
    .map((h) => parseInt(h.startDate.slice(0, 4), 10))
    .filter((y) => !Number.isNaN(y));
  const targetYears = yearsInHolidays.length > 0 ? yearsInHolidays : [2026];
  const seasonalFestiveEvents = generateRecurringSeasonalFestiveEventsForHotel(targetYears, hotel);

  return [...holidayEvents, ...seasonalFestiveEvents];
}
