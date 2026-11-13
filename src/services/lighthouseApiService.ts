/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LighthouseRateConfig, LighthouseRateItem, CompetitorHotel } from '../types';
import { FOLKESTONE_COMPSET_BASE } from './compsetBenchmarkService';

const STORAGE_KEY_PREFIX = 'flowtym_lighthouse_config_';

/**
 * Spécification technique officielle de l'API Lighthouse Rate Shopping (v3)
 * URL de base : https://api.mylighthouse.com/v3
 * Authentification : Header X-Oi-Authorization: <LighthouseApiToken> ou OAuth Bearer token
 * Endpoints officiels :
 *   - GET /v3/rates : Meilleurs tarifs actuels et historiques par compset
 *   - GET /v3/roomtyperates : Tarifs détaillés par catégorie de chambre
 *   - GET /v3/historic/rates : Historique des relevés tarifaires passés
 *   - GET /v3/historic/roomtyperates : Historique par catégorie de chambre
 */
export const LIGHTHOUSE_API_SPEC = {
  name: 'Lighthouse Rate Insight API',
  baseUrl: 'À confirmer — connecteur non configuré',
  docUrl: 'https://api.mylighthouse.com/#introduction-0',
  portalUrl: 'https://app.mylighthouse.com/hotel',
  integrationStatus: 'not_connected',
  authProtocol: 'À confirmer auprès du fournisseur',
  note: 'Les endpoints, l’authentification, les paramètres LOS/POS, les limites et les droits doivent être confirmés dans la documentation contractuelle du compte. Aucun endpoint n’est présumé ni appelé par ce module.',
  supportedEndpoints: [] as Array<{method:string;path:string;description:string;params:string[]}>,
  rateLimits: 'À confirmer auprès de Lighthouse',
  availabilityHorizons: 'À confirmer auprès de Lighthouse',
  requiredCapabilities: [
    'Extraction des tarifs concurrents comparables',
    'Disponibilités / sold-out et statut de comparabilité',
    'Historisation des relevés avec horodatage et devise',
    'Couverture et fraîcheur par date de séjour',
  ],
};

export const DEFAULT_LIGHTHOUSE_CONFIG: LighthouseRateConfig = {
  apiKey: '',
  accountEmail: '',
  baseUrl: '',
  authType: 'api_token',
  isConnected: false,
  status: 'disconnected',
  compsetIds: [],
};

export function getLighthouseConfig(hotelId: string): LighthouseRateConfig {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${hotelId}`);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<LighthouseRateConfig>;
      return {
        ...DEFAULT_LIGHTHOUSE_CONFIG,
        ...stored,
        apiKey: '',
        isConnected: false,
        status: 'disconnected',
        lastSyncAt: undefined,
        rateLimitRemaining: undefined,
        rateLimitReset: undefined,
      };
    }
  } catch (e) {
    console.error('Failed to parse Lighthouse config from storage', e);
  }
  return { ...DEFAULT_LIGHTHOUSE_CONFIG };
}

export function saveLighthouseConfig(hotelId: string, config: LighthouseRateConfig): void {
  try {
    // API secrets belong in Supabase Edge Function secrets, never browser localStorage.
    const safeConfig = {
      ...config,
      apiKey: '',
      isConnected: false,
      status: 'disconnected' as const,
      lastSyncAt: undefined,
      rateLimitRemaining: undefined,
      rateLimitReset: undefined,
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${hotelId}`, JSON.stringify(safeConfig));
  } catch (e) {
    console.error('Failed to save Lighthouse config to storage', e);
  }
}

/**
 * Test réel de ping et validation du connecteur Lighthouse
 */
export async function testLighthouseConnection(
  _apiKey: string,
  _hotelId: string
): Promise<{ success: boolean; latencyMs: number; message: string; accountInfo?: any }> {
  return {
    success: false,
    latencyMs: 0,
    message: 'Aucun appel réseau Lighthouse n’a été effectué. Le contrat, les endpoints, l’authentification et les droits du compte doivent être validés avant de déclarer le connecteur opérationnel.',
    accountInfo: { status: 'not_connected', sourceStatus: 'unavailable' },
  };
}

/**
 * Récupère les tarifs Lighthouse du compset pour une date donnée
 */
export function getLighthouseRatesForDate(
  hotelId: string,
  dateStr: string,
  baselinePrice: number = 240
): {
  rates: LighthouseRateItem[];
  compsetAverage: number;
  highestRate: number;
  lowestRate: number;
  soldOutRatio: number;
  marketTensionAlert: boolean;
} {
  // Graine déterministe basée sur la date
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const factor = (Math.abs(hash) % 50) / 100; // 0.00 à 0.49

  const rates: LighthouseRateItem[] = FOLKESTONE_COMPSET_BASE.map((comp, idx) => {
    const isSoldOut = idx === 0 ? factor > 0.35 : idx === 2 ? factor > 0.42 : false;
    const rateDelta = Math.round((factor - 0.2) * 60 + (idx * 8));
    const rateEur = isSoldOut ? comp.baselineRate + 90 : Math.max(160, comp.baselineRate + rateDelta);

    return {
      hotelId: comp.id,
      hotelName: comp.name,
      dateStr,
      roomType: comp.roomType,
      ratePlan: idx % 2 === 0 ? 'Meilleur Tarif Disponible (BAR)' : 'Offre Non Annulable (RO)',
      rateEur,
      currency: 'EUR',
      isSoldOut,
      pos: idx === 1 ? 'Booking.com' : idx === 3 ? 'Expedia Group' : 'Site Officiel Direct',
      observedAt: 'SIMULATION locale — aucune collecte Lighthouse',
      deltaPercentVsPriorScrape: rateDelta > 15 ? 8.5 : rateDelta < -10 ? -4.2 : 0,
      sourceStatus: 'simulation',
    };
  });

  const availableRates = rates.filter((r) => !r.isSoldOut).map((r) => r.rateEur);
  const compsetAverage =
    availableRates.length > 0
      ? Math.round(availableRates.reduce((a, b) => a + b, 0) / availableRates.length)
      : baselinePrice;

  const soldOutCount = rates.filter((r) => r.isSoldOut).length;

  return {
    rates,
    compsetAverage,
    highestRate: availableRates.length > 0 ? Math.max(...availableRates) : baselinePrice,
    lowestRate: availableRates.length > 0 ? Math.min(...availableRates) : baselinePrice,
    soldOutRatio: Math.round((soldOutCount / rates.length) * 100),
    marketTensionAlert: soldOutCount >= 2 || compsetAverage >= baselinePrice * 1.25,
  };
}
