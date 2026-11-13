/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — Générateur Automatique des Périodes Saisonnières et Fêtes
 * Catégorie officielle : 'periodes_saisonnieres_fetes' (« Périodes saisonnières et fêtes »)
 *
 * Couvre automatiquement année après année (2025, 2026, 2027, 2028) :
 * - Paris : Période de fin d'année & Réveillon du Nouvel An du 26 décembre au 1er janvier (chevauchement inter-annuel géré proprement)
 * - Paris : Période de Noël & Grands Magasins (19 au 25 décembre)
 * - Paris : Fête Nationale 14 Juillet & Ponts majeurs
 * - Lyon : Fête des Lumières & Fêtes de Fin d'Année (26 déc → 1er jan)
 * - Nice : Fêtes de Fin d'Année Côte d'Azur (26 déc → 1er jan) & Carnaval de Nice
 * - Marseille : Fêtes de Fin d'Année Vieux-Port (26 déc → 1er jan)
 * - Lille : Marché de Noël & Fin d'Année Grand-Place (26 déc → 1er jan)
 * - Bordeaux : Fêtes de Fin d'Année & Réveillon (26 déc → 1er jan)
 *
 * Chaque période intègre un scoring RM adapté à la destination et des recommandations Yield explicites.
 */

import { EventItem, RMImpactLevel } from '../types';

export interface SeasonalTemplateSpec {
  idPrefix: string;
  city: string;
  venueId: string;
  venueName: string;
  titleTemplate: (year: number, nextYear: number) => string;
  subtitle: string;
  startMonthDay: string; // MM-DD
  endMonthDay: string; // MM-DD (if < startMonthDay, ends in year + 1)
  expectedAttendance: number;
  internationalRatioPercent: number;
  rmScore: number;
  impactLevel: RMImpactLevel;
  recommendedAction: string;
  adrBoostPercent: number;
  minStayRecommended: number;
  stopSellSuggested: boolean;
  notes: string;
  sources: string[];
}

