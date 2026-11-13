/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utilitaire centralisé de filtrage chronologique ET géographique strict pour Flowtym Revenue Management.
 * Règles chronologiques :
 * 1. Date de référence par défaut = 12/11/2026 (2026-11-12).
 * 2. Sur la vue standard (mois en cours ou vue générale), exclure tout événement déjà terminé.
 * 3. Classer les événements en cours en premier ("En cours"), puis les événements à venir par ordre chronologique croissant.
 * 4. Lorsqu'un utilisateur sélectionne un mois passé via le sélecteur de période, afficher l'historique de ce mois.
 * 5. Lorsqu'un utilisateur sélectionne un mois futur, afficher les événements de cette période chronologiquement.
 *
 * Règles géographiques strictes (niveau données/requêtes) :
 * - La localisation de l'hôtel (GPS lat/lng, ville, territoire officiel) détermine le périmètre affiché.
 * - Un hôtel parisien ne reçoit jamais d'événements de Lyon, Marseille, Lille ou Nice (et inversement).
 * - Seules les communes limitrophes du bassin de l'hôtel et les distances Haversine conformes au rayon sont retenues.
 */

import { EventItem, Hotel } from '../types';
import {
  calculateHaversineDistanceKm,
  estimateTravelTimes,
  getTerritoryForCity,
  OFFICIAL_TERRITORIES_DIRECTORY,
  resolveEventCoordinates,
} from '../data/geoData';
import type { HotelEventWatchConfig } from '../services/rmsSettingsService';

export const CURRENT_REFERENCE_DATE = '2026-11-12';

export interface EventDateFilterOptions {
  selectedYear?: number | 'all';
  selectedMonth?: number | 'all'; // 0-indexed (0 = Janvier, 10 = Novembre, 11 = Décembre)
  referenceDate?: string; // Format YYYY-MM-DD (défaut: 2026-11-12)
  includePastInCurrentMonth?: boolean; // Par défaut false
}

export interface EventGeoMatchResult {
  isEligible: boolean;
  distanceKm: number;
  driveTimeMins: number;
  transitTimeMins: number;
  matchReason: string;
  rejectionReason?: string;
  territoryName: string;
  isEconomicException: boolean;
}

/**
 * Normalise une chaîne géographique pour comparaison robuste sans accents/casse.
 */
function normalizeGeoText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Calcule le rayon géographique effectif (en km) depuis la configuration Veille de l'hôtel.
 */
export function resolveEffectiveRadiusKm(eventWatchConfig?: Partial<HotelEventWatchConfig>): number {
  if (!eventWatchConfig) return 35;
  const main = eventWatchConfig.mainRadiusKm ?? 10;
  const extended = eventWatchConfig.extendedRadiusKm ?? 35;

  switch (eventWatchConfig.geoScope) {
    case 'intra_muros':
      return main;
    case 'metropole':
      return extended;
    case 'bassin_elargi':
      return Math.max(extended, 60);
    case 'custom':
    default:
      return extended;
  }
}

/**
 * Évalue si un événement appartient strictement à la zone de chalandise géographique de l'hôtel.
 * Effectue un contrôle multi-niveaux : pays, territoire officiel / communes limitrophes, coordonnées GPS (Haversine).
 */
