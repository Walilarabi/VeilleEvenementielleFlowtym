/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — SERVICE UNIFIÉ D'HYDRATATION, AUTH, REALTIME & PERSISTANCE SUPABASE
 * Centralise la lecture (SELECT), l'écriture incrémentale (UPSERT/DELETE),
 * l'authentification Supabase Auth et les abonnements Realtime WebSocket.
 * Ne masque jamais les erreurs réseau/RLS et rapporte fidèlement l'état réel.
 */

import {
  EventItem,
  EventProposal,
  EventSuggestion,
  Hotel,
  HotelTariffConfiguration,
  RateCalendarCell,
  RMAlertItem,
  RMDecisionRecord,
} from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { HotelRMSConfig } from './rmsSettingsService';

const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';

export type SupabaseSyncMode = 'supabase_live' | 'local_fallback_unconfigured' | 'sync_error';

export interface SupabaseRuntimeState {
  mode: SupabaseSyncMode;
  lastHydratedAt: string | null;
  lastWriteAt: string | null;
  lastError: string | null;
  hydratedTables: string[];
}

const runtimeState: SupabaseRuntimeState = {
  mode: isSupabaseConfigured() ? 'supabase_live' : 'local_fallback_unconfigured',
  lastHydratedAt: null,
  lastWriteAt: null,
  lastError: null,
  hydratedTables: [],
};

function recordSupabaseError(context: string, error: unknown): void {
  const msg = error instanceof Error ? error.message : String((error as any)?.message || error || 'Erreur inconnue');
  runtimeState.mode = isSupabaseConfigured() ? 'sync_error' : 'local_fallback_unconfigured';
  runtimeState.lastError = `[${context}] ${msg}`;
  console.warn(`[Flowtym Supabase] ${runtimeState.lastError}`);
}

function recordSupabaseSuccess(tableName?: string): void {
  runtimeState.mode = 'supabase_live';
  runtimeState.lastError = null;
  runtimeState.lastWriteAt = new Date().toISOString();
  if (tableName && !runtimeState.hydratedTables.includes(tableName)) {
    runtimeState.hydratedTables.push(tableName);
  }
}

export function getSupabaseRuntimeState(): SupabaseRuntimeState {
  if (!isSupabaseConfigured()) {
    return {
      ...runtimeState,
      mode: 'local_fallback_unconfigured',
    };
  }
  return { ...runtimeState };
}

// -----------------------------------------------------------------------------
// 1. SUPABASE AUTH (Sign-In / Sign-Up / Session / Listener)
// -----------------------------------------------------------------------------

export interface FlowtymAuthUser {
  id?: string;
  name: string;
  email: string;
  role: string;
  authProvider: 'supabase' | 'local_demo';
}

export async function signInWithSupabaseAuth(
  email: string,
  password: string
): Promise<{ success: boolean; user?: FlowtymAuthUser; error?: string; unconfigured?: boolean }> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) {
    return { success: false, unconfigured: true, error: 'Clé Supabase Anon Key non configurée.' };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.user) {
      return { success: false, error: error?.message || 'Identifiants Supabase invalides.' };
    }

    const meta = data.user.user_metadata || {};
    recordSupabaseSuccess('auth');
    return {
      success: true,
      user: {
        id: data.user.id,
        name: String(meta.full_name || meta.name || data.user.email?.split('@')[0] || 'Revenue Manager'),
        email: data.user.email || email,
        role: String(meta.role || 'Revenue Manager'),
        authProvider: 'supabase',
      },
    };
  } catch (err: any) {
    recordSupabaseError('auth.signIn', err);
    return { success: false, error: err?.message || 'Erreur de connexion Supabase Auth.' };
  }
}

