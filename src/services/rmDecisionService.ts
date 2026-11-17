/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RMAlertItem, RMDecisionRecord, RMDecisionAction, StandardDemandLevel } from '../types';
import { syncRMDecisionToSupabase } from './supabaseSyncService';
import { INITIAL_HOTELS } from '../data/mockData';
import { getHotelRMSConfig } from './rmsSettingsService';
import { emitRMSUpdate } from './rmsMetricsEngine';
import { getTodayIsoDate, addDaysIso } from '../utils/eventFilterUtils';

function ensureUpcomingDate(preferredDate: string, fallbackOffsetDays: number, todayStr: string = getTodayIsoDate()): string {
  return preferredDate >= todayStr ? preferredDate : addDaysIso(todayStr, fallbackOffsetDays);
}

const ALERTS_STORAGE_KEY = 'flowtym_rm_alerts_v1';
const DECISIONS_STORAGE_KEY = 'flowtym_rm_decisions_log_v1';

export const RM_HOTEL_SAFETY_LIMITS = {
  RATE_FLOOR_EUR: 180,
  RATE_CEILING_EUR: 550,
  MAX_SINGLE_STEP_EUR: 100,
  COMPSET_HIGH_DISCONNECT_EUR: 80,
};

export type RMSafetyAlertSeverity = 'critical' | 'warning' | 'info' | 'safe';

export interface RMSafetyEvaluation {
  hasViolation: boolean;
  severity: RMSafetyAlertSeverity;
  type: 'ceiling_breach' | 'floor_breach' | 'large_step' | 'compset_disconnect' | 'safe';
  badgeLabel: string;
  badgeClass: string;
  rowHighlightClass: string;
  cellHighlightClass: string;
  explanation: string;
  ruleCode: string;
}

