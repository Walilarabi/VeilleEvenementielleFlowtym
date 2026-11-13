/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FLOWTYM RMS — MOTEUR D'INTÉGRATION ET D'ANALYSE LIGHTHOUSE RATE INSIGHT
 * Analyse de la demande marché, veille tarifaire concurrentielle et évolutions des prix
 * Conforme aux 5 onglets de l'export Lighthouse :
 * 1. Aperçu
 * 2. Tarifs
 * 3. vs. Hier
 * 4. vs. 3 jours
 * 5. vs. 7 jours
 *
 * Hôtel de référence : Grand Hôtel Folkestone Opéra (4★)
 * Source : Booking.com · Devise : EUR · LOS : 1 nuit · 2 guests · Primary Compset
 */

/**
 * @deprecated LEGACY BROWSER / DEMO SERVICE.
 * Not the authoritative backend and not approved for live Revenue Management decisions.
 * Live persistence and decisions must use the authenticated Supabase Revenue API
 * (src/services/revenueApiClient.ts) and its RLS-protected database contracts.
 */

import * as XLSX from 'xlsx';

export type MarketDemandLevelCategory = 'faible' | 'moderee' | 'forte' | 'tres_forte';

export interface MarketDemandThresholds {
  faibleMax: number;    // < 40
  modereeMax: number;   // 40 - 69
  forteMax: number;     // 70 - 84
  tresForteMin: number; // >= 85
}

export const DEFAULT_DEMAND_THRESHOLDS: MarketDemandThresholds = {
  faibleMax: 39,
  modereeMax: 69,
  forteMax: 84,
  tresForteMin: 85,
};

export type HotelAvailabilityStatus = 'disponible' | 'epuise' | 'los2' | '1pax' | 'non_disponible';

export interface CompetitorRateRecord {
  id: string;
  name: string;
  stars: number;
  rate: number | null; // null if sold-out or unavailable (NEVER 0)
  status: HotelAvailabilityStatus;
  statusLabel: string;
  gapVsFolkestoneEur: number | null;
  evolution1d: number | null; // vs. Hier
  evolution3d: number | null; // vs. 3 jours
  evolution7d: number | null; // vs. 7 jours
}

export interface FolkestoneRateRecord {
  name: string;
  rate: number | null;
  status: HotelAvailabilityStatus;
  statusLabel: string;
  evolution1d: number | null;
  evolution3d: number | null;
  evolution7d: number | null;
  gapVsLighthouseMedianEur: number | null;
  gapVsLighthouseMedianPct: number | null;
  gapVsFlowtymMedianEur: number | null;
  gapVsFlowtymMedianPct: number | null;
  rank: number | null;
  totalAvailable: number;
  positioning: 'en_dessous' | 'aligne' | 'au_dessus' | 'non_disponible';
  positioningLabel: string;
}

export interface LighthouseAIRecoveryAlert {
  id: string;
  caseType: 'CAS_1' | 'CAS_2' | 'CAS_3' | 'CAS_4' | 'CAS_5';
  title: string;
  dateStr: string;
  triggerData: string;
  constat: string;
  recommandation: string;
  priority: 'haute' | 'moyenne' | 'critique';
  suggestedActionRate?: number;
}

export interface LighthouseDailyItem {
  id: string;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: string; // e.g. "Lundi", "Mardi"
  isWeekend: boolean;

  // A. Demande du marché (Aperçu + Tarifs)
  demandIndex: number; // 0-100 (Indice Lighthouse de demande, PAS un taux d'occupation)
  demandLevel: MarketDemandLevelCategory;
  demandEvolution1d: number | null; // vs hier
  demandEvolution3d: number | null; // vs J-3
  demandEvolution7d: number | null; // vs J-7

  // B. Médianes du marché
  lighthouseMedianEur: number; // Médiane officielle fournie par Lighthouse (Aperçu)
  flowtymMedianEur: number;    // Médiane recalculée Flowtym (exclut Folkestone, indispos et non-numériques)
  medianGapEur: number;        // flowtymMedianEur - lighthouseMedianEur
  medianGapPct: number;

  // C. Mon Hôtel : Folkestone Opéra (Hôtel de référence)
  folkestone: FolkestoneRateRecord;

  // D. Tarif de chaque hôtel concurrent (Onglet Tarifs)
  competitors: CompetitorRateRecord[];

  // Indicateurs synthétiques du compset pour cette date
  compsetAverage: number;
  minCompRate: number | null;
  minCompHotelName: string | null;
  maxCompRate: number | null;
  maxCompHotelName: string | null;
  totalAvailableHotels: number;
  totalSoldOutHotels: number;

  // Dynamique concurrentielle
  increasedCount1d: number;
  decreasedCount1d: number;
  stableCount1d: number;
  increasedCount7d: number;
  decreasedCount7d: number;
  maxIncrease7d: { hotelName: string; amount: number } | null;
  maxDecrease7d: { hotelName: string; amount: number } | null;

  // Alertes & Recommandations IA
  aiAlerts: LighthouseAIRecoveryAlert[];
}

export interface LighthouseExtractionMetadata {
  id: string;
  fileName: string;
  extractedAt: string;
  sourceChannel: string; // "Booking.com"
  currency: string; // "EUR"
  los: string; // "1 nuit"
  occupancy: string; // "2 personnes"
  compsetName: string; // "Primary Compset"
  referenceHotel: string; // "Folkestone Opéra"
  dateRange: string;
  totalDatesCount: number;
  isCustomUpload: boolean;
  sourceStatus?: 'live' | 'imported' | 'fixture' | 'simulation';
}

export interface LighthouseExtractionDataset {
  metadata: LighthouseExtractionMetadata;
  records: LighthouseDailyItem[];
}

// Candidats de compset configurables : noms uniquement, jamais utilisés comme tarifs réels.
export const FOLKESTONE_PRIMARY_COMPSET_NAMES = [
  'Hôtel Saint-Pétersbourg Opéra & Spa',
  'Hôtel Charing Cross',
  'Hôtel Astra Opéra (Astotel)',
  'Hotel Indigo Paris-Opéra (IHG)',
  'Hôtel Saint-Augustin Elysées',
  'Hôtel Pulitzer Paris',
  'Hôtel Bedford Opéra Madeleine',
  'Hôtel Le Marquis Faubourg Saint-Honoré',
  'Hôtel Caumartin Opéra Astotel',
  'Maison Albar Hotels Le Vendôme',
];

