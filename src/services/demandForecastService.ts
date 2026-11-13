/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @deprecated LEGACY BROWSER / DEMO SERVICE.
 * Not the authoritative backend and not approved for live Revenue Management decisions.
 * Live persistence and decisions must use the authenticated Supabase Revenue API
 * (src/services/revenueApiClient.ts) and its RLS-protected database contracts.
 */

import { EventItem, Hotel, DemandForecastItem, StandardDemandLevel, ForecastDriver } from '../types';
import { isEventGeographicallyRelevant } from '../utils/marketDemand';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/**
 * Génère les prévisions de demande quotidiennes sur une période
 */
export function generateDemandForecast(
  hotel: Hotel,
  events: EventItem[],
  year: number,
  month: number // 0-indexed (e.g. 9 = October)
): DemandForecastItem[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const forecasts: DemandForecastItem[] = [];

  // Filtrer les événements géographiquement pertinents pour cet hôtel
  const relevantEvents = events.filter((e) => isEventGeographicallyRelevant(e, hotel));

  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${mStr}-${dStr}`;

    const dateObj = new Date(year, month, day);
    const dayOfWeekFr = DAYS_FR[dateObj.getDay()];

    // Événements actifs ce jour
    const activeEvents = relevantEvents.filter((e) => e.startDate <= dateStr && e.endDate >= dateStr);

    const drivers: ForecastDriver[] = activeEvents.map((e) => {
      const imp = e.hotelImpacts?.[hotel.id];
      return {
        name: e.title,
        category: e.category,
        expectedAttendance: e.expectedAttendance,
        impactScore: e.scoreBreakdown?.finalRMScore ?? 50,
        distanceKm: imp?.distanceKm ?? 3.5,
        venueName: e.venueName,
        status: e.status,
      };
    });

    // Score de pression du marché (0-100)
    let marketPressure = 15;
    const totalPax = activeEvents.reduce((acc, e) => acc + (e.expectedAttendance || 0), 0);
    const maxScore = activeEvents.length > 0 ? Math.max(...activeEvents.map((e) => e.scoreBreakdown?.finalRMScore ?? 50)) : 0;

    if (activeEvents.length > 0) {
      marketPressure = Math.min(100, Math.round(maxScore * 0.65 + Math.min(totalPax / 8000, 35)));
    } else {
      // Demande organique loisir le weekend à Paris
      const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6;
      marketPressure = isWeekend ? 38 : 22;
    }

    // Qualification du niveau de demande (faible, normal, élevé, exceptionnel)
    let demandLevel: StandardDemandLevel = 'faible';
    if (marketPressure >= 75 || maxScore >= 80 || totalPax >= 80000) {
      demandLevel = marketPressure >= 88 ? 'exceptionnel' : 'eleve';
    } else if (marketPressure >= 38 || activeEvents.length >= 1) {
      demandLevel = 'normal';
    } else {
      demandLevel = 'faible';
    }

    // Indice de confiance prédictive (0 - 100%)
    let confidenceScore = 88;
    if (activeEvents.length > 0) {
      const hasOfficial = activeEvents.some((e) => e.evidences && e.evidences.some((ev) => ev.sourceType === 'official_organizer'));
      confidenceScore = hasOfficial ? 96 : 91;
    }

    // Fourchette d'occupation prévisionnelle
    let expectedOccupancyRange: [number, number];
    let adrMultiplier = 1.0;

    switch (demandLevel) {
      case 'exceptionnel':
        expectedOccupancyRange = [92, 98];
        adrMultiplier = 1.38;
        break;
      case 'eleve':
        expectedOccupancyRange = [84, 93];
        adrMultiplier = 1.25;
        break;
      case 'normal':
        expectedOccupancyRange = [68, 82];
        adrMultiplier = 1.08;
        break;
      case 'faible':
      default:
        expectedOccupancyRange = [45, 64];
        adrMultiplier = 0.95;
        break;
    }

    const baseADR = hotel.baseADR || 260;
    const recommendedADR = Math.round(baseADR * adrMultiplier);
    const avgOcc = (expectedOccupancyRange[0] + expectedOccupancyRange[1]) / 2 / 100;
    const projectedRevPAR = Math.round(recommendedADR * avgOcc);

    // Opportunité de revenus supplémentaires vs ADR de base à taux normal
    const organicRevPAR = Math.round(baseADR * 0.72);
    const deltaRevPAR = Math.max(0, projectedRevPAR - organicRevPAR);
    const revenueOpportunityEur = Math.round(deltaRevPAR * (hotel.roomCount || 45));

    forecasts.push({
      dateStr,
      dayOfWeekFr,
      demandLevel,
      confidenceScore,
      expectedOccupancyRange,
      projectedRevPAR,
      baseADR,
      recommendedADR,
      revenueOpportunityEur,
      marketPressureScore: marketPressure,
      drivers,
      isPmsIntegrated: false,
      pmsPickupStatus: 'not_connected',
      pmsStatusNote: 'Modélisation basée sur l’intelligence événementielle, la localisation et le compset. Connecteur PMS prêt pour ingestion API pickup / OTB.',
    });
  }

  return forecasts;
}