export function evaluateRMSafety(
  recommendedRate: number,
  currentRate: number,
  compsetAvgRate?: number,
  limits = RM_HOTEL_SAFETY_LIMITS
): RMSafetyEvaluation {
  const gap = Math.abs(recommendedRate - currentRate);

  // 1. Plafond de sécurité (550 €)
  if (recommendedRate >= limits.RATE_CEILING_EUR) {
    const isExceeded = recommendedRate > limits.RATE_CEILING_EUR;
    return {
      hasViolation: true,
      severity: 'critical',
      type: 'ceiling_breach',
      badgeLabel: isExceeded
        ? `🚨 Dépassement Plafond (${recommendedRate}€ > ${limits.RATE_CEILING_EUR}€)`
        : `⚠️ Plafond Max Atteint (${limits.RATE_CEILING_EUR}€)`,
      badgeClass: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800/70 ring-1 ring-rose-400 dark:ring-rose-700',
      rowHighlightClass: 'bg-rose-50/60 dark:bg-rose-950/25 border-l-4 border-l-rose-500',
      cellHighlightClass: 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800/70 ring-2 ring-rose-400/40 font-black',
      explanation: `Le tarif conseillé (${recommendedRate}€) atteint ou dépasse le tarif plafond configuré (${limits.RATE_CEILING_EUR}€). Risque d'élasticité prix négative et de décrochage du compset.`,
      ruleCode: 'GUARDRAIL_CEILING_LIMIT',
    };
  }

  // 2. Plancher de sécurité (180 €)
  if (recommendedRate <= limits.RATE_FLOOR_EUR) {
    const isUnder = recommendedRate < limits.RATE_FLOOR_EUR;
    return {
      hasViolation: true,
      severity: 'critical',
      type: 'floor_breach',
      badgeLabel: isUnder
        ? `🚨 Sous-Plancher Interdit (${recommendedRate}€ < ${limits.RATE_FLOOR_EUR}€)`
        : `⚠️ Plancher Min Atteint (${limits.RATE_FLOOR_EUR}€)`,
      badgeClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/70 ring-1 ring-amber-400 dark:ring-amber-700',
      rowHighlightClass: 'bg-amber-50/60 dark:bg-amber-950/25 border-l-4 border-l-amber-500',
      cellHighlightClass: 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800/70 ring-2 ring-amber-400/40 font-black',
      explanation: `Le tarif conseillé (${recommendedRate}€) atteint la borne plancher minimale garantie (${limits.RATE_FLOOR_EUR}€). Risque d'érosion de la valeur perçue et de l'ADR net.`,
      ruleCode: 'GUARDRAIL_FLOOR_LIMIT',
    };
  }

  // 3. Saut tarifaire unitaire violent (|gap| >= 100 €)
  if (gap >= limits.MAX_SINGLE_STEP_EUR) {
    return {
      hasViolation: true,
      severity: 'warning',
      type: 'large_step',
      badgeLabel: `⚡ Saut Brutal (+${gap}€)`,
      badgeClass: 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800/70',
      rowHighlightClass: 'bg-orange-50/40 dark:bg-orange-950/20 border-l-4 border-l-orange-400',
      cellHighlightClass: 'bg-orange-100 dark:bg-orange-950/70 text-orange-900 dark:text-orange-200 border border-orange-300 dark:border-orange-800/70 font-black',
      explanation: `Variation unitaire supérieure au saut de sécurité de ${limits.MAX_SINGLE_STEP_EUR}€ (+${gap}€ vs tarif actuel ${currentRate}€). Contrôle de cohérence requis.`,
      ruleCode: 'GUARDRAIL_MAX_STEP_JUMP',
    };
  }

  // 4. Déconnexion anormale du compset (+80 € au dessus de la moyenne concurrents)
  if (compsetAvgRate && recommendedRate > compsetAvgRate + limits.COMPSET_HIGH_DISCONNECT_EUR) {
    const spread = recommendedRate - compsetAvgRate;
    return {
      hasViolation: true,
      severity: 'info',
      type: 'compset_disconnect',
      badgeLabel: `⚠️ Écart Compset (+${spread}€)`,
      badgeClass: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70',
      rowHighlightClass: 'bg-indigo-50/20 dark:bg-indigo-950/20 border-l-4 border-l-indigo-400',
      cellHighlightClass: 'text-indigo-900 dark:text-indigo-200 font-bold',
      explanation: `Tarif supérieur de ${spread}€ à la moyenne du compset direct (${compsetAvgRate}€). Vérifier le taux de compression concurrentiel.`,
      ruleCode: 'GUARDRAIL_COMPSET_SPREAD',
    };
  }

  // 5. Conforme
  return {
    hasViolation: false,
    severity: 'safe',
    type: 'safe',
    badgeLabel: `🛡️ Conforme [${limits.RATE_FLOOR_EUR}€ - ${limits.RATE_CEILING_EUR}€]`,
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70',
    rowHighlightClass: '',
    cellHighlightClass: 'text-slate-900 dark:text-slate-100 font-bold',
    explanation: `Tarif conforme aux bornes de sécurité de l'établissement (${limits.RATE_FLOOR_EUR}€ – ${limits.RATE_CEILING_EUR}€).`,
    ruleCode: 'GUARDRAIL_COMPLIANT',
  };
}

export function getMarketDemandPercentage(demandLevel?: string): number {
  const l = (demandLevel || '').toLowerCase();
  if (l.includes('excep') || l.includes('critique')) return 96;
  if (l.includes('tres') || l.includes('très')) return 86;
  if (l.includes('elev') || l.includes('élev')) return 74;
  if (l.includes('moder') || l.includes('modér') || l.includes('moyen')) return 58;
  if (l.includes('faible')) return 38;
  return 58;
}