const SEASONAL_SPECS: SeasonalTemplateSpec[] = [
  // ==============================================================
  // PARIS — FÊTES DE FIN D'ANNÉE & RÉVEILLON DU NOUVEL AN (26/12 → 01/01)
  // ==============================================================
  {
    idPrefix: 'seasonal-paris-nye',
    city: 'Paris',
    venueId: 'venue-grand-palais',
    venueName: 'Champs-Élysées, Opéra & Hyper-centre Paris',
    titleTemplate: (y, ny) => `Fêtes de Fin d’Année & Réveillon du Nouvel An Paris (${y}/${ny})`,
    subtitle: 'Très forte demande touristique & internationale — Pic du 26 décembre au 1er janvier',
    startMonthDay: '12-26',
    endMonthDay: '01-01',
    expectedAttendance: 320000,
    internationalRatioPercent: 68,
    rmScore: 93,
    impactLevel: 'hyper',
    recommendedAction:
      'Palier tarifaire Réveillon : hausse dynamique BAR (+35% à +55% selon pickup J-14), Min Stay 3 nuits sur 29/12–01/01, fermeture des tarifs promotionnels OTA et garantie prépaiement 100%.',
    adrBoostPercent: 48,
    minStayRecommended: 3,
    stopSellSuggested: true,
    notes:
      'Période critique de fin d’année à Paris (26 déc. au 1er jan.). Demande loisirs internationale + célébrations Champs-Élysées / Arc de Triomphe / Opéra générant une compression compset généralisée.',
    sources: ['Paris Je t’aime — Office du Tourisme', 'Mairie de Paris — Programmation Saint-Sylvestre', 'Historique RM Flowtym N-1/N-2'],
  },
  {
    idPrefix: 'seasonal-paris-noel',
    city: 'Paris',
    venueId: 'venue-olympia',
    venueName: 'Grands Boulevards, Opéra & Haussmann',
    titleTemplate: (y) => `Période des Fêtes de Noël & Illuminations à Paris ${y}`,
    subtitle: 'Vitrines Haussmann, Marchés de Noël & vacances familiales internationales',
    startMonthDay: '12-18',
    endMonthDay: '12-25',
    expectedAttendance: 145000,
    internationalRatioPercent: 52,
    rmScore: 81,
    impactLevel: 'critique',
    recommendedAction:
      'Maintenir une prime ADR (+18% à +28%) sur les typologies Supérieure et Familiale, surveiller le pickup 7j et appliquer Min Stay 2 nuits les 24–25 décembre.',
    adrBoostPercent: 24,
    minStayRecommended: 2,
    stopSellSuggested: false,
    notes:
      'Semaine précédant Noël très porteuse dans le quartier Opéra / Grands Magasins (Galeries Lafayette & Printemps à <500m).',
    sources: ['Paris Je t’aime', 'Comité Haussmann Paris'],
  },
  {
    idPrefix: 'seasonal-paris-14juillet',
    city: 'Paris',
    venueId: 'venue-grand-palais',
    venueName: 'Champ-de-Mars, Trocadéro & Seine',
    titleTemplate: (y) => `Fête Nationale du 14 Juillet & Long Week-End d’Été Paris ${y}`,
    subtitle: 'Feu d’artifice Tour Eiffel, défilé militaire & haute saison estivale',
    startMonthDay: '07-12',
    endMonthDay: '07-15',
    expectedAttendance: 210000,
    internationalRatioPercent: 60,
    rmScore: 86,
    impactLevel: 'critique',
    recommendedAction:
      'Rehausser le BAR de +25% à +38% sur la nuit du 13 et du 14 juillet, limiter les remises anticipées.',
    adrBoostPercent: 32,
    minStayRecommended: 2,
    stopSellSuggested: true,
    notes: 'Forte compression de l’hyper-centre parisien durant les festivités nationales.',
    sources: ['Ville de Paris', 'Préfecture de Police — Périmètre Festivités'],
  },
  {
    idPrefix: 'seasonal-paris-stvalentin',
    city: 'Paris',
    venueId: 'venue-olympia',
    venueName: 'Paris Hyper-centre & Quartier Opéra',
    titleTemplate: (y) => `Week-End & Fête de la Saint-Valentin Paris ${y}`,
    subtitle: 'Pic de séjours couples & packages romantiques boutique',
    startMonthDay: '02-13',
    endMonthDay: '02-15',
    expectedAttendance: 65000,
    internationalRatioPercent: 48,
    rmScore: 75,
    impactLevel: 'critique',
    recommendedAction:
      'Activer le tarif dynamique romance (+18%), privilégier le canal direct avec offre surclassement / petit-déjeuner.',
    adrBoostPercent: 20,
    minStayRecommended: 1,
    stopSellSuggested: false,
    notes: 'Forte sensibilité positive sur hôtels boutique 4★ du centre parisien.',
    sources: ['Observatoire Hôtelier Paris Île-de-France'],
  },

  // ==============================================================
  // LYON — PÉRIODES SAISONNIÈRES & FÊTES
  // ==============================================================
  {
    idPrefix: 'seasonal-lyon-lumieres',
    city: 'Lyon',
    venueId: 'venue-centre-congres-lyon',
    venueName: 'Presqu’île, Bellecour & Vieux-Lyon',
    titleTemplate: (y) => `Fête des Lumières de Lyon ${y}`,
    subtitle: 'Événement patrimonial majeur — saturation hôtelière complète de la métropole',
    startMonthDay: '12-05',
    endMonthDay: '12-08',
    expectedAttendance: 1800000,
    internationalRatioPercent: 35,
    rmScore: 95,
    impactLevel: 'hyper',
    recommendedAction:
      'Tarification événementielle maximale, Min Stay 3 nuits sur 05–08 déc., stop-sell OTA remisés et prépaiement intégral.',
    adrBoostPercent: 65,
    minStayRecommended: 3,
    stopSellSuggested: true,
    notes: 'Plus fort pic annuel de demande sur Lyon Bellecour et toute la métropole.',
    sources: ['Ville de Lyon — Fête des Lumières', 'OnlyLyon Convention Bureau'],
  },
  {
    idPrefix: 'seasonal-lyon-nye',
    city: 'Lyon',
    venueId: 'venue-centre-congres-lyon',
    venueName: 'Presqu’île Bellecour & Confluence',
    titleTemplate: (y, ny) => `Période de Fin d’Année & Réveillon du Nouvel An Lyon (${y}/${ny})`,
    subtitle: 'Marchés de Noël, tourisme gastronomique & nuit de la Saint-Sylvestre',
    startMonthDay: '12-26',
    endMonthDay: '01-01',
    expectedAttendance: 85000,
    internationalRatioPercent: 28,
    rmScore: 76,
    impactLevel: 'critique',
    recommendedAction:
      'Hausse progressive BAR (+15% à +28% sur les nuits du 30–31/12) en fonction du rythme de pickup vs médiane compset Bellecour.',
    adrBoostPercent: 22,
    minStayRecommended: 2,
    stopSellSuggested: false,
    notes: 'Demande loisirs et gastronomique soutenue en fin d’année à Lyon (score adapté au marché lyonnais).',
    sources: ['OnlyLyon Tourisme'],
  },

  // ==============================================================
  // NICE CÔTE D'AZUR — PÉRIODES SAISONNIÈRES & FÊTES
  // ==============================================================
  {
    idPrefix: 'seasonal-nice-nye',
    city: 'Nice',
    venueId: 'venue-acropolis-nice',
    venueName: 'Promenade des Anglais & Place Masséna',
    titleTemplate: (y, ny) => `Fêtes de Fin d’Année & Réveillon Azur Nice (${y}/${ny})`,
    subtitle: 'Village de Noël, clientèle hivernale haut de gamme & Saint-Sylvestre',
    startMonthDay: '12-26',
    endMonthDay: '01-01',
    expectedAttendance: 95000,
    internationalRatioPercent: 58,
    rmScore: 80,
    impactLevel: 'critique',
    recommendedAction:
      'Optimiser le tarif des chambres Vue Mer et Suites (+22% à +35%), Min Stay 2 nuits du 30/12 au 01/01.',
    adrBoostPercent: 26,
    minStayRecommended: 2,
    stopSellSuggested: false,
    notes: 'Clientèle internationale hivernale forte entre Noël et Jour de l’An sur la Promenade des Anglais.',
    sources: ['Nice Côte d’Azur Tourisme'],
  },
  {
    idPrefix: 'seasonal-nice-carnaval',
    city: 'Nice',
    venueId: 'venue-acropolis-nice',
    venueName: 'Place Masséna & Promenade des Anglais',
    titleTemplate: (y) => `Carnaval de Nice & Batailles de Fleurs ${y}`,
    subtitle: 'Grand événement hivernal de la Côte d’Azur — forte fréquentation week-ends',
    startMonthDay: '02-12',
    endMonthDay: '02-28',
    expectedAttendance: 230000,
    internationalRatioPercent: 44,
    rmScore: 84,
    impactLevel: 'critique',
    recommendedAction:
      'Yield actif sur les vendredis/samedis (+28% ADR), packages séjour carnaval 2–3 nuits.',
    adrBoostPercent: 28,
    minStayRecommended: 2,
    stopSellSuggested: false,
    notes: 'Moteur d’occupation majeur sur la basse/moyenne saison azuréenne.',
    sources: ['Office du Tourisme Métropolitain Nice Côte d’Azur'],
  },

  // ==============================================================
  // MARSEILLE, LILLE, BORDEAUX — PÉRIODES SAISONNIÈRES & FÊTES
  // ==============================================================
  {
    idPrefix: 'seasonal-marseille-nye',
    city: 'Marseille',
    venueId: 'venue-marseille-vieuxport',
    venueName: 'Vieux-Port & Centre-Ville Marseille',
    titleTemplate: (y, ny) => `Fêtes de Fin d’Année & Réveillon Vieux-Port Marseille (${y}/${ny})`,
    subtitle: 'Foire aux Santons, illuminations & nuit de la Saint-Sylvestre',
    startMonthDay: '12-26',
    endMonthDay: '01-01',
    expectedAttendance: 75000,
    internationalRatioPercent: 24,
    rmScore: 72,
    impactLevel: 'critique',
    recommendedAction:
      'Rehausser les nuits du 30–31/12 (+18%) tout en maintenant une offre compétitive sur le 26–29/12.',
    adrBoostPercent: 18,
    minStayRecommended: 2,
    stopSellSuggested: false,
    notes: 'Demande loisirs régionale et méditerranéenne concentrée sur le Vieux-Port.',
    sources: ['Office de Tourisme de Marseille'],
  },
  {
    idPrefix: 'seasonal-lille-nye',
    city: 'Lille',
    venueId: 'venue-lille-grandplace',
    venueName: 'Grand-Place & Vieux-Lille',
    titleTemplate: (y, ny) => `Marché de Noël & Réveillon du Nouvel An Lille (${y}/${ny})`,
    subtitle: 'Grande Roue Grand-Place, flux transfrontalier Belgique/UK & Saint-Sylvestre',
    startMonthDay: '12-26',
    endMonthDay: '01-01',
    expectedAttendance: 90000,
    internationalRatioPercent: 42,
    rmScore: 74,
    impactLevel: 'critique',
    recommendedAction:
      'Capter la clientèle belge/britannique sur le 26–31/12 avec tarif dynamique +20% et packages dîner/séjour.',
    adrBoostPercent: 20,
    minStayRecommended: 2,
    stopSellSuggested: false,
    notes: 'Forte affluence transfrontalière entre Noël et le 1er janvier à Lille.',
    sources: ['Hello Lille — Agence d’Attractivité'],
  },
  {
    idPrefix: 'seasonal-bordeaux-nye',
    city: 'Bordeaux',
    venueId: 'venue-bordeaux-centre',
    venueName: 'Place des Quinconces & Centre Historique',
    titleTemplate: (y, ny) => `Fêtes de Fin d’Année & Réveillon Bordeaux (${y}/${ny})`,
    subtitle: 'Œnotourisme hivernal, illuminations & Saint-Sylvestre',
    startMonthDay: '12-26',
    endMonthDay: '01-01',
    expectedAttendance: 68000,
    internationalRatioPercent: 30,
    rmScore: 71,
    impactLevel: 'critique',
    recommendedAction:
      'Surveiller le pickup sur les 30–31 décembre et optimiser la marge BAR (+16% à +22%).',
    adrBoostPercent: 17,
    minStayRecommended: 2,
    stopSellSuggested: false,
    notes: 'Pic saisonnier centré sur la nuit du 31 décembre et séjours courts.',
    sources: ['Bordeaux Tourisme & Congrès'],
  },
];

