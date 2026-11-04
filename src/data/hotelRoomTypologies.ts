/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HotelRoomBreakdown, FeederMarketShare } from '../types/schoolHolidays';

export interface HotelInventoryProfile {
  hotelId: string;
  hotelName: string;
  roomBreakdown: HotelRoomBreakdown;
  feederMarkets: FeederMarketShare[];
  historicalHolidayOccRate: number; // Taux d'occupation moyen historique pendant les vacances scolaires
  historicalHolidayADR: number; // ADR moyen historique en vacances scolaires
  familySegmentShare: number; // % de clientèle familiale global
  corporateSegmentShare: number; // % clientèle affaires
}

export const HOTEL_INVENTORY_PROFILES: Record<string, HotelInventoryProfile> = {
  // HÔTEL PILOTE : Grand Hôtel Folkestone Opéra (4★)
  // 14 Rue de Castellane, 75008 Paris (Quartier Opéra / Madeleine)
  // 45 chambres au total
  'hotel-opera': {
    hotelId: 'hotel-opera',
    hotelName: 'Grand Hôtel Folkestone Opéra (4★)',
    roomBreakdown: {
      singleRooms: 6, // 13.3%
      doubleRooms: 23, // 51.1%
      tripleRooms: 8, // 17.8% (3 personnes)
      quadrupleRooms: 4, // 8.9% (4 personnes)
      familyRooms: 2, // 4.4% (grande chambre famille 4-5 pers)
      connectingRooms: 2, // 4.4% (2x2 communicantes)
      suites: 2, // 4.4% (Junior Suite familiale)
      familyCapacityRooms: 16, // 8 + 4 + 2 + 2 = 16 chambres (35.6% du parc !)
      familyCapacitySharePercent: 35.6,
      description: 'Parc équilibré avec 16 chambres adaptées aux familles (triples, quadruples, communicantes & suites). Fort potentiel d’accueil familial lors des congés scolaires européens.',
    },
    feederMarkets: [
      {
        countryCode: 'FR',
        countryName: 'France',
        flag: '🇫🇷',
        sharePercent: 32,
        alos: 2.1,
        priorityRank: 1,
        familyTravelPropensity: 'forte',
      },
      {
        countryCode: 'GB',
        countryName: 'Royaume-Uni',
        flag: '🇬🇧',
        sharePercent: 22,
        alos: 2.9,
        priorityRank: 2,
        familyTravelPropensity: 'tres_forte',
      },
      {
        countryCode: 'US',
        countryName: 'États-Unis',
        flag: '🇺🇸',
        sharePercent: 14,
        alos: 4.2,
        priorityRank: 3,
        familyTravelPropensity: 'forte',
      },
      {
        countryCode: 'BE',
        countryName: 'Belgique',
        flag: '🇧🇪',
        sharePercent: 11,
        alos: 2.4,
        priorityRank: 4,
        familyTravelPropensity: 'tres_forte',
      },
      {
        countryCode: 'DE',
        countryName: 'Allemagne',
        flag: '🇩🇪',
        sharePercent: 8,
        alos: 3.1,
        priorityRank: 5,
        familyTravelPropensity: 'forte',
      },
      {
        countryCode: 'CH',
        countryName: 'Suisse',
        flag: '🇨🇭',
        sharePercent: 5,
        alos: 2.6,
        priorityRank: 6,
        familyTravelPropensity: 'forte',
      },
      {
        countryCode: 'NL',
        countryName: 'Pays-Bas',
        flag: '🇳🇱',
        sharePercent: 4,
        alos: 2.8,
        priorityRank: 7,
        familyTravelPropensity: 'tres_forte',
      },
      {
        countryCode: 'ES',
        countryName: 'Espagne',
        flag: '🇪🇸',
        sharePercent: 4,
        alos: 3.0,
        priorityRank: 8,
        familyTravelPropensity: 'forte',
      },
    ],
    historicalHolidayOccRate: 84.5,
    historicalHolidayADR: 295,
    familySegmentShare: 32,
    corporateSegmentShare: 48,
  },

  // Hôtel Le Marais Boutique (4★)
  // Clientèle couple & boutique, faible capacité familiale
  'hotel-marais': {
    hotelId: 'hotel-marais',
    hotelName: 'Hôtel Le Marais Boutique',
    roomBreakdown: {
      singleRooms: 6,
      doubleRooms: 34,
      tripleRooms: 4,
      quadrupleRooms: 2,
      familyRooms: 0,
      connectingRooms: 0,
      suites: 2,
      familyCapacityRooms: 6,
      familyCapacitySharePercent: 12.5,
      description: 'Hôtel boutique romantique orienté couples et voyageurs individuels. Seulement 6 chambres pouvant accueillir plus de 2 personnes.',
    },
    feederMarkets: [
      { countryCode: 'FR', countryName: 'France', flag: '🇫🇷', sharePercent: 35, alos: 1.8, priorityRank: 1, familyTravelPropensity: 'moderee' },
      { countryCode: 'US', countryName: 'États-Unis', flag: '🇺🇸', sharePercent: 25, alos: 3.8, priorityRank: 2, familyTravelPropensity: 'moderee' },
      { countryCode: 'GB', countryName: 'Royaume-Uni', flag: '🇬🇧', sharePercent: 18, alos: 2.5, priorityRank: 3, familyTravelPropensity: 'moderee' },
      { countryCode: 'IT', countryName: 'Italie', flag: '🇮🇹', sharePercent: 8, alos: 2.7, priorityRank: 4, familyTravelPropensity: 'moderee' },
    ],
    historicalHolidayOccRate: 78.0,
    historicalHolidayADR: 320,
    familySegmentShare: 14,
    corporateSegmentShare: 52,
  },

  // Lyon Bellecour Plaza (4★)
  'hotel-lyon': {
    hotelId: 'hotel-lyon',
    hotelName: 'Lyon Bellecour Plaza',
    roomBreakdown: {
      singleRooms: 15,
      doubleRooms: 65,
      tripleRooms: 18,
      quadrupleRooms: 6,
      familyRooms: 4,
      connectingRooms: 4,
      suites: 2,
      familyCapacityRooms: 28,
      familyCapacitySharePercent: 25.5,
      description: 'Grand établissement central avec 28 chambres et suites familiales adaptées aux étapes de vacances et séjours touristiques en région Auvergne-Rhône-Alpes.',
    },
    feederMarkets: [
      { countryCode: 'FR', countryName: 'France', flag: '🇫🇷', sharePercent: 55, alos: 1.9, priorityRank: 1, familyTravelPropensity: 'forte' },
      { countryCode: 'CH', countryName: 'Suisse', flag: '🇨🇭', sharePercent: 16, alos: 2.2, priorityRank: 2, familyTravelPropensity: 'forte' },
      { countryCode: 'DE', countryName: 'Allemagne', flag: '🇩🇪', sharePercent: 12, alos: 2.4, priorityRank: 3, familyTravelPropensity: 'forte' },
      { countryCode: 'BE', countryName: 'Belgique', flag: '🇧🇪', sharePercent: 9, alos: 2.1, priorityRank: 4, familyTravelPropensity: 'forte' },
    ],
    historicalHolidayOccRate: 76.5,
    historicalHolidayADR: 215,
    familySegmentShare: 24,
    corporateSegmentShare: 60,
  },

  // Nice Promenade Palace (5★)
  'hotel-nice': {
    hotelId: 'hotel-nice',
    hotelName: 'Nice Promenade Palace',
    roomBreakdown: {
      singleRooms: 10,
      doubleRooms: 88,
      tripleRooms: 35,
      quadrupleRooms: 18,
      familyRooms: 10,
      connectingRooms: 8,
      suites: 7,
      familyCapacityRooms: 70,
      familyCapacitySharePercent: 41.7,
      description: 'Palace balnéaire avec 70 chambres et suites familiales avec vue mer. Très forte attraction familiale estivale et lors des congés scolaires européens.',
    },
    feederMarkets: [
      { countryCode: 'FR', countryName: 'France', flag: '🇫🇷', sharePercent: 28, alos: 3.5, priorityRank: 1, familyTravelPropensity: 'tres_forte' },
      { countryCode: 'GB', countryName: 'Royaume-Uni', flag: '🇬🇧', sharePercent: 20, alos: 4.2, priorityRank: 2, familyTravelPropensity: 'tres_forte' },
      { countryCode: 'US', countryName: 'États-Unis', flag: '🇺🇸', sharePercent: 16, alos: 4.8, priorityRank: 3, familyTravelPropensity: 'tres_forte' },
      { countryCode: 'IT', countryName: 'Italie', flag: '🇮🇹', sharePercent: 12, alos: 2.8, priorityRank: 4, familyTravelPropensity: 'forte' },
      { countryCode: 'SA', countryName: 'Arabie Saoudite', flag: '🇸🇦', sharePercent: 10, alos: 7.5, priorityRank: 5, familyTravelPropensity: 'tres_forte' },
    ],
    historicalHolidayOccRate: 91.2,
    historicalHolidayADR: 480,
    familySegmentShare: 46,
    corporateSegmentShare: 22,
  },
};

export function getHotelInventoryProfile(hotelId: string): HotelInventoryProfile {
  return HOTEL_INVENTORY_PROFILES[hotelId] || HOTEL_INVENTORY_PROFILES['hotel-opera'];
}

export function getHotelRoomTypology(hotelId: string) {
  const profile = getHotelInventoryProfile(hotelId);
  const rb = profile.roomBreakdown;
  const totalRooms = (rb.singleRooms || 0) + (rb.doubleRooms || 0) + (rb.tripleRooms || 0) + (rb.quadrupleRooms || 0) + (rb.familyRooms || 0) + (rb.connectingRooms || 0) + (rb.suites || 0);
  return {
    ...rb,
    totalRooms,
    familyCapacityRooms: rb.familyCapacityRooms,
    familyCapacityPercentage: rb.familyCapacitySharePercent,
  };
}
