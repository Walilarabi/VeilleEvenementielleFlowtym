/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const TODAY_DATE_STR = '2026-11-04';

export interface CompetitorRateInfo {
  hotelName: string;
  rateEur: number;
  isSoldOut: boolean;
  stars: number;
  roomType: string;
}

export interface DailyRateIntelligence {
  id: string;
  hotelId: string;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: string;
  eventId?: string;
  eventTitle?: string;
  eventCategory?: string;
  expectedAttendance?: number;
  rmScore?: number; // 0-100
  demandLevel: 'faible' | 'modere' | 'eleve' | 'tres_fort' | 'exceptionnel';
  
  // Données Importées D-EDGE CRS & PMS Night Audit
  currentBarEur: number;
  roomsSoldOtb: number;
  totalRooms: number;
  occupancyPercent: number;
  remainingRooms: number;
  pickup24h: number;
  pickup7d: number;
  currentMinStay: number;
  currentStopSell: boolean;
  sourcePmsDedge: string; // e.g. "D-EDGE CRS + Opera PMS"
  
  // Données Importées Lighthouse Rate Insight (Compset)
  compsetMinEur: number;
  compsetMedianEur: number;
  compsetMaxEur: number;
  compsetSoldOutCount: number;
  compsetTotalCount: number;
  competitors: CompetitorRateInfo[];
  rateIndexVsCompset: number; // (currentBarEur / compsetMedianEur) * 100
  gapVsMedianEur: number; // currentBarEur - compsetMedianEur
  sourceLighthouse: string; // e.g. "Lighthouse Rate Insight (5 concurrents)"
  
  // Recommandation Tarifaire IA (Moteur RM Flowtym)
  suggestedBarEur: number;
  deltaVsCurrentEur: number;
  deltaVsCurrentPercent: number;
  suggestedMinStay: number;
  suggestedStopSellPromos: boolean;
  revenueGainPotentialEur: number;
  confidenceScore: number;
  justification: string;
  compressionAlert: boolean;
  underpricedAlert: boolean;
  
  // Statut de Décision
  status: 'pending' | 'applied' | 'modified' | 'ignored';
  appliedRateEur?: number;
  appliedMinStay?: number;
  decisionNote?: string;
  lastDecisionAt?: string;
}

export interface CompetitorMeta {
  name: string;
  stars: number;
  color: string;
  defaultRoomType: string;
}

export const COMPSET_METAS: CompetitorMeta[] = [
  { name: 'Hôtel Saint-Pétersbourg Opéra', stars: 4, color: '#3b82f6', defaultRoomType: 'Classique' },
  { name: 'Hôtel Charing Cross', stars: 4, color: '#10b981', defaultRoomType: 'Supérieure' },
  { name: 'Hôtel Astra Opéra', stars: 4, color: '#f59e0b', defaultRoomType: 'Standard' },
  { name: 'Hotel Indigo Paris-Opéra', stars: 4, color: '#ec4899', defaultRoomType: 'Deluxe' },
  { name: 'Hôtel Saint-Augustin Elysées', stars: 3, color: '#06b6d4', defaultRoomType: 'Standard' },
];

export interface CompsetRankedItem {
  hotelName: string;
  rateEur: number;
  isCurrentHotel: boolean;
  isSoldOut: boolean;
  stars: number;
  roomType: string;
  rank: number | null; // null if sold-out
  gapVsHotelEur: number;
}

export type CompsetStatusType = 'significantly_cheaper' | 'aligned' | 'more_expensive';

export interface CompsetRankingResult {
  rank: number; // 1-based rank (1 = least expensive available)
  totalAvailable: number; // available hotels including current hotel (e.g. 6)
  totalCompset: number; // total size (user hotel + 5 competitors = 6)
  rankingFraction: string; // e.g. "1/6", "2/6", "1/5"
  soldOutCount: number;
  cheaperCount: number;
  moreExpensiveCount: number;
  isCheapest: boolean;
  isMostExpensive: boolean;
  isMedian: boolean;
  isTied: boolean;
  positionLabel: string; // e.g. "1er moins cher", "Position médiane", "Le plus cher"
  statusClassification: CompsetStatusType;
  statusBadgeText: string;
  statusDescription: string;
  fullRankingTable: CompsetRankedItem[];
}

