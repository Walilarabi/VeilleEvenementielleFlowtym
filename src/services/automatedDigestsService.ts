/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SERVICE DE CONFIGURATION DU BRIEF HEBDOMADAIRE DU LUNDI MATIN
 * Automatisation des récapitulatifs de performance et recommandations de prix S+1
 */

export interface MondayDigestConfig {
  enabled: boolean;
  dayOfWeek: 'lundi';
  timeOfDay: string; // e.g. "08:00"
  recipients: string[];
  channels: {
    email: boolean;
    slack: boolean;
    inApp: boolean;
  };
  includeSections: {
    pastWeekPerformance: boolean;
    nextWeekPricingRecommendations: boolean;
    compsetMovements: boolean;
    compressionAlerts: boolean;
  };
  lastSentAt?: string;
}

export interface DigestUpcomingDayRecommendation {
  dateStr: string;
  dayOfWeek: string;
  eventTitle: string;
  demandLevel: string;
  demandPercent: number;
  currentBarEur: number;
  suggestedBarEur: number;
  deltaEur: number;
  deltaPercent: number;
  strategyAction: string;
  urgency: 'critique' | 'haute' | 'optimale';
  compsetMedianEur: number;
}

export interface MondayDigestContent {
  subject: string;
  generationDate: string;
  hotelName: string;
  totalRooms: number;
  periodLabel: string;
  
  // S-1 Performance Summary
  pastWeek: {
    roomNightsSold: number;
    occupancyPercent: number;
    adrEur: number;
    revparEur: number;
    totalRevenueEur: number;
    pickup7dRooms: number;
    deltaVsBudgetPercent: number;
  };
  
  // S+1 Pricing Recommendations
  upcomingWeekRecommendations: DigestUpcomingDayRecommendation[];
  
  // Yield Directives
  yieldDirectives: {
    title: string;
    description: string;
    type: 'price_increase' | 'min_stay' | 'stop_sell' | 'monitoring';
  }[];
}

const DIGEST_STORAGE_KEY = 'flowtym_monday_digest_config_v2';
const DIGEST_LOG_STORAGE_KEY = 'flowtym_monday_digest_send_log_v1';