export async function signUpWithSupabaseAuth(
  email: string,
  password: string,
  fullName: string,
  role: string = 'revenue_manager'
): Promise<{ success: boolean; user?: FlowtymAuthUser; error?: string; confirmationRequired?: boolean }> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) {
    return { success: false, error: 'Clé Supabase Anon Key non configurée.' };
  }

  try {
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });
    if (error) {
      return { success: false, error: error.message };
    }
    if (!data.session) {
      return {
        success: true,
        confirmationRequired: true,
        user: {
          id: data.user?.id,
          name: fullName,
          email,
          role,
          authProvider: 'supabase',
        },
      };
    }
    return {
      success: true,
      user: {
        id: data.user?.id,
        name: fullName,
        email,
        role,
        authProvider: 'supabase',
      },
    };
  } catch (err: any) {
    recordSupabaseError('auth.signUp', err);
    return { success: false, error: err?.message || 'Erreur lors de la création du compte.' };
  }
}

export async function signOutFromSupabaseAuth(): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return;
  try {
    await client.auth.signOut();
  } catch (err) {
    recordSupabaseError('auth.signOut', err);
  }
}

export async function restoreSupabaseSession(): Promise<FlowtymAuthUser | null> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.user) return null;
    const u = data.session.user;
    const meta = u.user_metadata || {};
    return {
      id: u.id,
      name: String(meta.full_name || meta.name || u.email?.split('@')[0] || 'Revenue Manager'),
      email: u.email || '',
      role: String(meta.role || 'Revenue Manager'),
      authProvider: 'supabase',
    };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// 2. HYDRATATION GLOBALE DEPUIS SUPABASE (READ-FIRST)
// -----------------------------------------------------------------------------

export interface HydratedSupabaseDataset {
  available: boolean;
  hotels: Hotel[];
  events: EventItem[];
  proposals: EventProposal[];
  suggestions: EventSuggestion[];
  error?: string;
}