export function evaluateEventGeographyForHotel(
  event: EventItem,
  hotel: Hotel,
  eventWatchConfig?: Partial<HotelEventWatchConfig>
): EventGeoMatchResult {
  const hotelTerritory = getTerritoryForCity(hotel.city);
  const maxRadiusKm = resolveEffectiveRadiusKm(eventWatchConfig);
  const strictTerritoryIsolation = eventWatchConfig?.strictTerritoryIsolation ?? true;
  const allowEconomicException = eventWatchConfig?.allowJustifiedEconomicException ?? false;
  const economicMinAttendance = eventWatchConfig?.economicExceptionMinAttendance ?? 100000;

  // 0. Sécurité pays
  if (
    event.country &&
    hotel.country &&
    normalizeGeoText(event.country) !== normalizeGeoText(hotel.country)
  ) {
    return {
      isEligible: false,
      distanceKm: 999,
      driveTimeMins: 999,
      transitTimeMins: 999,
      territoryName: hotelTerritory.territoryName,
      matchReason: '',
      rejectionReason: `Pays différent (${event.country} vs ${hotel.country})`,
      isEconomicException: false,
    };
  }

  const eventCityNorm = normalizeGeoText(event.city);
  const hotelCityNorm = normalizeGeoText(hotel.city);
  const territoryKeyNorm = normalizeGeoText(hotelTerritory.cityKey);

  // 1. Cas particulier des vacances scolaires : générées/converties pour la zone académique de l'hôtel
  if (event.category === 'vacances_scolaires') {
    const matchesHotelCity =
      eventCityNorm === hotelCityNorm ||
      eventCityNorm.includes(hotelCityNorm) ||
      hotelCityNorm.includes(eventCityNorm);
    if (!matchesHotelCity) {
      return {
        isEligible: false,
        distanceKm: 999,
        driveTimeMins: 999,
        transitTimeMins: 999,
        territoryName: hotelTerritory.territoryName,
        matchReason: '',
        rejectionReason: `Zone académique non rattachée à ${hotel.city}`,
        isEconomicException: false,
      };
    }
    return {
      isEligible: true,
      distanceKm: 0,
      driveTimeMins: 0,
      transitTimeMins: 0,
      territoryName: hotelTerritory.territoryName,
      matchReason: `Zone scolaire rattachée à ${hotel.city}`,
      isEconomicException: false,
    };
  }

  // 2. Résolution GPS de l'événement & distance Haversine
  const coords = resolveEventCoordinates({
    venueId: event.venueId,
    venueName: event.venueName,
    city: event.city,
  });

  const existingImpact = event.hotelImpacts?.[hotel.id];
  const distanceKm = coords
    ? calculateHaversineDistanceKm(hotel.lat, hotel.lng, coords.lat, coords.lng)
    : existingImpact?.distanceKm ?? (eventCityNorm === hotelCityNorm ? 2.5 : 450);

  const isSameCity = eventCityNorm === hotelCityNorm || eventCityNorm.includes(hotelCityNorm);
  const travelTimes = estimateTravelTimes(distanceKm, isSameCity);

  // 3. Vérification de l'appartenance au territoire officiel ou communes limitrophes
  const normalizedCommunes = hotelTerritory.keyCommunes.map((c) =>
    normalizeGeoText(c.replace(/\(\d+\)/g, '').split('/')[0])
  );
  const inHotelTerritoryCommune =
    isSameCity ||
    eventCityNorm === territoryKeyNorm ||
    normalizedCommunes.some(
      (commune) =>
        commune.length >= 3 &&
        (eventCityNorm.includes(commune) || commune.includes(eventCityNorm))
    ) ||
    (coords ? normalizeGeoText(coords.territoryKey) === territoryKeyNorm : false);

  // 4. Exclusion explicite des métropoles externes connues hors du territoire de l'hôtel
  const otherKnownCity = Object.values(OFFICIAL_TERRITORIES_DIRECTORY).find((terr) => {
    const tNorm = normalizeGeoText(terr.cityKey);
    if (tNorm === territoryKeyNorm) return false;
    if (eventCityNorm === tNorm || eventCityNorm.includes(tNorm)) return true;
    const tCommunes = terr.keyCommunes.map((c) =>
      normalizeGeoText(c.replace(/\(\d+\)/g, '').split('/')[0])
    );
    return tCommunes.some((c) => c.length >= 4 && eventCityNorm.includes(c));
  });

  if (otherKnownCity) {
    // Un événement d'une autre métropole (ex: Lyon vs Paris) est strictement exclu par défaut
    const canApplyEconomicException =
      allowEconomicException &&
      event.expectedAttendance >= economicMinAttendance &&
      event.scoreBreakdown.finalRMScore >= 88;

    if (!canApplyEconomicException) {
      return {
        isEligible: false,
        distanceKm,
        driveTimeMins: travelTimes.driveTimeMins,
        transitTimeMins: travelTimes.transitTimeMins,
        territoryName: hotelTerritory.territoryName,
        matchReason: '',
        rejectionReason: `Hors zone ${hotel.city} (bassin ${otherKnownCity.territoryName}, ${distanceKm} km)`,
        isEconomicException: false,
      };
    }

    return {
      isEligible: true,
      distanceKm,
      driveTimeMins: travelTimes.driveTimeMins,
      transitTimeMins: travelTimes.transitTimeMins,
      territoryName: hotelTerritory.territoryName,
      matchReason: `Exception économique justifiée (${event.expectedAttendance.toLocaleString('fr-FR')} pers., impact national)`,
      isEconomicException: true,
    };
  }

  // 5. Vérification du bounding box territorial + rayon Haversine
  const inBoundingBox = coords
    ? coords.lat >= hotelTerritory.bounds.south - 0.15 &&
      coords.lat <= hotelTerritory.bounds.north + 0.15 &&
      coords.lng >= hotelTerritory.bounds.west - 0.2 &&
      coords.lng <= hotelTerritory.bounds.east + 0.2
    : false;

  const withinRadius = distanceKm <= maxRadiusKm;

  if (strictTerritoryIsolation) {
    if ((inHotelTerritoryCommune || inBoundingBox) && withinRadius) {
      return {
        isEligible: true,
        distanceKm,
        driveTimeMins: travelTimes.driveTimeMins,
        transitTimeMins: travelTimes.transitTimeMins,
        territoryName: hotelTerritory.territoryName,
        matchReason: isSameCity
          ? `${hotel.city} (${distanceKm} km · ~${travelTimes.transitTimeMins} min)`
          : `Bassin ${hotelTerritory.territoryName} (${distanceKm} km)`,
        isEconomicException: false,
      };
    }

    return {
      isEligible: false,
      distanceKm,
      driveTimeMins: travelTimes.driveTimeMins,
      transitTimeMins: travelTimes.transitTimeMins,
      territoryName: hotelTerritory.territoryName,
      matchReason: '',
      rejectionReason: `Distance ${distanceKm} km > périmètre ${maxRadiusKm} km (${hotelTerritory.territoryName})`,
      isEconomicException: false,
    };
  }

  if (withinRadius || inHotelTerritoryCommune) {
    return {
      isEligible: true,
      distanceKm,
      driveTimeMins: travelTimes.driveTimeMins,
      transitTimeMins: travelTimes.transitTimeMins,
      territoryName: hotelTerritory.territoryName,
      matchReason: `Périmètre ${maxRadiusKm} km (${distanceKm} km)`,
      isEconomicException: false,
    };
  }

  return {
    isEligible: false,
    distanceKm,
    driveTimeMins: travelTimes.driveTimeMins,
    transitTimeMins: travelTimes.transitTimeMins,
    territoryName: hotelTerritory.territoryName,
    matchReason: '',
    rejectionReason: `Hors périmètre configuré (${distanceKm} km > ${maxRadiusKm} km)`,
    isEconomicException: false,
  };
}

