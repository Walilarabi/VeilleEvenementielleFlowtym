/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SERVICE DE SURVEILLANCE DE LA PARITÉ TARIFAIRE & ALERTES SLACK AUTOMATISÉES
 * Flowtym Parity AI Engine
 */

export interface SlackParityConfig {
  enabled: boolean;
  webhookUrl: string;
  channel: string;
  botName: string;
  triggerThresholdEur: number;
  monitoredChannels: string[];
  autoAlertOnDetection: boolean;
  lastAlertSentAt?: string;
}

export type ParitySeverity = 'critical' | 'warning' | 'info';
export type ParityStatus = 'active' | 'in_remediation' | 'resolved';

export interface ParityDiscrepancyItem {
  id: string;
  dateStr: string;
  channelName: string;
  channelLogo?: string;
  roomType: string;
  directRateEur: number;
  otaRateEur: number;
  discrepancyEur: number;
  discrepancyPercent: number;
  detectedAt: string;
  severity: ParitySeverity;
  aiDiagnostic: string;
  rootCause: string;
  recommendedAction: string;
  status: ParityStatus;
  slackSent: boolean;
  slackMessageTs?: string;
}

const PARITY_CONFIG_STORAGE_KEY = 'flowtym_slack_parity_config_v1';
const PARITY_ITEMS_STORAGE_KEY = 'flowtym_parity_discrepancies_v1';

import { upsertParityAlertsToSupabase } from './supabaseDataService';
import { emitRMSUpdate } from './rmsMetricsEngine';
import { getRatePlanningCells } from './ratePlanningSyncService';
import { INITIAL_HOTELS } from '../data/mockData';
import { getTodayIsoDate, addDaysIso } from '../utils/eventFilterUtils';

function ensureUpcomingParityDate(preferredDate: string, fallbackOffset: number, todayStr: string): string {
  return preferredDate >= todayStr ? preferredDate : addDaysIso(todayStr, fallbackOffset);
}

export function buildInitialParityDiscrepancies(todayStr: string = getTodayIsoDate()): ParityDiscrepancyItem[] {
  return [
    {
      id: 'parity-agoda-sial-2026',
      dateStr: addDaysIso(todayStr, 3),
      channelName: 'Agoda',
      roomType: 'Chambre Classique Double',
      directRateEur: 395,
      otaRateEur: 338,
      discrepancyEur: -57,
      discrepancyPercent: -14.4,
      detectedAt: 'Il y a 18 minutes',
      severity: 'critical',
      aiDiagnostic: 'Fuite grossiste B2B (Bedbank / Hotelbeds) revendue en B2C sans autorisation sur Agoda Private Deals.',
      rootCause: 'Allotement grossiste B2B réinjecté avec écrêtement de marge de 14.4% sur une date à forte demande.',
      recommendedAction: 'Déposer une réclamation de parité immédiate via le portail Agoda et couper l\'accès au grossiste B2B identifié.',
      status: 'active',
      slackSent: true,
    },
    {
      id: 'parity-booking-mobile-2026',
      dateStr: addDaysIso(todayStr, 6),
      channelName: 'Booking.com',
      roomType: 'Supérieure Exécutive',
      directRateEur: 365,
      otaRateEur: 328,
      discrepancyEur: -37,
      discrepancyPercent: -10.1,
      detectedAt: 'Il y a 42 minutes',
      severity: 'critical',
      aiDiagnostic: 'Tarif Mobile Rate Booking.com activé à votre insu en cumul avec le programme Genius Niveau 3.',
      rootCause: 'Empilement commercial non consenti : remise mobile 10% appliquée sur tarif Genius déjà remisé.',
      recommendedAction: 'Désactiver le cumul Tarif Mobile dans l\'Extranet Booking.com > Opportunités > Tarifs Ciblés.',
      status: 'active',
      slackSent: true,
    },
    {
      id: 'parity-tripcom-devise-2026',
      dateStr: ensureUpcomingParityDate('2026-11-20', 9, todayStr),
      channelName: 'Trip.com',
      roomType: 'Classique Double',
      directRateEur: 310,
      otaRateEur: 288,
      discrepancyEur: -22,
      discrepancyPercent: -7.1,
      detectedAt: 'Il y a 2 heures',
      severity: 'warning',
      aiDiagnostic: 'Écart de conversion de devise EUR / USD avec exclusion de la taxe de séjour dans l’affichage initial.',
      rootCause: 'Affichage hors taxes trompeur captant la clientèle internationale avant le checkout.',
      recommendedAction: 'Contacter le gestionnaire de compte Trip.com pour exiger l\'affichage TTC conforme à la directive européenne.',
      status: 'in_remediation',
      slackSent: true,
    },
    {
      id: 'parity-expedia-package-2026',
      dateStr: ensureUpcomingParityDate('2026-12-31', 21, todayStr),
      channelName: 'Expedia Group',
      roomType: 'Deluxe Opéra',
      directRateEur: 550,
      otaRateEur: 495,
      discrepancyEur: -55,
      discrepancyPercent: -10.0,
      detectedAt: 'Il y a 4 heures',
      severity: 'critical',
      aiDiagnostic: 'Tarif package (Vol + Hôtel) vendu seul en chambre sèche sur Expedia Mobile.',
      rootCause: 'Rupture de condition de packaging : la chambre est réservable seule au tarif préférentiel vol.',
      recommendedAction: 'Fermer immédiatement la grille tarifaire Package sur la date concernée dans le CRS D-EDGE.',
      status: 'active',
      slackSent: false,
    },
  ];
}