/**
 * Calcul qualitatif du niveau de demande selon les seuils configurables Flowtym
 */
export function getDemandLevelFromIndex(
  index: number,
  thresholds: MarketDemandThresholds = DEFAULT_DEMAND_THRESHOLDS
): MarketDemandLevelCategory {
  if (index >= thresholds.tresForteMin) return 'tres_forte';
  if (index >= thresholds.forteMax - 14) return 'forte';
  if (index >= thresholds.modereeMax - 29) return 'moderee';
  return 'faible';
}

/**
 * Couleurs associées aux niveaux de demande Flowtym
 */
export function getDemandColor(level: MarketDemandLevelCategory): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (level) {
    case 'faible':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'moderee':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'forte':
      return {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
        dot: 'bg-orange-500',
      };
    case 'tres_forte':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
      };
  }
}

/**
 * Calcul strict de la médiane recalculée par Flowtym :
 * - Exclut Folkestone Opéra
 * - Exclut les hôtels indisponibles / épuisés
 * - Exclut les valeurs non numériques
 * - Utilise uniquement les tarifs comparables disponibles
 */
export function calculateFlowtymMedian(competitors: CompetitorRateRecord[]): number {
  const validRates = competitors
    .filter((c) => c.status === 'disponible' && typeof c.rate === 'number' && c.rate > 0)
    .map((c) => c.rate as number);

  if (validRates.length === 0) return 0;

  validRates.sort((a, b) => a - b);
  const mid = Math.floor(validRates.length / 2);

  if (validRates.length % 2 !== 0) {
    return validRates[mid];
  } else {
    return Math.round((validRates[mid - 1] + validRates[mid]) / 2);
  }
}

/**
 * Générateur de recommandations IA selon les 5 cas définis par les règles de Revenue Management
 */
export function generateLighthouseAIAlerts(
  dateStr: string,
  demandIndex: number,
  demandLevel: MarketDemandLevelCategory,
  folkestoneRate: number | null,
  folkestoneStatus: HotelAvailabilityStatus,
  lighthouseMedian: number,
  flowtymMedian: number,
  competitors: CompetitorRateRecord[],
  increasedCount1d: number,
  decreasedCount1d: number,
  soldOutCount: number
): LighthouseAIRecoveryAlert[] {
  const alerts: LighthouseAIRecoveryAlert[] = [];

  if (folkestoneStatus !== 'disponible' || !folkestoneRate) {
    return alerts;
  }

  const effectiveMedian = flowtymMedian > 0 ? flowtymMedian : lighthouseMedian;
  const gapVsMedianEur = folkestoneRate - effectiveMedian;
  const gapVsMedianPct = effectiveMedian > 0 ? (gapVsMedianEur / effectiveMedian) * 100 : 0;

  // CAS 1 : Demande forte et concurrents qui augmentent leurs tarifs
  if ((demandLevel === 'forte' || demandLevel === 'tres_forte') && increasedCount1d >= 2) {
    const suggestedRate = Math.max(folkestoneRate + 25, effectiveMedian);
    alerts.push({
      id: `ai-cas1-${dateStr}`,
      caseType: 'CAS_1',
      title: 'Forte traction marché & hausse tarifaire compset',
      dateStr,
      triggerData: `Demande indice ${demandIndex}/100 (${demandLevel.toUpperCase()}) · ${increasedCount1d} concurrents en hausse sur 24h`,
      constat: `La demande du marché s'accélère vigoureusement et au moins ${increasedCount1d} établissements du compset ont relevé leurs prix. Votre tarif actuel (${folkestoneRate}€) risque d'être capté trop rapidement.`,
      recommandation: `Étudier une augmentation tarifaire de +${suggestedRate - folkestoneRate}€ pour porter le tarif BAR à ${suggestedRate}€ et imposer un Min Stay 2 nuits.`,
      priority: demandLevel === 'tres_forte' ? 'critique' : 'haute',
      suggestedActionRate: suggestedRate,
    });
  }

  // CAS 2 : Demande faible et concurrents qui diminuent leurs tarifs
  if (demandLevel === 'faible' && decreasedCount1d >= 2) {
    const suggestedRate = Math.max(180, Math.min(folkestoneRate - 15, effectiveMedian));
    alerts.push({
      id: `ai-cas2-${dateStr}`,
      caseType: 'CAS_2',
      title: 'Ralentissement de la demande & baisse compset',
      dateStr,
      triggerData: `Demande faible (${demandIndex}/100) · ${decreasedCount1d} concurrents en baisse tarifaire`,
      constat: `Le compset applique des remises tarifaires face à un essoufflement de la demande. Risque avéré de perte de compétitivité et de décrochage sur le canal Booking.com.`,
      recommandation: `Ajuster tactiquement le BAR à ${suggestedRate}€ (${suggestedRate - folkestoneRate}€) pour stimuler le volume et préserver votre part de marché.`,
      priority: 'moyenne',
      suggestedActionRate: suggestedRate,
    });
  }

  // CAS 3 : Folkestone Opéra significativement moins cher que la médiane
  if (gapVsMedianPct <= -8) {
    const suggestedRate = Math.round(effectiveMedian - 5);
    alerts.push({
      id: `ai-cas3-${dateStr}`,
      caseType: 'CAS_3',
      title: 'Sous-valorisation tarifaire détectée',
      dateStr,
      triggerData: `Folkestone à ${folkestoneRate}€ vs Médiane compset à ${effectiveMedian}€ (écart de ${gapVsMedianEur}€, soit ${gapVsMedianPct.toFixed(1)}%)`,
      constat: `Votre établissement se positionne nettement en dessous de la médiane recalculée du compset direct (${effectiveMedian}€). Risque de manque à gagner (RevPAR sous-optimal).`,
      recommandation: `Revaloriser le tarif vers ${suggestedRate}€ (+${suggestedRate - folkestoneRate}€) pour capter la prime de marché tout en restant attractif.`,
      priority: gapVsMedianPct <= -15 ? 'critique' : 'haute',
      suggestedActionRate: suggestedRate,
    });
  }

  // CAS 4 : Folkestone Opéra significativement plus cher que la médiane
  if (gapVsMedianPct >= 12 && demandLevel !== 'tres_forte') {
    alerts.push({
      id: `ai-cas4-${dateStr}`,
      caseType: 'CAS_4',
      title: 'Sur-tarification vs. Médiane du compset',
      dateStr,
      triggerData: `Folkestone à ${folkestoneRate}€ vs Médiane à ${effectiveMedian}€ (+${gapVsMedianEur}€ / +${gapVsMedianPct.toFixed(1)}%) avec demande ${demandLevel}`,
      constat: `Votre tarif dépasse la médiane compset de +${gapVsMedianPct.toFixed(1)}% alors que la pression de marché n'est pas exceptionnelle. Risque de ralentissement brutal du pickup.`,
      recommandation: `Vérifier si le taux d'occupation On The Books justifie cette prime ou réaligner à ${effectiveMedian + 10}€ pour sécuriser les réservations.`,
      priority: 'moyenne',
      suggestedActionRate: effectiveMedian + 10,
    });
  }

  // CAS 5 : Plusieurs concurrents affichent "Épuisé"
  if (soldOutCount >= 2) {
    const suggestedRate = folkestoneRate + 45;
    alerts.push({
      id: `ai-cas5-${dateStr}`,
      caseType: 'CAS_5',
      title: 'Tension sur l’offre : multiples concurrents complets',
      dateStr,
      triggerData: `${soldOutCount} hôtels concurrents complets ("Épuisé") sur la date`,
      constat: `Forte compression de l'offre d'hébergement dans le quartier Opéra (${soldOutCount} concurrents sold out). L'élasticité-prix devient très faible.`,
      recommandation: `Action immédiate : Augmenter le tarif BAR de +45€ (${suggestedRate}€), fermer les tarifs remisés non annulables et imposer un Min Stay 2 ou 3 nuits.`,
      priority: 'critique',
      suggestedActionRate: suggestedRate,
    });
  }

  return alerts;
}