/**
 * Calcule avec rigueur le classement du positionnement tarifaire de l'hôtel
 * dans le compset pour une date donnée.
 * - Exclut strictement les concurrents en rupture de stock (sold-out) du classement disponible.
 * - Gère les ex æquo sans distorsion.
 * - Calcule les écarts par rapport à mon hôtel.
 */
export function calculateCompsetRanking(
  record: DailyRateIntelligence,
  currentHotelName: string = 'Mon Hôtel'
): CompsetRankingResult {
  // Liste des concurrents avec disponibilité
  const availableComps = record.competitors.filter((c) => !c.isSoldOut && c.rateEur > 0);
  const soldOutComps = record.competitors.filter((c) => c.isSoldOut || c.rateEur <= 0);

  // Établissements disponibles incluant mon hôtel
  const availableItems: {
    hotelName: string;
    rateEur: number;
    isCurrentHotel: boolean;
    isSoldOut: boolean;
    stars: number;
    roomType: string;
  }[] = [
    {
      hotelName: currentHotelName,
      rateEur: record.currentBarEur,
      isCurrentHotel: true,
      isSoldOut: false,
      stars: 4,
      roomType: 'Chambre Classique (BAR)',
    },
    ...availableComps.map((c) => ({
      hotelName: c.hotelName,
      rateEur: c.rateEur,
      isCurrentHotel: false,
      isSoldOut: false,
      stars: c.stars,
      roomType: c.roomType,
    })),
  ];

  // Tri par tarif croissant (du moins cher au plus cher)
  availableItems.sort((a, b) => a.rateEur - b.rateEur);

  const totalAvailable = availableItems.length;
  const totalCompset = 1 + record.competitors.length; // 6 au total
  const soldOutCount = soldOutComps.length;

  // Calcul du rang avec gestion des égalités
  let currentRank = 1;
  const rankedItems: CompsetRankedItem[] = availableItems.map((item, idx) => {
    if (idx > 0 && item.rateEur > availableItems[idx - 1].rateEur) {
      currentRank = idx + 1;
    }
    return {
      hotelName: item.hotelName,
      rateEur: item.rateEur,
      isCurrentHotel: item.isCurrentHotel,
      isSoldOut: false,
      stars: item.stars,
      roomType: item.roomType,
      rank: currentRank,
      gapVsHotelEur: item.rateEur - record.currentBarEur,
    };
  });

  // Ajouter les concurrents sold-out à la fin (sans rang numérique)
  const fullRankingTable: CompsetRankedItem[] = [
    ...rankedItems,
    ...soldOutComps.map((c) => ({
      hotelName: c.hotelName,
      rateEur: c.rateEur,
      isCurrentHotel: false,
      isSoldOut: true,
      stars: c.stars,
      roomType: c.roomType,
      rank: null,
      gapVsHotelEur: c.rateEur > 0 ? c.rateEur - record.currentBarEur : 0,
    })),
  ];

  const myItem = rankedItems.find((i) => i.isCurrentHotel);
  const myRank = myItem ? myItem.rank || 1 : 1;

  const cheaperCount = availableItems.filter((i) => i.rateEur < record.currentBarEur).length;
  const moreExpensiveCount = availableItems.filter((i) => i.rateEur > record.currentBarEur).length;
  const isTied = availableItems.filter((i) => i.rateEur === record.currentBarEur).length > 1;

  const isCheapest = cheaperCount === 0;
  const isMostExpensive = moreExpensiveCount === 0;
  const isMedian = myRank > 1 && myRank < totalAvailable;

  // Libellé de positionnement
  let positionLabel = `${myRank}e sur ${totalAvailable}`;
  if (isCheapest) {
    positionLabel = `1er moins cher sur ${totalAvailable}`;
  } else if (isMostExpensive) {
    positionLabel = `Le plus cher (${myRank}/${totalAvailable})`;
  } else if (Math.abs(myRank - Math.ceil(totalAvailable / 2)) <= 1) {
    positionLabel = `Position médiane (${myRank}/${totalAvailable})`;
  }

  if (isTied) {
    positionLabel += ' (ex æquo)';
  }

  const rankingFraction = `${myRank}/${totalAvailable}`;

  // Classification d'alignement marché : 'significantly_cheaper' | 'aligned' | 'more_expensive'
  let statusClassification: CompsetStatusType = 'aligned';
  let statusBadgeText = 'Aligné sur le marché';
  let statusDescription = 'Tarif en ligne avec la médiane compset (±8%)';

  const gapVsMedian = record.currentBarEur - record.compsetMedianEur;
  const gapPct = record.compsetMedianEur > 0
    ? (gapVsMedian / record.compsetMedianEur) * 100
    : 0;

  if (gapPct <= -8 || isCheapest) {
    statusClassification = 'significantly_cheaper';
    statusBadgeText = 'Significativement moins cher';
    statusDescription = isCheapest
      ? '1er tarif le plus bas du Compset — Opportunité immédiate de rehausse tarifaire'
      : `Tarif nettement sous la médiane (${gapPct.toFixed(1)}%)`;
  } else if (gapPct >= 8 || isMostExpensive) {
    statusClassification = 'more_expensive';
    statusBadgeText = 'Plus cher que le compset';
    statusDescription = isMostExpensive
      ? 'Tarif le plus élevé du Compset — Risque de perte de volume si demande non confirmée'
      : `Tarif supérieur à la médiane (+${gapPct.toFixed(1)}%)`;
  }

  return {
    rank: myRank,
    totalAvailable,
    totalCompset,
    rankingFraction,
    soldOutCount,
    cheaperCount,
    moreExpensiveCount,
    isCheapest,
    isMostExpensive,
    isMedian,
    isTied,
    positionLabel,
    statusClassification,
    statusBadgeText,
    statusDescription,
    fullRankingTable,
  };
}

