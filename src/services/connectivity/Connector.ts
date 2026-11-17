/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Contrat d'intégration universel FLOWTYM REVENUE (`Connector`) et classe abstraite `BaseConnector`.
 * Découple le moteur de Planning Tarifaire de toute API PMS, Channel Manager ou Rate Shopper,
 * en structurant :
 *   - la découverte catalogue (`getRooms`, `getRatePlans`)
 *   - la lecture ARI (`getRates`, `getAvailability`, `fetchRestrictions`, `fetchSnapshot`)
 *   - la mise à jour sortante (`updateRate`, `updateInventory`, `pushRestrictions`)
 *   - la gestion d'authentification (`authenticate`, `refreshAuth`, `getAuthHeaders`, `validateAuthConfig`)
 *   - la validation des capacités (`supportsCapability`, `validateCapability`, `validateCapabilities`)
 */

import {
  ConnectorAuthType,
  ConnectorCapabilities,
  ConnectorFamily,
  ConnectorInstance,
  ConnectorProviderId,
  ConnectorSyncLog,
  ConnectorTestResult,
  CurrencyCode,
  DistributionChannelCode,
} from '../../types';
import { appendLocalSyncLog } from '../connectors/connectorRegistry';

export interface ConnectorDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface ConnectorRoom {
  externalCode: string;
  externalName: string;
  physicalRooms?: number;
  sellableRooms?: number;
  maxOccupancy?: number;
  maxAdults?: number;
  maxChildren?: number;
  bedConfiguration?: string;
  isActive?: boolean;
}

export interface ConnectorRatePlan {
  externalCode: string;
  externalName: string;
  currency?: CurrencyCode;
  breakfastIncluded?: boolean;
  cancellationPolicy?: string;
  derivedFromExternalCode?: string | null;
  applicableExternalRoomCodes?: string[];
  isPublic?: boolean;
  isActive?: boolean;
}

// Alias rétrocompatibles pour les consommateurs existants
export type ConnectorExternalRoomType = ConnectorRoom;
export type ConnectorExternalRatePlan = ConnectorRatePlan;

export interface ConnectorRatePoint {
  hotelId: string;
  stayDate: string; // YYYY-MM-DD
  roomTypeCode: string;
  ratePlanCode: string;
  rateEur: number;
  currency: CurrencyCode;
  channelCode?: DistributionChannelCode;
  externalVersion?: number;
  externalUpdatedAt?: string;
  externalActor?: string;
}

export interface ConnectorAvailabilityPoint {
  hotelId: string;
  stayDate: string; // YYYY-MM-DD
  roomTypeCode: string;
  physicalRooms?: number;
  sellableRooms?: number;
  roomsSold?: number;
  leftForSale: number;
  outOfOrderRooms?: number;
  channelAllocations?: Partial<Record<DistributionChannelCode, number>>;
  externalUpdatedAt?: string;
}

export interface ConnectorRestrictionPoint {
  hotelId: string;
  stayDate: string; // YYYY-MM-DD
  roomTypeCode: string;
  ratePlanCode: string;
  minStay: number;
  maxStay: number | null;
  cta: boolean;
  ctd: boolean;
  isClosed: boolean;
  releaseDays?: number | null;
  externalUpdatedAt?: string;
}

export interface ConnectorExternalCatalog {
  providerId: ConnectorProviderId;
  connectorId: string;
  hotelId: string;
  fetchedAt: string;
  executionMode: 'live_api' | 'sandbox_simulation';
  roomTypes: ConnectorRoom[];
  ratePlans: ConnectorRatePlan[];
  channels: string[];
}

export interface ConnectorMappingEntry {
  connectorId: string;
  entityType: 'room_type' | 'rate_plan' | 'channel' | 'restriction';
  internalCode: string;
  externalCode: string;
  externalLabel?: string;
  isPrimary?: boolean;
}