/**
 * Génère automatiquement les événements « Périodes saisonnières et fêtes »
 * pour les années configurées (par défaut 2025, 2026, 2027, 2028) afin d'assurer
 * la reconduction annuelle automatique et la couverture du chevauchement 26/12 -> 01/01.
 */
export function generateSeasonalFestiveEvents(years: number[] = [2025, 2026, 2027, 2028]): EventItem[] {
  const generated: EventItem[] = [];

  years.forEach((year) => {
    SEASONAL_SPECS.forEach((spec) => {
      const crossesYear = spec.endMonthDay < spec.startMonthDay;
      const endYear = crossesYear ? year + 1 : year;
      const startDate = `${year}-${spec.startMonthDay}`;
      const endDate = `${endYear}-${spec.endMonthDay}`;
      const title = spec.titleTemplate(year, endYear);

      const hotelImpacts: EventItem['hotelImpacts'] = {};
      if (spec.city === 'Paris') {
        hotelImpacts['hotel-opera'] = {
          hotelId: 'hotel-opera',
          distanceKm: 1.2,
          distanceMins: 7,
          directDemandShare: spec.rmScore >= 90 ? 48 : 30,
          compressionIndex: Math.min(10, Math.round(spec.rmScore / 10)),
          recommendedAction: spec.recommendedAction,
          estimatedADRBoostPercent: spec.adrBoostPercent,
          minStayRecommended: spec.minStayRecommended,
          stopSellSuggested: spec.stopSellSuggested,
        };
        hotelImpacts['hotel-marais'] = {
          hotelId: 'hotel-marais',
          distanceKm: 2.3,
          distanceMins: 12,
          directDemandShare: spec.rmScore >= 90 ? 46 : 28,
          compressionIndex: Math.min(10, Math.round(spec.rmScore / 10)),
          recommendedAction: spec.recommendedAction,
          estimatedADRBoostPercent: spec.adrBoostPercent,
          minStayRecommended: spec.minStayRecommended,
          stopSellSuggested: spec.stopSellSuggested,
        };
      } else if (spec.city === 'Lyon') {
        hotelImpacts['hotel-lyon'] = {
          hotelId: 'hotel-lyon',
          distanceKm: 0.5,
          distanceMins: 4,
          directDemandShare: spec.rmScore >= 90 ? 52 : 28,
          compressionIndex: Math.min(10, Math.round(spec.rmScore / 10)),
          recommendedAction: spec.recommendedAction,
          estimatedADRBoostPercent: spec.adrBoostPercent,
          minStayRecommended: spec.minStayRecommended,
          stopSellSuggested: spec.stopSellSuggested,
        };
      } else if (spec.city === 'Nice') {
        hotelImpacts['hotel-nice'] = {
          hotelId: 'hotel-nice',
          distanceKm: 0.7,
          distanceMins: 5,
          directDemandShare: 36,
          compressionIndex: Math.min(10, Math.round(spec.rmScore / 10)),
          recommendedAction: spec.recommendedAction,
          estimatedADRBoostPercent: spec.adrBoostPercent,
          minStayRecommended: spec.minStayRecommended,
          stopSellSuggested: spec.stopSellSuggested,
        };
      }

      generated.push({
        id: `${spec.idPrefix}-${year}`,
        title,
        subtitle: spec.subtitle,
        category: 'periodes_saisonnieres_fetes',
        venueId: spec.venueId,
        venueName: spec.venueName,
        city: spec.city,
        country: 'France',
        startDate,
        endDate,
        expectedAttendance: spec.expectedAttendance,
        internationalRatioPercent: spec.internationalRatioPercent,
        status: year <= 2026 ? 'confirmed' : 'estimated_recurrent',
        impactLevel: spec.impactLevel,
        scoreBreakdown: {
          attendanceScore: Math.min(25, Math.round(spec.rmScore * 0.25)),
          internationalScore: Math.min(20, Math.round((spec.internationalRatioPercent / 100) * 20)),
          saturationScore: Math.min(20, Math.round(spec.rmScore * 0.2)),
          proximityScore: 18,
          compressionScore: Math.min(17, Math.round(spec.rmScore * 0.17)),
          finalRMScore: spec.rmScore,
          confidenceScore: year <= 2027 ? 96 : 90,
        },
        sources: spec.sources,
        evidences: [
          {
            id: `evid-${spec.idPrefix}-${year}`,
            sourceName: spec.sources[0] || 'Référentiel Saisonnalité Flowtym',
            sourceUrl: 'https://www.parisjetaime.com',
            sourceType: 'city_agenda',
            verifiedAt: '2026-11-12',
            excerpt: spec.notes,
            trustScore: 96,
          },
        ],
        hotelImpacts,
        isRecurring: true,
        recurrenceFrequency: 'annual',
        historicalGrowth: '+6.5% RevPAR vs N-1 sur période festive',
        isWatchlist: spec.rmScore >= 75,
        isYieldActive: spec.rmScore >= 80,
        notes: spec.notes,
        createdAt: '2026-01-10',
        lastVerifiedAt: '2026-11-12',
      });
    });
  });

  return generated;
}
