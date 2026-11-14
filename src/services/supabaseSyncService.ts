/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — Service de Synchronisation & Persistance Supabase
 * Connecté par défaut au projet https://aliploqizujgovnlgjvg.supabase.co
 */

import {
  EventItem,
  EventProposal,
  EventSource,
  EventSuggestion,
  Hotel,
  RMAlertItem,
  RMDecisionRecord,
  Venue,
} from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import type { HotelRMSConfig } from './rmsSettingsService';
import type { MajorEventEmailAlertConfig, MajorEventEmailAlertLog } from './majorEventAlertService';

interface AuthenticatedTenantContext {
  userId: string;
  organizationId: string;
}

async function getAuthenticatedTenantContext(): Promise<AuthenticatedTenantContext | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return null;
  const { data: profile, error: profileError } = await client
    .from('users')
    .select('id,organization_id,role')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError || !profile?.organization_id) return null;
  return { userId: profile.id, organizationId: profile.organization_id };
}

export interface SupabaseSyncSummary {
  success: boolean;
  message: string;
  syncedCounts: {
    hotels: number;
    venues: number;
    sources: number;
    events: number;
    proposals: number;
    suggestions: number;
  };
}

/**
 * Synchronise le référentiel initial (hôtels, lieux, sources, événements, propositions, suggestions)
 * vers Supabase via upsert idempotent sur external_id.
 */
export async function syncInitialDataToSupabase(_payload: {
  hotels: Hotel[];
  venues: Venue[];
  sources: EventSource[];
  events: EventItem[];
  proposals: EventProposal[];
  suggestions: EventSuggestion[];
}): Promise<SupabaseSyncSummary> {
  const emptyCounts = { hotels: 0, venues: 0, sources: 0, events: 0, proposals: 0, suggestions: 0 };
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) {
    return { success: false, message: 'Configuration Supabase absente. Aucune donnée synchronisée.', syncedCounts: emptyCounts };
  }
  const tenant = await getAuthenticatedTenantContext();
  if (!tenant) {
    return { success: false, message: 'Session Supabase ou profil organisation non vérifié. Aucune donnée synchronisée.', syncedCounts: emptyCounts };
  }

  // Fail closed: the legacy seed payload does not map to the current normalized schema.
  // Never create a synthetic organization or write mock IDs into production tables.
  return {
    success: false,
    message: 'Synchronisation initiale suspendue : le mapping du référentiel historique vers le schéma normalisé doit être migré avant toute écriture.',
    syncedCounts: emptyCounts,
  };
}

/**
 * Persiste la configuration RMS d'un hôtel vers hotel_rms_configs (non bloquant)
 */
export async function syncHotelRMSConfigToSupabase(hotelId: string, config: HotelRMSConfig): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return;
  const tenant = await getAuthenticatedTenantContext();
  if (!tenant) return;
  try {
    await client.from('hotel_rms_configs').upsert(
      {
        external_hotel_id: hotelId,
        organization_id: tenant.organizationId,
        room_typologies: config.roomTypologies,
        rm_rules: config.rmRules,
        comp_set: config.compSet,
        comp_set_settings: config.compSetSettings,
        event_watch: config.eventWatch,
        notifications: config.notifications,
      },
      { onConflict: 'external_hotel_id' }
    );
  } catch {
    // Fallback transparent vers localStorage
  }
}

/**
 * Persiste une alerte RM & une décision humaine vers Supabase (non bloquant)
 */
export async function syncRMDecisionToSupabase(
  hotelId: string,
  decision: RMDecisionRecord,
  updatedAlert?: RMAlertItem
): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return;
  const tenant = await getAuthenticatedTenantContext();
  if (!tenant) return;
  try {
    await client.from('rm_decision_records').upsert(
      {
        external_id: decision.id,
        alert_id: decision.alertId,
        event_id: decision.eventId || null,
        event_title: decision.eventTitle,
        date_str: decision.dateStr,
        external_hotel_id: hotelId,
        action: decision.action,
        original_current_rate: decision.originalCurrentRate,
        recommended_rate: decision.recommendedRate,
        applied_rate: decision.appliedRate,
        comment: decision.comment || null,
        decided_at: decision.decidedAt,
        decided_by: decision.decidedBy,
      },
      { onConflict: 'external_id' }
    );

    if (updatedAlert) {
      await client.from('rm_alerts').upsert(
        {
          external_id: updatedAlert.id,
          external_hotel_id: hotelId,
          event_id: updatedAlert.eventId,
          event_title: updatedAlert.eventTitle,
          venue_name: updatedAlert.venueName,
          category: updatedAlert.category,
          date_str: updatedAlert.dateStr,
          demand_level: updatedAlert.demandLevel,
          current_rate: updatedAlert.currentRate,
          recommended_rate: updatedAlert.recommendedRate,
          gap_eur: updatedAlert.gapEur,
          gap_percent: updatedAlert.gapPercent,
          confidence_score: updatedAlert.confidenceScore,
          sources: updatedAlert.sources,
          urgency: updatedAlert.urgency,
          status: updatedAlert.status,
          reason: updatedAlert.reason,
          compression_factor: updatedAlert.compressionFactor,
          compset_average_rate: updatedAlert.compsetAverageRate,
          sold_out_competitors_count: updatedAlert.soldOutCompetitorsCount,
          min_stay_recommended: updatedAlert.minStayRecommended || 1,
          cta_recommended: Boolean(updatedAlert.ctaRecommended),
        },
        { onConflict: 'external_id' }
      );
    }
  } catch {
    // Fallback transparent vers localStorage
  }
}

/**
 * Persiste la configuration et les logs d'alertes e-mail quotidiennes (score > 70)
 */
export async function syncMajorEventAlertConfigToSupabase(config: MajorEventEmailAlertConfig): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return;
  const tenant = await getAuthenticatedTenantContext();
  if (!tenant) return;
  try {
    await client.from('major_event_email_alert_configs').upsert(
      {
        external_hotel_id: 'global',
        enabled: config.enabled,
        min_score: config.minScore,
        send_time: config.sendTime,
        frequency: config.frequency,
        recipients: config.recipients,
        include_ongoing: config.includeOngoing,
        horizon_days: config.horizonDays,
        include_yield_recommendations: config.includeYieldRecommendations,
        last_sent_at: config.lastSentAt ? new Date(config.lastSentAt.replace(' ', 'T')).toISOString() : null,
      },
      { onConflict: 'external_hotel_id' }
    );
  } catch {
    // Fallback transparent vers localStorage
  }
}

export async function syncMajorEventAlertLogToSupabase(log: MajorEventEmailAlertLog): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return;
  const tenant = await getAuthenticatedTenantContext();
  if (!tenant) return;
  try {
    await client.from('major_event_email_alert_logs').upsert(
      {
        external_id: log.id,
        sent_at: new Date(log.sentAt.replace(' ', 'T')).toISOString(),
        recipients: log.recipients,
        events_count: log.eventsCount,
        min_score: log.minScore,
        top_event_title: log.topEventTitle,
        status: log.status,
      },
      { onConflict: 'external_id' }
    );
  } catch {
    // Fallback transparent vers localStorage
  }
}
