/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchoolHolidayPeriod } from '../types/schoolHolidays';
import { EventItem, Hotel, RMImpactLevel } from '../types';

/**
 * Converts official holiday calendar dates into calendar markers.
 * No hotel demand, attendance, distance, ADR uplift or RM score is inferred.
 */
export function convertSchoolHolidaysToEventItems(
  holidays: SchoolHolidayPeriod[],
  hotel: Hotel
): EventItem[] {
  const notEvaluated: RMImpactLevel = 'faible';
  return holidays.map((holiday) => ({
    id: `holiday-ev-${holiday.id}`,
    title: `${holiday.name} (${holiday.countryName})`,
    subtitle: `${holiday.flag} Vacances scolaires · ${holiday.durationDays} jours · Impact hôtelier non évalué`,
    category: 'vacances_scolaires',
    venueId: `holiday-calendar-${holiday.countryCode.toLowerCase()}`,
    venueName: `Calendrier scolaire · ${holiday.countryName}`,
    city: hotel.city,
    country: holiday.countryName,
    startDate: holiday.startDate,
    endDate: holiday.endDate,
    expectedAttendance: 0,
    internationalRatioPercent: 0,
    status: holiday.isOfficial ? 'confirmed' : 'estimated_recurrent',
    impactLevel: notEvaluated,
    scoreBreakdown: {
      attendanceScore: 0,
      internationalScore: 0,
      saturationScore: 0,
      proximityScore: 0,
      compressionScore: 0,
      finalRMScore: 0,
      confidenceScore: 0,
    },
    sources: [holiday.officialSource],
    evidences: [{
      id: `evid-hol-${holiday.id}`,
      sourceName: holiday.officialSource,
      sourceUrl: holiday.sourceUrl,
      sourceType: 'official_organizer',
      verifiedAt: holiday.lastSync,
      excerpt: `Calendrier des vacances scolaires de ${holiday.countryName}. Aucun impact hôtelier n'est calculé à partir de cette seule date.`,
      trustScore: 0,
    }],
    hotelImpacts: {},
    isRecurring: true,
    recurrenceFrequency: 'annual',
    notes: holiday.notes ?? 'Date de calendrier uniquement ; demande et impact tarifaire non évalués.',
    officialUrl: holiday.sourceUrl,
    createdAt: holiday.lastSync,
    lastVerifiedAt: holiday.lastSync,
  }));
}
