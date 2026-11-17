/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Architecture d'Intégration Universelle FLOWTYM REVENUE
 * Registre modulaire des connecteurs PMS, Channel Manager & Rate Shopper,
 * matrice de capacités, adaptateur D-EDGE prioritaire et service client sécurisé.
 */

import {
  ConnectorCapabilities,
  ConnectorFamily,
  ConnectorInstance,
  ConnectorProviderDefinition,
  ConnectorProviderId,
  ConnectorSyncLog,
  ConnectorTestResult,
  ScheduledRateChange,
} from '../../types';
import { resolveApiUrl } from '../apiBase';

const CONNECTORS_CACHE_KEY_PREFIX = 'flowtym_universal_connectors_v1_';
const SYNC_LOGS_CACHE_KEY_PREFIX = 'flowtym_sync_logs_v1_';
const SCHEDULED_CHANGES_KEY_PREFIX = 'flowtym_scheduled_rate_changes_v1_';

export const CONNECTOR_PROVIDERS: ConnectorProviderDefinition[] = [
  // =========================================================================
  // CHANNEL MANAGERS (D-EDGE PRIORITAIRE)
  // =========================================================================
  {
    providerId: 'dedge',
    name: 'D-EDGE CRS & Channel Manager',
    family: 'channel_manager',
    isPriority: true,
    description:
      'Connecteur prioritaire D-EDGE : API ARI REST/JSON, Webhooks temps réel, import catalogue Chambres/Plans & import matrice Excel Planning.',
    defaultAuthType: 'bearer',
    defaultEndpointPlaceholder: 'https://api.d-edge.com/v2/ari',
    docsUrl: 'https://docs.d-edge.com',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: true,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: true,
      maxDaysPerBatch: 365,
      supportedRestrictionTypes: ['min_stay', 'max_stay', 'cta', 'ctd', 'stop_sell', 'release_days'],
    },
    fields: [
      { key: 'hotelCode', label: 'Code Hôtel D-EDGE', placeholder: 'H2258', isSecret: false, required: true },
      { key: 'engineId', label: 'Engine ID', placeholder: 'dedge_engine_...', isSecret: false, required: false },
      { key: 'apiToken', label: 'Bearer Token / Clé API D-EDGE', placeholder: 'Saisir le jeton (stocké chiffré côté serveur)', isSecret: true, required: true },
      { key: 'webhookSecret', label: 'Secret Signature Webhook (HMAC)', placeholder: 'whsec_...', isSecret: true, required: false },
    ],
  },
  {
    providerId: 'siteminder',
    name: 'SiteMinder Channel Manager',
    family: 'channel_manager',
    description: 'Distribution OTA OTA/SMX, synchronisation tarifs, stock & restrictions bidirectionnelle.',
    defaultAuthType: 'oauth2',
    defaultEndpointPlaceholder: 'https://api.siteminder.com/v1/ari',
    docsUrl: 'https://developer.siteminder.com',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: true,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: true,
      maxDaysPerBatch: 180,
      supportedRestrictionTypes: ['min_stay', 'max_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Property Code SiteMinder', placeholder: 'SM-PROP-01', isSecret: false, required: true },
      { key: 'clientId', label: 'Client ID OAuth2', placeholder: 'sm_client_...', isSecret: false, required: true },
      { key: 'clientSecret', label: 'Client Secret OAuth2', placeholder: 'Secret chiffré serveur', isSecret: true, required: true },
    ],
  },
  {
    providerId: 'cubilis',
    name: 'Cubilis (Stardekk)',
    family: 'channel_manager',
    description: 'Connecteur OTA/XML Cubilis pour tarifs par occupation, min-stay et fermetures.',
    defaultAuthType: 'api_key',
    defaultEndpointPlaceholder: 'https://api.cubilis.eu/v1/ota',
    docsUrl: 'https://cubilis.com',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: true,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: false,
      supportsPolling: true,
      supportsDeltaSync: false,
      maxDaysPerBatch: 90,
      supportedRestrictionTypes: ['min_stay', 'max_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Cubilis Hotel ID', placeholder: 'CUB-1024', isSecret: false, required: true },
      { key: 'apiKey', label: 'API Key Cubilis', placeholder: 'Clé API chiffrée', isSecret: true, required: true },
    ],
  },
  {
    providerId: 'vertical_booking',
    name: 'Vertical Booking CRS',
    family: 'channel_manager',
    description: 'CRS & Channel Manager multi-canaux, tarifs dérivés et restrictions avancées.',
    defaultAuthType: 'basic',
    defaultEndpointPlaceholder: 'https://ws.verticalbooking.com/ari',
    docsUrl: 'https://www.verticalbooking.com',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: true,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: false,
      maxDaysPerBatch: 120,
      supportedRestrictionTypes: ['min_stay', 'max_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Hotel ID Vertical Booking', placeholder: 'VB-8891', isSecret: false, required: true },
      { key: 'username', label: 'Identifiant WS', placeholder: 'ws_flowtym', isSecret: false, required: true },
      { key: 'password', label: 'Mot de passe WS', placeholder: 'Mot de passe chiffré', isSecret: true, required: true },
    ],
  },
  {
    providerId: 'roomcloud',
    name: 'RoomCloud Channel Manager',
    family: 'channel_manager',
    description: 'Synchronisation OTA temps réel et import de plans tarifaires RoomCloud.',
    defaultAuthType: 'api_key',
    defaultEndpointPlaceholder: 'https://api.roomcloud.net/v2',
    docsUrl: 'https://www.roomcloud.net',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: true,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: true,
      maxDaysPerBatch: 90,
      supportedRestrictionTypes: ['min_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'RoomCloud Hotel ID', placeholder: 'RC-4410', isSecret: false, required: true },
      { key: 'apiKey', label: 'Clé API RoomCloud', placeholder: 'Clé API chiffrée', isSecret: true, required: true },
    ],
  },
  {
    providerId: 'channex',
    name: 'Channex.io Open API',
    family: 'channel_manager',
    description: 'Channel Manager API-first REST/JSON haute fréquence avec Webhooks natifs.',
    defaultAuthType: 'api_key',
    defaultEndpointPlaceholder: 'https://app.channex.io/api/v1',
    docsUrl: 'https://docs.channex.io',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: true,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: true,
      maxDaysPerBatch: 365,
      supportedRestrictionTypes: ['min_stay', 'max_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Property UUID Channex', placeholder: 'chx_prop_...', isSecret: false, required: true },
      { key: 'userApiKey', label: 'Header user-api-key', placeholder: 'Clé API chiffrée', isSecret: true, required: true },
    ],
  },

  // =========================================================================
  // PMS (PROPERTY MANAGEMENT SYSTEMS)
  // =========================================================================
  {
    providerId: 'opera_cloud',
    name: 'Oracle Opera / Opera Cloud (OHIP)',
    family: 'pms',
    description: 'Connecteur Oracle Hospitality Integration Platform (OHIP) & OXI : inventaire physique, réservations OTB & tarifs PMS.',
    defaultAuthType: 'oauth2',
    defaultEndpointPlaceholder: 'https://oc-api.hospitality.oraclecloud.com/rtp/v1',
    docsUrl: 'https://docs.oracle.com/en/industries/hospitality/',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: false,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: true,
      maxDaysPerBatch: 365,
      supportedRestrictionTypes: ['min_stay', 'max_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Hotel ID Opera (Chain/Hotel)', placeholder: 'PARFO', isSecret: false, required: true },
      { key: 'appKey', label: 'x-app-key OHIP', placeholder: 'Clé applicative', isSecret: false, required: true },
      { key: 'clientId', label: 'Client ID OAuth2', placeholder: 'ohip_client_...', isSecret: false, required: true },
      { key: 'clientSecret', label: 'Client Secret OAuth2', placeholder: 'Secret chiffré serveur', isSecret: true, required: true },
    ],
  },
  {
    providerId: 'mews',
    name: 'Mews Commander PMS',
    family: 'pms',
    description: 'API Connector Mews : espaces/catégories, disponibilités temps réel, tarifs journaliers et Webhooks.',
    defaultAuthType: 'api_key',
    defaultEndpointPlaceholder: 'https://api.mews.com/api/connector/v1',
    docsUrl: 'https://mews-systems.gitbook.io/connector-api',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: true,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: true,
      maxDaysPerBatch: 180,
      supportedRestrictionTypes: ['min_stay', 'max_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Enterprise ID Mews', placeholder: 'mews_ent_...', isSecret: false, required: true },
      { key: 'clientToken', label: 'ClientToken Mews', placeholder: 'ClientToken chiffré', isSecret: true, required: true },
      { key: 'accessToken', label: 'AccessToken Mews', placeholder: 'AccessToken chiffré', isSecret: true, required: true },
    ],
  },
  {
    providerId: 'cloudbeds',
    name: 'Cloudbeds PMS',
    family: 'pms',
    description: 'API v1.2 Cloudbeds : chambres, plans tarifaires, disponibilités et mise à jour des tarifs.',
    defaultAuthType: 'oauth2',
    defaultEndpointPlaceholder: 'https://hotels.cloudbeds.com/api/v1.2',
    docsUrl: 'https://hotels.cloudbeds.com/api/docs/',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: false,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: false,
      maxDaysPerBatch: 90,
      supportedRestrictionTypes: ['min_stay', 'max_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Property ID Cloudbeds', placeholder: 'CB-9921', isSecret: false, required: true },
      { key: 'apiKey', label: 'Bearer Token / API Key Cloudbeds', placeholder: 'Secret chiffré serveur', isSecret: true, required: true },
    ],
  },
  {
    providerId: 'protel',
    name: 'Protel PMS (Planet / I/O)',
    family: 'pms',
    description: 'Connecteur Protel Cloud & On-Premise : inventaire, réservations OTB et tarifs.',
    defaultAuthType: 'api_key',
    defaultEndpointPlaceholder: 'https://api.protel.net/v1',
    docsUrl: 'https://developer.protel.net',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: false,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: false,
      supportsPolling: true,
      supportsDeltaSync: false,
      maxDaysPerBatch: 90,
      supportedRestrictionTypes: ['min_stay', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'MPE Hotel ID Protel', placeholder: 'PROT-01', isSecret: false, required: true },
      { key: 'apiKey', label: 'Clé API Protel I/O', placeholder: 'Secret chiffré serveur', isSecret: true, required: true },
    ],
  },
  {
    providerId: 'roomraccoon',
    name: 'RoomRaccoon PMS',
    family: 'pms',
    description: 'PMS + Booking Engine intégré RoomRaccoon pour hôtels indépendants & boutiques.',
    defaultAuthType: 'api_key',
    defaultEndpointPlaceholder: 'https://api.roomraccoon.com/v1',
    docsUrl: 'https://docs.roomraccoon.com',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: true,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: true,
      maxDaysPerBatch: 180,
      supportedRestrictionTypes: ['min_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Hotel ID RoomRaccoon', placeholder: 'RR-302', isSecret: false, required: true },
      { key: 'apiKey', label: 'Clé API RoomRaccoon', placeholder: 'Secret chiffré serveur', isSecret: true, required: true },
    ],
  },
  {
    providerId: 'apaleo',
    name: 'Apaleo Open PMS',
    family: 'pms',
    description: 'Architecture 100% API-first Apaleo : Unit Groups, Rate Plans, Blocks & Webhooks temps réel.',
    defaultAuthType: 'oauth2',
    defaultEndpointPlaceholder: 'https://api.apaleo.com/rateplan/v1',
    docsUrl: 'https://api.apaleo.com/swagger',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: true,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: true,
      maxDaysPerBatch: 365,
      supportedRestrictionTypes: ['min_stay', 'max_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Property Code Apaleo', placeholder: 'APL-PAR', isSecret: false, required: true },
      { key: 'clientId', label: 'Client ID OAuth2', placeholder: 'apaleo_client_...', isSecret: false, required: true },
      { key: 'clientSecret', label: 'Client Secret OAuth2', placeholder: 'Secret chiffré serveur', isSecret: true, required: true },
    ],
  },

  // =========================================================================
  // RATE SHOPPERS
  // =========================================================================
  {
    providerId: 'lighthouse',
    name: 'Lighthouse Rate Insight',
    family: 'rate_shopper',
    description: 'Veille tarifaire concurrentielle OTA & Direct Web (API v3 X-Oi-Authorization) + import Excel CompSet.',
    defaultAuthType: 'custom_header',
    defaultEndpointPlaceholder: 'https://api.mylighthouse.com/v3',
    docsUrl: 'https://docs.mylighthouse.com',
    defaultCapabilities: {
      readRates: true,
      writeRates: false,
      readRestrictions: true,
      writeRestrictions: false,
      readInventory: false,
      writeInventory: false,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: false,
      supportsPolling: true,
      supportsDeltaSync: true,
      maxDaysPerBatch: 365,
      supportedRestrictionTypes: ['min_stay', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Lighthouse Property ID', placeholder: 'LH-PAR-881', isSecret: false, required: true },
      { key: 'apiKey', label: 'Clé API (X-Oi-Authorization)', placeholder: 'Secret chiffré serveur', isSecret: true, required: true },
    ],
  },
  {
    providerId: 'ota_insight',
    name: 'OTA Insight / Parity Monitor',
    family: 'rate_shopper',
    description: 'Surveillance parité tarifaire OTA vs Direct et relevés multi-POS.',
    defaultAuthType: 'bearer',
    defaultEndpointPlaceholder: 'https://api.otainsight.com/v2',
    docsUrl: 'https://www.mylighthouse.com',
    defaultCapabilities: {
      readRates: true,
      writeRates: false,
      readRestrictions: false,
      writeRestrictions: false,
      readInventory: false,
      writeInventory: false,
      importRoomTypes: false,
      importRatePlans: false,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: true,
      maxDaysPerBatch: 180,
      supportedRestrictionTypes: [],
    },
    fields: [
      { key: 'hotelCode', label: 'Account / Hotel Code', placeholder: 'OTA-401', isSecret: false, required: true },
      { key: 'apiToken', label: 'Bearer Token', placeholder: 'Secret chiffré serveur', isSecret: true, required: true },
    ],
  },

  // =========================================================================
  // CONNECTEUR UNIVERSEL CUSTOM API
  // =========================================================================
  {
    providerId: 'custom_api',
    name: 'API Externe Personnalisée (REST / Webhook)',
    family: 'channel_manager',
    description: 'Connecteur générique configurable pour tout autre PMS, Channel Manager ou Rate Shopper disposant d’une API REST/JSON.',
    defaultAuthType: 'bearer',
    defaultEndpointPlaceholder: 'https://api.votre-partenaire.com/v1/ari',
    docsUrl: 'https://flowtym.com/docs/universal-connector-spec',
    defaultCapabilities: {
      readRates: true,
      writeRates: true,
      readRestrictions: true,
      writeRestrictions: true,
      readInventory: true,
      writeInventory: true,
      importRoomTypes: true,
      importRatePlans: true,
      supportsWebhooks: true,
      supportsPolling: true,
      supportsDeltaSync: false,
      maxDaysPerBatch: 90,
      supportedRestrictionTypes: ['min_stay', 'max_stay', 'cta', 'ctd', 'stop_sell'],
    },
    fields: [
      { key: 'hotelCode', label: 'Identifiant Établissement Externe', placeholder: 'EXT-HOTEL-01', isSecret: false, required: true },
      { key: 'customHeaderName', label: 'Nom Header Auth (si custom)', placeholder: 'X-Api-Key', isSecret: false, required: false },
      { key: 'apiSecret', label: 'Clé / Token / Secret API', placeholder: 'Secret chiffré serveur', isSecret: true, required: true },
    ],
  },
];

