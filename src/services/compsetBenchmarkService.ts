/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompetitorHotel, MarketCompressionAlert, StandardDemandLevel } from '../types';

export interface CompsetSnapshot {
  hotelId: string;
  hotelName: string;
  dateStr: string;
  myRate: number;
  compsetAverage: number;
  compsetMedian: number;
  rateSpreadVsCompset: number; // in € (myRate - compsetAverage)
  rateSpreadPercent: number; // in %
  soldOutCount: number;
  totalCompetitors: number;
  marketPosition: number; // rank, e.g. 2nd out of 6
  competitors: CompetitorHotel[];
  compressionAlert?: MarketCompressionAlert;
}

// Compset spécifique pour l'hôtel pilote : Grand Hôtel Folkestone Opéra (4★)
export const FOLKESTONE_COMPSET_BASE: Omit<CompetitorHotel, 'currentRate' | 'isSoldOut' | 'rateTrend' | 'deltaPercent' | 'lastObservedAt'>[] = [
  {
    id: 'comp-stpetersbourg',
    name: 'Hôtel Saint-Pétersbourg Opéra & Spa',
    stars: 4,
    roomCount: 50,
    distanceMeters: 180,
    address: '35 Rue de Caumartin, 75009 Paris',
    baselineRate: 255,
    roomType: 'Chambre Classique Double',
    scrapedSource: 'Direct Web + Booking.com Engine',
  },
  {
    id: 'comp-charing-cross',
    name: 'Hôtel Charing Cross',
    stars: 4,
    roomCount: 52,
    distanceMeters: 290,
    address: '39 Rue Pasquier, 75008 Paris',
    baselineRate: 245,
    roomType: 'Chambre Supérieure',
    scrapedSource: 'SynXis / GDS Amadeus RateFeed',
  },
  {
    id: 'comp-astra-opera',
    name: 'Hôtel Astra Opéra (Astotel)',
    stars: 4,
    roomCount: 73,
    distanceMeters: 340,
    address: '29 Rue de Caumartin, 75009 Paris',
    baselineRate: 270,
    roomType: 'Chambre Confort',
    scrapedSource: 'Direct Brand Website',
  },
  {
    id: 'comp-indigo-opera',
    name: 'Hôtel Indigo Paris - Opéra (IHG)',
    stars: 4,
    roomCount: 57,
    distanceMeters: 450,
    address: '2 Rue Édouard VII, 75009 Paris',
    baselineRate: 295,
    roomType: 'Chambre Standard King',
    scrapedSource: 'IHG Central Reservation / Expedia API',
  },
  {
    id: 'comp-pulitzer',
    name: 'Hôtel Pulitzer Paris',
    stars: 4,
    roomCount: 44,
    distanceMeters: 620,
    address: '23 Rue du Faubourg Montmartre, 75009 Paris',
    baselineRate: 260,
    roomType: 'Chambre Double Cosy',
    scrapedSource: 'Booking.com Channel XML',
  },
];

/**
 * Calcule les prix du compset pour une date donnée en fonction des événements actifs
 */