export interface ConnectorPushRatePayload {
  cellKey: string;
  stayDate: string;
  internalRoomCode: string;
  externalRoomCode: string;
  internalPlanCode: string;
  externalPlanCode: string;
  rateEur: number;
  currency: CurrencyCode;
  baseExternalVersion?: number;
  forceOverwrite?: boolean;
}

export interface ConnectorPushAvailabilityPayload {
  stayDate: string;
  internalRoomCode: string;
  externalRoomCode: string;
  leftForSale: number;
  channelAllocations?: Partial<Record<DistributionChannelCode, number>>;
}

export interface ConnectorPushRestrictionPayload {
  cellKey: string;
  stayDate: string;
  internalRoomCode: string;
  externalRoomCode: string;
  internalPlanCode: string;
  externalPlanCode: string;
  minStay: number;
  maxStay: number | null;
  cta: boolean;
  ctd: boolean;
  isClosed: boolean;
  releaseDays?: number | null;
}

export interface ConnectorPushItemOutcome {
  itemKey: string;
  status: 'synced' | 'queued' | 'failed' | 'rejected' | 'conflict';
  externalAckId?: string | null;
  externalVersion?: number;
  errorMessage?: string | null;
}

export interface ConnectorPushResult {
  success: boolean;
  connectorId: string;
  providerId: ConnectorProviderId;
  executionMode: 'live_api' | 'sandbox_simulation';
  idempotencyKey: string;
  traceabilityId: string;
  processedCount: number;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  latencyMs: number;
  items: ConnectorPushItemOutcome[];
  processedAt: string;
}

export interface ConnectorHealthReport {
  connectorId: string;
  providerId: ConnectorProviderId;
  healthy: boolean;
  executionMode: 'live_api' | 'sandbox_simulation';
  latencyMs: number;
  checkedAt: string;
  message: string;
}

export interface ConnectorSnapshot {
  range: ConnectorDateRange;
  rates: ConnectorRatePoint[];
  availability: ConnectorAvailabilityPoint[];
  restrictions: ConnectorRestrictionPoint[];
  fetchedAt: string;
}

export interface ConnectorWebhookParseResult {
  valid: boolean;
  signatureVerified: boolean;
  idempotencyKey?: string;
  rates: ConnectorRatePoint[];
  availability: ConnectorAvailabilityPoint[];
  restrictions: ConnectorRestrictionPoint[];
  reason?: string;
}

export interface ConnectorAuthContext {
  authenticated: boolean;
  authType: ConnectorAuthType;
  executionMode: 'live_api' | 'sandbox_simulation';
  authenticatedAt: string;
  expiresAt?: string | null;
  tokenType?: 'Bearer' | 'ApiKey' | 'Basic' | 'CustomHeader';
  scopes?: string[];
  headers: Record<string, string>;
}

export interface ConnectorAuthValidationResult {
  valid: boolean;
  authType: ConnectorAuthType;
  executionMode: 'live_api' | 'sandbox_simulation';
  missingCredentials: string[];
  issues: string[];
}

export interface ConnectorCapabilityValidationResult {
  valid: boolean;
  checkedCapabilities: (keyof ConnectorCapabilities)[];
  missingCapabilities: (keyof ConnectorCapabilities)[];
  warnings: string[];
}

/**
 * Erreur métier levée lorsqu'une opération requiert une capacité absente du connecteur.
 */
export class ConnectorUnsupportedCapabilityError extends Error {
  public readonly providerId: ConnectorProviderId;
  public readonly capability: keyof ConnectorCapabilities;

  constructor(
    providerId: ConnectorProviderId,
    capability: keyof ConnectorCapabilities,
    operationLabel: string
  ) {
    super(
      `Capacité "${String(capability)}" non supportée par le connecteur "${providerId}" pour l'opération : ${operationLabel}.`
    );
    this.name = 'ConnectorUnsupportedCapabilityError';
    this.providerId = providerId;
    this.capability = capability;
  }
}

/**
 * Erreur levée lorsque l'authentification d'un connecteur échoue ou est incomplète.
 */