export function formatDemandWithPercentage(demandLevel?: string): {
  label: string;
  badge: string;
  percent: number;
  colorClass: string;
} {
  const percent = getMarketDemandPercentage(demandLevel);
  const l = (demandLevel || '').toLowerCase();
  if (l.includes('excep') || l.includes('critique')) {
    return { label: 'Exceptionnel', badge: `🔥 Exceptionnel (${percent}%)`, percent, colorClass: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/70' };
  }
  if (l.includes('tres') || l.includes('très')) {
    return { label: 'Très fort', badge: `⚡ Très fort (${percent}%)`, percent, colorClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70' };
  }
  if (l.includes('elev') || l.includes('élev')) {
    return { label: 'Élevé', badge: `📈 Élevé (${percent}%)`, percent, colorClass: 'bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800/70' };
  }
  if (l.includes('faible')) {
    return { label: 'Faible', badge: `💤 Faible (${percent}%)`, percent, colorClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
  }
  return { label: 'Modéré', badge: `⚖️ Modéré (${percent}%)`, percent, colorClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
}

export function getInitialRMAlerts(todayStr: string = getTodayIsoDate()): RMAlertItem[] {
  return [
  {
    id: 'alert-nouvel-an-2026',
    hotelId: 'hotel-opera',
    eventId: 'event-nouvel-an-2026',
    eventTitle: 'Réveillon Saint-Sylvestre & Concerts Festifs Opéra Garnier',
    venueName: 'Palais Garnier & Madeleine',
    category: 'culturel',
    dateStr: ensureUpcomingDate('2026-12-31', 21, todayStr),
    demandLevel: 'exceptionnel',
    currentRate: 320,
    recommendedRate: 550, // Bornes Plafond Atteinte (550 €)
    gapEur: 230,
    gapPercent: 71.9,
    confidenceScore: 99,
    sources: [
      'Opéra National de Paris — Billetterie Gala',
      'Observatoire Touristique de Paris (Saturation Festivités)',
      'Benchmark Compset Opéra (Hôtel Saint-Pétersbourg sold-out à 580€)',
      'D-EDGE OTB 92%'
    ],
    urgency: 'critique',
    status: 'active',
    reason: 'Saturation exceptionnelle du quartier Opéra. 4 concurrents sur 5 complets. Le moteur recommande d\'atteindre le plafond de sécurité absolu configuré de 550€.',
    compressionFactor: 'Alerte Borne Plafond : tarif plafonné à la limite stricte autorisée (550€) pour éviter le risque d\'inélasticité.',
    compsetAverageRate: 520,
    soldOutCompetitorsCount: 4,
    minStayRecommended: 3,
    ctaRecommended: true,
  },
  {
    id: 'alert-sial-2026',
    hotelId: 'hotel-opera',
    eventId: 'event-sial-2026',
    eventTitle: 'Congrès International & Sommet Tech Paris Nord Villepinte',
    venueName: 'Parc des Expositions Paris Nord Villepinte',
    category: 'salons_foires',
    dateStr: addDaysIso(todayStr, 5),
    demandLevel: 'exceptionnel',
    currentRate: 275,
    recommendedRate: 395, // Saut > 100€ (gap: 120€)
    gapEur: 120,
    gapPercent: 43.6,
    confidenceScore: 98,
    sources: [
      'Comexposium — Organisateur Officiel SIAL',
      'Viparis Paris Nord Villepinte',
      'Observatoire du Tourisme de Paris & Île-de-France',
      'Booking.com & Expedia Live Rate Feed'
    ],
    urgency: 'critique',
    status: 'active',
    reason: '285 000 professionnels de l’agroalimentaire dont 70% d’internationaux. Saturation extrême de l’hôtellerie francilienne (RER B direct Gare du Nord / Châtelet). 3 concurrents sur 5 sont complets (sold-out).',
    compressionFactor: 'Saturation hôtelière critique. Saut tarifaire important (+120€) nécessitant validation humaine renforcée.',
    compsetAverageRate: 410,
    soldOutCompetitorsCount: 3,
    minStayRecommended: 3,
    ctaRecommended: true,
  },
  {
    id: 'alert-smcl-2026',
    hotelId: 'hotel-opera',
    eventId: 'event-smcl-2026',
    eventTitle: 'Salon des Maires et des Collectivités Locales 2026 (SMCL) & 108e Congrès AMF',
    venueName: 'Paris Expo Porte de Versailles',
    category: 'salons_foires',
    dateStr: ensureUpcomingDate('2026-11-24', 8, todayStr),
    demandLevel: 'eleve',
    currentRate: 260,
    recommendedRate: 345, // Conforme aux bornes
    gapEur: 85,
    gapPercent: 32.7,
    confidenceScore: 96,
    sources: [
      'Site Officiel SMCL (salondesmaires.com)',
      'Association des Maires de France (amf.asso.fr)',
      'Viparis Porte de Versailles — Calendrier Salons',
      'Benchmark Compset Opéra (Hôtel Saint-Pétersbourg, Astra Opéra)'
    ],
    urgency: 'critique',
    status: 'active',
    reason: '60 000 élus, décideurs territoriaux et délégations nationales attendus. Temps d\'accès direct depuis Saint-Lazare/Madeleine (Ligne 12 directe Porte de Versailles). Le compset affiche déjà 85% d\'occupation moyenne sur ces dates.',
    compressionFactor: 'Forte demande institutionnelle et corporate à haut pouvoir d’achat. Tarif parfaitement conforme aux bornes de l\'hôtel.',
    compsetAverageRate: 338,
    soldOutCompetitorsCount: 2,
    minStayRecommended: 2,
    ctaRecommended: false,
  },
  {
    id: 'alert-mondial-auto-2026',
    hotelId: 'hotel-opera',
    eventId: 'event-mondial-auto-2026',
    eventTitle: 'Grand Salon Professionnel & Forum Européen Porte de Versailles',
    venueName: 'Paris Expo Porte de Versailles',
    category: 'salons_foires',
    dateStr: addDaysIso(todayStr, 12),
    demandLevel: 'exceptionnel',
    currentRate: 270,
    recommendedRate: 375, // Saut > 100€ (gap: 105€)
    gapEur: 105,
    gapPercent: 38.9,
    confidenceScore: 97,
    sources: [
      'PFA — Plateforme de la Filière Automobile',
      'Viparis Porte de Versailles',
      'Paris je t’aime Convention Bureau'
    ],
    urgency: 'haute',
    status: 'active',
    reason: '490 000 visiteurs et professionnels. Pression internationale intense sur la semaine 42. Saut unitaire supérieur à 100€.',
    compressionFactor: 'Chevauchement partiel avec le SIAL et la préparation des délégations presse.',
    compsetAverageRate: 365,
    soldOutCompetitorsCount: 2,
    minStayRecommended: 3,
    ctaRecommended: false,
  },
  {
    id: 'alert-janvier-creux-2027',
    hotelId: 'hotel-opera',
    eventId: 'event-soldes-janvier-2027',
    eventTitle: 'Dimanche Creux Hivernal Post-Fêtes & Début Soldes d\'Hiver',
    venueName: 'Grands Magasins Haussmann / Opéra',
    category: 'culturel',
    dateStr: ensureUpcomingDate('2027-01-10', 28, todayStr),
    demandLevel: 'normal',
    currentRate: 215,
    recommendedRate: 180, // Bornes Plancher Atteinte (180 €)
    gapEur: -35,
    gapPercent: -16.3,
    confidenceScore: 92,
    sources: [
      'Historique D-EDGE Saisons Précédentes (Janvier S2)',
      'CCI Paris Île-de-France — Calendrier Soldes',
      'Lighthouse Benchmark Opéra (Compset min à 175€)'
    ],
    urgency: 'moyenne',
    status: 'active',
    reason: 'Ralentissement classique des arrivées d\'affaires le dimanche soir de début janvier. L\'algorithme ajuste le tarif au plancher de sécurité de 180€ pour préserver le volume sans dégrader le positionnement.',
    compressionFactor: 'Alerte Borne Plancher : tarif fixé sur le plancher strict garanti de 180€ (interdiction d\'abaisser en-dessous).',
    compsetAverageRate: 195,
    soldOutCompetitorsCount: 0,
    minStayRecommended: 1,
    ctaRecommended: false,
  },
  {
    id: 'alert-rolex-masters-2026',
    hotelId: 'hotel-opera',
    eventId: 'event-rolex-paris-masters-2026',
    eventTitle: 'Tournoi Indoor ATP & Événement Sportif Paris La Défense',
    venueName: 'Paris La Défense Arena',
    category: 'sport',
    dateStr: addDaysIso(todayStr, 17),
    demandLevel: 'eleve',
    currentRate: 260,
    recommendedRate: 330, // Conforme
    gapEur: 70,
    gapPercent: 26.9,
    confidenceScore: 93,
    sources: [
      'Fédération Française de Tennis (FFT)',
      'Paris La Défense Arena — Billetterie Officielle',
      'ATP Tour Calendar'
    ],
    urgency: 'haute',
    status: 'active',
    reason: '145 000 spectateurs et packages VIP sur 9 jours. Accès direct depuis Madeleine / Auber (RER A direct La Défense en 8 min). Clientèle loisir premium et entreprises.',
    compressionFactor: 'Weekend de Toussaint combiné aux demi-finales du tournoi.',
    compsetAverageRate: 325,
    soldOutCompetitorsCount: 1,
    minStayRecommended: 2,
    ctaRecommended: false,
  },
  {
    id: 'alert-smcl-2027',
    hotelId: 'hotel-opera',
    eventId: 'event-smcl-2027',
    eventTitle: 'Salon des Maires et des Collectivités Locales 2027 (SMCL) — Anticipation J-380',
    venueName: 'Paris Expo Porte de Versailles',
    category: 'salons_foires',
    dateStr: ensureUpcomingDate('2027-11-23', 45, todayStr),
    demandLevel: 'eleve',
    currentRate: 260,
    recommendedRate: 350, // Conforme
    gapEur: 90,
    gapPercent: 34.6,
    confidenceScore: 92,
    sources: [
      'Calendrier prévisionnel AMF / Salons de France',
      'Base historique Flowtym Event Intelligence'
    ],
    urgency: 'moyenne',
    status: 'active',
    reason: 'Événement annuel récurrent à impact commercial garanti. Les réservations institutionnelles de groupes débutent dès J-360. Verrouiller la grille tarifaire précoce pour éviter les contrats groupe sous-évalués.',
    compressionFactor: 'Anticipation stratégique des contingents institutionnels et des mandats d’élus.',
    compsetAverageRate: 340,
    soldOutCompetitorsCount: 0,
    minStayRecommended: 2,
    ctaRecommended: false,
  },
];
}

export const INITIAL_RM_ALERTS: RMAlertItem[] = getInitialRMAlerts();

/**
 * Construit dynamiquement des alertes RM calibrées pour un hôtel hors Opéra
 */
function buildDynamicAlertsForHotel(hotelId: string): RMAlertItem[] {
  const todayStr = getTodayIsoDate();
  if (hotelId === 'hotel-opera') return getInitialRMAlerts(todayStr);
  const hotel = INITIAL_HOTELS.find((h) => h.id === hotelId) || INITIAL_HOTELS[0];
  const cfg = getHotelRMSConfig(hotel);
  const floor = cfg.rmRules?.barFloorEur || 130;
  const ceiling = cfg.rmRules?.barCeilingEur || 550;
  const base = hotel.baseADR || 200;
  const recHigh = Math.min(ceiling, Math.round(base * 1.32));
  const recMid = Math.min(ceiling, Math.round(base * 1.18));
  const recLow = Math.max(floor, Math.round(base * 0.88));

  return [
    {
      id: `alert-${hotelId}-peak-1`,
      hotelId,
      eventId: `ev-peak-${hotel.city.toLowerCase()}`,
      eventTitle: `Pic d’Affluence & Compression Marché (${hotel.city})`,
      venueName: `${hotel.city} Centre / Parc des Expos`,
      category: 'salons_foires',
      dateStr: ensureUpcomingDate('2026-11-24', 8, todayStr),
      demandLevel: 'eleve',
      currentRate: base,
      recommendedRate: recHigh,
      gapEur: recHigh - base,
      gapPercent: Math.round(((recHigh - base) / Math.max(1, base)) * 1000) / 10,
      confidenceScore: 95,
      sources: ['Calendrier Événements Flowtym', `Compset ${hotel.city}`, 'D-EDGE OTB'],
      urgency: 'critique',
      status: 'active',
      reason: `Forte pression sur ${hotel.city} (${hotel.name}). Écart tarifaire détecté sous la médiane du Compset.`,
      compressionFactor: 'Hausse recommandée dans le respect strict des garde-fous de l’établissement.',
      compsetAverageRate: recHigh + 12,
      soldOutCompetitorsCount: 2,
      minStayRecommended: 2,
      ctaRecommended: false,
    },
    {
      id: `alert-${hotelId}-mid-2`,
      hotelId,
      eventId: `ev-mid-${hotel.city.toLowerCase()}`,
      eventTitle: `Demande Corporate & Événementielle (${hotel.city})`,
      venueName: `${hotel.city} Métropole`,
      category: 'congres_medical',
      dateStr: ensureUpcomingDate('2026-12-03', 17, todayStr),
      demandLevel: 'eleve',
      currentRate: base,
      recommendedRate: recMid,
      gapEur: recMid - base,
      gapPercent: Math.round(((recMid - base) / Math.max(1, base)) * 1000) / 10,
      confidenceScore: 92,
      sources: ['Veille Congrès & Salons', `Compset ${hotel.city}`],
      urgency: 'haute',
      status: 'active',
      reason: `Tension affaires anticipée sur ${hotel.city} : opportunité de revaloriser le BAR vers ${recMid}€.`,
      compressionFactor: 'Alignement progressif sur la médiane du marché.',
      compsetAverageRate: recMid + 5,
      soldOutCompetitorsCount: 1,
      minStayRecommended: 1,
      ctaRecommended: false,
    },
    {
      id: `alert-${hotelId}-low-3`,
      hotelId,
      eventId: `ev-low-${hotel.city.toLowerCase()}`,
      eventTitle: `Dimanche Creux Hivernal (${hotel.city})`,
      venueName: hotel.city,
      category: 'culturel',
      dateStr: ensureUpcomingDate('2027-01-10', 30, todayStr),
      demandLevel: 'normal',
      currentRate: base,
      recommendedRate: recLow,
      gapEur: recLow - base,
      gapPercent: Math.round(((recLow - base) / Math.max(1, base)) * 1000) / 10,
      confidenceScore: 89,
      sources: ['Historique OTB N-1', `Garde-fous ${hotel.name}`],
      urgency: 'moyenne',
      status: 'active',
      reason: `Ralentissement saisonnier sur ${hotel.city}. Tarif protégé au-dessus du plancher configuré (${floor}€).`,
      compressionFactor: `Plancher de sécurité actif à ${floor}€.`,
      compsetAverageRate: recLow + 8,
      soldOutCompetitorsCount: 0,
      minStayRecommended: 1,
      ctaRecommended: false,
    },
  ];
}

export function getRMHotelSafetyLimits(hotelId: string) {
  const hotel = INITIAL_HOTELS.find((h) => h.id === hotelId);
  if (!hotel) return RM_HOTEL_SAFETY_LIMITS;
  const cfg = getHotelRMSConfig(hotel);
  return {
    RATE_FLOOR_EUR: cfg.rmRules?.barFloorEur || RM_HOTEL_SAFETY_LIMITS.RATE_FLOOR_EUR,
    RATE_CEILING_EUR: cfg.rmRules?.barCeilingEur || RM_HOTEL_SAFETY_LIMITS.RATE_CEILING_EUR,
    MAX_SINGLE_STEP_EUR: cfg.rmRules?.maxSingleAdjustmentEur || RM_HOTEL_SAFETY_LIMITS.MAX_SINGLE_STEP_EUR,
    COMPSET_HIGH_DISCONNECT_EUR: 80,
  };
}

/**
 * Récupère les alertes actives et archivées strictement filtrées pour l'hôtel actif
 */
export function getStoredRMAlerts(hotelId: string = 'hotel-opera'): RMAlertItem[] {
  try {
    const raw = localStorage.getItem(`${ALERTS_STORAGE_KEY}_${hotelId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load RM alerts from storage:', err);
  }
  const initialForHotel = buildDynamicAlertsForHotel(hotelId);
  saveStoredRMAlerts(hotelId, initialForHotel);
  return initialForHotel;
}

/**
 * Sauvegarde les alertes
 */
export function saveStoredRMAlerts(hotelId: string, alerts: RMAlertItem[]): void {
  try {
    localStorage.setItem(`${ALERTS_STORAGE_KEY}_${hotelId}`, JSON.stringify(alerts));
  } catch (err) {
    console.error('Failed to save RM alerts to storage:', err);
  }
}

/**
 * Récupère le journal d'audit des décisions RM
 */
export function getStoredRMDecisions(hotelId: string = 'hotel-opera'): RMDecisionRecord[] {
  try {
    const raw = localStorage.getItem(`${DECISIONS_STORAGE_KEY}_${hotelId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load RM decisions from storage:', err);
  }
  return [];
}

/**
 * Sauvegarde une nouvelle décision dans le journal d'audit
 */
export function recordRMDecision(
  hotelId: string,
  alert: RMAlertItem,
  action: RMDecisionAction,
  appliedRate: number,
  user: string = 'Wali Larabi (Head of RM)',
  comment?: string
): { updatedAlerts: RMAlertItem[]; newDecision: RMDecisionRecord } {
  const currentAlerts = getStoredRMAlerts(hotelId);
  const currentDecisions = getStoredRMDecisions(hotelId);

  const updatedAlerts: RMAlertItem[] = currentAlerts.map((a) => {
    if (a.id === alert.id) {
      const newStatus: RMAlertItem['status'] =
        action === 'accepted'
          ? 'accepted'
          : action === 'modified'
          ? 'modified'
          : action === 'rejected'
          ? 'rejected'
          : 'postponed';

      return {
        ...a,
        status: newStatus,
        currentRate: action === 'accepted' || action === 'modified' ? appliedRate : a.currentRate,
        gapEur: action === 'accepted' || action === 'modified' ? Math.max(0, a.recommendedRate - appliedRate) : a.gapEur,
        gapPercent:
          action === 'accepted' || action === 'modified' && appliedRate > 0
            ? Math.round(((a.recommendedRate - appliedRate) / appliedRate) * 100)
            : a.gapPercent,
      };
    }
    return a;
  });

  const newDecision: RMDecisionRecord = {
    id: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    alertId: alert.id,
    eventId: alert.eventId,
    eventTitle: alert.eventTitle,
    dateStr: alert.dateStr,
    hotelId,
    action,
    originalCurrentRate: alert.currentRate,
    recommendedRate: alert.recommendedRate,
    appliedRate,
    comment,
    decidedAt: new Date().toISOString(),
    decidedBy: user,
  };

  const updatedDecisions = [newDecision, ...currentDecisions];

  saveStoredRMAlerts(hotelId, updatedAlerts);
  try {
    localStorage.setItem(`${DECISIONS_STORAGE_KEY}_${hotelId}`, JSON.stringify(updatedDecisions));
  } catch (err) {
    console.error('Failed to save decision record to storage:', err);
  }

  const updatedAlert = updatedAlerts.find((a) => a.id === alert.id);
  void syncRMDecisionToSupabase(hotelId, newDecision, updatedAlert);
  emitRMSUpdate(hotelId, 'pricing', `Décision RM (${action}) enregistrée pour ${alert.dateStr}`);

  return { updatedAlerts, newDecision };
}