const STORAGE_PREFIX = 'flowtym_pricing_intelligence_';

// Générateur automatique de flux continu 90 jours à partir du 4 novembre 2026
function generateContinuous90DaysData(): DailyRateIntelligence[] {
  const days: DailyRateIntelligence[] = [];
  const frenchDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  // Start 15 days before today (Oct 20) and go 95 days ahead (Feb 8, 2027)
  const baseDate = new Date('2026-10-20T12:00:00Z');
  const totalDays = 112; // ~112 continuous days

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(baseDate);
    d.setUTCDate(baseDate.getUTCDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = frenchDays[d.getUTCDay()];
    const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;

    // Événements clés prédéterminés
    let eventTitle: string | undefined = undefined;
    let eventCategory = 'culture_loisirs';
    let expectedAttendance = 12000;
    let rmScore = 65;
    let demandLevel: 'faible' | 'modere' | 'eleve' | 'tres_fort' | 'exceptionnel' = 'modere';
    let justification = 'Tension régulière de saison automne / hiver.';
    let compressionAlert = false;
    let underpricedAlert = false;
    let soldOutIndices: number[] = []; // indices among the 5 competitors

    // Événements majeurs
    if (dateStr >= '2026-11-12' && dateStr <= '2026-11-15') {
      eventTitle = 'Paris Photo 2026 — Grand Palais';
      eventCategory = 'salons_foires';
      expectedAttendance = 68000;
      rmScore = 88;
      demandLevel = 'tres_fort';
      justification = 'Forte affluence internationale de collectionneurs d’art et galeries. Compset en forte surcote.';
      compressionAlert = true;
      underpricedAlert = true;
      soldOutIndices = [3]; // Indigo sold out
    } else if (dateStr >= '2026-11-18' && dateStr <= '2026-11-20') {
      eventTitle = 'Congrès National de Médecine & Cardiologie';
      eventCategory = 'salons_foires';
      expectedAttendance = 24000;
      rmScore = 85;
      demandLevel = 'eleve';
      justification = 'Délégations médicales et laboratoires à fort pouvoir d’achat. Saint-Pétersbourg complet.';
      compressionAlert = true;
      underpricedAlert = true;
      soldOutIndices = [0]; // Saint-Pétersbourg sold out
    } else if (dateStr >= '2026-11-23' && dateStr <= '2026-11-26') {
      eventTitle = 'Salon des Maires et des Collectivités Locales 2026 (SMCL)';
      eventCategory = 'salons_foires';
      expectedAttendance = 60000;
      rmScore = 96;
      demandLevel = 'exceptionnel';
      justification = '60 000 élus et décideurs territoriaux. 2 à 3 concurrents sold-out. Risque critique de sous-tarification si maintien à 260€.';
      compressionAlert = true;
      underpricedAlert = true;
      soldOutIndices = dateStr === '2026-11-25' ? [0, 2, 3] : [0, 3];
    } else if (dateStr >= '2026-11-27' && dateStr <= '2026-11-29') {
      eventTitle = 'Illuminations de Noël & Shopping Grands Magasins';
      eventCategory = 'culture_loisirs';
      expectedAttendance = 35000;
      rmScore = 76;
      demandLevel = 'eleve';
      justification = 'Week-end touristique de pré-Noël. Vente des dernières chambres au tarif supérieur.';
    } else if (dateStr >= '2026-12-05' && dateStr <= '2026-12-13') {
      eventTitle = 'Salon Nautique International de Paris 2026';
      eventCategory = 'salons_foires';
      expectedAttendance = 140000;
      rmScore = 84;
      demandLevel = 'eleve';
      justification = 'Exposants maritimes et plaisanciers sur séjour moyen 3 nuits.';
      compressionAlert = true;
      underpricedAlert = true;
      soldOutIndices = [3];
    } else if (dateStr >= '2026-12-24' && dateStr <= '2026-12-28') {
      eventTitle = 'Fêtes de Noël à Paris';
      eventCategory = 'culture_loisirs';
      expectedAttendance = 45000;
      rmScore = 82;
      demandLevel = 'eleve';
      justification = 'Tourisme familial européen et américain.';
    } else if (dateStr >= '2026-12-30' && dateStr <= '2027-01-02') {
      eventTitle = 'Réveillon de la Saint-Sylvestre Paris 2026/2027';
      eventCategory = 'culture_loisirs';
      expectedAttendance = 120000;
      rmScore = 99;
      demandLevel = 'exceptionnel';
      justification = 'Saturation historique de Paris. 4 concurrents complets sur 5. Sous-tarification critique à combler immédiatement.';
      compressionAlert = true;
      underpricedAlert = true;
      soldOutIndices = [0, 1, 2, 3];
    } else if (dateStr >= '2027-01-18' && dateStr <= '2027-01-24') {
      eventTitle = 'Paris Fashion Week Homme Automne/Hiver 2027';
      eventCategory = 'salons_foires';
      expectedAttendance = 32000;
      rmScore = 92;
      demandLevel = 'exceptionnel';
      justification = 'Presse internationale, acheteurs et VIP mode. Forte propension à payer.';
      compressionAlert = true;
      underpricedAlert = true;
      soldOutIndices = [0, 3];
    } else if (isWeekend) {
      demandLevel = 'eleve';
      rmScore = 72;
      justification = 'Week-end de loisirs régulier avec bonne demande FIT.';
    } else {
      demandLevel = 'modere';
      rmScore = 60;
      justification = 'Journée classique de milieu de semaine.';
    }

    // Prix de base de l'hôtel (entre 220€ et 310€)
    let currentBar = 240;
    if (demandLevel === 'exceptionnel') currentBar = dateStr.includes('12-31') ? 310 : 265;
    else if (demandLevel === 'tres_fort') currentBar = 255;
    else if (demandLevel === 'eleve') currentBar = 245;
    else if (isWeekend) currentBar = 250;
    else currentBar = 230;

    // Tarifs concurrents simulés avec cohérence par rapport au standing
    const compBase = [
      { name: 'Hôtel Saint-Pétersbourg Opéra', base: 310, stars: 4, roomType: 'Classique' },
      { name: 'Hôtel Charing Cross', base: 285, stars: 4, roomType: 'Supérieure' },
      { name: 'Hôtel Astra Opéra', base: 295, stars: 4, roomType: 'Standard' },
      { name: 'Hotel Indigo Paris-Opéra', base: 345, stars: 4, roomType: 'Deluxe' },
      { name: 'Hôtel Saint-Augustin Elysées', base: 260, stars: 3, roomType: 'Standard' },
    ];

    const eventMultiplier = demandLevel === 'exceptionnel' ? 1.38 : demandLevel === 'tres_fort' ? 1.25 : demandLevel === 'eleve' ? 1.15 : 1.0;
    const weekendAdd = isWeekend ? 20 : 0;

    const competitors: CompetitorRateInfo[] = compBase.map((cb, idx) => {
      const isSoldOut = soldOutIndices.includes(idx);
      const rate = Math.round((cb.base * eventMultiplier + weekendAdd + (idx % 3) * 5) / 5) * 5;
      return {
        hotelName: cb.name,
        rateEur: isSoldOut ? rate + 40 : rate, // record observed rate prior to sold out
        isSoldOut,
        stars: cb.stars,
        roomType: cb.roomType,
      };
    });

    const activeRates = competitors.filter((c) => !c.isSoldOut).map((c) => c.rateEur);
    const compsetMin = activeRates.length > 0 ? Math.min(...activeRates) : 260;
    const compsetMax = activeRates.length > 0 ? Math.max(...activeRates) : 380;
    const compsetMedian = activeRates.length > 0
      ? activeRates.sort((a, b) => a - b)[Math.floor(activeRates.length / 2)]
      : 300;

    // Tarif suggéré RM
    let suggestedBar = currentBar;
    if (demandLevel === 'exceptionnel') {
      suggestedBar = Math.max(currentBar + 85, compsetMedian + 10);
    } else if (demandLevel === 'tres_fort') {
      suggestedBar = Math.max(currentBar + 60, compsetMedian);
    } else if (demandLevel === 'eleve') {
      suggestedBar = Math.max(currentBar + 35, compsetMedian - 10);
    } else if (compsetMedian > currentBar + 30) {
      suggestedBar = compsetMedian - 15;
    }

    const deltaEur = suggestedBar - currentBar;
    const deltaPct = Math.round((deltaEur / currentBar) * 100);
    const roomsSold = Math.min(45, Math.round(28 + (rmScore / 100) * 15));
    const occupancyPercent = Math.round((roomsSold / 45) * 1000) / 10;
    const remainingRooms = 45 - roomsSold;

    days.push({
      id: `rate-${dateStr}`,
      hotelId: 'hotel-opera',
      dateStr,
      dayOfWeek,
      eventId: eventTitle ? `evt-${dateStr}` : undefined,
      eventTitle,
      eventCategory,
      expectedAttendance,
      rmScore,
      demandLevel,
      currentBarEur: currentBar,
      roomsSoldOtb: roomsSold,
      totalRooms: 45,
      occupancyPercent,
      remainingRooms,
      pickup24h: demandLevel === 'exceptionnel' ? 7 : isWeekend ? 4 : 2,
      pickup7d: demandLevel === 'exceptionnel' ? 21 : 12,
      currentMinStay: isWeekend ? 2 : 1,
      currentStopSell: false,
      sourcePmsDedge: 'D-EDGE CRS + Opera Cloud PMS',
      compsetMinEur: compsetMin,
      compsetMedianEur: compsetMedian,
      compsetMaxEur: compsetMax,
      compsetSoldOutCount: soldOutIndices.length,
      compsetTotalCount: 5,
      competitors,
      rateIndexVsCompset: Math.round((currentBar / (compsetMedian || 1)) * 1000) / 10,
      gapVsMedianEur: currentBar - compsetMedian,
      sourceLighthouse: `Lighthouse Rate Insight (Relevé ${TODAY_DATE_STR})`,
      suggestedBarEur: suggestedBar,
      deltaVsCurrentEur: deltaEur,
      deltaVsCurrentPercent: deltaPct,
      suggestedMinStay: demandLevel === 'exceptionnel' ? 2 : 1,
      suggestedStopSellPromos: demandLevel === 'exceptionnel' || demandLevel === 'tres_fort',
      revenueGainPotentialEur: deltaEur > 0 ? Math.round(deltaEur * remainingRooms * 0.85) : 0,
      confidenceScore: Math.min(99, 82 + Math.round(rmScore * 0.16)),
      justification,
      compressionAlert,
      underpricedAlert: currentBar < compsetMedian - 30,
      status: 'pending',
    });
  }

  // Also append key 2027 future dates (Bourget & SMCL 2027)
  days.push(
    {
      id: 'rate-2027-06-15',
      hotelId: 'hotel-opera',
      dateStr: '2027-06-15',
      dayOfWeek: 'Mardi',
      eventId: 'event-bourget-2027',
      eventTitle: 'Paris Air Show Le Bourget 2027 (Salon de l’Aéronautique)',
      eventCategory: 'salons_foires',
      expectedAttendance: 320000,
      rmScore: 99,
      demandLevel: 'exceptionnel',
      currentBarEur: 290,
      roomsSoldOtb: 28,
      totalRooms: 45,
      occupancyPercent: 62.2,
      remainingRooms: 17,
      pickup24h: 4,
      pickup7d: 14,
      currentMinStay: 2,
      currentStopSell: false,
      sourcePmsDedge: 'D-EDGE CRS + Opera Cloud PMS',
      compsetMinEur: 410,
      compsetMedianEur: 460,
      compsetMaxEur: 550,
      compsetSoldOutCount: 2,
      compsetTotalCount: 5,
      competitors: [
        { hotelName: 'Hôtel Saint-Pétersbourg Opéra', rateEur: 470, isSoldOut: true, stars: 4, roomType: 'Classique' },
        { hotelName: 'Hôtel Charing Cross', rateEur: 430, isSoldOut: false, stars: 4, roomType: 'Supérieure' },
        { hotelName: 'Hôtel Astra Opéra', rateEur: 460, isSoldOut: false, stars: 4, roomType: 'Standard' },
        { hotelName: 'Hotel Indigo Paris-Opéra', rateEur: 550, isSoldOut: true, stars: 4, roomType: 'Deluxe' },
        { hotelName: 'Hôtel Saint-Augustin Elysées', rateEur: 410, isSoldOut: false, stars: 3, roomType: 'Standard' },
      ],
      rateIndexVsCompset: 63.0,
      gapVsMedianEur: -170,
      sourceLighthouse: `Lighthouse Rate Insight (Relevé ${TODAY_DATE_STR})`,
      suggestedBarEur: 460,
      deltaVsCurrentEur: 170,
      deltaVsCurrentPercent: 58.6,
      suggestedMinStay: 4,
      suggestedStopSellPromos: true,
      revenueGainPotentialEur: 5800,
      confidenceScore: 99,
      justification: 'Plus grand salon aéronautique mondial. Délégations internationales à très haut budget. Hausse immédiate et Min Stay 4 nuits.',
      compressionAlert: true,
      underpricedAlert: true,
      status: 'pending',
    },
    {
      id: 'rate-2027-11-23',
      hotelId: 'hotel-opera',
      dateStr: '2027-11-23',
      dayOfWeek: 'Mardi',
      eventId: 'event-smcl-2027',
      eventTitle: 'Salon des Maires et des Collectivités Locales 2027 (SMCL 2027)',
      eventCategory: 'salons_foires',
      expectedAttendance: 62000,
      rmScore: 96,
      demandLevel: 'exceptionnel',
      currentBarEur: 270,
      roomsSoldOtb: 24,
      totalRooms: 45,
      occupancyPercent: 53.3,
      remainingRooms: 21,
      pickup24h: 3,
      pickup7d: 8,
      currentMinStay: 1,
      currentStopSell: false,
      sourcePmsDedge: 'D-EDGE CRS + Opera Cloud PMS',
      compsetMinEur: 335,
      compsetMedianEur: 365,
      compsetMaxEur: 430,
      compsetSoldOutCount: 1,
      compsetTotalCount: 5,
      competitors: [
        { hotelName: 'Hôtel Saint-Pétersbourg Opéra', rateEur: 375, isSoldOut: false, stars: 4, roomType: 'Classique' },
        { hotelName: 'Hôtel Charing Cross', rateEur: 345, isSoldOut: false, stars: 4, roomType: 'Supérieure' },
        { hotelName: 'Hôtel Astra Opéra', rateEur: 365, isSoldOut: false, stars: 4, roomType: 'Standard' },
        { hotelName: 'Hotel Indigo Paris-Opéra', rateEur: 430, isSoldOut: true, stars: 4, roomType: 'Deluxe' },
        { hotelName: 'Hôtel Saint-Augustin Elysées', rateEur: 335, isSoldOut: false, stars: 3, roomType: 'Standard' },
      ],
      rateIndexVsCompset: 74.0,
      gapVsMedianEur: -95,
      sourceLighthouse: `Lighthouse Rate Insight (Relevé ${TODAY_DATE_STR})`,
      suggestedBarEur: 365,
      deltaVsCurrentEur: 95,
      deltaVsCurrentPercent: 35.2,
      suggestedMinStay: 2,
      suggestedStopSellPromos: true,
      revenueGainPotentialEur: 3600,
      confidenceScore: 97,
      justification: 'Édition 2027 confirmée du SMCL. Anticipation des réservations institutionnelles à 1 an.',
      compressionAlert: true,
      underpricedAlert: true,
      status: 'pending',
    }
  );

  return days;
}

