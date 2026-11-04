/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HolidaySeason = 'hiver' | 'printemps' | 'ete' | 'automne';

export interface HolidayZone {
  id: string;
  name: string;
  description: string;
  academiesOrRegions: string[];
}

export interface SchoolHolidayPeriod {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  flag: string;
  season: HolidaySeason;
  year: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationDays: number;
  zoneId?: string;
  zoneLabel?: string;
  associatedHolidays?: string[]; // e.g. Lundi de Pâques, Ascension, Toussaint
  officialSource: string;
  sourceUrl: string;
  isOfficial: boolean;
  lastSync: string;
  notes?: string;
}

export interface CountryHolidayConfig {
  code: string;
  name: string;
  flag: string;
  hasZones: boolean;
  zones?: HolidayZone[];
  defaultActive: boolean;
  officialSource: string;
  sourceUrl: string;
  populationCoveragePercent: number;
}

export interface HotelRoomBreakdown {
  singleRooms: number;
  doubleRooms: number;
  tripleRooms: number;
  quadrupleRooms: number;
  familyRooms: number;
  connectingRooms: number;
  suites: number;
  familyCapacityRooms: number; // triples + quadruples + familiales + communicantes + suites
  familyCapacitySharePercent: number; // e.g. 36%
  description: string;
}

export interface FeederMarketShare {
  countryCode: string;
  countryName: string;
  flag: string;
  sharePercent: number;
  alos: number; // Durée moyenne de séjour (nuits)
  priorityRank: number;
  familyTravelPropensity: 'tres_forte' | 'forte' | 'moderee' | 'faible';
}

export type HolidayImpactClassification = 'vert' | 'orange' | 'rouge' | 'donnees_insuffisantes';

export interface SchoolHolidaysImpactScoreResult {
  periodId: string;
  holidayName: string;
  countryCode: string;
  countryName: string;
  flag: string;
  season: HolidaySeason;
  startDate: string;
  endDate: string;
  durationDays: number;
  score: number; // 0 to 100
  classification: HolidayImpactClassification;
  classificationLabel: string;
  scoreBreakdown: {
    feederMarketScore: number; // 0 to 25
    proximityScore: number; // 0 to 15
    countryOverlapScore: number; // 0 to 20
    roomTypologyScore: number; // 0 to 25
    historicalPaceScore: number; // 0 to 15
  };
  overlappingCountries: {
    code: string;
    name: string;
    flag: string;
    holidayName: string;
  }[];
  hotelFamilyCapacityShare: number;
  targetedRoomTypes: string[];
  recommendation: string;
  commercialStrategy: string;
  yieldAction: string;
  pmsReadiness: string;
}

export interface HolidayOverlapSummary {
  startDate: string;
  endDate: string;
  season: HolidaySeason;
  countries: {
    code: string;
    name: string;
    flag: string;
    holidayName: string;
  }[];
  totalCountries: number;
  overlapLabel: string;
  peakPeriodName: string;
  impactScoreAvg: number;
  recommendedFocus: string;
}