export const INITIAL_PARITY_DISCREPANCIES: ParityDiscrepancyItem[] = buildInitialParityDiscrepancies();

export function getSlackParityConfig(): SlackParityConfig {
  try {
    const saved = localStorage.getItem(PARITY_CONFIG_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // fallback
  }

  return {
    enabled: true,
    webhookUrl: '',
    channel: '#rm-alertes-parite',
    botName: 'Flowtym Parity AI Watchdog',
    triggerThresholdEur: 5,
    monitoredChannels: ['Booking.com', 'Expedia', 'Agoda', 'Trip.com', 'Google Hotel Ads', 'Trivago'],
    autoAlertOnDetection: true,
    lastAlertSentAt: 'Prêt',
  };
}

export function saveSlackParityConfig(config: SlackParityConfig): void {
  try {
    localStorage.setItem(PARITY_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save slack parity config', err);
  }
}

export function getParityDiscrepancies(hotelId: string = 'hotel-opera'): ParityDiscrepancyItem[] {
  const key = `${PARITY_ITEMS_STORAGE_KEY}_${hotelId}`;
  const todayStr = getTodayIsoDate();
  try {
    const saved = localStorage.getItem(key) || (hotelId === 'hotel-opera' ? localStorage.getItem(PARITY_ITEMS_STORAGE_KEY) : null);
    if (saved) {
      const parsed: ParityDiscrepancyItem[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.some((item) => item.dateStr >= todayStr)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  // Générer automatiquement des écarts calés sur les tarifs réels futurs du Planning Tarifaire de cet hôtel
  const targetHotel = INITIAL_HOTELS.find((h) => h.id === hotelId);
  const cells = targetHotel
    ? getRatePlanningCells(targetHotel).filter(
        (c) => c.ratePlanCode === 'BAR' && c.roomTypeCode === 'classique' && c.stayDate >= todayStr
      )
    : [];
  if (cells.length >= 3) {
    const sample1 = cells[Math.min(4, cells.length - 1)];
    const sample2 = cells[Math.min(10, cells.length - 1)];
    const generated: ParityDiscrepancyItem[] = [
      {
        id: `parity-${hotelId}-agoda-${sample1.stayDate}`,
        dateStr: sample1.stayDate,
        channelName: 'Agoda',
        roomType: sample1.roomTypeName,
        directRateEur: sample1.currentRateEur,
        otaRateEur: Math.max(50, Math.round(sample1.currentRateEur * 0.87)),
        discrepancyEur: -Math.round(sample1.currentRateEur * 0.13),
        discrepancyPercent: -13.0,
        detectedAt: 'Synchronisé avec le Planning',
        severity: 'critical',
        aiDiagnostic: 'Fuite grossiste B2B revendue en B2C sans autorisation sur Agoda Private Deals.',
        rootCause: 'Allotement grossiste B2B réinjecté sous le tarif BAR officiel.',
        recommendedAction: 'Déposer une réclamation de parité via le portail Agoda et vérifier la grille B2B.',
        status: 'active',
        slackSent: false,
      },
      {
        id: `parity-${hotelId}-booking-${sample2.stayDate}`,
        dateStr: sample2.stayDate,
        channelName: 'Booking.com',
        roomType: sample2.roomTypeName,
        directRateEur: sample2.currentRateEur,
        otaRateEur: Math.max(50, Math.round(sample2.currentRateEur * 0.91)),
        discrepancyEur: -Math.round(sample2.currentRateEur * 0.09),
        discrepancyPercent: -9.0,
        detectedAt: 'Synchronisé avec le Planning',
        severity: 'warning',
        aiDiagnostic: 'Tarif Mobile Rate Booking.com cumulé avec le programme Genius.',
        rootCause: 'Cumul commercial Mobile -10% appliqué au-dessus du tarif BAR.',
        recommendedAction: 'Désactiver le cumul Tarif Mobile dans l’extranet Booking.com.',
        status: 'active',
        slackSent: false,
      },
    ];
    return hotelId === 'hotel-opera' ? buildInitialParityDiscrepancies(todayStr) : generated;
  }

  return hotelId === 'hotel-opera' ? buildInitialParityDiscrepancies(todayStr) : [];
}

export function saveParityDiscrepancies(items: ParityDiscrepancyItem[], hotelId: string = 'hotel-opera'): void {
  try {
    localStorage.setItem(`${PARITY_ITEMS_STORAGE_KEY}_${hotelId}`, JSON.stringify(items));
    if (hotelId === 'hotel-opera') {
      localStorage.setItem(PARITY_ITEMS_STORAGE_KEY, JSON.stringify(items));
    }
    void upsertParityAlertsToSupabase(
      hotelId,
      items.map((it) => ({
        id: it.id,
        dateStr: it.dateStr,
        roomType: it.roomType,
        directRateEur: it.directRateEur,
        otaChannel: it.channelName,
        otaRateEur: it.otaRateEur,
        status: it.severity === 'critical' ? 'undercut_critical' : it.severity === 'warning' ? 'undercut_minor' : 'ok',
        severity: it.severity,
        aiDiagnostic: it.aiDiagnostic,
        rootCause: it.rootCause,
        recommendedAction: it.recommendedAction,
        slackSent: it.slackSent,
        remediationStatus: it.status,
      }))
    );
    emitRMSUpdate(hotelId, 'parity', 'Statut de parité mis à jour');
  } catch (err) {
    console.error('Failed to save parity items', err);
  }
}

export function generateSlackPayload(item: ParityDiscrepancyItem, config: SlackParityConfig, hotelName: string = 'Établissement Flowtym') {
  return {
    channel: config.channel,
    username: config.botName,
    icon_emoji: ':warning:',
    text: `🚨 *Alerte Rupture de Parité Détectée sur ${item.channelName} (${item.discrepancyEur}€)* pour le ${item.dateStr}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 RUPTURE DE PARITÉ TARIFAIRE · ${item.channelName.toUpperCase()}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Hôtel :* ${hotelName}\n*Date de séjour :* ${item.dateStr} (${item.roomType})\n*Détection IA :* ${item.aiDiagnostic}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Tarif Direct Officiel :*\n*${item.directRateEur} €* (Site Web)`,
          },
          {
            type: 'mrkdwn',
            text: `*Tarif Constaté sur ${item.channelName} :*\n*~${item.otaRateEur} €~* :fire: (*${item.discrepancyEur} €* / ${item.discrepancyPercent}%)`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `:mag: *Cause racine :* ${item.rootCause}\n:bulb: *Action RM immédiate recommandée :* ${item.recommendedAction}`,
          },
        ],
      },
    ],
  };
}

export async function sendSlackParityAlert(
  item: ParityDiscrepancyItem,
  config: SlackParityConfig,
  hotelId: string = 'hotel-opera',
  hotelName: string = 'Établissement Flowtym'
): Promise<{ success: boolean; dispatched?: boolean; message: string }> {
  let dispatched = false;
  let serverMessage = '';

  try {
    const resp = await fetch('/api/parity/slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: config.webhookUrl,
        hotelName,
        alert: {
          ...item,
          otaChannel: item.channelName,
          gapEur: item.discrepancyEur,
        },
      }),
    });
    if (resp.ok) {
      const json = await resp.json();
      dispatched = Boolean(json.dispatched);
      serverMessage = String(json.message || '');
    }
  } catch {
    // Backend indisponible (test hors ligne)
  }

  const items = getParityDiscrepancies(hotelId);
  const updatedItems = items.map((i) => (i.id === item.id ? { ...i, slackSent: dispatched } : i));
  saveParityDiscrepancies(updatedItems, hotelId);

  if (dispatched) {
    config.lastAlertSentAt = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    saveSlackParityConfig(config);
  }

  return {
    success: true,
    dispatched,
    message: dispatched
      ? `Alerte de parité ${item.channelName} (${item.discrepancyEur}€ sur le ${item.dateStr}) transmise dans ${config.channel} !`
      : serverMessage || `Alerte enregistrée dans Flowtym. Renseignez une URL Slack Webhook valide pour l’envoi externe vers ${config.channel}.`,
  };
}