export const INITIAL_RATE_INTELLIGENCE_DATA: DailyRateIntelligence[] = generateContinuous90DaysData();

export function getRateIntelligenceRecords(hotelId: string): DailyRateIntelligence[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${hotelId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 30) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load rate intelligence from storage', e);
  }

  // Generate and adjust for hotel
  const data = generateContinuous90DaysData().map((item) => ({
    ...item,
    hotelId,
  }));
  saveRateIntelligenceRecords(hotelId, data);
  return data;
}

export function saveRateIntelligenceRecords(hotelId: string, records: DailyRateIntelligence[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${hotelId}`, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save rate intelligence to storage', e);
  }
}

export function applyRateSuggestion(
  hotelId: string,
  recordId: string,
  customRate?: number,
  customMinStay?: number,
  note?: string
): DailyRateIntelligence[] {
  const records = getRateIntelligenceRecords(hotelId);
  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' le ' + new Date().toLocaleDateString('fr-FR');
  
  const updated = records.map((rec) => {
    if (rec.id !== recordId) return rec;

    const rate = customRate !== undefined ? customRate : rec.suggestedBarEur;
    const minStay = customMinStay !== undefined ? customMinStay : rec.suggestedMinStay;

    return {
      ...rec,
      status: customRate !== undefined && customRate !== rec.suggestedBarEur ? ('modified' as const) : ('applied' as const),
      appliedRateEur: rate,
      appliedMinStay: minStay,
      currentBarEur: rate, // update local BAR
      currentMinStay: minStay,
      decisionNote: note || `Tarif ${rate}€ validé et transmis au CRS D-EDGE`,
      lastDecisionAt: now,
      deltaVsCurrentEur: 0,
      deltaVsCurrentPercent: 0,
      underpricedAlert: false,
    };
  });

  saveRateIntelligenceRecords(hotelId, updated);
  return updated;
}

export function applyAllRateSuggestions(hotelId: string): { updated: DailyRateIntelligence[]; count: number } {
  const records = getRateIntelligenceRecords(hotelId);
  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' le ' + new Date().toLocaleDateString('fr-FR');
  let count = 0;

  const updated = records.map((rec) => {
    if (rec.status === 'applied') return rec;
    count++;
    return {
      ...rec,
      status: 'applied' as const,
      appliedRateEur: rec.suggestedBarEur,
      appliedMinStay: rec.suggestedMinStay,
      currentBarEur: rec.suggestedBarEur,
      currentMinStay: rec.suggestedMinStay,
      decisionNote: `Validation groupée : alignement sur ${rec.suggestedBarEur}€`,
      lastDecisionAt: now,
      deltaVsCurrentEur: 0,
      deltaVsCurrentPercent: 0,
      underpricedAlert: false,
    };
  });

  saveRateIntelligenceRecords(hotelId, updated);
  return { updated, count };
}

export function exportRateGridToCSV(records: DailyRateIntelligence[], hotelName: string): void {
  const headers = [
    'Date',
    'Jour',
    'Événement Associé',
    'Score RM',
    'Niveau Demande',
    'Occ % Actuelle',
    'Stock Dispo',
    'Pickup 24h',
    'Tarif BAR Actuel (€)',
    'Position Compset (Rang)',
    'Statut vs Marché',
    'Min Stay Actuel',
    'Compset Min (€)',
    'Compset Médian (€)',
    'Compset Max (€)',
    'Compset Sold-Out (Complets)',
    'Écart vs Médian (€)',
    'Tarif Suggéré IA (€)',
    'Delta (€)',
    'Delta (%)',
    'Min Stay Suggéré',
    'Gain Potentiel RevPAR (€)',
    'Statut Décision',
    'Justification RM',
  ];

  const rows = records.map((r) => {
    const ranking = calculateCompsetRanking(r, hotelName);
    return [
      r.dateStr,
      r.dayOfWeek,
      `"${(r.eventTitle || 'Sans événement majeur').replace(/"/g, '""')}"`,
      r.rmScore || '-',
      r.demandLevel,
      `${r.occupancyPercent}%`,
      r.remainingRooms,
      r.pickup24h > 0 ? `+${r.pickup24h}` : `${r.pickup24h}`,
      r.currentBarEur,
      `"${ranking.positionLabel}"`,
      `"${ranking.statusBadgeText}"`,
      `${r.currentMinStay}n`,
      r.compsetMinEur,
      r.compsetMedianEur,
      r.compsetMaxEur,
      `${r.compsetSoldOutCount}/${r.compsetTotalCount}`,
      r.gapVsMedianEur,
      r.suggestedBarEur,
      r.deltaVsCurrentEur > 0 ? `+${r.deltaVsCurrentEur}` : `${r.deltaVsCurrentEur}`,
      r.deltaVsCurrentPercent > 0 ? `+${r.deltaVsCurrentPercent}%` : `${r.deltaVsCurrentPercent}%`,
      `${r.suggestedMinStay}n`,
      r.revenueGainPotentialEur,
      r.status,
      `"${r.justification.replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `pricing_intelligence_${hotelName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