export async function hydratePortfolioFromSupabase(): Promise<HydratedSupabaseDataset> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) {
    runtimeState.mode = 'local_fallback_unconfigured';
    return { available: false, hotels: [], events: [], proposals: [], suggestions: [] };
  }

  try {
    const [hotelsRes, eventsRes, propsRes, sugsRes] = await Promise.all([
      client.from('hotels').select('*').eq('is_active', true).order('name'),
      client.from('events').select('*').order('start_date', { ascending: true }).limit(500),
      client.from('event_proposals').select('*').order('start_date', { ascending: true }),
      client.from('event_suggestions').select('*').order('suggested_start_date', { ascending: true }),
    ]);

    const firstErr = hotelsRes.error || eventsRes.error || propsRes.error || sugsRes.error;
    if (firstErr) {
      recordSupabaseError('hydratePortfolio', firstErr);
      return {
        available: false,
        hotels: [],
        events: [],
        proposals: [],
        suggestions: [],
        error: firstErr.message,
      };
    }

    const validSegments: Hotel['segment'][] = ['Luxe', 'Boutique', 'Affaires', 'Économique', 'Resort'];
    const hotels: Hotel[] = (hotelsRes.data || []).map((row: any) => {
      const rawSeg = String(row.segment || 'Boutique') as Hotel['segment'];
      return {
        id: String(row.external_id || row.id),
        name: String(row.name),
        group: String(row.group_name || 'Flowtym Hospitality Group'),
        city: String(row.city),
        country: String(row.country || 'France'),
        address: String(row.address || ''),
        lat: Number(row.lat || 48.8566),
        lng: Number(row.lng || 2.3522),
        stars: Number(row.stars || 4),
        roomCount: Number(row.room_count || 45),
        segment: validSegments.includes(rawSeg) ? rawSeg : 'Boutique',
        baseADR: Number(row.base_adr || 200),
      };
    });

    const events: EventItem[] = (eventsRes.data || []).map((row: any) => ({
      id: String(row.external_id || row.id),
      title: String(row.title),
      subtitle: row.subtitle || undefined,
      category: row.category || 'salons_foires',
      venueId: String(row.venue_id || `venue-${String(row.city || 'paris').toLowerCase()}`),
      venueName: String(row.venue_name || row.city || 'Lieu principal'),
      city: String(row.city),
      country: String(row.country || 'France'),
      startDate: String(row.start_date),
      endDate: String(row.end_date || row.start_date),
      expectedAttendance: Number(row.expected_attendance || 0),
      internationalRatioPercent: Number(row.international_ratio || 25),
      status: row.status || 'confirmed',
      impactLevel: row.impact_level || 'modere',
      scoreBreakdown: row.score_breakdown && typeof row.score_breakdown === 'object' && 'finalRMScore' in row.score_breakdown
        ? row.score_breakdown
        : {
            attendanceScore: 14,
            internationalScore: 10,
            saturationScore: 12,
            proximityScore: 12,
            compressionScore: 10,
            finalRMScore: Number(row.final_rm_score || 58),
            confidenceScore: Number(row.confidence_score || 90),
          },
      sources: Array.isArray(row.sources) ? row.sources : [],
      officialUrl: row.official_url || undefined,
      evidences: [],
      hotelImpacts: {},
      isRecurring: Boolean(row.is_recurring),
      recurrenceFrequency: row.recurrence_frequency || undefined,
      historicalGrowth: row.historical_growth || undefined,
      isFavorite: Boolean(row.is_favorite),
      isWatchlist: Boolean(row.is_watchlist),
      isYieldActive: Boolean(row.is_yield_active),
      isAnomaly: Boolean(row.is_anomaly),
      notes: row.notes || undefined,
      createdAt: String(row.created_at || new Date().toISOString()).slice(0, 10),
      lastVerifiedAt: String(row.updated_at || new Date().toISOString()).slice(0, 10),
    }));

    const proposals: EventProposal[] = (propsRes.data || []).map((row: any) => ({
      id: String(row.external_id || row.id),
      title: String(row.title),
      subtitle: row.subtitle || undefined,
      category: row.category || 'salons_foires',
      city: String(row.city),
      venueName: String(row.venue_name || ''),
      startDate: String(row.start_date),
      endDate: String(row.end_date || row.start_date),
      expectedAttendance: Number(row.expected_attendance || 0),
      score: Number(row.score || 45),
      status: row.status || 'pending',
      detectedSource: String(row.detected_source || 'Veille Flowtym'),
      impactLevel: row.impact_level || 'modere',
    }));

    const suggestions: EventSuggestion[] = (sugsRes.data || []).map((row: any) => ({
      id: String(row.external_id || row.id),
      eventTitle: String(row.event_title),
      category: row.category || 'congres_medical',
      city: String(row.city),
      venueName: String(row.venue_name || ''),
      suggestedDates: {
        start: String(row.suggested_start_date),
        end: String(row.suggested_end_date || row.suggested_start_date),
      },
      detectedVia: String(row.detected_via || 'Moteur IA Flowtym'),
      confidence: Number(row.confidence || 80),
      reason: String(row.reason || ''),
      impactPredicted: row.impact_predicted || 'fort',
      status: row.status || 'pending',
    }));

    runtimeState.lastHydratedAt = new Date().toISOString();
    recordSupabaseSuccess('hotels');
    recordSupabaseSuccess('events');
    recordSupabaseSuccess('event_proposals');
    recordSupabaseSuccess('event_suggestions');

    return { available: true, hotels, events, proposals, suggestions };
  } catch (err: any) {
    recordSupabaseError('hydratePortfolio', err);
    return {
      available: false,
      hotels: [],
      events: [],
      proposals: [],
      suggestions: [],
      error: err?.message,
    };
  }
}

export async function fetchHotelConfigFromSupabase(hotelId: string): Promise<Partial<HotelRMSConfig> | null> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await client
      .from('hotel_rms_configs')
      .select('*')
      .eq('external_hotel_id', hotelId)
      .maybeSingle();
    if (error) {
      recordSupabaseError('fetchHotelRMSConfig', error);
      return null;
    }
    if (!data) return null;
    recordSupabaseSuccess('hotel_rms_configs');
    return {
      hotelId,
      roomTypologies: data.room_typologies || [],
      rmRules: data.rm_rules || {},
      compSet: data.comp_set || [],
      compSetSettings: data.comp_set_settings || {},
      eventWatch: data.event_watch || {},
      notifications: data.notifications || {},
      updatedAt: data.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    recordSupabaseError('fetchHotelRMSConfig', err);
    return null;
  }
}

