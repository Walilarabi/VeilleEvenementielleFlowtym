/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SERVICE DE CONFIGURATION DES ALERTES E-MAIL QUOTIDIENNES (ÉVÉNEMENTS MAJEURS SCORE > 70)
 */

import { EventItem } from '../types';
import {
  CURRENT_REFERENCE_DATE,
  sortEventsChronologically,
  getEventChronologicalStatus,
} from '../utils/eventFilterUtils';
import {
  syncMajorEventAlertConfigToSupabase,
  syncMajorEventAlertLogToSupabase,
} from './supabaseSyncService';

export interface MajorEventEmailAlertLog {
  id: string;
  sentAt: string;
  recipients: string[];
  eventsCount: number;
  minScore: number;
  topEventTitle: string;
  status: 'sent';
}

export interface MajorEventEmailAlertConfig {
  enabled: boolean;
  minScore: number; // Défaut: 70 (strictement > 70)
  sendTime: string; // ex: "07:30"
  frequency: 'daily' | 'weekdays' | 'weekly';
  recipients: string[];
  includeOngoing: boolean;
  horizonDays: number; // ex: 60 jours
  includeYieldRecommendations: boolean;
  lastSentAt?: string;
}

export function getAlertFrequencyLabel(freq: MajorEventEmailAlertConfig['frequency']): string {
  switch (freq) {
    case 'weekdays':
      return 'Jours ouvrés (Lun–Ven)';
    case 'weekly':
      return 'Hebdomadaire (Lundi)';
    case 'daily':
    default:
      return 'Quotidienne (7j/7)';
  }
}

const MAJOR_ALERT_CONFIG_KEY = 'flowtym_major_event_email_alert_config_v1';
const MAJOR_ALERT_LOGS_KEY = 'flowtym_major_event_email_alert_logs_v1';

export function getMajorEventAlertConfig(): MajorEventEmailAlertConfig {
  try {
    const raw = localStorage.getItem(MAJOR_ALERT_CONFIG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to read major event alert config:', err);
  }

  return {
    enabled: true,
    minScore: 70,
    sendTime: '07:30',
    frequency: 'daily',
    recipients: ['WaliLarabi@gmail.com'],
    includeOngoing: true,
    horizonDays: 60,
    includeYieldRecommendations: true,
    lastSentAt: '2026-11-12 07:30:05',
  };
}

export function saveMajorEventAlertConfig(config: MajorEventEmailAlertConfig): void {
  try {
    localStorage.setItem(MAJOR_ALERT_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save major event alert config:', err);
  }
  void syncMajorEventAlertConfigToSupabase(config);
}

export function getMajorEventAlertLogs(): MajorEventEmailAlertLog[] {
  try {
    const raw = localStorage.getItem(MAJOR_ALERT_LOGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to read major event alert logs:', err);
  }

  return [
    {
      id: 'alert-log-init-1',
      sentAt: '2026-11-12 07:30:05',
      recipients: ['WaliLarabi@gmail.com'],
      eventsCount: 4,
      minScore: 70,
      topEventTitle: 'Congrès Européen d’Oncologie Médicale (ESMO)',
      status: 'sent',
    },
  ];
}

export function appendMajorEventAlertLog(log: MajorEventEmailAlertLog): MajorEventEmailAlertLog[] {
  const existing = getMajorEventAlertLogs();
  const updated = [log, ...existing].slice(0, 15);
  try {
    localStorage.setItem(MAJOR_ALERT_LOGS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save major event alert log:', err);
  }
  void syncMajorEventAlertLogToSupabase(log);
  return updated;
}

/**
 * Extrait et classe chronologiquement les événements majeurs détectés (score > minScore, défaut > 70)
 * En respectant strictement la date du jour (en cours d'abord, puis à venir dans l'horizon configuré).
 */
export function getQualifyingMajorEvents(
  events: EventItem[],
  config: MajorEventEmailAlertConfig,
  refDate: string = CURRENT_REFERENCE_DATE
): EventItem[] {
  const refTime = new Date(refDate).getTime();
  const maxHorizonTime = refTime + config.horizonDays * 24 * 60 * 60 * 1000;

  const matching = events.filter((ev) => {
    const score = ev.scoreBreakdown?.finalRMScore ?? 0;
    if (score <= config.minScore) return false;

    const status = getEventChronologicalStatus(ev, refDate);
    if (status === 'past') return false;
    if (status === 'ongoing') return config.includeOngoing;

    // status === 'upcoming'
    const startTime = new Date(ev.startDate).getTime();
    return startTime <= maxHorizonTime;
  });

  return sortEventsChronologically(matching, refDate, false);
}

export function buildMajorEventAlertEmailPreview(
  config: MajorEventEmailAlertConfig,
  events: EventItem[],
  hotelName: string,
  refDate: string = CURRENT_REFERENCE_DATE
): { subject: string; bodyText: string; qualifyingEvents: EventItem[] } {
  const qualifyingEvents = getQualifyingMajorEvents(events, config, refDate);
  const subject = `[Flowtym RM] Alerte Quotidienne : ${qualifyingEvents.length} événement(s) majeur(s) (Score > ${config.minScore}) · ${hotelName}`;

  const lines: string[] = [
    `Bonjour,`,
    ``,
    `Voici votre veille quotidienne des événements majeurs détectés (Score RM > ${config.minScore}/100) pour ${hotelName} à date du ${refDate.split('-').reverse().join('/')} (horizon ${config.horizonDays} jours) :`,
    ``,
  ];

  if (qualifyingEvents.length === 0) {
    lines.push(`Aucun événement en cours ou à venir ne dépasse le seuil de score > ${config.minScore} sur cet horizon.`);
  } else {
    qualifyingEvents.forEach((ev, idx) => {
      const status = getEventChronologicalStatus(ev, refDate) === 'ongoing' ? 'EN COURS' : 'À VENIR';
      const score = ev.scoreBreakdown.finalRMScore;
      const dates = ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} au ${ev.endDate}`;
      lines.push(
        `${idx + 1}. [${status}] ${ev.title} (${ev.city} · ${ev.venueName})`
      );
      lines.push(
        `   Dates : ${dates} | Score RM : ${score}/100 | Affluence : ${ev.expectedAttendance ? ev.expectedAttendance.toLocaleString('fr-FR') + ' pax' : 'NC'}`
      );
      if (config.includeYieldRecommendations) {
        const rec =
          score >= 85
            ? 'Recommandation RM : Fermeture tarifs réduits + Séjour min. 3 nuits + Hausse BAR +35%'
            : 'Recommandation RM : Yield actif + Hausse BAR +15% à +30% + Surveillance Pickup';
        lines.push(`   → ${rec}`);
      }
      lines.push('');
    });
  }

  lines.push(`--`);
  lines.push(
    `Flowtym Revenue Management · Fréquence : ${getAlertFrequencyLabel(config.frequency)} à ${config.sendTime}`
  );

  return {
    subject,
    bodyText: lines.join('\n'),
    qualifyingEvents,
  };
}