/**
 * Création du jeu de données déterministe et réaliste pour Grand Hôtel Folkestone Opéra
 * Couvre 60 dates consécutives (du 10 novembre 2026 au 8 janvier 2027)
 */
export function createEmptyLighthouseDataset(): LighthouseExtractionDataset {
  return {
    metadata: {
      id: 'empty-live-data',
      fileName: '',
      extractedAt: '',
      sourceChannel: 'Lighthouse',
      currency: 'EUR',
      los: '1 nuit',
      occupancy: '2 personnes',
      compsetName: 'CompSet à configurer',
      referenceHotel: 'Folkestone Opéra',
      dateRange: '',
      totalDatesCount: 0,
      isCustomUpload: false,
      sourceStatus: 'live',
    },
    records: [],
  };
}

export function createDefaultLighthouseDataset(): LighthouseExtractionDataset {
  const records: LighthouseDailyItem[] = [];
  const baseDate = new Date('2026-11-10T12:00:00Z');
  const totalDays = 60;
  const frenchDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  for (let i = 0; i < totalDays; i++) {
    const curDate = new Date(baseDate);
    curDate.setUTCDate(baseDate.getUTCDate() + i);
    const dateStr = curDate.toISOString().split('T')[0];
    const dayOfWeek = frenchDays[curDate.getUTCDay()];
    const isWeekend = curDate.getUTCDay() === 5 || curDate.getUTCDay() === 6;

    // Simulation déterministe basée sur les événements parisiens réels
    let demandIndex = 58;
    if (dateStr >= '2026-11-12' && dateStr <= '2026-11-15') {
      // Paris Photo 2026
      demandIndex = 88;
    } else if (dateStr >= '2026-11-23' && dateStr <= '2026-11-26') {
      // Salon des Maires
      demandIndex = 95;
    } else if (dateStr >= '2026-12-05' && dateStr <= '2026-12-13') {
      // Salon Nautique
      demandIndex = 79;
    } else if (dateStr >= '2026-12-30' && dateStr <= '2027-01-02') {
      // Nouvel An
      demandIndex = 98;
    } else if (isWeekend) {
      demandIndex = 74;
    } else {
      demandIndex = 54 + ((i * 7) % 20);
    }

    const demandLevel = getDemandLevelFromIndex(demandIndex);

    // Évolutions de la demande
    const demandEvolution1d = demandIndex >= 85 ? +4 : demandIndex <= 45 ? -3 : ((i % 5) - 2);
    const demandEvolution3d = Math.round(demandEvolution1d * 2.2);
    const demandEvolution7d = Math.round(demandEvolution1d * 3.5);

    // Tarifs de base des concurrents
    const compSpecs = [
      { name: 'Hôtel Saint-Pétersbourg Opéra & Spa', stars: 4, base: 295 },
      { name: 'Hôtel Charing Cross', stars: 4, base: 280 },
      { name: 'Hôtel Astra Opéra (Astotel)', stars: 4, base: 290 },
      { name: 'Hôtel Indigo Paris - Opéra (IHG)', stars: 4, base: 340 },
      { name: 'Hôtel Pulitzer Paris', stars: 4, base: 275 },
    ];

    const demandMultiplier = demandIndex >= 90 ? 1.45 : demandIndex >= 80 ? 1.28 : demandIndex >= 70 ? 1.15 : 1.0;
    const weekendAdd = isWeekend ? 25 : 0;

    // Décision sold-out des concurrents
    const isMajorPeak = demandIndex >= 88;
    const soldOutIndices = isMajorPeak
      ? (dateStr === '2026-11-25' || dateStr === '2026-12-31' ? [0, 2, 3] : [0, 3])
      : demandIndex >= 78 ? [(i % 5)] : [];

    // Tarif Folkestone Opéra (Hôtel de référence)
    let folkestoneRateVal = Math.round((240 * demandMultiplier + weekendAdd) / 5) * 5;
    let folkestoneStatus: HotelAvailabilityStatus = 'disponible';
    let folkestoneStatusLabel = `${folkestoneRateVal} €`;

    // Évolution tarifaire Folkestone
    const folkEvolution1d = isMajorPeak ? +15 : ((i % 4) === 0 ? -10 : 0);
    const folkEvolution3d = isMajorPeak ? +25 : folkEvolution1d * 2;
    const folkEvolution7d = isMajorPeak ? +50 : folkEvolution1d * 3;

    // Concurrents
    const competitors: CompetitorRateRecord[] = compSpecs.map((cs, idx) => {
      const isSoldOut = soldOutIndices.includes(idx);
      const isLOS2 = !isSoldOut && isWeekend && idx === 1; // Charing Cross impose parfois LOS2
      const is1Pax = !isSoldOut && idx === 4 && (i % 9 === 0);

      let status: HotelAvailabilityStatus = 'disponible';
      let statusLabel = '';
      let rate: number | null = null;

      if (isSoldOut) {
        status = 'epuise';
        statusLabel = 'Épuisé';
      } else if (isLOS2) {
        status = 'los2';
        statusLabel = 'LOS2';
        rate = Math.round((cs.base * demandMultiplier + weekendAdd) / 5) * 5;
      } else if (is1Pax) {
        status = '1pax';
        statusLabel = '1 pax';
        rate = Math.round((cs.base * demandMultiplier - 15) / 5) * 5;
      } else {
        status = 'disponible';
        rate = Math.round((cs.base * demandMultiplier + weekendAdd + (idx * 5)) / 5) * 5;
        statusLabel = `${rate} €`;
      }

      // Évolutions vs hier / 3j / 7j
      const evo1d = isSoldOut ? null : isMajorPeak ? +20 : ((idx + i) % 5 === 0 ? -15 : (idx % 2 === 0 ? +10 : 0));
      const evo3d = evo1d !== null ? Math.round(evo1d * 1.8) : null;
      const evo7d = evo1d !== null ? Math.round(evo1d * 3.2) : null;

      const gapVsFolkestoneEur = rate !== null && folkestoneRateVal !== null ? rate - folkestoneRateVal : null;

      return {
        id: `comp-${idx}`,
        name: cs.name,
        stars: cs.stars,
        rate,
        status,
        statusLabel,
        gapVsFolkestoneEur,
        evolution1d: evo1d,
        evolution3d: evo3d,
        evolution7d: evo7d,
      };
    });

    // Calcul des statistiques
    const availableCompRates = competitors
      .filter((c) => c.status === 'disponible' && c.rate !== null && c.rate > 0)
      .map((c) => c.rate as number);

    const compsetAverage =
      availableCompRates.length > 0
        ? Math.round(availableCompRates.reduce((a, b) => a + b, 0) / availableCompRates.length)
        : Math.round(folkestoneRateVal * 1.1);

    const minCompRate = availableCompRates.length > 0 ? Math.min(...availableCompRates) : null;
    const minCompHotel = competitors.find((c) => c.rate === minCompRate);
    const minCompHotelName = minCompHotel ? minCompHotel.name : null;

    const maxCompRate = availableCompRates.length > 0 ? Math.max(...availableCompRates) : null;
    const maxCompHotel = competitors.find((c) => c.rate === maxCompRate);
    const maxCompHotelName = maxCompHotel ? maxCompHotel.name : null;

    // 1. Médiane recalculée Flowtym (stricte)
    const flowtymMedianEur = calculateFlowtymMedian(competitors);

    // 2. Médiane Lighthouse officielle (fournie dans l'onglet Aperçu)
    // Parfois légèrement différente car Lighthouse inclut l'hôtel de référence ou d'autres filtres
    const lighthouseMedianEur =
      flowtymMedianEur > 0 ? Math.round((flowtymMedianEur + (i % 3 === 0 ? 5 : i % 4 === 0 ? -5 : 0)) / 5) * 5 : 290;

    const medianGapEur = flowtymMedianEur - lighthouseMedianEur;
    const medianGapPct = lighthouseMedianEur > 0 ? Math.round((medianGapEur / lighthouseMedianEur) * 1000) / 10 : 0;

    // Classement et Positionnement Folkestone
    const allAvailableRates = [folkestoneRateVal, ...availableCompRates].sort((a, b) => a - b);
    const folkRank = allAvailableRates.indexOf(folkestoneRateVal) + 1;
    const totalAvailableHotels = allAvailableRates.length;

    let folkPositioning: 'en_dessous' | 'aligne' | 'au_dessus' = 'aligne';
    let folkPositioningLabel = 'Aligné sur le marché';

    const gapVsLhMedianEur = folkestoneRateVal - lighthouseMedianEur;
    const gapVsLhMedianPct = lighthouseMedianEur > 0 ? (gapVsLhMedianEur / lighthouseMedianEur) * 100 : 0;

    const gapVsFtMedianEur = folkestoneRateVal - flowtymMedianEur;
    const gapVsFtMedianPct = flowtymMedianEur > 0 ? (gapVsFtMedianEur / flowtymMedianEur) * 100 : 0;

    if (gapVsLhMedianPct <= -8 || folkRank === 1) {
      folkPositioning = 'en_dessous';
      folkPositioningLabel = folkRank === 1 ? '1er moins cher (En dessous)' : 'En dessous du marché';
    } else if (gapVsLhMedianPct >= 8 || folkRank === totalAvailableHotels) {
      folkPositioning = 'au_dessus';
      folkPositioningLabel = folkRank === totalAvailableHotels ? 'Le plus cher (Au-dessus)' : 'Au-dessus du marché';
    }

    const folkestone: FolkestoneRateRecord = {
      name: 'Folkestone Opéra',
      rate: folkestoneRateVal,
      status: folkestoneStatus,
      statusLabel: folkestoneStatusLabel,
      evolution1d: folkEvolution1d,
      evolution3d: folkEvolution3d,
      evolution7d: folkEvolution7d,
      gapVsLighthouseMedianEur: gapVsLhMedianEur,
      gapVsLighthouseMedianPct: Math.round(gapVsLhMedianPct * 10) / 10,
      gapVsFlowtymMedianEur: gapVsFtMedianEur,
      gapVsFlowtymMedianPct: Math.round(gapVsFtMedianPct * 10) / 10,
      rank: folkRank,
      totalAvailable: totalAvailableHotels,
      positioning: folkPositioning,
      positioningLabel: folkPositioningLabel,
    };

    // Dynamique concurrentielle
    const increasedCount1d = competitors.filter((c) => c.evolution1d !== null && c.evolution1d > 0).length;
    const decreasedCount1d = competitors.filter((c) => c.evolution1d !== null && c.evolution1d < 0).length;
    const stableCount1d = competitors.filter((c) => c.evolution1d === 0).length;

    const increasedCount7d = competitors.filter((c) => c.evolution7d !== null && c.evolution7d > 0).length;
    const decreasedCount7d = competitors.filter((c) => c.evolution7d !== null && c.evolution7d < 0).length;

    // Plus forte hausse / baisse sur 7j
    let maxIncrease7d: { hotelName: string; amount: number } | null = null;
    let maxDecrease7d: { hotelName: string; amount: number } | null = null;

    competitors.forEach((c) => {
      if (c.evolution7d !== null) {
        if (c.evolution7d > 0 && (!maxIncrease7d || c.evolution7d > maxIncrease7d.amount)) {
          maxIncrease7d = { hotelName: c.name, amount: c.evolution7d };
        }
        if (c.evolution7d < 0 && (!maxDecrease7d || c.evolution7d < maxDecrease7d.amount)) {
          maxDecrease7d = { hotelName: c.name, amount: c.evolution7d };
        }
      }
    });

    const soldOutCount = competitors.filter((c) => c.status === 'epuise').length;

    // Recommandations IA (CAS 1 à 5)
    const aiAlerts = generateLighthouseAIAlerts(
      dateStr,
      demandIndex,
      demandLevel,
      folkestoneRateVal,
      folkestoneStatus,
      lighthouseMedianEur,
      flowtymMedianEur,
      competitors,
      increasedCount1d,
      decreasedCount1d,
      soldOutCount
    );

    records.push({
      id: `lh-${dateStr}`,
      dateStr,
      dayOfWeek,
      isWeekend,
      demandIndex,
      demandLevel,
      demandEvolution1d,
      demandEvolution3d,
      demandEvolution7d,
      lighthouseMedianEur,
      flowtymMedianEur,
      medianGapEur,
      medianGapPct,
      folkestone,
      competitors,
      compsetAverage,
      minCompRate,
      minCompHotelName,
      maxCompRate,
      maxCompHotelName,
      totalAvailableHotels,
      totalSoldOutHotels: soldOutCount,
      increasedCount1d,
      decreasedCount1d,
      stableCount1d,
      increasedCount7d,
      decreasedCount7d,
      maxIncrease7d,
      maxDecrease7d,
      aiAlerts,
    });
  }

  return {
    metadata: {
      id: 'ext-default-lh',
      fileName: 'folkestone-opéra_bookingdotcom_lowest_los1_2guests.xlsx',
      extractedAt: '06/11/2026 à 08:30 (Heure de Paris)',
      sourceChannel: 'Booking.com',
      currency: 'EUR',
      los: '1 nuit',
      occupancy: '2 personnes',
      compsetName: 'Primary Compset',
      referenceHotel: 'Folkestone Opéra',
      dateRange: '10/11/2026 — 08/01/2027',
      totalDatesCount: records.length,
      isCustomUpload: false,
      sourceStatus: 'simulation',
    },
    records,
  };
}