export async function fetchTariffSnapshotFromSupabase(hotelId: string): Promise<HotelTariffConfiguration | null> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await client
      .from('tariff_config_snapshots')
      .select('config_payload')
      .eq('external_hotel_id', hotelId)
      .maybeSingle();
    if (error) {
      recordSupabaseError('fetchTariffSnapshot', error);
      return null;
    }
    if (data?.config_payload && typeof data.config_payload === 'object') {
      recordSupabaseSuccess('tariff_config_snapshots');
      return data.config_payload as HotelTariffConfiguration;
    }
    return null;
  } catch (err) {
    recordSupabaseError('fetchTariffSnapshot', err);
    return null;
  }
}

export async function persistTariffSnapshotToSupabase(
  hotelId: string,
  config: HotelTariffConfiguration,
  actor: string = 'Revenue Manager',
  reason: string = 'Mise à jour configuration tarifaire'
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return false;
  try {
    const { error } = await client.from('tariff_config_snapshots').upsert(
      {
        external_hotel_id: hotelId,
        config_payload: config,
        updated_by: actor,
        updated_reason: reason,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'external_hotel_id' }
    );
    if (error) {
      recordSupabaseError('persistTariffSnapshot', error);
      return false;
    }
    recordSupabaseSuccess('tariff_config_snapshots');
    return true;
  } catch (err) {
    recordSupabaseError('persistTariffSnapshot', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// 3. PERSISTANCE INCRÉMENTALE DES ENTITÉS (CRUD RÉEL)
// -----------------------------------------------------------------------------

export async function upsertSingleHotelToSupabase(hotel: Hotel): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return false;
  try {
    const { error } = await client.from('hotels').upsert(
      {
        external_id: hotel.id,
        organization_id: DEFAULT_ORG_ID,
        name: hotel.name,
        group_name: hotel.group,
        city: hotel.city,
        country: hotel.country,
        address: hotel.address,
        lat: hotel.lat,
        lng: hotel.lng,
        stars: hotel.stars,
        room_count: hotel.roomCount,
        segment: hotel.segment,
        base_adr: hotel.baseADR,
        is_active: true,
      },
      { onConflict: 'external_id' }
    );
    if (error) {
      recordSupabaseError('upsertHotel', error);
      return false;
    }
    recordSupabaseSuccess('hotels');
    return true;
  } catch (err) {
    recordSupabaseError('upsertHotel', err);
    return false;
  }
}

export async function deleteHotelFromSupabase(hotelId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return false;
  try {
    const { error } = await client
      .from('hotels')
      .update({ is_active: false })
      .eq('external_id', hotelId);
    if (error) {
      recordSupabaseError('deleteHotel', error);
      return false;
    }
    recordSupabaseSuccess('hotels');
    return true;
  } catch (err) {
    recordSupabaseError('deleteHotel', err);
    return false;
  }
}

export async function upsertSingleEventToSupabase(e: EventItem): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return false;
  try {
    const { error } = await client.from('events').upsert(
      {
        external_id: e.id,
        title: e.title,
        subtitle: e.subtitle || null,
        category: e.category,
        venue_name: e.venueName,
        city: e.city,
        country: e.country,
        start_date: e.startDate,
        end_date: e.endDate,
        status: e.status,
        impact_level: e.impactLevel,
        is_recurring: e.isRecurring,
        recurrence_frequency: e.recurrenceFrequency || null,
        historical_growth: e.historicalGrowth || null,
        expected_attendance: e.expectedAttendance || 0,
        international_ratio: e.internationalRatioPercent || 0,
        score_breakdown: e.scoreBreakdown || {},
        final_rm_score: Math.min(100, Math.max(0, Math.round(e.scoreBreakdown?.finalRMScore ?? 0))),
        confidence_score: e.scoreBreakdown?.confidenceScore ?? 95,
        sources: e.sources || [],
        official_url: e.officialUrl || null,
        is_favorite: Boolean(e.isFavorite),
        is_watchlist: Boolean(e.isWatchlist),
        is_yield_active: Boolean(e.isYieldActive),
        is_anomaly: Boolean(e.isAnomaly),
        notes: e.notes || null,
      },
      { onConflict: 'external_id' }
    );
    if (error) {
      recordSupabaseError('upsertEvent', error);
      return false;
    }
    recordSupabaseSuccess('events');
    return true;
  } catch (err) {
    recordSupabaseError('upsertEvent', err);
    return false;
  }
}

export async function upsertProposalToSupabase(p: EventProposal): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return false;
  try {
    const { error } = await client.from('event_proposals').upsert(
      {
        external_id: p.id,
        organization_id: DEFAULT_ORG_ID,
        title: p.title,
        subtitle: p.subtitle || null,
        category: p.category,
        city: p.city,
        venue_name: p.venueName,
        start_date: p.startDate,
        end_date: p.endDate,
        expected_attendance: p.expectedAttendance,
        score: p.score,
        status: p.status,
        detected_source: p.detectedSource,
        impact_level: p.impactLevel,
      },
      { onConflict: 'external_id' }
    );
    if (error) {
      recordSupabaseError('upsertProposal', error);
      return false;
    }
    recordSupabaseSuccess('event_proposals');
    return true;
  } catch (err) {
    recordSupabaseError('upsertProposal', err);
    return false;
  }
}

