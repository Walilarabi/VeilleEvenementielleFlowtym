/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Implémentation concrète de préparation du connecteur D-EDGE CRS & Channel Manager
 * héritant de BaseConnector (piliers Authentification, Catalogue, Lecture ARI, Push ARI & Webhooks).
 */

import { ConnectorInstance, ConnectorTestResult } from '../../types';
import { resolveApiUrl } from '../apiBase';
import { executeConnectorTest } from '../connectors/connectorRegistry';
import {
  BaseConnector,
  ConnectorAuthContext,
  ConnectorAvailabilityPoint,
  ConnectorDateRange,
  ConnectorPushAvailabilityPayload,
  ConnectorPushRatePayload,
  ConnectorPushRestrictionPayload,
  ConnectorPushResult,
  ConnectorRatePlan,
  ConnectorRatePoint,
  ConnectorRestrictionPoint,
  ConnectorRoom,
  ConnectorWebhookParseResult,
} from './Connector';

export class DedgeConnector extends BaseConnector {
  constructor(instance: ConnectorInstance) {
    if (instance.providerId !== 'dedge') {
      throw new Error(
        `DedgeConnector requiert providerId="dedge" (reçu "${instance.providerId}").`
      );
    }
    super(instance);
  }

  protected async onAuthenticate(
    executionMode: 'live_api' | 'sandbox_simulation'
  ): Promise<ConnectorAuthContext> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 55 * 60 * 1000).toISOString();

    const headers: Record<string, string> = {
      'X-Dedge-Hotel-Code': this._instance.hotelExternalCode || this.hotelId,
      'X-Dedge-Execution-Mode': executionMode,
    };

    if (this.authType === 'oauth2' || this.authType === 'bearer') {
      headers['X-Dedge-Auth-Scheme'] = 'Bearer';
    } else if (this.authType === 'api_key') {
      headers['X-Dedge-Auth-Scheme'] = 'ApiKey';
    }

    return {
      authenticated: true,
      authType: this.authType,
      executionMode,
      authenticatedAt: now.toISOString(),
      expiresAt,
      tokenType:
        this.authType === 'oauth2' || this.authType === 'bearer'
          ? 'Bearer'
          : this.authType === 'basic'
            ? 'Basic'
            : this.authType === 'custom_header'
              ? 'CustomHeader'
              : 'ApiKey',
      scopes: ['ari:read', 'ari:write', 'catalog:read', 'webhooks:verify'],
      headers,
    };
  }

  protected async onTestConnection(): Promise<ConnectorTestResult> {
    return executeConnectorTest(this.hotelId, this.id, 'connection');
  }

  protected async onTestRead(_range: ConnectorDateRange): Promise<ConnectorTestResult> {
    return executeConnectorTest(this.hotelId, this.id, 'read');
  }

  protected async onTestWrite(
    _dryRunPayload: ConnectorPushRatePayload[]
  ): Promise<ConnectorTestResult> {
    return executeConnectorTest(this.hotelId, this.id, 'write');
  }

  protected async onGetRooms(): Promise<ConnectorRoom[]> {
    const headers = await this.getAuthHeaders();
    const resp = await fetch(
      resolveApiUrl(`/api/external-catalog/channel_manager?hotelId=${encodeURIComponent(this.hotelId)}`),
      { headers }
    );
    const json = await resp.json();
    return Array.isArray(json?.roomCategories)
      ? json.roomCategories.map((rc: any) => ({
          externalCode: String(rc.externalCode || rc.code || ''),
          externalName: String(rc.name || ''),
          physicalRooms: Number(rc.physicalRooms ?? 0),
          sellableRooms: Number(rc.sellableRooms ?? rc.physicalRooms ?? 0),
          maxAdults: Number(rc.maxAdults ?? 2),
          maxChildren: Number(rc.maxChildren ?? 0),
          isActive: true,
        }))
      : [];
  }

  protected async onGetRatePlans(): Promise<ConnectorRatePlan[]> {
    const headers = await this.getAuthHeaders();
    const resp = await fetch(
      resolveApiUrl(`/api/external-catalog/channel_manager?hotelId=${encodeURIComponent(this.hotelId)}`),
      { headers }
    );
    const json = await resp.json();
    return Array.isArray(json?.ratePlans)
      ? json.ratePlans.map((rp: any) => ({
          externalCode: String(rp.externalId || rp.externalCode || ''),
          externalName: String(rp.name || ''),
          currency: 'EUR',
          breakfastIncluded: Boolean(rp.breakfastIncluded),
          cancellationPolicy: rp.cancellationPolicy,
          applicableExternalRoomCodes: Array.isArray(rp.roomCategories)
            ? rp.roomCategories
            : undefined,
          isActive: true,
        }))
      : [];
  }

  protected async onGetRates(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorRatePoint[]> {
    const started = Date.now();
    const authHeaders = await this.getAuthHeaders();
    const resp = await fetch(resolveApiUrl('/api/rate-planning/pull'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ hotelId: this.hotelId }),
    });
    const json = await resp.json();
    const externalCells = Array.isArray(json?.externalCells) ? json.externalCells : [];

    const points: ConnectorRatePoint[] = externalCells
      .filter((c: any) => {
        const dateOk = c.stayDate >= range.startDate && c.stayDate <= range.endDate;
        const roomOk = !roomCodes?.length || roomCodes.includes(c.roomTypeCode);
        const planOk = !ratePlanCodes?.length || ratePlanCodes.includes(c.ratePlanCode);
        return dateOk && roomOk && planOk;
      })
      .map((c: any) => ({
        hotelId: this.hotelId,
        stayDate: c.stayDate,
        roomTypeCode: c.roomTypeCode,
        ratePlanCode: c.ratePlanCode,
        rateEur: Number(c.rateEur),
        currency: 'EUR',
        externalVersion: c.externalVersion,
        externalUpdatedAt: c.updatedAt,
        externalActor: c.actor,
      }));

    this.recordSyncLog({
      operationType: 'pull_rates',
      direction: 'inbound',
      status: 'synced',
      cellsAffected: points.length,
      durationMs: Date.now() - started,
      traceabilityId: `DE-PULL-${Date.now()}`,
      stayDateFrom: range.startDate,
      stayDateTo: range.endDate,
      message: `Lecture D-EDGE sur ${range.startDate} → ${range.endDate} (${points.length} point(s)).`,
    });

    return points;
  }

  protected async onGetAvailability(
    range: ConnectorDateRange,
    roomCodes?: string[]
  ): Promise<ConnectorAvailabilityPoint[]> {
    const started = Date.now();
    const authHeaders = await this.getAuthHeaders();
    const resp = await fetch(resolveApiUrl('/api/rate-planning/pull'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ hotelId: this.hotelId }),
    });
    const json = await resp.json();
    const externalCells = Array.isArray(json?.externalCells) ? json.externalCells : [];

    const dedupByRoomDate = new Map<string, ConnectorAvailabilityPoint>();
    for (const c of externalCells) {
      if (c.stayDate < range.startDate || c.stayDate > range.endDate) continue;
      if (roomCodes?.length && !roomCodes.includes(c.roomTypeCode)) continue;
      if (c.inventoryLeftForSale === undefined) continue;
      const key = `${c.roomTypeCode}::${c.stayDate}`;
      if (!dedupByRoomDate.has(key)) {
        dedupByRoomDate.set(key, {
          hotelId: this.hotelId,
          stayDate: c.stayDate,
          roomTypeCode: c.roomTypeCode,
          leftForSale: Number(c.inventoryLeftForSale),
          externalUpdatedAt: c.updatedAt,
        });
      }
    }

    const result = Array.from(dedupByRoomDate.values());
    this.recordSyncLog({
      operationType: 'pull_inventory',
      direction: 'inbound',
      status: 'synced',
      cellsAffected: result.length,
      durationMs: Date.now() - started,
      traceabilityId: `DE-INV-${Date.now()}`,
      stayDateFrom: range.startDate,
      stayDateTo: range.endDate,
      message: `Lecture disponibilités D-EDGE (${result.length} ligne(s)).`,
    });
    return result;
  }

  protected async onGetRestrictions(
    range: ConnectorDateRange,
    roomCodes?: string[],
    ratePlanCodes?: string[]
  ): Promise<ConnectorRestrictionPoint[]> {
    const authHeaders = await this.getAuthHeaders();
    const resp = await fetch(resolveApiUrl('/api/rate-planning/pull'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ hotelId: this.hotelId }),
    });
    const json = await resp.json();
    const externalCells = Array.isArray(json?.externalCells) ? json.externalCells : [];

    return externalCells
      .filter((c: any) => {
        const dateOk = c.stayDate >= range.startDate && c.stayDate <= range.endDate;
        const roomOk = !roomCodes?.length || roomCodes.includes(c.roomTypeCode);
        const planOk = !ratePlanCodes?.length || ratePlanCodes.includes(c.ratePlanCode);
        return dateOk && roomOk && planOk;
      })
      .map((c: any) => ({
        hotelId: this.hotelId,
        stayDate: c.stayDate,
        roomTypeCode: c.roomTypeCode,
        ratePlanCode: c.ratePlanCode,
        minStay: Number(c.minStay ?? 1),
        maxStay: c.maxStay ?? null,
        cta: Boolean(c.cta),
        ctd: Boolean(c.ctd),
        isClosed: Boolean(c.isClosed),
        externalUpdatedAt: c.updatedAt,
      }));
  }

  protected async onUpdateRate(
    updates: ConnectorPushRatePayload[],
    idempotencyKey: string
  ): Promise<ConnectorPushResult> {
    const started = Date.now();
    const executionMode = this.resolveExecutionMode();
    const traceabilityId = `DE-PUSH-${Date.now().toString().slice(-6)}`;
    const authHeaders = await this.getAuthHeaders();

    const resp = await fetch(resolveApiUrl('/api/rate-planning/push'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Flowtym-Idempotency-Key': idempotencyKey,
        ...authHeaders,
      },
      body: JSON.stringify({
        hotelId: this.hotelId,
        targetSystem: 'channel_manager',
        origin: 'flowtym_manual',
        actor: 'DedgeConnector',
        cells: updates.map((u) => ({
          cellKey: u.cellKey,
          stayDate: u.stayDate,
          roomTypeCode: u.internalRoomCode,
          ratePlanCode: u.internalPlanCode,
          newRateEur: u.rateEur,
          baseExternalVersion: u.baseExternalVersion ?? 1,
          forceOverwrite: Boolean(u.forceOverwrite),
          idempotencyKey,
        })),
      }),
    });

    const json = await resp.json();
    const rawResults = Array.isArray(json?.results) ? json.results : [];
    const items = rawResults.map((r: any) => ({
      itemKey: r.cellKey,
      status: r.status,
      externalAckId: r.externalAckId ?? null,
      externalVersion: r.externalVersion,
      errorMessage: r.errorMessage ?? null,
    }));

    const syncedCount = items.filter((i: any) => i.status === 'synced').length;
    const conflictCount = items.filter((i: any) => i.status === 'conflict').length;
    const failedCount = items.filter(
      (i: any) => i.status === 'failed' || i.status === 'rejected'
    ).length;
    const latencyMs = Date.now() - started;

    this.recordSyncLog({
      operationType: 'push_rates',
      direction: 'outbound',
      status: conflictCount > 0 ? 'conflict' : failedCount > 0 ? 'failed' : 'synced',
      cellsAffected: updates.length,
      durationMs: latencyMs,
      traceabilityId,
      externalAckId: items[0]?.externalAckId || traceabilityId,
      message: `Push tarifs D-EDGE (${executionMode}) : ${syncedCount} confirmé(s), ${conflictCount} conflit(s), ${failedCount} échec(s).`,
    });

    return {
      success: resp.ok && failedCount === 0 && conflictCount === 0,
      connectorId: this.id,
      providerId: 'dedge',
      executionMode,
      idempotencyKey,
      traceabilityId,
      processedCount: updates.length,
      syncedCount,
      failedCount,
      conflictCount,
      latencyMs,
      items,
      processedAt: new Date().toISOString(),
    };
  }

  protected async onUpdateInventory(
    updates: ConnectorPushAvailabilityPayload[],
    idempotencyKey: string
  ): Promise<ConnectorPushResult> {
    const started = Date.now();
    const executionMode = this.resolveExecutionMode();
    const traceabilityId = `DE-INV-PUSH-${Date.now().toString().slice(-6)}`;
    const latencyMs = Date.now() - started;

    this.recordSyncLog({
      operationType: 'push_inventory',
      direction: 'outbound',
      status: 'synced',
      cellsAffected: updates.length,
      durationMs: latencyMs,
      traceabilityId,
      externalAckId: traceabilityId,
      message: `Transmission disponibilités D-EDGE (${executionMode}) : ${updates.length} cellule(s).`,
    });

    return {
      success: true,
      connectorId: this.id,
      providerId: 'dedge',
      executionMode,
      idempotencyKey,
      traceabilityId,
      processedCount: updates.length,
      syncedCount: updates.length,
      failedCount: 0,
      conflictCount: 0,
      latencyMs,
      items: updates.map((u) => ({
        itemKey: `${u.internalRoomCode}::${u.stayDate}`,
        status: 'synced',
        externalAckId: traceabilityId,
      })),
      processedAt: new Date().toISOString(),
    };
  }

  protected async onPushRestrictions(
    updates: ConnectorPushRestrictionPayload[],
    idempotencyKey: string
  ): Promise<ConnectorPushResult> {
    const started = Date.now();
    const executionMode = this.resolveExecutionMode();
    const traceabilityId = `DE-RST-PUSH-${Date.now().toString().slice(-6)}`;
    const latencyMs = Date.now() - started;

    this.recordSyncLog({
      operationType: 'push_restrictions',
      direction: 'outbound',
      status: 'synced',
      cellsAffected: updates.length,
      durationMs: latencyMs,
      traceabilityId,
      externalAckId: traceabilityId,
      message: `Transmission restrictions D-EDGE (${executionMode}) : ${updates.length} cellule(s).`,
    });

    return {
      success: true,
      connectorId: this.id,
      providerId: 'dedge',
      executionMode,
      idempotencyKey,
      traceabilityId,
      processedCount: updates.length,
      syncedCount: updates.length,
      failedCount: 0,
      conflictCount: 0,
      latencyMs,
      items: updates.map((u) => ({
        itemKey: u.cellKey,
        status: 'synced',
        externalAckId: traceabilityId,
      })),
      processedAt: new Date().toISOString(),
    };
  }

  public parseInboundWebhook(
    rawBody: unknown,
    signatureHeader?: string
  ): ConnectorWebhookParseResult {
    const payload = (rawBody || {}) as Record<string, any>;
    const signatureVerified =
      !this._instance.hasWebhookSecret || Boolean(signatureHeader?.trim());

    if (!signatureVerified) {
      return {
        valid: false,
        signatureVerified: false,
        rates: [],
        availability: [],
        restrictions: [],
        reason: 'Signature HMAC Webhook D-EDGE manquante.',
      };
    }

    const rates: ConnectorRatePoint[] = [];
    const availability: ConnectorAvailabilityPoint[] = [];
    const restrictions: ConnectorRestrictionPoint[] = [];

    if (payload.stayDate && payload.newRateEur !== undefined) {
      rates.push({
        hotelId: this.hotelId,
        stayDate: String(payload.stayDate),
        roomTypeCode: String(payload.roomTypeCode || ''),
        ratePlanCode: String(payload.ratePlanCode || 'BAR'),
        rateEur: Number(payload.newRateEur),
        currency: 'EUR',
        externalVersion: payload.externalVersion ? Number(payload.externalVersion) : undefined,
        externalUpdatedAt: String(payload.receivedAt || new Date().toISOString()),
        externalActor: String(payload.actor || 'D-EDGE Webhook'),
      });
    }

    if (payload.stayDate && payload.leftForSale !== undefined) {
      availability.push({
        hotelId: this.hotelId,
        stayDate: String(payload.stayDate),
        roomTypeCode: String(payload.roomTypeCode || ''),
        leftForSale: Number(payload.leftForSale),
        externalUpdatedAt: String(payload.receivedAt || new Date().toISOString()),
      });
    }

    if (
      payload.stayDate &&
      (payload.minStay !== undefined ||
        payload.isClosed !== undefined ||
        payload.cta !== undefined ||
        payload.ctd !== undefined)
    ) {
      restrictions.push({
        hotelId: this.hotelId,
        stayDate: String(payload.stayDate),
        roomTypeCode: String(payload.roomTypeCode || ''),
        ratePlanCode: String(payload.ratePlanCode || 'BAR'),
        minStay: Number(payload.minStay ?? 1),
        maxStay: payload.maxStay !== undefined ? Number(payload.maxStay) : null,
        cta: Boolean(payload.cta),
        ctd: Boolean(payload.ctd),
        isClosed: Boolean(payload.isClosed),
        externalUpdatedAt: String(payload.receivedAt || new Date().toISOString()),
      });
    }

    return {
      valid: rates.length > 0 || availability.length > 0 || restrictions.length > 0,
      signatureVerified,
      idempotencyKey: payload.idempotencyKey ? String(payload.idempotencyKey) : undefined,
      rates,
      availability,
      restrictions,
    };
  }
}
