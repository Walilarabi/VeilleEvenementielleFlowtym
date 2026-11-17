/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Types universels pour l'Architecture Modulaire de Connecteurs (PMS, Channel Manager, Rate Shopper),
 * l'Import Excel Intelligent D-EDGE / Générique, les Logs Techniques et la Planification Tarifaire.
 */

export type ConnectorFamily = 'pms' | 'channel_manager' | 'rate_shopper';

export type ConnectorProviderId =
  | 'opera_cloud'
  | 'mews'
  | 'cloudbeds'
  | 'protel'
  | 'roomraccoon'
  | 'apaleo'
  | 'dedge'
  | 'siteminder'
  | 'cubilis'
  | 'vertical_booking'
  | 'roomcloud'
  | 'channex'
  | 'lighthouse'
  | 'ota_insight'
  | 'custom_api';

export type ConnectorAuthType = 'api_key' | 'oauth2' | 'bearer' | 'basic' | 'custom_header';

export type ConnectorEnvironment = 'sandbox' | 'production';

export type ConnectorSyncMode = 'manual' | 'scheduled' | 'realtime_webhook';

export type ConnectorConnectionStatus =
  | 'unconfigured'
  | 'sandbox_ready'
  | 'connected'
  | 'degraded'
  | 'error';

export interface ConnectorCapabilities {
  readRates: boolean;
  writeRates: boolean;
  readRestrictions: boolean;
  writeRestrictions: boolean;
  readInventory: boolean;
  writeInventory: boolean;
  importRoomTypes: boolean;
  importRatePlans: boolean;
  supportsWebhooks: boolean;
  supportsPolling: boolean;
  supportsDeltaSync: boolean;
  maxDaysPerBatch: number;
  supportedRestrictionTypes: ('min_stay' | 'max_stay' | 'cta' | 'ctd' | 'stop_sell' | 'release_days')[];
}

export interface ConnectorFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  isSecret: boolean;
  required: boolean;
  helpText?: string;
}

export interface ConnectorProviderDefinition {
  providerId: ConnectorProviderId;
  name: string;
  family: ConnectorFamily;
  isPriority?: boolean;
  description: string;
  defaultAuthType: ConnectorAuthType;
  defaultEndpointPlaceholder: string;
  docsUrl: string;
  defaultCapabilities: ConnectorCapabilities;
  fields: ConnectorFieldDefinition[];
}

export interface ConnectorCredentialMetadata {
  keyName: string;
  label: string;
  isSecret: boolean;
  hasValue: boolean;
  maskedPreview: string; // ex: "••••••••a9b0" ou ""
  updatedAt: string;
}