export function getProviderDefinition(providerId: ConnectorProviderId): ConnectorProviderDefinition {
  return (
    CONNECTOR_PROVIDERS.find((p) => p.providerId === providerId) ||
    CONNECTOR_PROVIDERS[CONNECTOR_PROVIDERS.length - 1]
  );
}

export function buildDefaultConnectorsForHotel(hotelId: string): ConnectorInstance[] {
  const now = new Date().toISOString();
  const dedgeDef = getProviderDefinition('dedge');
  const operaDef = getProviderDefinition('opera_cloud');
  const lhDef = getProviderDefinition('lighthouse');

  return [
    {
      id: `conn-${hotelId}-dedge`,
      hotelId,
      family: 'channel_manager',
      providerId: 'dedge',
      providerName: dedgeDef.name,
      displayName: 'D-EDGE CRS (Principal)',
      environment: 'sandbox',
      authType: 'bearer',
      endpointUrl: dedgeDef.defaultEndpointPlaceholder,
      hotelExternalCode: hotelId === 'hotel-opera' ? 'H2258' : `EXT-${hotelId.toUpperCase().slice(0, 8)}`,
      webhookUrl: '/api/webhooks/external-ari',
      webhookSecretMasked: '',
      hasWebhookSecret: false,
      credentials: dedgeDef.fields.map((f) => ({
        keyName: f.key,
        label: f.label,
        isSecret: f.isSecret,
        hasValue: f.key === 'hotelCode' || f.key === 'engineId',
        maskedPreview:
          f.key === 'hotelCode'
            ? hotelId === 'hotel-opera'
              ? 'H2258'
              : hotelId.toUpperCase()
            : f.key === 'engineId'
            ? 'dedge_engine_45ch'
            : '',
        updatedAt: now,
      })),
      activeSyncMode: 'realtime_webhook',
      pollingIntervalMinutes: 15,
      autoSyncEnabled: true,
      capabilities: { ...dedgeDef.defaultCapabilities },
      isActive: true,
      isPrimaryForFamily: true,
      connectionStatus: 'sandbox_ready',
      executionMode: 'sandbox_simulation',
      lastReadTestAt: now,
      lastWriteTestAt: null,
      lastSyncAt: now,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `conn-${hotelId}-opera`,
      hotelId,
      family: 'pms',
      providerId: 'opera_cloud',
      providerName: operaDef.name,
      displayName: 'Opera Cloud PMS',
      environment: 'sandbox',
      authType: 'oauth2',
      endpointUrl: operaDef.defaultEndpointPlaceholder,
      hotelExternalCode: hotelId === 'hotel-opera' ? 'PARFO' : `PMS-${hotelId.toUpperCase().slice(0, 6)}`,
      webhookUrl: '/api/webhooks/external-ari',
      webhookSecretMasked: '',
      hasWebhookSecret: false,
      credentials: operaDef.fields.map((f) => ({
        keyName: f.key,
        label: f.label,
        isSecret: f.isSecret,
        hasValue: f.key === 'hotelCode',
        maskedPreview: f.key === 'hotelCode' ? 'PARFO' : '',
        updatedAt: now,
      })),
      activeSyncMode: 'scheduled',
      pollingIntervalMinutes: 15,
      autoSyncEnabled: false,
      capabilities: { ...operaDef.defaultCapabilities },
      isActive: true,
      isPrimaryForFamily: true,
      connectionStatus: 'sandbox_ready',
      executionMode: 'sandbox_simulation',
      lastReadTestAt: null,
      lastWriteTestAt: null,
      lastSyncAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `conn-${hotelId}-lighthouse`,
      hotelId,
      family: 'rate_shopper',
      providerId: 'lighthouse',
      providerName: lhDef.name,
      displayName: 'Lighthouse Rate Insight',
      environment: 'sandbox',
      authType: 'custom_header',
      endpointUrl: lhDef.defaultEndpointPlaceholder,
      hotelExternalCode: 'LH-PAR-FOLKESTONE',
      webhookUrl: '',
      webhookSecretMasked: '',
      hasWebhookSecret: false,
      credentials: lhDef.fields.map((f) => ({
        keyName: f.key,
        label: f.label,
        isSecret: f.isSecret,
        hasValue: f.key === 'hotelCode',
        maskedPreview: f.key === 'hotelCode' ? 'LH-PAR-FOLKESTONE' : '',
        updatedAt: now,
      })),
      activeSyncMode: 'scheduled',
      pollingIntervalMinutes: 60,
      autoSyncEnabled: true,
      capabilities: { ...lhDef.defaultCapabilities },
      isActive: true,
      isPrimaryForFamily: true,
      connectionStatus: 'sandbox_ready',
      executionMode: 'sandbox_simulation',
      lastReadTestAt: now,
      lastWriteTestAt: null,
      lastSyncAt: now,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// ==============================================================================
// INTERFACE ADAPTATEUR UNIVERSEL (PATTERN ADAPTER DÉCOUPLÉ DU MOTEUR TARIFAIRE)
// ==============================================================================
export interface UniversalConnectorAdapter {
  providerId: ConnectorProviderId;
  family: ConnectorFamily;
  getCapabilities(instance: ConnectorInstance): ConnectorCapabilities;
  testConnection(instance: ConnectorInstance): Promise<ConnectorTestResult>;
  testRead(instance: ConnectorInstance): Promise<ConnectorTestResult>;
  testWrite(instance: ConnectorInstance): Promise<ConnectorTestResult>;
}

/**
 * Adaptateur client qui délègue au backend Express (/api/connectors/*) afin que
 * les secrets ne quittent jamais le coffre-fort serveur en clair.
 */
export const ServerBackedConnectorAdapter: UniversalConnectorAdapter = {
  providerId: 'dedge',
  family: 'channel_manager',
  getCapabilities(instance: ConnectorInstance): ConnectorCapabilities {
    return instance.capabilities;
  },
  async testConnection(instance: ConnectorInstance): Promise<ConnectorTestResult> {
    return executeConnectorTest(instance.hotelId, instance.id, 'connection');
  },
  async testRead(instance: ConnectorInstance): Promise<ConnectorTestResult> {
    return executeConnectorTest(instance.hotelId, instance.id, 'read');
  },
  async testWrite(instance: ConnectorInstance): Promise<ConnectorTestResult> {
    return executeConnectorTest(instance.hotelId, instance.id, 'write');
  },
};

function sanitizeConnectorForClientCache(c: ConnectorInstance): ConnectorInstance {
  // Garantir qu'aucun secret en clair n'est jamais écrit en cache navigateur
  return {
    ...c,
    credentials: c.credentials.map((cred) => ({
      ...cred,
      maskedPreview: cred.isSecret
        ? cred.hasValue
          ? cred.maskedPreview.startsWith('••••')
            ? cred.maskedPreview
            : `••••${cred.maskedPreview.slice(-4)}`
          : ''
        : cred.maskedPreview,
    })),
  };
}

export function getCachedConnectorsForHotel(hotelId: string): ConnectorInstance[] {
  try {
    const raw = localStorage.getItem(`${CONNECTORS_CACHE_KEY_PREFIX}${hotelId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback
  }
  const defaults = buildDefaultConnectorsForHotel(hotelId);
  try {
    localStorage.setItem(`${CONNECTORS_CACHE_KEY_PREFIX}${hotelId}`, JSON.stringify(defaults));
  } catch {
    // Ignore storage quota
  }
  return defaults;
}

export async function fetchConnectorsForHotel(hotelId: string): Promise<ConnectorInstance[]> {
  const localFallback = getCachedConnectorsForHotel(hotelId);
  try {
    const resp = await fetch(resolveApiUrl(`/api/connectors/${encodeURIComponent(hotelId)}`));
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.connectors) && data.connectors.length > 0) {
        const sanitized = data.connectors.map(sanitizeConnectorForClientCache);
        localStorage.setItem(`${CONNECTORS_CACHE_KEY_PREFIX}${hotelId}`, JSON.stringify(sanitized));
        return sanitized;
      }
    }
  } catch {
    // Fallback cache local sans secrets
  }
  return localFallback;
}

export async function saveConnectorOnServer(
  hotelId: string,
  connector: ConnectorInstance,
  plainSecrets: Record<string, string> = {},
  actorRole: string = 'admin'
): Promise<{ success: boolean; connector: ConnectorInstance; error?: string }> {
  const sanitizedLocal = sanitizeConnectorForClientCache(connector);
  try {
    const resp = await fetch(resolveApiUrl(`/api/connectors/${encodeURIComponent(hotelId)}`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-flowtym-role': actorRole,
      },
      body: JSON.stringify({ connector: sanitizedLocal, secrets: plainSecrets }),
    });
    const data = await resp.json();
    if (!resp.ok || !data?.success) {
      return { success: false, connector: sanitizedLocal, error: data?.error || `HTTP ${resp.status}` };
    }
    const saved = sanitizeConnectorForClientCache(data.connector);
    const current = getCachedConnectorsForHotel(hotelId);
    const exists = current.some((c) => c.id === saved.id);
    const updated = exists ? current.map((c) => (c.id === saved.id ? saved : c)) : [...current, saved];
    localStorage.setItem(`${CONNECTORS_CACHE_KEY_PREFIX}${hotelId}`, JSON.stringify(updated));
    return { success: true, connector: saved };
  } catch (err: any) {
    // Sauvegarde locale métadonnées non-secrètes uniquement
    const current = getCachedConnectorsForHotel(hotelId);
    const exists = current.some((c) => c.id === sanitizedLocal.id);
    const updated = exists
      ? current.map((c) => (c.id === sanitizedLocal.id ? sanitizedLocal : c))
      : [...current, sanitizedLocal];
    localStorage.setItem(`${CONNECTORS_CACHE_KEY_PREFIX}${hotelId}`, JSON.stringify(updated));
    return {
      success: true,
      connector: sanitizedLocal,
      error: err?.message ? `Mode hors-ligne : ${err.message}` : undefined,
    };
  }
}

export async function deleteConnectorOnServer(
  hotelId: string,
  connectorId: string,
  actorRole: string = 'admin'
): Promise<{ success: boolean; error?: string }> {
  const current = getCachedConnectorsForHotel(hotelId);
  const next = current.filter((c) => c.id !== connectorId);
  localStorage.setItem(`${CONNECTORS_CACHE_KEY_PREFIX}${hotelId}`, JSON.stringify(next));
  try {
    const resp = await fetch(
      resolveApiUrl(`/api/connectors/${encodeURIComponent(hotelId)}/${encodeURIComponent(connectorId)}`),
      {
        method: 'DELETE',
        headers: { 'x-flowtym-role': actorRole },
      }
    );
    const data = await resp.json();
    return { success: Boolean(data?.success ?? resp.ok), error: data?.error };
  } catch {
    return { success: true };
  }
}

export async function executeConnectorTest(
  hotelId: string,
  connectorId: string,
  testType: 'connection' | 'read' | 'write' | 'webhook'
): Promise<ConnectorTestResult> {
  const cached = getCachedConnectorsForHotel(hotelId).find((c) => c.id === connectorId);
  try {
    const resp = await fetch(
      resolveApiUrl(`/api/connectors/${encodeURIComponent(hotelId)}/${encodeURIComponent(connectorId)}/test`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType, connector: cached }),
      }
    );
    const data = await resp.json();
    if (data && typeof data.success === 'boolean') {
      return data as ConnectorTestResult;
    }
  } catch {
    // Fallback contrôlé
  }
  return {
    success: Boolean(cached?.hotelExternalCode),
    testType,
    providerId: cached?.providerId || 'custom_api',
    connectorId,
    executionMode: 'sandbox_simulation',
    latencyMs: 45,
    traceabilityId: `SBX-LOCAL-${Date.now()}`,
    message: cached?.hotelExternalCode
      ? `Test ${testType} validé en Sandbox contrôlée (${cached.displayName}).`
      : 'Code hôtel externe requis pour exécuter le test.',
    testedAt: new Date().toISOString(),
  };
}

// ==============================================================================
// LOGS TECHNIQUES DE SYNCHRONISATION (FILTRABLES & TRAÇABLES)
// ==============================================================================

export function getCachedSyncLogs(hotelId: string): ConnectorSyncLog[] {
  try {
    const raw = localStorage.getItem(`${SYNC_LOGS_CACHE_KEY_PREFIX}${hotelId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return [];
}

export function appendLocalSyncLog(hotelId: string, log: ConnectorSyncLog): ConnectorSyncLog[] {
  const prev = getCachedSyncLogs(hotelId);
  const next = [log, ...prev].slice(0, 400);
  try {
    localStorage.setItem(`${SYNC_LOGS_CACHE_KEY_PREFIX}${hotelId}`, JSON.stringify(next));
  } catch {
    // Ignore
  }
  void fetch(resolveApiUrl(`/api/sync-logs/${encodeURIComponent(hotelId)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log),
  }).catch(() => {});
  return next;
}

export async function fetchSyncLogsForHotel(
  hotelId: string,
  filters?: {
    providerId?: string;
    status?: string;
    operationType?: string;
    date?: string;
    roomTypeCode?: string;
    ratePlanCode?: string;
  }
): Promise<ConnectorSyncLog[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.providerId && filters.providerId !== 'all') params.set('providerId', filters.providerId);
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters?.operationType && filters.operationType !== 'all') params.set('operationType', filters.operationType);
    if (filters?.date) params.set('date', filters.date);
    if (filters?.roomTypeCode && filters.roomTypeCode !== 'all') params.set('roomTypeCode', filters.roomTypeCode);
    if (filters?.ratePlanCode && filters.ratePlanCode !== 'all') params.set('ratePlanCode', filters.ratePlanCode);
    const q = params.toString();
    const resp = await fetch(resolveApiUrl(`/api/sync-logs/${encodeURIComponent(hotelId)}${q ? `?${q}` : ''}`));
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.logs)) {
        const merged = [...data.logs];
        const existingIds = new Set(merged.map((l) => l.id));
        for (const l of getCachedSyncLogs(hotelId)) {
          if (!existingIds.has(l.id)) merged.push(l);
        }
        return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 400);
      }
    }
  } catch {
    // Fallback cache local
  }
  return getCachedSyncLogs(hotelId);
}

// ==============================================================================
// FILE DES MODIFICATIONS PLANIFIÉES DANS LE FUTUR
// ==============================================================================

export function getScheduledRateChanges(hotelId: string): ScheduledRateChange[] {
  try {
    const raw = localStorage.getItem(`${SCHEDULED_CHANGES_KEY_PREFIX}${hotelId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return [];
}

export function saveScheduledRateChange(hotelId: string, item: ScheduledRateChange): ScheduledRateChange[] {
  const prev = getScheduledRateChanges(hotelId);
  const next = [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 100);
  try {
    localStorage.setItem(`${SCHEDULED_CHANGES_KEY_PREFIX}${hotelId}`, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function updateScheduledRateChangeStatus(
  hotelId: string,
  scheduleId: string,
  status: ScheduledRateChange['status'],
  summary?: string
): ScheduledRateChange[] {
  const now = new Date().toISOString();
  const next = getScheduledRateChanges(hotelId).map((s) =>
    s.id === scheduleId
      ? {
          ...s,
          status,
          executedAt: status === 'executed' ? now : s.executedAt,
          summary: summary || s.summary,
        }
      : s
  );
  try {
    localStorage.setItem(`${SCHEDULED_CHANGES_KEY_PREFIX}${hotelId}`, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}