/**
 * Filtre un flux d'événements au niveau des données selon la localisation exacte de l'hôtel,
 * et enrichit automatiquement `hotelImpacts[hotel.id]` avec la distance Haversine et le temps de trajet
 * lorsque ces informations ne sont pas pré-calculées.
 */
export function filterEventsByHotelGeography<T extends EventItem>(
  events: T[],
  hotel: Hotel,
  eventWatchConfig?: Partial<HotelEventWatchConfig>
): T[] {
  const results: T[] = [];

  for (const ev of events) {
    const geo = evaluateEventGeographyForHotel(ev, hotel, eventWatchConfig);
    if (!geo.isEligible) continue;

    // Enrichir à la volée les métriques de distance pour l'hôtel actif si manquantes
    const existingImpact = ev.hotelImpacts?.[hotel.id];
    if (existingImpact) {
      results.push(ev);
    } else {
      const compressionIndex = Math.min(10, Math.max(1, Math.round(ev.scoreBreakdown.finalRMScore / 10)));
      const estimatedBoost =
        ev.impactLevel === 'hyper' ? 38 : ev.impactLevel === 'critique' ? 28 : ev.impactLevel === 'modere' ? 14 : 5;
      results.push({
        ...ev,
        hotelImpacts: {
          ...ev.hotelImpacts,
          [hotel.id]: {
            hotelId: hotel.id,
            distanceKm: geo.distanceKm,
            distanceMins: geo.transitTimeMins,
            directDemandShare: geo.distanceKm <= 8 ? 32 : geo.distanceKm <= 20 ? 18 : 10,
            compressionIndex,
            recommendedAction:
              ev.scoreBreakdown.finalRMScore >= 75
                ? 'Ajuster BAR à la hausse et surveiller le pickup J-14'
                : 'Maintien compétitif et veille pickup',
            estimatedADRBoostPercent: estimatedBoost,
            minStayRecommended: ev.scoreBreakdown.finalRMScore >= 85 ? 2 : 1,
            stopSellSuggested: ev.scoreBreakdown.finalRMScore >= 90,
          },
        },
      });
    }
  }

  return results;
}