export class ConnectorAuthenticationError extends Error {
  public readonly providerId: ConnectorProviderId;
  public readonly authType: ConnectorAuthType;

  constructor(providerId: ConnectorProviderId, authType: ConnectorAuthType, message: string) {
    super(`[${providerId}/${authType}] ${message}`);
    this.name = 'ConnectorAuthenticationError';
    this.providerId = providerId;
    this.authType = authType;
  }
}

/**
 * Interface canonique que tout connecteur PMS, Channel Manager ou Rate Shopper doit implémenter.
 */
export interface Connector {
  readonly id: string;
  readonly hotelId: string;
  readonly family: ConnectorFamily;
  readonly providerId: ConnectorProviderId;
  readonly authType: ConnectorAuthType;
  readonly instance: ConnectorInstance;
  readonly capabilities: ConnectorCapabilities;

  // Gestion de l'authentification
  authenticate(): Promise<ConnectorAuthContext>;
  refreshAuth(): Promise<ConnectorAuthContext>;
  isAuthenticated(): boolean;
  validateAuthConfig(): ConnectorAuthValidationResult;
  getAuthHeaders(): Promise<Record<string, string>>;

  // Inspection & validation des capacités
  getCapabilities(): ConnectorCapabilities;
  supportsCapability(capability: keyof ConnectorCapabilities): boolean;
  validateCapability(capability: keyof ConnectorCapabilities, operationLabel?: string): void;
  validateCapabilities(
    requiredCapabilities: (keyof ConnectorCapabilities)[]
  ): ConnectorCapabilityValidationResult;