export async function upsertSuggestionToSupabase(s: EventSuggestion): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return false;
  try {
    const { error } = await client.from('event_suggestions').upsert(
      {
        external_id: s.id,
        organization_id: DEFAULT_ORG_ID,
        event_title: s.eventTitle,
        category: s.category,
        city: s.city,
        venue_name: s.venueName,
        suggested_start_date: s.suggestedDates.start,
        suggested_end_date: s.suggestedDates.end,
        detected_via: s.detectedVia,
        confidence: s.confidence,
        reason: s.reason,
        impact_predicted: s.impactPredicted,
        status: s.status,
      },
      { onConflict: 'external_id' }
    );
    if (error) {
      recordSupabaseError('upsertSuggestion', error);
      return false;
    }
    recordSupabaseSuccess('event_suggestions');
    return true;
  } catch (err) {
    recordSupabaseError('upsertSuggestion', err);
    return false;
  }
}

export async function upsertGeoSettingsToSupabase(
  hotelId: string,
  settings: {
    radiusPrimaryKm: number;
    radiusExtendedKm: number;
    minRMScoreThreshold: number;
    enabledCategories: string[];
  }
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return false;
  try {
    const { data: hotelRow } = await client
      .from('hotels')
      .select('id')
      .eq('external_id', hotelId)
      .maybeSingle();
    if (!hotelRow?.id) return false;

    const { error } = await client.from('hotel_geo_settings').upsert(
      {
        hotel_id: hotelRow.id,
        primary_radius_km: settings.radiusPrimaryKm,
        extended_radius_km: settings.radiusExtendedKm,
        min_rm_score_threshold: settings.minRMScoreThreshold,
        enabled_categories: settings.enabledCategories,
      },
      { onConflict: 'hotel_id' }
    );
    if (error) {
      recordSupabaseError('upsertGeoSettings', error);
      return false;
    }
    recordSupabaseSuccess('hotel_geo_settings');
    return true;
  } catch (err) {
    recordSupabaseError('upsertGeoSettings', err);
    return false;
  }
}

