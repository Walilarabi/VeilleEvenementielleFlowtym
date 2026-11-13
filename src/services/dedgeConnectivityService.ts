/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEdgeConfig, DEdgeInventoryDay } from '../types';

const DEDGE_STORAGE_KEY_PREFIX = 'flowtym_dedge_config_';

/**
 * Documentation officielle D-EDGE CRS & Connectivity
 * Portail : https://login.d-edge.com
 * Documentation Développeur : https://docs.d-edge.com
 * Les 4 Piliers Techniques :
 *   1. Connectivity APIs : Distribution OTA (300+ canaux), synchronisation bidirectionnelle PMS/RMS (ARI - Availability, Rates, Inventory, Min Stay, Stop-Sell).
 *   2. Pricing & Availability APIs : Best Price API et Daily Rates API (récupération des plages de prix et restrictions en temps réel).
 *   3. Booking APIs : Récupération des flux de réservations, confirmations asynchrones et analyse de vélocité (Pickup).
 *   4. Guest Management APIs : Profils clients et conformité RGPD.
 */
export const DEDGE_ARCHITECTURE_SPEC = {
  name: 'D-EDGE CRS & Channel Manager',
  loginUrl: 'https://login.d-edge.com/?culture=fr',
  docsUrl: 'https://docs.d-edge.com',
  integrationStatus: 'not_connected',
  note: 'Les endpoints, méthodes d’authentification, payloads, webhooks et droits d’accès doivent être confirmés dans le contrat/API officielle du compte hôtelier. Aucun endpoint n’est présumé ici.',
  supportedModes: ['partner_connector', 'night_audit_export', 'direct_api_after_contract_validation'],
  pillars: [
    { pillar: 'Disponibilités', purpose: 'Lire les chambres commercialisables et restrictions.', dataAvailable: 'À confirmer dans le contrat du compte.', apiSupport: 'Non validé — aucun appel effectué.' },
    { pillar: 'Tarifs et plans tarifaires', purpose: 'Lire les tarifs publiés et leurs règles.', dataAvailable: 'À confirmer dans le contrat du compte.', apiSupport: 'Non validé — aucun endpoint présumé.' },
    { pillar: 'Réservations et pickup', purpose: 'Importer les réservations, modifications et annulations.', dataAvailable: 'À confirmer dans le contrat du compte.', apiSupport: 'Non validé — droits à vérifier.' },
    { pillar: 'Publication tarifaire', purpose: 'Écrire un tarif après validation humaine.', dataAvailable: 'À confirmer avec D-EDGE et l’hôtel.', apiSupport: 'Désactivé tant que la certification n’est pas obtenue.' },
  ],
  dataClassification: {
    directApi: ['Aucune donnée déclarée disponible en direct avant validation contractuelle.'],
    partnerConnector: ['Disponibilités, tarifs et réservations : couverture à confirmer avec le connecteur certifié.'],
    manualExportNeeded: ['Exports Night Audit / historiques : méthode d’import à valider avec l’hôtel.'],
  },
};

export const DEFAULT_DEDGE_CONFIG: DEdgeConfig = {
  hotelCode: '',
  engineId: '',
  apiToken: '',
  webhookUrl: '',
  authType: 'bearer_token',
  status: 'disconnected',
  syncMode: 'night_audit_export',
  lastHeartbeatStatus: 'error',
};

export function getDEdgeConfig(hotelId: string): DEdgeConfig {
  try {
    const raw = localStorage.getItem(`${DEDGE_STORAGE_KEY_PREFIX}${hotelId}`);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<DEdgeConfig>;
      return {
        ...DEFAULT_DEDGE_CONFIG,
        ...stored,
        apiToken: '',
        webhookUrl: '',
        status: 'disconnected',
        lastSyncAt: undefined,
        lastHeartbeatStatus: 'error',
      };
    }
  } catch (e) {
    console.error('Failed to parse D-EDGE config from storage', e);
  }
  return { ...DEFAULT_DEDGE_CONFIG };
}