export function getEffectiveEndDate(event: Pick<EventItem, 'startDate' | 'endDate'>): string {
  return event.endDate && event.endDate >= event.startDate ? event.endDate : event.startDate;
}

/**
 * Vérifie si un événement est actuellement en cours à la date de référence.
 */
export function isEventOngoing(event: Pick<EventItem, 'startDate' | 'endDate'>, referenceDate: string = CURRENT_REFERENCE_DATE): boolean {
  const effectiveEnd = getEffectiveEndDate(event);
  return event.startDate <= referenceDate && effectiveEnd >= referenceDate;
}

/**
 * Vérifie si un événement est à venir par rapport à la date de référence.
 */
export function isEventUpcoming(event: Pick<EventItem, 'startDate'>, referenceDate: string = CURRENT_REFERENCE_DATE): boolean {
  return event.startDate > referenceDate;
}

/**
 * Vérifie si un événement est déjà terminé avant la date de référence.
 */
export function isEventPast(event: Pick<EventItem, 'startDate' | 'endDate'>, referenceDate: string = CURRENT_REFERENCE_DATE): boolean {
  const effectiveEnd = getEffectiveEndDate(event);
  return effectiveEnd < referenceDate;
}

export function isEventFinished(event: Pick<EventItem, 'startDate' | 'endDate'>, referenceDate: string = CURRENT_REFERENCE_DATE): boolean {
  return isEventPast(event, referenceDate);
}

export type EventChronologicalStatus = 'ongoing' | 'upcoming' | 'past';

export function getEventChronologicalStatus(
  event: Pick<EventItem, 'startDate' | 'endDate'>,
  referenceDate: string = CURRENT_REFERENCE_DATE
): EventChronologicalStatus {
  if (isEventOngoing(event, referenceDate)) return 'ongoing';
  if (isEventUpcoming(event, referenceDate)) return 'upcoming';
  return 'past';
}

export function getEventStatusBadgeConfig(
  event: Pick<EventItem, 'startDate' | 'endDate'>,
  referenceDate: string = CURRENT_REFERENCE_DATE
): {
  status: EventChronologicalStatus;
  label: string;
  subLabel?: string;
  badgeClass: string;
  dotClass: string;
} {
  const status = getEventChronologicalStatus(event, referenceDate);
  if (status === 'ongoing') {
    return {
      status,
      label: 'En cours',
      subLabel: `Jusqu'au ${getEffectiveEndDate(event).split('-').reverse().join('/')}`,
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 font-semibold',
      dotClass: 'bg-emerald-500',
    };
  }
  if (status === 'upcoming') {
    const refMs = new Date(referenceDate).getTime();
    const startMs = new Date(event.startDate).getTime();
    const daysAway = Math.max(1, Math.round((startMs - refMs) / (1000 * 60 * 60 * 24)));
    return {
      status,
      label: 'À venir',
      subLabel: `Dans ${daysAway} j`,
      badgeClass: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/70 font-medium',
      dotClass: 'bg-violet-500',
    };
  }
  return {
    status,
    label: 'Terminé',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium',
    dotClass: 'bg-slate-400',
  };
}

export function getMonthTemporalRelation(
  year: number,
  month: number,
  referenceDate: string = CURRENT_REFERENCE_DATE
): 'past' | 'current' | 'future' {
  const [refYearStr, refMonthStr] = referenceDate.split('-');
  const refYear = parseInt(refYearStr, 10);
  const refMonth = parseInt(refMonthStr, 10) - 1;
  if (year < refYear || (year === refYear && month < refMonth)) return 'past';
  if (year === refYear && month === refMonth) return 'current';
  return 'future';
}

/**
 * Vérifie si un événement chevauche une année et un mois donnés (mois 0-indexed).
 */