/**
 * Générateur officiel du fichier Excel réel à 5 onglets :
 * `folkestone-opéra_bookingdotcom_lowest_los1_2guests.xlsx`
 * Permet au Revenue Manager de télécharger l'export conforme à la spécification Lighthouse
 */
export function exportLighthouseWorkbookToXLSX(
  dataset: LighthouseExtractionDataset = createDefaultLighthouseDataset()
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 1. Onglet Aperçu
  const apercuHeaders = [
    'Date',
    'Demande du marché',
    'Tarif le plus bas, médiane du compset',
    'Folkestone Opéra',
    'Minimum du compset',
    'Maximum du compset',
    'Moyenne du compset',
    'Hôtels disponibles',
    'Hôtels complets',
  ];

  const apercuRows = dataset.records.map((r) => [
    r.dateStr,
    r.demandIndex,
    r.lighthouseMedianEur,
    r.folkestone.rate ?? r.folkestone.statusLabel,
    r.minCompRate ?? 'N/D',
    r.maxCompRate ?? 'N/D',
    r.compsetAverage,
    r.totalAvailableHotels,
    r.totalSoldOutHotels,
  ]);

  const wsApercu = XLSX.utils.aoa_to_sheet([apercuHeaders, ...apercuRows]);
  XLSX.utils.book_append_sheet(wb, wsApercu, 'Aperçu');

  // 2. Onglet Tarifs
  const tarifsHeaders = [
    'Date',
    'Demande du marché',
    'Folkestone Opéra',
    ...FOLKESTONE_PRIMARY_COMPSET_NAMES,
  ];

  const tarifsRows = dataset.records.map((r) => {
    return [
      r.dateStr,
      r.demandIndex,
      r.folkestone.rate ?? r.folkestone.statusLabel,
      ...r.competitors.map((c) => (c.status === 'disponible' ? c.rate : c.statusLabel)),
    ];
  });

  const wsTarifs = XLSX.utils.aoa_to_sheet([tarifsHeaders, ...tarifsRows]);
  XLSX.utils.book_append_sheet(wb, wsTarifs, 'Tarifs');

  // 3. Onglet vs. Hier
  const vsHierHeaders = [
    'Date',
    'Demande vs. Hier',
    'Folkestone Opéra',
    ...FOLKESTONE_PRIMARY_COMPSET_NAMES,
  ];

  const vsHierRows = dataset.records.map((r) => [
    r.dateStr,
    r.demandEvolution1d !== null ? (r.demandEvolution1d > 0 ? `+${r.demandEvolution1d}` : `${r.demandEvolution1d}`) : '',
    r.folkestone.evolution1d !== null
      ? (r.folkestone.evolution1d > 0 ? `+${r.folkestone.evolution1d}` : `${r.folkestone.evolution1d}`)
      : '',
    ...r.competitors.map((c) =>
      c.evolution1d !== null ? (c.evolution1d > 0 ? `+${c.evolution1d}` : `${c.evolution1d}`) : ''
    ),
  ]);

  const wsVsHier = XLSX.utils.aoa_to_sheet([vsHierHeaders, ...vsHierRows]);
  XLSX.utils.book_append_sheet(wb, wsVsHier, 'vs. Hier');

  // 4. Onglet vs. 3 jours
  const vs3jHeaders = [
    'Date',
    'Demande vs. 3j',
    'Folkestone Opéra',
    ...FOLKESTONE_PRIMARY_COMPSET_NAMES,
  ];

  const vs3jRows = dataset.records.map((r) => [
    r.dateStr,
    r.demandEvolution3d !== null ? (r.demandEvolution3d > 0 ? `+${r.demandEvolution3d}` : `${r.demandEvolution3d}`) : '',
    r.folkestone.evolution3d !== null
      ? (r.folkestone.evolution3d > 0 ? `+${r.folkestone.evolution3d}` : `${r.folkestone.evolution3d}`)
      : '',
    ...r.competitors.map((c) =>
      c.evolution3d !== null ? (c.evolution3d > 0 ? `+${c.evolution3d}` : `${c.evolution3d}`) : ''
    ),
  ]);

  const wsVs3j = XLSX.utils.aoa_to_sheet([vs3jHeaders, ...vs3jRows]);
  XLSX.utils.book_append_sheet(wb, wsVs3j, 'vs. 3 jours');

  // 5. Onglet vs. 7 jours
  const vs7jHeaders = [
    'Date',
    'Demande vs. 7j',
    'Folkestone Opéra',
    ...FOLKESTONE_PRIMARY_COMPSET_NAMES,
  ];

  const vs7jRows = dataset.records.map((r) => [
    r.dateStr,
    r.demandEvolution7d !== null ? (r.demandEvolution7d > 0 ? `+${r.demandEvolution7d}` : `${r.demandEvolution7d}`) : '',
    r.folkestone.evolution7d !== null
      ? (r.folkestone.evolution7d > 0 ? `+${r.folkestone.evolution7d}` : `${r.folkestone.evolution7d}`)
      : '',
    ...r.competitors.map((c) =>
      c.evolution7d !== null ? (c.evolution7d > 0 ? `+${c.evolution7d}` : `${c.evolution7d}`) : ''
    ),
  ]);

  const wsVs7j = XLSX.utils.aoa_to_sheet([vs7jHeaders, ...vs7jRows]);
  XLSX.utils.book_append_sheet(wb, wsVs7j, 'vs. 7 jours');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}