export function getMondayDigestConfig(): MondayDigestConfig {
  try {
    const saved = localStorage.getItem(DIGEST_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // fallback
  }

  return {
    enabled: true,
    dayOfWeek: 'lundi',
    timeOfDay: '08:00',
    recipients: ['WaliLarabi@gmail.com', 'direction.folkestone@flowtym.com'],
    channels: {
      email: true,
      slack: true,
      inApp: true,
    },
    includeSections: {
      pastWeekPerformance: true,
      nextWeekPricingRecommendations: true,
      compsetMovements: true,
      compressionAlerts: true,
    },
    lastSentAt: '2026-11-02 08:00:14',
  };
}

export function saveMondayDigestConfig(config: MondayDigestConfig): void {
  try {
    localStorage.setItem(DIGEST_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save digest config', err);
  }
}

export function generateMondayDigestContent(): MondayDigestContent {
  return {
    subject: '📊 Brief Hebdomadaire RM · Grand Hôtel Folkestone Opéra (Semaine du 09 au 15 Nov 2026)',
    generationDate: 'Lundi 09 Novembre 2026 à 08:00',
    hotelName: 'Grand Hôtel Folkestone Opéra (45 chambres)',
    totalRooms: 45,
    periodLabel: 'Semaine 46 (09 nov. – 15 nov. 2026)',
    pastWeek: {
      roomNightsSold: 284,
      occupancyPercent: 90.2,
      adrEur: 318.4,
      revparEur: 287.2,
      totalRevenueEur: 90425,
      pickup7dRooms: 42,
      deltaVsBudgetPercent: 14.8,
    },
    upcomingWeekRecommendations: [
      {
        dateStr: '2026-11-10',
        dayOfWeek: 'Mardi',
        eventTitle: 'Sommet Tech & Intelligence Artificielle Paris',
        demandLevel: 'Très fort',
        demandPercent: 88,
        currentBarEur: 260,
        suggestedBarEur: 325,
        deltaEur: 65,
        deltaPercent: 25.0,
        strategyAction: 'Capture de demande corporate',
        urgency: 'haute',
        compsetMedianEur: 315,
      },
      {
        dateStr: '2026-11-11',
        dayOfWeek: 'Mercredi (Férié Armistice)',
        eventTitle: 'Week-end prolongé & Tourisme Loisir Européen',
        demandLevel: 'Élevé',
        demandPercent: 82,
        currentBarEur: 280,
        suggestedBarEur: 335,
        deltaEur: 55,
        deltaPercent: 19.6,
        strategyAction: 'Verrouillage Min Stay 2 nuits',
        urgency: 'haute',
        compsetMedianEur: 320,
      },
      {
        dateStr: '2026-11-12',
        dayOfWeek: 'Jeudi',
        eventTitle: 'Salon International de la Transition Énergétique',
        demandLevel: 'Exceptionnel',
        demandPercent: 95,
        currentBarEur: 275,
        suggestedBarEur: 375,
        deltaEur: 100,
        deltaPercent: 36.4,
        strategyAction: 'Hausse BAR agressive — 3 concurrents complets',
        urgency: 'critique',
        compsetMedianEur: 360,
      },
      {
        dateStr: '2026-11-13',
        dayOfWeek: 'Vendredi',
        eventTitle: 'Concerts Festifs Opéra & Tourisme Week-end',
        demandLevel: 'Très fort',
        demandPercent: 90,
        currentBarEur: 310,
        suggestedBarEur: 385,
        deltaEur: 75,
        deltaPercent: 24.2,
        strategyAction: 'Stock résiduel critique (5 ch. restantes)',
        urgency: 'critique',
        compsetMedianEur: 370,
      },
      {
        dateStr: '2026-11-14',
        dayOfWeek: 'Samedi',
        eventTitle: 'Match Tournoi International & Nuitées Loisir',
        demandLevel: 'Exceptionnel',
        demandPercent: 96,
        currentBarEur: 340,
        suggestedBarEur: 420,
        deltaEur: 80,
        deltaPercent: 23.5,
        strategyAction: 'Fermeture aux arrivées OTA (Direct uniquement)',
        urgency: 'critique',
        compsetMedianEur: 410,
      },
    ],
    yieldDirectives: [
      {
        title: 'Application immédiate d’un Min Stay 2 nuits sur le 11-13 Novembre',
        description: 'Évite l’isolement de la nuitée du jeudi et maximise le revenu cumulé du week-end prolongé.',
        type: 'min_stay',
      },
      {
        title: 'Rehaussement tarifaire BAR de +75€ à +100€ sur le Jeudi 12 et Vendredi 13',
        description: 'La tension compset est maximale avec 3 concurrents déjà complets sur le rayon Opéra.',
        type: 'price_increase',
      },
      {
        title: 'Verrouillage des allotements grossistes (Stop-Sell B2B)',
        description: 'Couper les disponibilités B2B résiduelles pour éviter toute fuite tarifaire non contrôlée.',
        type: 'stop_sell',
      },
    ],
  };
}

export function sendSimulatedMondayDigest(email = 'WaliLarabi@gmail.com'): {
  success: boolean;
  message: string;
  sentAt: string;
} {
  const now = new Date();
  const sentAt = now.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const currentConfig = getMondayDigestConfig();
  currentConfig.lastSentAt = sentAt;
  saveMondayDigestConfig(currentConfig);

  // Record in send log
  try {
    const logs = JSON.parse(localStorage.getItem(DIGEST_LOG_STORAGE_KEY) || '[]');
    logs.unshift({
      id: `digest-log-${Date.now()}`,
      sentAt,
      recipient: email,
      subject: 'Brief Hebdomadaire RM · Grand Hôtel Folkestone Opéra',
      status: 'success',
      type: 'manual_test',
    });
    localStorage.setItem(DIGEST_LOG_STORAGE_KEY, JSON.stringify(logs.slice(0, 20)));
  } catch {
    // silent catch
  }

  return {
    success: true,
    message: `Brief hebdomadaire envoyé avec succès à ${email} (${sentAt}). Prochain envoi programmé : lundi prochain à ${currentConfig.timeOfDay}.`,
    sentAt,
  };
}
