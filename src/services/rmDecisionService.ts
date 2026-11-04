/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RMAlertItem, RMDecisionRecord, RMDecisionAction, StandardDemandLevel } from '../types';

const ALERTS_STORAGE_KEY = 'flowtym_rm_alerts_v1';
const DECISIONS_STORAGE_KEY = 'flowtym_rm_decisions_log_v1';

export const INITIAL_RM_ALERTS: RMAlertItem[] = [
  {
    id: 'alert-smcl-2026',
    hotelId: 'hotel-opera',
    eventId: 'event-smcl-2026',
    eventTitle: 'Salon des Maires et des Collectivités Locales 2026 (SMCL) & 108e Congrès AMF',
    venueName: 'Paris Expo Porte de Versailles',
    category: 'salons_foires',
    dateStr: '2026-11-24',
    demandLevel: 'eleve',
    currentRate: 260,
    recommendedRate: 345,
    gapEur: 85,
    gapPercent: 32.7,
    confidenceScore: 96,
    sources: [
      'Site Officiel SMCL (salondesmaires.com)',
      'Association des Maires de France (amf.asso.fr)',
      'Viparis Porte de Versailles — Calendrier Salons 2026',
      'Benchmark Compset Opéra (Hôtel Saint-Pétersbourg, Astra Opéra)'
    ],
    urgency: 'critique',
    status: 'active',
    reason: '60 000 élus, décideurs territoriaux et délégations nationales attendus. Temps d\'accès direct depuis Saint-Lazare/Madeleine (Ligne 12 directe Porte de Versailles). Le compset affiche déjà 85% d\'occupation moyenne sur ces dates.',
    compressionFactor: 'Forte demande institutionnelle et corporate à haut pouvoir d’achat. Risque majeur de sous-tarification si maintien du tarif de base.',
    compsetAverageRate: 338,
    soldOutCompetitorsCount: 2,
    minStayRecommended: 2,
    ctaRecommended: false,
  },
  {
    id: 'alert-sial-2026',
    hotelId: 'hotel-opera',
    eventId: 'event-sial-2026',
    eventTitle: 'SIAL Paris 2026 — Salon International de l’Alimentation',
    venueName: 'Parc des Expositions Paris Nord Villepinte',
    category: 'salons_foires',
    dateStr: '2026-10-18',
    demandLevel: 'exceptionnel',
    currentRate: 275,
    recommendedRate: 395,
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
    compressionFactor: 'Saturation hôtelière critique. Fermeture immédiate des canaux promotionnels requise.',
    compsetAverageRate: 410,
    soldOutCompetitorsCount: 3,
    minStayRecommended: 3,
    ctaRecommended: true,
  },
  {
    id: 'alert-mondial-auto-2026',
    hotelId: 'hotel-opera',
    eventId: 'event-mondial-auto-2026',
    eventTitle: 'Mondial de l’Automobile Paris 2026',
    venueName: 'Paris Expo Porte de Versailles',
    category: 'salons_foires',
    dateStr: '2026-10-15',
    demandLevel: 'exceptionnel',
    currentRate: 270,
    recommendedRate: 375,
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
    reason: '490 000 visiteurs et professionnels. Pression internationale intense sur la semaine 42.',
    compressionFactor: 'Chevauchement partiel avec le SIAL et la préparation des délégations presse.',
    compsetAverageRate: 365,
    soldOutCompetitorsCount: 2,
    minStayRecommended: 3,
    ctaRecommended: false,
  },
  {
    id: 'alert-rolex-masters-2026',
    hotelId: 'hotel-opera',
    eventId: 'event-rolex-paris-masters-2026',
    eventTitle: 'Rolex Paris Masters 2026 — ATP Masters 1000',
    venueName: 'Paris La Défense Arena',
    category: 'sport',
    dateStr: '2026-10-31',
    demandLevel: 'eleve',
    currentRate: 260,
    recommendedRate: 330,
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
    dateStr: '2027-11-23',
    demandLevel: 'eleve',
    currentRate: 260,
    recommendedRate: 350,
    gapEur: 90,
    gapPercent: 34.6,
    confidenceScore: 92,
    sources: [
      'Calendrier prévisionnel AMF / Salons de France 2027',
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

/**
 * Récupère les alertes actives et archivées
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
  return INITIAL_RM_ALERTS.filter((a) => a.hotelId === hotelId || hotelId === 'hotel-opera');
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

  // Mettre à jour le statut de l'alerte
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
        gapPercent: action === 'accepted' || action === 'modified' ? Math.round(((a.recommendedRate - appliedRate) / appliedRate) * 100) : a.gapPercent,
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

  return { updatedAlerts, newDecision };
}
