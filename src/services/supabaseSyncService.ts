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

const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';

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
export async function syncInitialDataToSupabase(payload: {
  hotels: Hotel[];
  venues: Venue[];
  sources: EventSource[];
  events: EventItem[];
  proposals: EventProposal[];
  suggestions: EventSuggestion[];
}): Promise<SupabaseSyncSummary> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Clé Anon Key Supabase non renseignée — synchronisation ignorée.',
      syncedCounts: { hotels: 0, venues: 0, sources: 0, events: 0, proposals: 0, suggestions: 0 },
    };
  }

  const syncedCounts = {
    hotels: 0,
    venues: 0,
    sources: 0,
    events: 0,
    proposals: 0,
    suggestions: 0,
  };

  try {
    // 1. Organisation par défaut
    await client.from('organizations').upsert(
      {
        id: DEFAULT_ORG_ID,
        name: 'Flowtym Hospitality Group',
        slug: 'flowtym-hospitality-group',
      },
      { onConflict: 'slug' }
    );

    // 2. Hôtels
    if (payload.hotels.length > 0) {
      const hotelRows = payload.hotels.map((h) => ({
        external_id: h.id,
        organization_id: DEFAULT_ORG_ID,
        name: h.name,
        group_name: h.group,
        city: h.city,
        country: h.country,
        address: h.address,
        lat: h.lat,
        lng: h.lng,
        stars: h.stars,
        room_count: h.roomCount,
        segment: h.segment,
        base_adr: h.baseADR,
      }));
      const { error } = await client.from('hotels').upsert(hotelRows, { onConflict: 'external_id' });
      if (!error) syncedCounts.hotels = hotelRows.length;
    }

    // 3. Venues
    if (payload.venues.length > 0) {
      const venueRows = payload.venues.map((v) => ({
        external_id: v.id,
        name: v.name,
        slug: v.id,
        venue_type: v.type,
        capacity: v.capacity,
        address: v.address,
        city: v.city,
        country: v.country,
        lat: v.lat,
        lng: v.lng,
        is_verified: true,
        discovered_via: 'flowtym_seed',
      }));
      const { error } = await client.from('venues').upsert(venueRows, { onConflict: 'external_id' });
      if (!error) syncedCounts.venues = venueRows.length;
    }

    // 4. Sources
    if (payload.sources.length > 0) {
      const sourceRows = payload.sources.map((s) => ({
        external_id: s.id,
        name: s.name,
        url: s.url,
        source_type: s.isOfficial ? 'official_organizer' : 'aggregator',
        category: s.category,
        city: s.city,
        reliability_score: s.reliabilityScore,
        last_crawled_at: s.lastCrawledAt ? new Date(s.lastCrawledAt).toISOString() : null,
        status: s.status,
        detected_events_count: s.detectedEventsCount,
        is_official: s.isOfficial,
      }));
      const { error } = await client.from('event_sources').upsert(sourceRows, { onConflict: 'external_id' });
      if (!error) syncedCounts.sources = sourceRows.length;
    }

    // 5. Événements (par lots de 100)
    if (payload.events.length > 0) {
      const eventRows = payload.events.map((e) => ({
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
      }));

      for (let i = 0; i < eventRows.length; i += 100) {
        const batch = eventRows.slice(i, i + 100);
        const { error } = await client.from('events').upsert(batch, { onConflict: 'external_id' });
        if (!error) syncedCounts.events += batch.length;
      }
    }

    // 6. Propositions
    if (payload.proposals.length > 0) {
      const propRows = payload.proposals.map((p) => ({
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
      }));
      const { error } = await client.from('event_proposals').upsert(propRows, { onConflict: 'external_id' });
      if (!error) syncedCounts.proposals = propRows.length;
    }

    // 7. Suggestions IA
    if (payload.suggestions.length > 0) {
      const sugRows = payload.suggestions.map((s) => ({
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
      }));
      const { error } = await client.from('event_suggestions').upsert(sugRows, { onConflict: 'external_id' });
      if (!error) syncedCounts.suggestions = sugRows.length;
    }

    return {
      success: true,
      message: `Synchronisation Supabase réussie (${syncedCounts.hotels} hôtels, ${syncedCounts.venues} lieux, ${syncedCounts.events} événements).`,
      syncedCounts,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Erreur lors de la synchronisation avec Supabase.',
      syncedCounts,
    };
  }
}

/**
 * Persiste la configuration RMS d'un hôtel vers hotel_rms_configs (non bloquant)
 */
export async function syncHotelRMSConfigToSupabase(hotelId: string, config: HotelRMSConfig): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) return;
  try {
    await client.from('hotel_rms_configs').upsert(
      {
        external_hotel_id: hotelId,
        organization_id: DEFAULT_ORG_ID,
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