export function saveDEdgeConfig(hotelId: string, config: DEdgeConfig): void {
  try {
    // Provider secrets must be stored in Supabase Edge Function secrets, never browser localStorage.
    const safeConfig = {
      ...config,
      apiToken: '',
      webhookUrl: '',
      status: 'disconnected' as const,
      lastSyncAt: undefined,
      lastHeartbeatStatus: 'error' as const,
    };
    localStorage.setItem(`${DEDGE_STORAGE_KEY_PREFIX}${hotelId}`, JSON.stringify(safeConfig));
  } catch (e) {
    console.error('Failed to save D-EDGE config to storage', e);
  }
}

/**
 * Test réel de synchronisation avec le CRS D-EDGE
 */
export async function testDEdgeConnection(
  hotelCode: string,
  _apiToken: string
): Promise<{ success: boolean; latencyMs: number; message: string; details?: any }> {
  return {
    success: false,
    latencyMs: 0,
    message: hotelCode
      ? 'Aucun appel réseau D-EDGE n’a été effectué. Le contrat technique, les endpoints et les droits du compte doivent être validés avant d’annoncer une connexion.'
      : 'Connecteur D-EDGE non configuré. Aucun appel réseau n’a été effectué.',
    details: { status: 'not_connected', sourceStatus: 'unavailable' },
  };
}

/**
 * Calcule les données internes de stock, OTB et pickup pour une date donnée
 * Adapté à l'hôtel sélectionné (ex. Grand Hôtel Folkestone Opéra : 45 chambres)
 */
export function getDEdgeInventoryForDate(
  hotelId: string,
  dateStr: string,
  totalRooms: number = 45,
  baseADR: number = 240
): DEdgeInventoryDay {
  // Graine déterministe basée sur la date
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const factor = (Math.abs(hash) % 100) / 100; // 0.00 à 0.99

  // Calcul du taux d'occupation OTB (ex: entre 55% et 95%)
  const occupancyPercent = Math.min(98, Math.max(48, Math.round(55 + factor * 40)));
  const roomsSold = Math.round((totalRooms * occupancyPercent) / 100);
  const roomsAvailable = Math.max(1, totalRooms - roomsSold);

  // Pickup sur 24h, 72h et 7 jours
  let pickup24h = 0;
  let bookingVelocity: DEdgeInventoryDay['bookingVelocity'] = 'normale';

  if (occupancyPercent >= 85) {
    pickup24h = Math.round(2 + factor * 5); // +2 à +7 chambres en 24h
    bookingVelocity = 'tres_rapide';
  } else if (occupancyPercent >= 70) {
    pickup24h = Math.round(1 + factor * 3);
    bookingVelocity = 'rapide';
  } else if (occupancyPercent <= 52) {
    pickup24h = Math.round(factor * 1);
    bookingVelocity = 'faible';
  } else {
    pickup24h = Math.round(1 + factor * 2);
    bookingVelocity = 'normale';
  }

  const pickup72h = pickup24h + Math.round(factor * 6);
  const pickup7d = pickup72h + Math.round(factor * 10);
  const cancellations24h = factor > 0.7 ? 1 : 0;

  // Calcul du tarif BAR actuel dans le CRS
  const currentBAR =
    occupancyPercent >= 90
      ? Math.round(baseADR * 1.35)
      : occupancyPercent >= 80
      ? Math.round(baseADR * 1.2)
      : baseADR;

  return {
    dateStr,
    hotelId,
    totalRooms,
    roomsSold,
    roomsAvailable,
    occupancyPercent,
    currentBAR,
    pickup24h,
    pickup72h,
    pickup7d,
    cancellations24h,
    bookingVelocity,
    minStayRestriction: occupancyPercent >= 88 ? 2 : 1,
    stopSellActive: roomsAvailable <= 2,
    averageLeadTimeDays: Math.round(18 + factor * 45),
    lastUpdated: 'SIMULATION locale — aucune donnée D-EDGE live',
    sourceStatus: 'simulation',
  };
}