export async function upsertParityAlertsToSupabase(
  hotelId: string,
  items: Array<{
    id: string;
    dateStr: string;
    roomType: string;
    directRateEur: number;
    otaChannel: string;
    otaRateEur: number;
    status: string;
    severity: string;
    aiDiagnostic: string;
    rootCause: string;
    recommendedAction: string;
    slackSent: boolean;
    remediationStatus: string;
    directUrl?: string;
    otaUrl?: string;
  }>
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured() || items.length === 0) return false;
  try {
    const rows = items.map((it) => ({
      external_id: it.id,
      external_hotel_id: hotelId,
      stay_date: it.dateStr,
      room_type: it.roomType,
      direct_bar_eur: it.directRateEur,
      lowest_ota_channel: it.otaChannel,
      lowest_ota_rate_eur: it.otaRateEur,
      parity_status: it.status,
      severity: it.severity,
      ai_diagnostic: it.aiDiagnostic,
      root_cause: it.rootCause,
      recommended_action: it.recommendedAction,
      slack_sent: it.slackSent,
      remediation_status: it.remediationStatus,
      direct_url: it.directUrl || null,
      ota_url: it.otaUrl || null,
      detected_at: new Date().toISOString(),
    }));
    const { error } = await client.from('rate_parity_checks').upsert(rows, { onConflict: 'external_id' });
    if (error) {
      recordSupabaseError('upsertParityAlerts', error);
      return false;
    }
    recordSupabaseSuccess('rate_parity_checks');
    return true;
  } catch (err) {
    recordSupabaseError('upsertParityAlerts', err);
    return false;
  }
}

export async function fetchRatePlanningCellsFromSupabase(hotelId: string): Promise<RateCalendarCell[] | null> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await client
      .from('rate_calendar_cells')
      .select('*')
      .eq('external_hotel_id', hotelId)
      .order('stay_date', { ascending: true });
    if (error || !data || data.length === 0) {
      if (error) recordSupabaseError('fetchRatePlanningCells', error);
      return null;
    }
    recordSupabaseSuccess('rate_calendar_cells');
    return data.map((row: any) => ({
      cellKey: row.cell_key,
      hotelId: row.external_hotel_id,
      roomTypeCode: row.room_type_code,
      roomTypeName: row.room_type_name,
      ratePlanCode: row.rate_plan_code,
      ratePlanName: row.rate_plan_name,
      stayDate: String(row.stay_date),
      currentRateEur: Number(row.current_rate_eur),
      previousRateEur: row.previous_rate_eur !== null ? Number(row.previous_rate_eur) : null,
      inventoryAvailable: Number(row.inventory_available ?? 5),
      totalRoomsInCategory: Number(row.total_rooms_in_category ?? 15),
      minStay: Number(row.min_stay ?? 1),
      maxStay: row.max_stay !== null ? Number(row.max_stay) : null,
      cta: Boolean(row.cta),
      ctd: Boolean(row.ctd),
      isClosed: Boolean(row.is_closed),
      channelRates: row.channel_rates || {},
      recommendation: row.recommendation_json || null,
      flowtymSavedRateEur: Number(row.flowtym_saved_rate_eur ?? row.current_rate_eur),
      transmittedRateEur: row.transmitted_rate_eur !== null ? Number(row.transmitted_rate_eur) : null,
      confirmedExternalRateEur: row.confirmed_external_rate_eur !== null ? Number(row.confirmed_external_rate_eur) : null,
      syncStatus: row.sync_status || 'synced',
      syncErrorMessage: row.sync_error_message || null,
      lastSyncAt: row.last_sync_at || null,
      lastSyncAckId: row.last_sync_ack_id || null,
      modificationOrigin: row.modification_origin || 'flowtym_auto',
      isManualOverride: Boolean(row.is_manual_override),
      version: Number(row.version ?? 1),
      externalVersion: Number(row.external_version ?? 1),
      lastExternalRateEur: row.last_external_rate_eur !== null ? Number(row.last_external_rate_eur) : null,
      lastExternalUpdatedAt: row.last_external_updated_at || null,
      lastExternalActor: row.last_external_actor || null,
      updatedBy: row.updated_by || 'System',
      updatedAt: row.updated_at || new Date().toISOString(),
    }));
  } catch (err) {
    recordSupabaseError('fetchRatePlanningCells', err);
    return null;
  }
}