/**
 * Analyseur robuste d'un fichier Excel Lighthouse (.xlsx) réel déposé par l'utilisateur
 */
export function parseLighthouseExcelFile(
  buffer: ArrayBuffer,
  fileName: string
): LighthouseExtractionDataset {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const normalizeSheetName = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const sheets = wb.SheetNames;
  const findSheet = (keywords: string[]) => {
    return sheets.find((s) => {
      const norm = normalizeSheetName(s);
      return keywords.some((k) => norm.includes(normalizeSheetName(k)));
    });
  };

  const apercuName = findSheet(['apercu', 'overview']) || sheets[0];
  const tarifsName = findSheet(['tarifs', 'rates', 'prices']) || sheets[1] || sheets[0];
  const vsHierName = findSheet(['vshier', 'hier', 'yesterday', '1d', 'j1']);
  const vs3jName = findSheet(['vs3jours', 'vs3j', '3jours', '3j', '3days']);
  const vs7jName = findSheet(['vs7jours', 'vs7j', '7jours', '7j', '7days']);

  const wsApercu = wb.Sheets[apercuName];
  const wsTarifs = wb.Sheets[tarifsName];
  const wsVsHier = vsHierName ? wb.Sheets[vsHierName] : undefined;
  const wsVs3j = vs3jName ? wb.Sheets[vs3jName] : undefined;
  const wsVs7j = vs7jName ? wb.Sheets[vs7jName] : undefined;

  const rawTarifs: any[][] = XLSX.utils.sheet_to_json(wsTarifs, { header: 1, defval: '' });
  const rawApercu: any[][] = XLSX.utils.sheet_to_json(wsApercu, { header: 1, defval: '' });
  const rawVsHier: any[][] = wsVsHier ? XLSX.utils.sheet_to_json(wsVsHier, { header: 1, defval: '' }) : [];
  const rawVs3j: any[][] = wsVs3j ? XLSX.utils.sheet_to_json(wsVs3j, { header: 1, defval: '' }) : [];
  const rawVs7j: any[][] = wsVs7j ? XLSX.utils.sheet_to_json(wsVs7j, { header: 1, defval: '' }) : [];

  if (rawTarifs.length < 2) {
    throw new Error("Le fichier ne contient pas de données dans l'onglet des tarifs.");
  }

  // Identifier les en-têtes
  const headerRow = rawTarifs[0].map((h: any) => String(h).trim());
  const dateColIdx = headerRow.findIndex((h) => /date/i.test(h));
  const demandColIdx = headerRow.findIndex((h) => /demande/i.test(h));
  const folkestoneColIdx = headerRow.findIndex((h) => /folkestone/i.test(h));

  // Les autres colonnes sont les concurrents
  const competitorCols: { name: string; idx: number }[] = [];
  headerRow.forEach((colName, idx) => {
    if (idx !== dateColIdx && idx !== demandColIdx && idx !== folkestoneColIdx && colName.length > 0) {
      competitorCols.push({ name: colName, idx });
    }
  });

  // Mapper Aperçu par Date
  const apercuMap = new Map<string, { demand: number; medianLh: number }>();
  if (rawApercu.length > 1) {
    const apHeaders = rawApercu[0].map((h: any) => String(h).trim());
    const apDateIdx = apHeaders.findIndex((h) => /date/i.test(h));
    const apDemandIdx = apHeaders.findIndex((h) => /demande/i.test(h));
    const apMedianIdx = apHeaders.findIndex((h) => /m[ée]diane/i.test(h));

    for (let r = 1; r < rawApercu.length; r++) {
      const row = rawApercu[r];
      const d = parseExcelDate(row[apDateIdx]);
      if (d) {
        const dem = parseFloat(row[apDemandIdx]) || 50;
        const med = parseFloat(row[apMedianIdx]) || 280;
        apercuMap.set(d, { demand: dem, medianLh: med });
      }
    }
  }

  // Mapper les évolutions vs Hier, vs 3j, vs 7j par (date + nom d'hôtel)
  const mapEvoSheet = (rows: any[][]) => {
    const m = new Map<string, number | null>();
    if (rows.length < 2) return m;
    const hd = rows[0].map((h: any) => String(h).trim());
    const dIdx = hd.findIndex((h) => /date/i.test(h));

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const d = parseExcelDate(row[dIdx]);
      if (!d) continue;

      hd.forEach((colName, cIdx) => {
        if (cIdx !== dIdx && colName) {
          const valStr = String(row[cIdx]).trim().replace('€', '').replace('+', '');
          const valNum = parseFloat(valStr);
          m.set(`${d}|${colName.toLowerCase()}`, isNaN(valNum) ? null : valNum);
        }
      });
    }
    return m;
  };

  const evoHierMap = mapEvoSheet(rawVsHier);
  const evo3jMap = mapEvoSheet(rawVs3j);
  const evo7jMap = mapEvoSheet(rawVs7j);

  const frenchDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const records: LighthouseDailyItem[] = [];

  for (let r = 1; r < rawTarifs.length; r++) {
    const row = rawTarifs[r];
    const dateStr = parseExcelDate(row[dateColIdx >= 0 ? dateColIdx : 0]);
    if (!dateStr) continue;

    const dt = new Date(`${dateStr}T12:00:00Z`);
    const dayOfWeek = frenchDays[dt.getUTCDay()];
    const isWeekend = dt.getUTCDay() === 5 || dt.getUTCDay() === 6;

    // Demande
    const apInfo = apercuMap.get(dateStr);
    const demandIndex = apInfo ? apInfo.demand : demandColIdx >= 0 ? parseFloat(row[demandColIdx]) || 55 : 55;
    const demandLevel = getDemandLevelFromIndex(demandIndex);

    // Évolution demande
    const demandEvolution1d = evoHierMap.get(`${dateStr}|demande vs. hier`) ?? null;
    const demandEvolution3d = evo3jMap.get(`${dateStr}|demande vs. 3j`) ?? null;
    const demandEvolution7d = evo7jMap.get(`${dateStr}|demande vs. 7j`) ?? null;

    // Folkestone Opéra
    const folkRawVal = folkestoneColIdx >= 0 ? row[folkestoneColIdx] : '';
    const { rate: folkRate, status: folkStatus, label: folkLabel } = parseRateCell(folkRawVal);

    const folkEvo1d = evoHierMap.get(`${dateStr}|folkestone opéra`) ?? evoHierMap.get(`${dateStr}|folkestone`) ?? null;
    const folkEvo3d = evo3jMap.get(`${dateStr}|folkestone opéra`) ?? evo3jMap.get(`${dateStr}|folkestone`) ?? null;
    const folkEvo7d = evo7jMap.get(`${dateStr}|folkestone opéra`) ?? evo7jMap.get(`${dateStr}|folkestone`) ?? null;

    // Concurrents
    const competitors: CompetitorRateRecord[] = competitorCols.map((cCol, idx) => {
      const rawVal = row[cCol.idx];
      const { rate, status, label } = parseRateCell(rawVal);

      const evo1d = evoHierMap.get(`${dateStr}|${cCol.name.toLowerCase()}`) ?? null;
      const evo3d = evo3jMap.get(`${dateStr}|${cCol.name.toLowerCase()}`) ?? null;
      const evo7d = evo7jMap.get(`${dateStr}|${cCol.name.toLowerCase()}`) ?? null;

      const gapVsFolkestoneEur = rate !== null && folkRate !== null ? rate - folkRate : null;

      return {
        id: `comp-upload-${idx}`,
        name: cCol.name,
        stars: 4,
        rate,
        status,
        statusLabel: label,
        gapVsFolkestoneEur,
        evolution1d: evo1d,
        evolution3d: evo3d,
        evolution7d: evo7d,
      };
    });

    // Médianes
    const flowtymMedianEur = calculateFlowtymMedian(competitors);
    const lighthouseMedianEur = apInfo ? apInfo.medianLh : flowtymMedianEur;
    const medianGapEur = flowtymMedianEur - lighthouseMedianEur;
    const medianGapPct = lighthouseMedianEur > 0 ? Math.round((medianGapEur / lighthouseMedianEur) * 1000) / 10 : 0;

    // Stats
    const availableCompRates = competitors
      .filter((c) => c.status === 'disponible' && c.rate !== null && c.rate > 0)
      .map((c) => c.rate as number);

    const compsetAverage =
      availableCompRates.length > 0
        ? Math.round(availableCompRates.reduce((a, b) => a + b, 0) / availableCompRates.length)
        : folkRate ?? 250;

    const minCompRate = availableCompRates.length > 0 ? Math.min(...availableCompRates) : null;
    const minCompHotel = competitors.find((c) => c.rate === minCompRate);
    const minCompHotelName = minCompHotel ? minCompHotel.name : null;

    const maxCompRate = availableCompRates.length > 0 ? Math.max(...availableCompRates) : null;
    const maxCompHotel = competitors.find((c) => c.rate === maxCompRate);
    const maxCompHotelName = maxCompHotel ? maxCompHotel.name : null;

    const allAvailableRates = folkRate !== null ? [folkRate, ...availableCompRates].sort((a, b) => a - b) : [...availableCompRates].sort((a, b) => a - b);
    const folkRank = folkRate !== null ? allAvailableRates.indexOf(folkRate) + 1 : null;
    const totalAvailableHotels = allAvailableRates.length;

    let folkPositioning: 'en_dessous' | 'aligne' | 'au_dessus' | 'non_disponible' = 'non_disponible';
    let folkPositioningLabel = 'Non disponible';

    if (folkRate !== null && lighthouseMedianEur > 0) {
      const gapPct = ((folkRate - lighthouseMedianEur) / lighthouseMedianEur) * 100;
      if (gapPct <= -8 || folkRank === 1) {
        folkPositioning = 'en_dessous';
        folkPositioningLabel = folkRank === 1 ? '1er moins cher (En dessous)' : 'En dessous du marché';
      } else if (gapPct >= 8 || folkRank === totalAvailableHotels) {
        folkPositioning = 'au_dessus';
        folkPositioningLabel = folkRank === totalAvailableHotels ? 'Le plus cher (Au-dessus)' : 'Au-dessus du marché';
      } else {
        folkPositioning = 'aligne';
        folkPositioningLabel = 'Aligné sur le marché';
      }
    }

    const folkestone: FolkestoneRateRecord = {
      name: 'Folkestone Opéra',
      rate: folkRate,
      status: folkStatus,
      statusLabel: folkLabel,
      evolution1d: folkEvo1d,
      evolution3d: folkEvo3d,
      evolution7d: folkEvo7d,
      gapVsLighthouseMedianEur: folkRate !== null ? folkRate - lighthouseMedianEur : null,
      gapVsLighthouseMedianPct: folkRate !== null && lighthouseMedianEur > 0 ? Math.round(((folkRate - lighthouseMedianEur) / lighthouseMedianEur) * 1000) / 10 : null,
      gapVsFlowtymMedianEur: folkRate !== null ? folkRate - flowtymMedianEur : null,
      gapVsFlowtymMedianPct: folkRate !== null && flowtymMedianEur > 0 ? Math.round(((folkRate - flowtymMedianEur) / flowtymMedianEur) * 1000) / 10 : null,
      rank: folkRank,
      totalAvailable: totalAvailableHotels,
      positioning: folkPositioning,
      positioningLabel: folkPositioningLabel,
    };

    const increasedCount1d = competitors.filter((c) => c.evolution1d !== null && c.evolution1d > 0).length;
    const decreasedCount1d = competitors.filter((c) => c.evolution1d !== null && c.evolution1d < 0).length;
    const stableCount1d = competitors.filter((c) => c.evolution1d === 0).length;

    const increasedCount7d = competitors.filter((c) => c.evolution7d !== null && c.evolution7d > 0).length;
    const decreasedCount7d = competitors.filter((c) => c.evolution7d !== null && c.evolution7d < 0).length;

    let maxIncrease7d: { hotelName: string; amount: number } | null = null;
    let maxDecrease7d: { hotelName: string; amount: number } | null = null;

    competitors.forEach((c) => {
      if (c.evolution7d !== null) {
        if (c.evolution7d > 0 && (!maxIncrease7d || c.evolution7d > maxIncrease7d.amount)) {
          maxIncrease7d = { hotelName: c.name, amount: c.evolution7d };
        }
        if (c.evolution7d < 0 && (!maxDecrease7d || c.evolution7d < maxDecrease7d.amount)) {
          maxDecrease7d = { hotelName: c.name, amount: c.evolution7d };
        }
      }
    });

    const soldOutCount = competitors.filter((c) => c.status === 'epuise').length;

    const aiAlerts = generateLighthouseAIAlerts(
      dateStr,
      demandIndex,
      demandLevel,
      folkRate,
      folkStatus,
      lighthouseMedianEur,
      flowtymMedianEur,
      competitors,
      increasedCount1d,
      decreasedCount1d,
      soldOutCount
    );

    records.push({
      id: `lh-import-${dateStr}`,
      dateStr,
      dayOfWeek,
      isWeekend,
      demandIndex,
      demandLevel,
      demandEvolution1d,
      demandEvolution3d,
      demandEvolution7d,
      lighthouseMedianEur,
      flowtymMedianEur,
      medianGapEur,
      medianGapPct,
      folkestone,
      competitors,
      compsetAverage,
      minCompRate,
      minCompHotelName,
      maxCompRate,
      maxCompHotelName,
      totalAvailableHotels,
      totalSoldOutHotels: soldOutCount,
      increasedCount1d,
      decreasedCount1d,
      stableCount1d,
      increasedCount7d,
      decreasedCount7d,
      maxIncrease7d,
      maxDecrease7d,
      aiAlerts,
    });
  }

  records.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  return {
    metadata: {
      id: `ext-upload-${Date.now()}`,
      fileName,
      extractedAt: `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      sourceChannel: 'Booking.com',
      currency: 'EUR',
      los: '1 nuit',
      occupancy: '2 personnes',
      compsetName: 'Primary Compset',
      referenceHotel: 'Folkestone Opéra',
      dateRange: records.length > 0 ? `${records[0].dateStr} — ${records[records.length - 1].dateStr}` : 'Inconnu',
      totalDatesCount: records.length,
      isCustomUpload: true,
      sourceStatus: 'imported',
    },
    records,
  };
}

function parseRateCell(val: any): { rate: number | null; status: HotelAvailabilityStatus; label: string } {
  if (val === null || val === undefined || val === '') {
    return { rate: null, status: 'non_disponible', label: 'N/D' };
  }

  const str = String(val).trim().toLowerCase();

  if (str.includes('epuis') || str.includes('complet') || str.includes('sold')) {
    return { rate: null, status: 'epuise', label: 'Épuisé' };
  }
  if (str.includes('los2') || str.includes('2 nuits')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return { rate: isNaN(num) ? null : num, status: 'los2', label: 'LOS2' };
  }
  if (str.includes('1 pax') || str.includes('1pax')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return { rate: isNaN(num) ? null : num, status: '1pax', label: '1 pax' };
  }

  // Nombre
  const cleaned = str.replace('€', '').replace('eur', '').replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);

  if (!isNaN(num) && num > 0) {
    return { rate: Math.round(num), status: 'disponible', label: `${Math.round(num)} €` };
  }

  return { rate: null, status: 'non_disponible', label: String(val).trim() || 'N/D' };
}

function parseExcelDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD/MM/YYYY
  const m = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }

  // Serial Excel number (e.g. 46330)
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const parsed = new Date((num - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  return null;
}
