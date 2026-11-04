/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchoolHolidayPeriod } from '../types/schoolHolidays';
import { EventItem, Hotel, RMImpactLevel } from '../types';
import { calculateSchoolHolidayImpactScore } from './schoolHolidaysImpactEngine';

/**
 * Convertit les vacances scolaires officielles en EventItem de catégorie 'vacances_scolaires'
 * pour les intégrer harmonieusement dans le calendrier principal, la liste et le filtre.
 */
export function convertSchoolHolidaysToEventItems(
  holidays: SchoolHolidayPeriod[],
  hotel: Hotel
): EventItem[] {
  return holidays.map((h) => {
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
      expectedAttendance: Math.round(analysis.hotelFamilyCapacityShare * 400), // flux potentiel famille estimé
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
}