export async function fetchRMAlertsAndDecisionsFromSupabase(
  hotelId: string
): Promise<{ alerts: RMAlertItem[]; decisions: RMDecisionRecord[] } | null> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return null;
  try {
    const [alertsRes, decRes] = await Promise.all([
      client.from('rm_alerts').select('*').eq('external_hotel_id', hotelId).order('date_str', { ascending: true }),
      client.from('rm_decision_records').select('*').eq('external_hotel_id', hotelId).order('decided_at', { ascending: false }).limit(200),
    ]);
    if (alertsRes.error || decRes.error) {
      recordSupabaseError('fetchRMAlertsAndDecisions', alertsRes.error || decRes.error);
      return null;
    }
    recordSupabaseSuccess('rm_alerts');
    recordSupabaseSuccess('rm_decision_records');
    const alerts: RMAlertItem[] = (alertsRes.data || []).map((a: any) => ({
      id: String(a.external_id || a.id),
      hotelId: String(a.external_hotel_id || hotelId),
      eventId: String(a.event_id || ''),
      eventTitle: String(a.event_title),
      venueName: String(a.venue_name || ''),
      category: a.category || 'salons_foires',
      dateStr: String(a.date_str),
      demandLevel: a.demand_level || 'eleve',
      currentRate: Number(a.current_rate),
      recommendedRate: Number(a.recommended_rate),
      gapEur: Number(a.gap_eur),
      gapPercent: Number(a.gap_percent),
      confidenceScore: Number(a.confidence_score),
      sources: Array.isArray(a.sources) ? a.sources : [],
      urgency: a.urgency || 'moyenne',
      status: a.status || 'active',
      reason: String(a.reason || ''),
      compressionFactor: a.compression_factor || '',
      compsetAverageRate: Number(a.compset_average_rate || 0),
      soldOutCompetitorsCount: Number(a.sold_out_competitors_count || 0),
      minStayRecommended: Number(a.min_stay_recommended || 1),
      ctaRecommended: Boolean(a.cta_recommended),
    }));
    const decisions: RMDecisionRecord[] = (decRes.data || []).map((d: any) => ({
      id: String(d.external_id || d.id),
      alertId: String(d.alert_id),
      eventId: d.event_id || undefined,
      eventTitle: String(d.event_title),
      dateStr: String(d.date_str),
      hotelId: String(d.external_hotel_id || hotelId),
      action: d.action,
      originalCurrentRate: Number(d.original_current_rate),
      recommendedRate: Number(d.recommended_rate),
      appliedRate: Number(d.applied_rate),
      comment: d.comment || undefined,
      decidedAt: String(d.decided_at),
      decidedBy: String(d.decided_by),
    }));
    return { alerts, decisions };
  } catch (err) {
    recordSupabaseError('fetchRMAlertsAndDecisions', err);
    return null;
  }
}

// -----------------------------------------------------------------------------
// 4. REALTIME SUPABASE (WebSocket postgres_changes)
// -----------------------------------------------------------------------------

export function subscribeToSupabaseRealtime(
  hotelId: string,
  callbacks: {
    onEventsChanged?: () => void;
    onRateCellsChanged?: () => void;
    onAlertsChanged?: () => void;
    onParityChanged?: () => void;
  }
): () => void {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return () => {};

  const channel = client
    .channel(`flowtym-rms-${hotelId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
      callbacks.onEventsChanged?.();
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rate_calendar_cells', filter: `external_hotel_id=eq.${hotelId}` },
      () => {
        callbacks.onRateCellsChanged?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rm_alerts', filter: `external_hotel_id=eq.${hotelId}` },
      () => {
        callbacks.onAlertsChanged?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rate_parity_checks', filter: `external_hotel_id=eq.${hotelId}` },
      () => {
        callbacks.onParityChanged?.();
      }
    )
    .subscribe();

  return () => {
    try {
      client.removeChannel(channel);
    } catch {
      // ignore cleanup error
    }
  };
}