  // Méthodes principales structurées (Catalogue, Lecture ARI, Mises à jour ARI)
  getRooms(): Promise<ConnectorRoom[]>;
  getRatePlans(): Promise<ConnectorRatePlan[]>;
  getRates(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorRatePoint[]>;
  getAvailability(
    range: ConnectorDateRange,
    roomCodes?: string[]
  ): Promise<ConnectorAvailabilityPoint[]>;
  updateRate(
    payload: ConnectorPushRatePayload | ConnectorPushRatePayload[],
    idempotencyKey?: string
  ): Promise<ConnectorPushResult>;
  updateInventory(
    payload: ConnectorPushAvailabilityPayload | ConnectorPushAvailabilityPayload[],
    idempotencyKey?: string
  ): Promise<ConnectorPushResult>;

  // Opérations complémentaires (restrictions, snapshot, santé, mappings, webhooks)
  testConnection(): Promise<ConnectorTestResult>;
  testRead(range?: ConnectorDateRange): Promise<ConnectorTestResult>;
  testWrite(dryRunPayload?: ConnectorPushRatePayload[]): Promise<ConnectorTestResult>;
  healthCheck(): Promise<ConnectorHealthReport>;
  fetchCatalog(): Promise<ConnectorExternalCatalog>;
  validateMappings(mappings: ConnectorMappingEntry[]): {
    valid: boolean;
    duplicateCodes: string[];
  };
  fetchRates(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorRatePoint[]>;
  fetchAvailability(
    range: ConnectorDateRange,
    roomCodes?: string[]
  ): Promise<ConnectorAvailabilityPoint[]>;
  fetchRestrictions(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorRestrictionPoint[]>;
  fetchSnapshot(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorSnapshot>;
  pushRates(
    updates: ConnectorPushRatePayload[],
    idempotencyKey?: string
  ): Promise<ConnectorPushResult>;
  pushAvailability(
    updates: ConnectorPushAvailabilityPayload[],
    idempotencyKey?: string
  ): Promise<ConnectorPushResult>;
  pushRestrictions(
    updates: ConnectorPushRestrictionPayload[],
    idempotencyKey?: string
  ): Promise<ConnectorPushResult>;
  parseInboundWebhook(
    rawBody: unknown,
    signatureHeader?: string
  ): ConnectorWebhookParseResult;
}

/**
 * Classe abstraite `BaseConnector` factorisant l'authentification, la validation des capacités,
 * le découpage en lots (`maxDaysPerBatch`), la validation des dates, l'idempotence,
 * la détection des doublons de mapping et la journalisation des opérations.
 */
export abstract class BaseConnector implements Connector {
  protected readonly _instance: ConnectorInstance;
  protected readonly _capabilities: ConnectorCapabilities;
  protected _authContext: ConnectorAuthContext | null = null;

  constructor(instance: ConnectorInstance) {
    this._instance = instance;
    this._capabilities = instance.capabilities;
  }

  get id(): string {
    return this._instance.id;
  }

  get hotelId(): string {
    return this._instance.hotelId;
  }

  get family(): ConnectorFamily {
    return this._instance.family;
  }

  get providerId(): ConnectorProviderId {
    return this._instance.providerId;
  }

  get authType(): ConnectorAuthType {
    return this._instance.authType;
  }

  get instance(): ConnectorInstance {
    return this._instance;
  }

  get capabilities(): ConnectorCapabilities {
    return this._capabilities;
  }

  // =========================================================================
  // 1. GESTION DE L'AUTHENTIFICATION
  // =========================================================================

  public validateAuthConfig(): ConnectorAuthValidationResult {
    const executionMode = this.resolveExecutionMode();
    const missingCredentials: string[] = [];
    const issues: string[] = [];

    if (this._instance.environment === 'production') {
      if (!this._instance.endpointUrl || !/^https?:\/\//i.test(this._instance.endpointUrl)) {
        issues.push('URL d’endpoint API manquante ou invalide pour le mode production.');
      }
      const secretsMissing = this._instance.credentials
        .filter((c) => c.isSecret && !c.hasValue)
        .map((c) => c.label || c.keyName);
      missingCredentials.push(...secretsMissing);

      if (this._instance.credentials.length === 0) {
        issues.push('Aucun identifiant d’authentification configuré.');
      }
    }

    return {
      valid:
        executionMode === 'sandbox_simulation' ||
        (missingCredentials.length === 0 && issues.length === 0),
      authType: this.authType,
      executionMode,
      missingCredentials,
      issues,
    };
  }

  public isAuthenticated(): boolean {
    if (!this._authContext || !this._authContext.authenticated) {
      return false;
    }
    if (this._authContext.expiresAt) {
      const expiresMs = Date.parse(this._authContext.expiresAt);
      if (Number.isFinite(expiresMs) && Date.now() >= expiresMs - 15_000) {
        return false;
      }
    }
    return true;
  }

  public async authenticate(): Promise<ConnectorAuthContext> {
    const validation = this.validateAuthConfig();
    if (!validation.valid) {
      const details = [...validation.missingCredentials, ...validation.issues].join(' ; ');
      throw new ConnectorAuthenticationError(
        this.providerId,
        this.authType,
        details || 'Configuration d’authentification invalide.'
      );
    }

    const context = await this.onAuthenticate(validation.executionMode);
    this._authContext = context;
    return context;
  }

  public async refreshAuth(): Promise<ConnectorAuthContext> {
    this._authContext = null;
    return this.authenticate();
  }

  public async getAuthHeaders(): Promise<Record<string, string>> {
    const ctx = await this.ensureAuthenticated();
    return {
      'X-Flowtym-Connector-Id': this.id,
      'X-Flowtym-Hotel-Id': this.hotelId,
      'X-Flowtym-Provider': this.providerId,
      ...ctx.headers,
    };
  }

  protected async ensureAuthenticated(): Promise<ConnectorAuthContext> {
    if (this.isAuthenticated() && this._authContext) {
      return this._authContext;
    }
    return this.authenticate();
  }

  // =========================================================================
  // 2. VALIDATION DES CAPACITÉS
  // =========================================================================

  public getCapabilities(): ConnectorCapabilities {
    return this._capabilities;
  }

  public supportsCapability(capability: keyof ConnectorCapabilities): boolean {
    const val = this._capabilities[capability];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val > 0;
    if (Array.isArray(val)) return val.length > 0;
    return false;
  }

  public validateCapability(
    capability: keyof ConnectorCapabilities,
    operationLabel = String(capability)
  ): void {
    this.assertCapability(capability, operationLabel);
  }

  public validateCapabilities(
    requiredCapabilities: (keyof ConnectorCapabilities)[]
  ): ConnectorCapabilityValidationResult {
    const missingCapabilities = requiredCapabilities.filter(
      (cap) => !this.supportsCapability(cap)
    );
    const warnings: string[] = [];

    if (
      this._capabilities.maxDaysPerBatch > 0 &&
      this._capabilities.maxDaysPerBatch < 30
    ) {
      warnings.push(
        `Fenêtre maximale par lot limitée à ${this._capabilities.maxDaysPerBatch} jour(s) : découpage automatique activé.`
      );
    }

    if (
      this._instance.activeSyncMode === 'realtime_webhook' &&
      !this.supportsCapability('supportsWebhooks')
    ) {
      warnings.push(
        'Le mode webhook temps réel est sélectionné alors que supportsWebhooks=false.'
      );
    }

    return {
      valid: missingCapabilities.length === 0,
      checkedCapabilities: requiredCapabilities,
      missingCapabilities,
      warnings,
    };
  }

  protected assertCapability(
    capability: keyof ConnectorCapabilities,
    operationLabel: string
  ): void {
    if (!this.supportsCapability(capability)) {
      throw new ConnectorUnsupportedCapabilityError(
        this.providerId,
        capability,
        operationLabel
      );
    }
  }

  // =========================================================================
  // 3. UTILITAIRES COMMUNS (DATES, LOTS, IDEMPOTENCE, MAPPINGS, LOGS)
  // =========================================================================

  protected validateDateRange(range: ConnectorDateRange): void {
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoRe.test(range.startDate) || !isoRe.test(range.endDate)) {
      throw new Error(
        `Plage de dates invalide (${range.startDate} -> ${range.endDate}) : format YYYY-MM-DD requis.`
      );
    }
    if (range.endDate < range.startDate) {
      throw new Error(
        `Date de fin (${range.endDate}) antérieure à la date de début (${range.startDate}).`
      );
    }
  }

  protected chunkDateRange(range: ConnectorDateRange): ConnectorDateRange[] {
    this.validateDateRange(range);
    const maxDays = Math.max(1, this._capabilities.maxDaysPerBatch || 90);
    const startMs = Date.parse(`${range.startDate}T00:00:00Z`);
    const endMs = Date.parse(`${range.endDate}T00:00:00Z`);
    const totalDays = Math.floor((endMs - startMs) / 86400000) + 1;

    if (totalDays <= maxDays) {
      return [range];
    }

    const chunks: ConnectorDateRange[] = [];
    let cursorMs = startMs;
    while (cursorMs <= endMs) {
      const chunkEndMs = Math.min(endMs, cursorMs + (maxDays - 1) * 86400000);
      chunks.push({
        startDate: new Date(cursorMs).toISOString().slice(0, 10),
        endDate: new Date(chunkEndMs).toISOString().slice(0, 10),
      });
      cursorMs = chunkEndMs + 86400000;
    }
    return chunks;
  }

  protected buildIdempotencyKey(prefix: string, scope: string): string {
    const rand = Math.random().toString(36).slice(2, 7);
    return `${prefix}-${this.providerId}-${this.hotelId}-${scope}-${Date.now()}-${rand}`;
  }

  protected resolveExecutionMode(): 'live_api' | 'sandbox_simulation' {
    const hasEndpoint = Boolean(
      this._instance.endpointUrl && /^https?:\/\//i.test(this._instance.endpointUrl)
    );
    const hasSecret = this._instance.credentials.some((c) => c.isSecret && c.hasValue);
    if (this._instance.environment === 'production' && hasEndpoint && hasSecret) {
      return 'live_api';
    }
    return 'sandbox_simulation';
  }

  protected recordSyncLog(params: {
    operationType: ConnectorSyncLog['operationType'];
    direction: ConnectorSyncLog['direction'];
    status: ConnectorSyncLog['status'];
    cellsAffected: number;
    durationMs: number;
    message: string;
    traceabilityId: string;
    externalAckId?: string | null;
    stayDateFrom?: string;
    stayDateTo?: string;
    actor?: string;
  }): void {
    const now = new Date().toISOString();
    appendLocalSyncLog(this.hotelId, {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hotelId: this.hotelId,
      connectorId: this.id,
      providerId: this.providerId,
      providerName: this._instance.providerName,
      family: this.family,
      operationType: params.operationType,
      direction: params.direction,
      status: params.status,
      executionMode: this.resolveExecutionMode(),
      stayDateFrom: params.stayDateFrom,
      stayDateTo: params.stayDateTo,
      cellsAffected: params.cellsAffected,
      traceabilityId: params.traceabilityId,
      externalAckId: params.externalAckId ?? null,
      durationMs: params.durationMs,
      actor: params.actor || 'Moteur Connecteurs',
      message: params.message,
      createdAt: now,
    });
  }

  public validateMappings(mappings: ConnectorMappingEntry[]): {
    valid: boolean;
    duplicateCodes: string[];
  } {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const item of mappings) {
      const extCode = item.externalCode.trim().toUpperCase();
      if (!extCode) continue;
      const key = `${item.connectorId}::${item.entityType}::${extCode}`;
      if (seen.has(key)) {
        duplicates.push(extCode);
      } else {
        seen.add(key);
      }
    }

    return {
      valid: duplicates.length === 0,
      duplicateCodes: Array.from(new Set(duplicates)),
    };
  }

  // =========================================================================
  // 4. MÉTHODES PUBLIQUES STRUCTURÉES (getRooms, getRatePlans, getRates, etc.)
  // =========================================================================

  public async getRooms(): Promise<ConnectorRoom[]> {
    this.assertCapability('importRoomTypes', 'Récupération des catégories de chambres (getRooms)');
    await this.ensureAuthenticated();
    return this.onGetRooms();
  }

  public async getRatePlans(): Promise<ConnectorRatePlan[]> {
    this.assertCapability('importRatePlans', 'Récupération des plans tarifaires (getRatePlans)');
    await this.ensureAuthenticated();
    return this.onGetRatePlans();
  }

  public async getRates(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorRatePoint[]> {
    this.assertCapability('readRates', 'Récupération des tarifs (getRates)');
    await this.ensureAuthenticated();
    const chunks = this.chunkDateRange(range);
    const all: ConnectorRatePoint[] = [];
    for (const chunk of chunks) {
      const part = await this.onGetRates(chunk, roomCodes, ratePlanCodes);
      all.push(...part);
    }
    return all;
  }

  public async getAvailability(
    range: ConnectorDateRange,
    roomCodes?: string[]
  ): Promise<ConnectorAvailabilityPoint[]> {
    this.assertCapability('readInventory', 'Récupération des disponibilités (getAvailability)');
    await this.ensureAuthenticated();
    const chunks = this.chunkDateRange(range);
    const all: ConnectorAvailabilityPoint[] = [];
    for (const chunk of chunks) {
      const part = await this.onGetAvailability(chunk, roomCodes);
      all.push(...part);
    }
    return all;
  }

  public async updateRate(
    payload: ConnectorPushRatePayload | ConnectorPushRatePayload[],
    idempotencyKey?: string
  ): Promise<ConnectorPushResult> {
    this.assertCapability('writeRates', 'Mise à jour tarifaire (updateRate)');
    await this.ensureAuthenticated();
    const updates = Array.isArray(payload) ? payload : [payload];
    for (const item of updates) {
      if (!Number.isFinite(item.rateEur) || item.rateEur < 0) {
        throw new Error(
          `Tarif invalide (${item.rateEur}) pour ${item.internalRoomCode}/${item.internalPlanCode} le ${item.stayDate}.`
        );
      }
    }
    const key = idempotencyKey || this.buildIdempotencyKey('update-rate', `${updates.length}`);
    return this.onUpdateRate(updates, key);
  }

  public async updateInventory(
    payload: ConnectorPushAvailabilityPayload | ConnectorPushAvailabilityPayload[],
    idempotencyKey?: string
  ): Promise<ConnectorPushResult> {
    this.assertCapability('writeInventory', 'Mise à jour des disponibilités (updateInventory)');
    await this.ensureAuthenticated();
    const updates = Array.isArray(payload) ? payload : [payload];
    for (const item of updates) {
      if (!Number.isFinite(item.leftForSale) || item.leftForSale < 0) {
        throw new Error(
          `Disponibilité invalide (${item.leftForSale}) pour ${item.internalRoomCode} le ${item.stayDate}.`
        );
      }
    }
    const key = idempotencyKey || this.buildIdempotencyKey('update-inv', `${updates.length}`);
    return this.onUpdateInventory(updates, key);
  }

  // =========================================================================
  // 5. MÉTHODES D'ORCHESTRATION & RÉTROCOMPATIBILITÉ
  // =========================================================================

  public async testConnection(): Promise<ConnectorTestResult> {
    await this.ensureAuthenticated();
    return this.onTestConnection();
  }

  public async testRead(range?: ConnectorDateRange): Promise<ConnectorTestResult> {
    this.assertCapability('readRates', 'Test de lecture tarifaire');
    await this.ensureAuthenticated();
    const today = new Date().toISOString().slice(0, 10);
    const targetRange = range || { startDate: today, endDate: today };
    this.validateDateRange(targetRange);
    return this.onTestRead(targetRange);
  }

  public async testWrite(
    dryRunPayload?: ConnectorPushRatePayload[]
  ): Promise<ConnectorTestResult> {
    this.assertCapability('writeRates', 'Test d’écriture tarifaire');
    await this.ensureAuthenticated();
    return this.onTestWrite(dryRunPayload || []);
  }

  public async healthCheck(): Promise<ConnectorHealthReport> {
    const started = Date.now();
    const res = await this.testConnection();
    return {
      connectorId: this.id,
      providerId: this.providerId,
      healthy: res.success,
      executionMode: res.executionMode,
      latencyMs: res.latencyMs || Date.now() - started,
      checkedAt: res.testedAt,
      message: res.message,
    };
  }

  public async fetchCatalog(): Promise<ConnectorExternalCatalog> {
    if (
      !this.supportsCapability('importRoomTypes') &&
      !this.supportsCapability('importRatePlans')
    ) {
      throw new ConnectorUnsupportedCapabilityError(
        this.providerId,
        'importRoomTypes',
        'Découverte du catalogue externe'
      );
    }
    await this.ensureAuthenticated();
    const [roomTypes, ratePlans] = await Promise.all([
      this.supportsCapability('importRoomTypes') ? this.onGetRooms() : Promise.resolve([]),
      this.supportsCapability('importRatePlans') ? this.onGetRatePlans() : Promise.resolve([]),
    ]);
    return {
      providerId: this.providerId,
      connectorId: this.id,
      hotelId: this.hotelId,
      fetchedAt: new Date().toISOString(),
      executionMode: this.resolveExecutionMode(),
      roomTypes,
      ratePlans,
      channels: this.getSupportedChannels(),
    };
  }

  protected getSupportedChannels(): string[] {
    return ['DIRECT_WEB', 'BOOKING', 'EXPEDIA', 'GDS'];
  }

  public fetchRates(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorRatePoint[]> {
    return this.getRates(range, roomCodes, ratePlanCodes);
  }

  public fetchAvailability(
    range: ConnectorDateRange,
    roomCodes?: string[]
  ): Promise<ConnectorAvailabilityPoint[]> {
    return this.getAvailability(range, roomCodes);
  }

  public async fetchRestrictions(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorRestrictionPoint[]> {
    this.assertCapability('readRestrictions', 'Récupération des restrictions');
    await this.ensureAuthenticated();
    const chunks = this.chunkDateRange(range);
    const all: ConnectorRestrictionPoint[] = [];
    for (const chunk of chunks) {
      const part = await this.onGetRestrictions(chunk, roomCodes, ratePlanCodes);
      all.push(...part);
    }
    return all;
  }

  public async fetchSnapshot(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorSnapshot> {
    this.validateDateRange(range);
    const [rates, availability, restrictions] = await Promise.all([
      this.supportsCapability('readRates')
        ? this.getRates(range, roomCodes, ratePlanCodes)
        : Promise.resolve([]),
      this.supportsCapability('readInventory')
        ? this.getAvailability(range, roomCodes)
        : Promise.resolve([]),
      this.supportsCapability('readRestrictions')
        ? this.fetchRestrictions(range, roomCodes, ratePlanCodes)
        : Promise.resolve([]),
    ]);

    return {
      range,
      rates,
      availability,
      restrictions,
      fetchedAt: new Date().toISOString(),
    };
  }

  public pushRates(
    updates: ConnectorPushRatePayload[],
    idempotencyKey?: string
  ): Promise<ConnectorPushResult> {
    return this.updateRate(updates, idempotencyKey);
  }

  public pushAvailability(
    updates: ConnectorPushAvailabilityPayload[],
    idempotencyKey?: string
  ): Promise<ConnectorPushResult> {
    return this.updateInventory(updates, idempotencyKey);
  }

  public async pushRestrictions(
    updates: ConnectorPushRestrictionPayload[],
    idempotencyKey?: string
  ): Promise<ConnectorPushResult> {
    this.assertCapability('writeRestrictions', 'Transmission de restrictions');
    await this.ensureAuthenticated();
    const key = idempotencyKey || this.buildIdempotencyKey('push-rst', `${updates.length}`);
    return this.onPushRestrictions(updates, key);
  }

  // =========================================================================
  // 6. HOOKS ABSTRAITS À IMPLÉMENTER PAR CHAQUE CONNECTEUR FOURNISSEUR
  // =========================================================================

  protected abstract onAuthenticate(
    executionMode: 'live_api' | 'sandbox_simulation'
  ): Promise<ConnectorAuthContext>;

  protected abstract onTestConnection(): Promise<ConnectorTestResult>;
  protected abstract onTestRead(range: ConnectorDateRange): Promise<ConnectorTestResult>;
  protected abstract onTestWrite(
    dryRunPayload: ConnectorPushRatePayload[]
  ): Promise<ConnectorTestResult>;

  protected abstract onGetRooms(): Promise<ConnectorRoom[]>;
  protected abstract onGetRatePlans(): Promise<ConnectorRatePlan[]>;

  protected abstract onGetRates(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorRatePoint[]>;

  protected abstract onGetAvailability(
    range: ConnectorDateRange,
    roomCodes?: string[]
  ): Promise<ConnectorAvailabilityPoint[]>;

  protected abstract onGetRestrictions(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorRestrictionPoint[]>;

  protected abstract onUpdateRate(
    updates: ConnectorPushRatePayload[],
    idempotencyKey: string
  ): Promise<ConnectorPushResult>;

  protected abstract onUpdateInventory(
    updates: ConnectorPushAvailabilityPayload[],
    idempotencyKey: string
  ): Promise<ConnectorPushResult>;

  protected abstract onPushRestrictions(
    updates: ConnectorPushRestrictionPayload[],
    idempotencyKey: string
  ): Promise<ConnectorPushResult>;

  public abstract parseInboundWebhook(
    rawBody: unknown,
    signatureHeader?: string
  ): ConnectorWebhookParseResult;
}