export interface ConnectorInstance {
  id: string;
  hotelId: string;
  family: ConnectorFamily;
  providerId: ConnectorProviderId;
  providerName: string;
  displayName: string;
  environment: ConnectorEnvironment;
  authType: ConnectorAuthType;
  endpointUrl: string;
  hotelExternalCode: string;
  webhookUrl: string;
  webhookSecretMasked: string;
  hasWebhookSecret: boolean;
  credentials: ConnectorCredentialMetadata[];
  activeSyncMode: ConnectorSyncMode;
  pollingIntervalMinutes: 5 | 15 | 30 | 60 | 180;
  autoSyncEnabled: boolean;
  capabilities: ConnectorCapabilities;
  isActive: boolean;
  isPrimaryForFamily: boolean;
  connectionStatus: ConnectorConnectionStatus;
  executionMode: 'live_api' | 'sandbox_simulation';
  lastReadTestAt: string | null;
  lastWriteTestAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorTestResult {
  success: boolean;
  testType: 'connection' | 'read' | 'write' | 'webhook';
  providerId: ConnectorProviderId;
  connectorId: string;
  executionMode: 'live_api' | 'sandbox_simulation';
  latencyMs: number;
  httpStatus?: number;
  traceabilityId: string;
  message: string;
  details?: Record<string, unknown>;
  testedAt: string;
}

export interface ConnectorSyncLog {
  id: string;
  hotelId: string;
  connectorId: string;
  providerId: ConnectorProviderId;
  providerName: string;
  family: ConnectorFamily;
  operationType:
    | 'push_rates'
    | 'push_restrictions'
    | 'push_inventory'
    | 'pull_rates'
    | 'pull_inventory'
    | 'pull_catalog'
    | 'webhook_inbound'
    | 'test_connection'
    | 'test_read'
    | 'test_write'
    | 'excel_import';
  direction: 'outbound' | 'inbound' | 'internal';
  status: 'queued' | 'sending' | 'synced' | 'failed' | 'rejected' | 'conflict';
  executionMode: 'live_api' | 'sandbox_simulation';
  roomTypeCode?: string;
  ratePlanCode?: string;
  stayDateFrom?: string;
  stayDateTo?: string;
  cellsAffected: number;
  traceabilityId: string;
  externalAckId?: string | null;
  durationMs: number;
  actor: string;
  message: string;
  payloadPreview?: string;
  createdAt: string;
}

export interface ScheduledRateChange {
  id: string;
  hotelId: string;
  scheduledForIso: string; // ISO datetime d'exécution planifiée
  status: 'scheduled' | 'executed' | 'cancelled' | 'failed';
  scopeLabel: string;
  dateFrom: string;
  dateTo: string;
  weekdays: number[]; // 0=Dim..6=Sam
  roomCategoryCodes: string[];
  ratePlanCodes: string[];
  adjustmentMode: 'fixed_price' | 'delta_eur' | 'delta_pct' | 'inventory_set' | 'restrictions';
  adjustmentValue: number;
  inventoryValue?: number | null;
  minStay?: number | null;
  stopSell?: boolean | null;
  autoPushToConnectors: boolean;
  actor: string;
  createdAt: string;
  executedAt?: string | null;
  summary?: string;
}

// ==============================================================================
// MOTEUR D'IMPORT EXCEL INTELLIGENT (D-EDGE PLANNING & FORMATS GÉNÉRIQUES)
// ==============================================================================

export type ImportProviderPreset = 'dedge_planning' | 'generic_matrix' | 'rate_plan_list' | 'lighthouse_export';

export type ImportDataMetricType = 'rate' | 'inventory' | 'min_stay' | 'max_stay' | 'cta' | 'ctd' | 'stop_sell' | 'unknown';

export interface ImportTemplateMapping {
  id: string;
  hotelId: string;
  name: string;
  providerPreset: ImportProviderPreset;
  roomColumnName: string;
  ratePlanColumnName: string;
  dataTypeColumnName: string;
  priceTypeValue: string; // ex: "Price (EUR)"
  inventoryTypeValue: string; // ex: "Left for sale"
  roomCodeMappings: Record<string, string>; // externalRoomLabel -> internalRoomCode
  planCodeMappings: Record<string, string>; // externalPlanLabel -> internalPlanCode
  defaultCurrency: 'EUR' | 'USD' | 'GBP' | 'CHF';
  createdAt: string;
  updatedAt: string;
}

export interface DedgeParsedCellRecord {
  rowIndex: number;
  sheetName: string;
  externalRoomLabel: string;
  externalPlanLabel: string;
  dataTypeLabel: string;
  metricType: ImportDataMetricType;
  stayDate: string; // YYYY-MM-DD
  numericValue: number | null;
  booleanValue?: boolean | null;
  rawCellValue: string;
  isValid: boolean;
  anomalyReason?: string;
}

export interface ImportAnomalyItem {
  id: string;
  rowIndex: number;
  sheetName: string;
  stayDate?: string;
  roomLabel: string;
  planLabel: string;
  severity: 'warning' | 'error';
  code: 'missing_value' | 'invalid_number' | 'negative_value' | 'duplicate_row' | 'unmapped_room' | 'unmapped_plan' | 'date_parse_error';
  message: string;
}

export interface DedgeImportAnalysis {
  fileName: string;
  fileFormat: 'xlsx' | 'xls' | 'csv';
  detectedProvider: ImportProviderPreset;
  delimiter?: string;
  sheetNames: string[];
  detectedColumns: {
    roomColumn: string;
    planColumn: string;
    dataTypeColumn: string;
    dateColumns: { header: string; isoDate: string }[];
  };
  detectedRooms: { externalLabel: string; suggestedInternalCode: string; rowCount: number }[];
  detectedPlans: { externalLabel: string; suggestedInternalCode: string; rowCount: number }[];
  detectedDataTypes: { label: string; metricType: ImportDataMetricType; count: number }[];
  dateRange: { start: string | null; end: string | null; totalDates: number };
  records: DedgeParsedCellRecord[];
  anomalies: ImportAnomalyItem[];
  stats: {
    totalRowsScanned: number;
    validRatePoints: number;
    validInventoryPoints: number;
    validRestrictionPoints: number;
    missingCells: number;
    duplicateCells: number;
    errorCells: number;
  };
}

export interface ImportDiffRow {
  cellKey: string;
  stayDate: string;
  roomCode: string;
  roomName: string;
  planCode: string;
  planName: string;
  metricType: 'rate' | 'inventory' | 'restriction';
  changeType: 'new' | 'modified' | 'unchanged' | 'rejected';
  existingValue: number | string | null;
  incomingValue: number | string | null;
  deltaEur?: number | null;
  reason?: string;
}

export interface DedgeImportReport {
  jobId: string;
  hotelId: string;
  fileName: string;
  providerPreset: ImportProviderPreset;
  executedAt: string;
  actor: string;
  status: 'completed' | 'completed_with_warnings' | 'failed';
  createdRoomsCount: number;
  createdPlansCount: number;
  updatedRatesCount: number;
  updatedInventoryCount: number;
  updatedRestrictionsCount: number;
  unchangedCount: number;
  rejectedCount: number;
  anomaliesCount: number;
  anomalies: ImportAnomalyItem[];
  summary: string;
}