export function doesEventOverlapMonth(
  event: Pick<EventItem, 'startDate' | 'endDate'>,
  year: number,
  month: number
): boolean {
  const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const monthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
  const effectiveEnd = getEffectiveEndDate(event);

  return effectiveEnd >= monthStartStr && event.startDate <= monthEndStr;
}

/**
 * Trie chronologiquement une liste d'événements :
 * - En cours d'abord, puis à venir par startDate croissant.
 * - Si isPastPeriod=true, trie simplement par startDate croissant.
 */
export function sortEventsChronologically<T extends EventItem>(
  events: T[],
  referenceDate: string = CURRENT_REFERENCE_DATE,
  isPastPeriod: boolean = false
): T[] {
  return [...events].sort((a, b) => {
    if (isPastPeriod) {
      const dateDiff = a.startDate.localeCompare(b.startDate);
      if (dateDiff !== 0) return dateDiff;
      return b.scoreBreakdown.finalRMScore - a.scoreBreakdown.finalRMScore;
    }

    const aOngoing = isEventOngoing(a, referenceDate);
    const bOngoing = isEventOngoing(b, referenceDate);

    if (aOngoing && !bOngoing) return -1;
    if (!aOngoing && bOngoing) return 1;

    const startCompare = a.startDate.localeCompare(b.startDate);
    if (startCompare !== 0) return startCompare;

    const endCompare = getEffectiveEndDate(a).localeCompare(getEffectiveEndDate(b));
    if (endCompare !== 0) return endCompare;

    return b.scoreBreakdown.finalRMScore - a.scoreBreakdown.finalRMScore;
  });
}

/**
 * Filtre et trie chronologiquement les événements selon la logique métier Flowtym :
 * - Priorité 1 : Événements "En cours" (startDate <= refDate && endDate >= refDate)
 * - Priorité 2 : Événements "À venir" (startDate > refDate), triés par ordre chronologique croissant
 * - Exclut systématiquement les événements déjà terminés de l'affichage courant/futur,
 *   tout en autorisant leur consultation si l'utilisateur sélectionne explicitement un mois/année passé.
 */
export function filterEventsByDate<T extends EventItem>(
  events: T[],
  options: EventDateFilterOptions = {}
): T[] {
  const {
    selectedYear = 'all',
    selectedMonth = 'all',
    referenceDate = CURRENT_REFERENCE_DATE,
    includePastInCurrentMonth = false,
  } = options;

  const [refYearStr, refMonthStr] = referenceDate.split('-');
  const refYear = parseInt(refYearStr, 10);
  const refMonth = parseInt(refMonthStr, 10) - 1; // 0-indexed (10 pour Novembre)

  // Déterminer le contexte temporel du sélecteur
  let isPastPeriodSelected = false;

  if (selectedYear !== 'all' && selectedMonth !== 'all') {
    if (selectedYear < refYear || (selectedYear === refYear && selectedMonth < refMonth)) {
      isPastPeriodSelected = true;
    }
  } else if (selectedYear !== 'all' && selectedYear < refYear) {
    isPastPeriodSelected = true;
  }

  // 1. Filtrage par période et exclusion des événements terminés
  const filtered = events.filter((event) => {
    const effectiveEnd = getEffectiveEndDate(event);
    // Filtrage année / mois si sélectionné
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
      if (!doesEventOverlapMonth(event, selectedYear, selectedMonth)) {
        return false;
      }
    } else if (selectedYear !== 'all') {
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;
      if (effectiveEnd < yearStart || event.startDate > yearEnd) {
        return false;
      }
    } else if (selectedMonth !== 'all') {
      const startMonth = parseInt(event.startDate.split('-')[1], 10) - 1;
      const endMonth = parseInt(effectiveEnd.split('-')[1], 10) - 1;
      if (startMonth !== selectedMonth && endMonth !== selectedMonth) {
        return false;
      }
    }

    // Exclusion stricte des événements passés pour la vue standard ou le mois en cours
    if (!isPastPeriodSelected && !includePastInCurrentMonth) {
      if (isEventFinished(event, referenceDate)) {
        return false;
      }
    }

    return true;
  });

  // 2. Tri strict : En cours d'abord, puis à venir par ordre chronologique croissant
  return sortEventsChronologically(filtered, referenceDate, isPastPeriodSelected);
}
