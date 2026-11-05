/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PushOpportunityAlert {
  id: string;
  title: string;
  dateStr: string;
  venueName: string;
  currentRate: number;
  recommendedRate: number;
  gapEur: number;
  gapPercent: number;
  demandLevel: string;
  demandPercent: number;
  urgency: 'critique' | 'haute' | 'moderee';
  reason: string;
  compsetContext: string;
  timestamp: number;
}

// Play pleasant synthetic audio chime using Web Audio API
export function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First high note (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // slide up to A5
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.35);

    // Second bell chime (E6) slightly delayed
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1318.51, ctx.currentTime);
        gain2.gain.setValueAtTime(0.08, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.4);
      } catch {
        // silent catch
      }
    }, 120);
  } catch {
    // AudioContext blocked or unsupported
  }
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission {
  if (!isBrowserNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!isBrowserNotificationSupported()) return 'denied';
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      try {
        new Notification('Flowtym · Alertes Push Activées', {
          body: 'Vous serez notifié dès qu’une opportunité tarifaire majeure est détectée.',
          icon: '/favicon.ico',
        });
      } catch {
        // notification instantiation catch
      }
    }
    return perm;
  } catch (err) {
    console.error('Error requesting notification permission', err);
    return 'denied';
  }
}

export function triggerNativePushNotification(alert: PushOpportunityAlert) {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(`🚨 Opportunité Tarifaire Majeure (+${alert.gapEur}€)`, {
      body: `${alert.title} (${alert.dateStr})\nTarif conseillé : ${alert.recommendedRate}€ (+${alert.gapEur}€ vs ${alert.currentRate}€). Demande à ${alert.demandPercent}%.`,
      icon: '/favicon.ico',
      tag: `rm-alert-${alert.id}`,
    });
  } catch (err) {
    console.warn('Native notification failed:', err);
  }
}

export const SAMPLE_MAJOR_OPPORTUNITIES: PushOpportunityAlert[] = [
  {
    id: 'push-sial-2026',
    title: 'SIAL Paris 2026 — Salon International de l’Alimentation',
    dateStr: '18 oct. 2026',
    venueName: 'Parc des Expositions Paris Nord Villepinte',
    currentRate: 275,
    recommendedRate: 395,
    gapEur: 120,
    gapPercent: 43.6,
    demandLevel: 'Exceptionnel',
    demandPercent: 96,
    urgency: 'critique',
    reason: 'Saturation internationale (285k pax). 4/5 concurrents à plus de 420€ ou sold out. Hausse immédiate de +120€ préconisée.',
    compsetContext: 'Compset moyen : 415€ · Votre tarif actuel (275€) est sous-évalué de 140€.',
    timestamp: Date.now(),
  },
  {
    id: 'push-reveillon-2026',
    title: 'Réveillon Saint-Sylvestre 2026 & Galas Opéra',
    dateStr: '31 déc. 2026',
    venueName: 'Palais Garnier & Opéra',
    currentRate: 320,
    recommendedRate: 550,
    gapEur: 230,
    gapPercent: 71.9,
    demandLevel: 'Exceptionnel',
    demandPercent: 99,
    urgency: 'critique',
    reason: 'Plafond RM atteint (550€). 4 concurrents complets dans un rayon de 400m. Risque de vendre prématurément sous le prix du marché.',
    compsetContext: 'Hôtel Saint-Pétersbourg sold-out à 580€ · OTB hôtel à 92%.',
    timestamp: Date.now(),
  },
  {
    id: 'push-salon-maires-2026',
    title: 'Salon des Maires et des Collectivités Locales 2026',
    dateStr: '18 nov. 2026',
    venueName: 'Paris Expo Porte de Versailles',
    currentRate: 210,
    recommendedRate: 295,
    gapEur: 85,
    gapPercent: 40.5,
    demandLevel: 'Très fort',
    demandPercent: 86,
    urgency: 'haute',
    reason: 'Forte accélération du pickup D-EDGE (+5 ch. en 24h). Stock résiduel 9 chambres. Rehaussement immédiat pour préserver l’ADR.',
    compsetContext: 'Compset moyen relevé à 310€ · OTB 80% à J-14.',
    timestamp: Date.now(),
  },
  {
    id: 'push-mondial-auto-2026',
    title: 'Mondial de l’Automobile de Paris 2026',
    dateStr: '14 oct. 2026',
    venueName: 'Paris Expo Porte de Versailles',
    currentRate: 260,
    recommendedRate: 365,
    gapEur: 105,
    gapPercent: 40.4,
    demandLevel: 'Exceptionnel',
    demandPercent: 94,
    urgency: 'critique',
    reason: '490k visiteurs attendus. Chevauchement partiel avec congrès pharmaceutique. Application d’un Min Stay 3 nuits et +105€.',
    compsetContext: 'Pression compset maximale · 3 concurrents complets sur les nuits du 14-16 oct.',
    timestamp: Date.now(),
  },
];