export function getCompsetForDate(
  hotelId: string,
  dateStr: string,
  myCurrentRate: number,
  activeEventsCount: number,
  maxRMScore: number,
  totalPax: number
): CompsetSnapshot {
  // Déterminer le facteur de compression du marché
  let compressionRatio = 1.0;
  let soldOutThreshold = 0.05; // 5% chance of sold out on normal day

  if (maxRMScore >= 80 || totalPax >= 100000) {
    // Événement majeur (ex: Mondial Auto, SIAL, Salon des Maires, Fashion Week)
    compressionRatio = 1.35 + (maxRMScore - 80) * 0.015;
    soldOutThreshold = 0.55; // Plus de la moitié du compset complet
  } else if (maxRMScore >= 60 || activeEventsCount >= 2) {
    compressionRatio = 1.15 + (maxRMScore - 60) * 0.008;
    soldOutThreshold = 0.25;
  }

  // Pseudo-random déterministe basé sur la date pour la stabilité des tests
  const dateHash = dateStr.split('-').reduce((acc, part) => acc * 31 + parseInt(part, 10), 0);

  let soldOutCount = 0;
  const competitors: CompetitorHotel[] = FOLKESTONE_COMPSET_BASE.map((comp, idx) => {
    const itemSeed = (dateHash + idx * 7919) % 1000 / 1000;
    const isSoldOut = itemSeed < soldOutThreshold;
    if (isSoldOut) soldOutCount++;

    // Variation individuelle du concurrent
    const variationMultiplier = 0.96 + ((dateHash * (idx + 1)) % 15) / 100;
    const finalRate = isSoldOut
      ? Math.round(comp.baselineRate * compressionRatio * 1.25)
      : Math.round(comp.baselineRate * compressionRatio * variationMultiplier);

    const deltaPercent = Math.round(((finalRate - comp.baselineRate) / comp.baselineRate) * 100);
    const rateTrend: 'up' | 'stable' | 'down' = deltaPercent > 5 ? 'up' : deltaPercent < -5 ? 'down' : 'stable';

    return {
      ...comp,
      currentRate: finalRate,
      isSoldOut,
      rateTrend,
      deltaPercent,
      lastObservedAt: 'Il y a 32 min',
    };
  });

  const availableCompetitors = competitors.filter((c) => !c.isSoldOut);
  const compsetSum = availableCompetitors.reduce((sum, c) => sum + c.currentRate, 0);
  const compsetAverage = availableCompetitors.length > 0 ? Math.round(compsetSum / availableCompetitors.length) : Math.round(myCurrentRate * 1.1);

  const ratesSorted = [...competitors.map((c) => c.currentRate), myCurrentRate].sort((a, b) => b - a);
  const marketPosition = ratesSorted.indexOf(myCurrentRate) + 1;

  let demandLevel: StandardDemandLevel = 'normal';
  if (compressionRatio >= 1.3 || soldOutCount >= 2) {
    demandLevel = compressionRatio >= 1.4 ? 'exceptionnel' : 'eleve';
  } else if (compressionRatio <= 1.05 && activeEventsCount === 0) {
    demandLevel = 'faible';
  }

  let compressionAlert: MarketCompressionAlert | undefined;
  if (soldOutCount >= 2 || compressionRatio >= 1.25) {
    compressionAlert = {
      id: `comp-alert-${dateStr}`,
      dateStr,
      compressionIndex: Math.min(10, Math.round(compressionRatio * 7)),
      demandLevel,
      primaryDrivers: totalPax > 50000 ? ['Forte affluence événementielle', 'Resserrement de la disponibilité compset'] : ['Tension sur le compset direct'],
      totalEstimatedPax: totalPax,
      soldOutRatioPercent: Math.round((soldOutCount / competitors.length) * 100),
      compsetAverageRate,
      rateSpreadVsBaselinePercent: Math.round((compressionRatio - 1) * 100),
      isMultiEventOverlap: activeEventsCount > 1,
      recommendedAction: soldOutCount >= 2 ? 'Fermer les canaux OTA remisés & appliquer Minimum Stay 2 ou 3 nuits' : 'Rehausser le BAR de +15% à +25%',
      suggestedMinStay: compressionRatio >= 1.3 ? 3 : 2,
      ctaRecommended: soldOutCount >= 3,
    };
  }

  return {
    hotelId,
    hotelName: 'Grand Hôtel Folkestone Opéra (4★)',
    dateStr,
    myRate: myCurrentRate,
    compsetAverage,
    compsetMedian: availableCompetitors.length > 0 ? availableCompetitors[Math.floor(availableCompetitors.length / 2)].currentRate : compsetAverage,
    rateSpreadVsCompset: myCurrentRate - compsetAverage,
    rateSpreadPercent: Math.round(((myCurrentRate - compsetAverage) / compsetAverage) * 100),
    soldOutCount,
    totalCompetitors: competitors.length,
    marketPosition,
    competitors,
    compressionAlert,
  };
}
