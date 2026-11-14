import { getSupabaseClient } from './supabaseClient';
import { EventEvidence, EventItem, EventSource, EventSuggestion, Hotel, Venue } from '../types';

export interface WorkspaceBootstrapData {
  hotels: Hotel[];
  venues: Venue[];
  sources: EventSource[];
  events: EventItem[];
  suggestions: EventSuggestion[];
  warnings: string[];
}

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const mapEventCategory = (value: string): EventItem['category'] => {
  const allowed: EventItem['category'][] = ['salons_foires', 'congres_medical', 'concerts_spectacles', 'sport', 'festivals', 'mode_luxe', 'corporate_sommet', 'culturel', 'vacances_scolaires', 'periodes_saisonnieres_fetes'];
  return allowed.includes(value as EventItem['category']) ? value as EventItem['category'] : 'culturel';
};

const mapConfirmationStatus = (value: string): EventItem['status'] => {
  const allowed: EventItem['status'][] = ['confirmed', 'probable', 'estime', 'a_verifier', 'estimated_recurrent', 'announced_pending', 'rumored'];
  return allowed.includes(value as EventItem['status']) ? value as EventItem['status'] : 'a_verifier';
};

const mapImpactLevel = (score: number): EventItem['impactLevel'] => score >= 85 ? 'hyper' : score >= 65 ? 'critique' : score >= 35 ? 'modere' : 'faible';

const mapEvidenceType = (value: string): EventEvidence['sourceType'] => {
  const allowed: EventEvidence['sourceType'][] = ['official_organizer', 'venue_calendar', 'press', 'ticketing', 'city_agenda'];
  return allowed.includes(value as EventEvidence['sourceType']) ? value as EventEvidence['sourceType'] : 'press';
};

export async function loadWorkspaceData(organizationId: string): Promise<WorkspaceBootstrapData> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Client Supabase non configuré.');

  const { data: hotelRows, error: hotelError } = await client
    .from('hotels')
    .select('id,organization_id,name,group_name,city,country,address,lat,lng,stars,room_count,segment,base_adr,is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name');
  if (hotelError) throw hotelError;

  const hotels: Hotel[] = (hotelRows || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    group: row.group_name || '',
    city: row.city,
    country: row.country,
    address: row.address || '',
    lat: numberOrNull(row.lat),
    lng: numberOrNull(row.lng),
    stars: numberOrNull(row.stars),
    roomCount: Number(row.room_count || 0),
    segment: row.segment || 'Non renseigné',
    baseADR: numberOrNull(row.base_adr),
  }));

  const warnings: string[] = [];
  const { data: venueRows, error: venueError } = await client
    .from('venues')
    .select('id,name,venue_type,city,country_code,address,latitude,longitude,capacity,verification_status')
    .order('name');
  if (venueError) warnings.push(`Lieux non chargés : ${venueError.message}`);

  const venues: Venue[] = (venueRows || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    city: row.city || '',
    country: row.country_code || '',
    address: row.address || '',
    lat: numberOrNull(row.latitude),
    lng: numberOrNull(row.longitude),
    capacity: numberOrNull(row.capacity),
    type: row.venue_type === 'parc_expositions' || row.venue_type === 'arena' || row.venue_type === 'stade' || row.venue_type === 'centre_congres' || row.venue_type === 'theatre' ? row.venue_type : 'espace_public',
  }));

  const { data: sourceRows, error: sourceError } = await client
    .from('event_sources')
    .select('id,name,source_url,source_type,city,reliability_score,is_official,status,last_crawled_at')
    .order('name');
  if (sourceError) warnings.push(`Sources événementielles non chargées : ${sourceError.message}`);

  const sources: EventSource[] = (sourceRows || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    url: row.source_url || '',
    category: row.source_type || 'unknown',
    city: row.city || '',
    reliabilityScore: Number(row.reliability_score || 0),
    lastCrawledAt: row.last_crawled_at || '',
    status: row.status === 'error' ? 'error' : row.status === 'active' || row.status === 'healthy' ? 'healthy' : 'warning',
    detectedEventsCount: 0,
    isOfficial: Boolean(row.is_official),
  }));

  const { data: eventRows, error: eventError } = await client
    .from('events')
    .select('id,title,subtitle,category,venue_id,city,country_code,status,expected_attendance,international_ratio_pct,recurrence_frequency,official_url,first_verified_at,last_verified_at,created_at')
    .neq('status', 'cancelled')
    .order('title');
  if (eventError) warnings.push(`Événements non chargés : ${eventError.message}`);

  const eventIds = (eventRows || []).map((row: any) => row.id);
  const [occurrencesResult, evidenceResult, impactResult] = eventIds.length ? await Promise.all([
    client.from('event_occurrences').select('id,event_id,start_date,end_date,date_status,attendance_estimate').in('event_id', eventIds).order('start_date'),
    client.from('event_evidence').select('id,event_id,source_name,source_url,evidence_type,verified_at,excerpt,trust_score').in('event_id', eventIds),
    hotels.length ? client.from('event_hotel_impacts').select('hotel_id,event_id,distance_km,drive_time_minutes,transit_time_minutes,estimated_demand_lift_pct,estimated_adr_lift_pct,recommended_action,final_rm_score,confidence_score,score_components,impact_status').eq('organization_id', organizationId).in('hotel_id', hotels.map((hotel) => hotel.id)).in('event_id', eventIds) : Promise.resolve({ data: [], error: null }),
  ]) : [
    { data: [], error: null }, { data: [], error: null }, { data: [], error: null },
  ];
  if (occurrencesResult.error) warnings.push(`Dates d'événements non chargées : ${occurrencesResult.error.message}`);
  if (evidenceResult.error) warnings.push(`Preuves événementielles non chargées : ${evidenceResult.error.message}`);
  if (impactResult.error) warnings.push(`Impacts hôtel non chargés : ${impactResult.error.message}`);

  const venueById = new Map(venues.map((venue) => [venue.id, venue]));
  const occurrencesByEvent = new Map<string, any[]>();
  for (const occurrence of occurrencesResult.data || []) {
    occurrencesByEvent.set(occurrence.event_id, [...(occurrencesByEvent.get(occurrence.event_id) || []), occurrence]);
  }
  const evidenceByEvent = new Map<string, EventEvidence[]>();
  for (const evidence of evidenceResult.data || []) {
    const item: EventEvidence = {
      id: evidence.id,
      sourceName: evidence.source_name || 'Source non renseignée',
      sourceUrl: evidence.source_url || '',
      sourceType: mapEvidenceType(evidence.evidence_type || ''),
      verifiedAt: evidence.verified_at || '',
      excerpt: evidence.excerpt || '',
      trustScore: Number(evidence.trust_score || 0),
    };
    evidenceByEvent.set(evidence.event_id, [...(evidenceByEvent.get(evidence.event_id) || []), item]);
  }
  const impactsByEvent = new Map<string, Record<string, any>>();
  for (const impact of impactResult.data || []) {
    const current = impactsByEvent.get(impact.event_id) || {};
    current[impact.hotel_id] = impact;
    impactsByEvent.set(impact.event_id, current);
  }

  const events: EventItem[] = (eventRows || []).flatMap((row: any) => {
    const occurrences = occurrencesByEvent.get(row.id) || [];
    if (!occurrences.length) return [];
    const occurrence = occurrences[0];
    const venue = row.venue_id ? venueById.get(row.venue_id) : undefined;
    const impacts = impactsByEvent.get(row.id) || {};
    const scores = Object.values(impacts) as any[];
    const topScore = scores.reduce((max, item) => Math.max(max, Number(item.final_rm_score || 0)), 0);
    const topImpact = scores.find((item) => Number(item.final_rm_score || 0) === topScore);
    const scoreComponents = topImpact?.score_components || {};
    const evidences = evidenceByEvent.get(row.id) || [];
    const hotelImpacts: EventItem['hotelImpacts'] = {};
    for (const [hotelId, item] of Object.entries(impacts)) {
      hotelImpacts[hotelId] = {
        hotelId,
        distanceKm: numberOrNull(item.distance_km),
        distanceMins: numberOrNull(item.drive_time_minutes ?? item.transit_time_minutes),
        directDemandShare: numberOrNull(item.estimated_demand_lift_pct),
        compressionIndex: null,
        recommendedAction: item.recommended_action || null,
        estimatedADRBoostPercent: numberOrNull(item.estimated_adr_lift_pct),
      };
    }
    return [{
      id: row.id,
      title: row.title,
      subtitle: row.subtitle || undefined,
      category: mapEventCategory(row.category),
      venueId: row.venue_id || '',
      venueName: venue?.name || 'Lieu non renseigné',
      city: row.city || venue?.city || '',
      country: row.country_code || venue?.country || '',
      startDate: occurrence.start_date,
      endDate: occurrence.end_date || occurrence.start_date,
      expectedAttendance: Number(occurrence.attendance_estimate ?? row.expected_attendance ?? 0),
      internationalRatioPercent: Number(row.international_ratio_pct || 0),
      status: mapConfirmationStatus(row.status),
      impactLevel: mapImpactLevel(topScore),
      scoreBreakdown: {
        attendanceScore: Number(topImpact?.attendance_score || 0),
        internationalScore: Number(topImpact?.international_score || 0),
        saturationScore: Number(scoreComponents.saturationScore || 0),
        proximityScore: Number(topImpact?.proximity_score || 0),
        compressionScore: Number(topImpact?.capacity_score || 0),
        finalRMScore: topScore,
        confidenceScore: Number(topImpact?.confidence_score || 0),
      },
      sources: evidences.map((item) => item.sourceName),
      evidences,
      hotelImpacts,
      isRecurring: Boolean(row.recurrence_frequency && row.recurrence_frequency !== 'one_time'),
      recurrenceFrequency: row.recurrence_frequency || undefined,
      isFavorite: false,
      isWatchlist: false,
      isYieldActive: false,
      isAnomaly: false,
      officialUrl: row.official_url || undefined,
      createdAt: row.created_at,
      lastVerifiedAt: row.last_verified_at || row.first_verified_at || '',
    }];
  });

  let suggestions: EventSuggestion[] = [];
  if (hotels.length) {
    const { data: suggestionRows, error: suggestionError } = await client
      .from('event_suggestions')
      .select('id,proposed_event,source_url,confidence_score,review_status,created_at')
      .eq('organization_id', organizationId)
      .in('hotel_id', hotels.map((hotel) => hotel.id));
    if (suggestionError) warnings.push(`Suggestions événementielles non chargées : ${suggestionError.message}`);
    suggestions = (suggestionRows || []).map((row: any) => {
      const proposed = row.proposed_event || {};
      return {
        id: row.id,
        eventTitle: proposed.title || proposed.event_title || 'Événement à qualifier',
        category: mapEventCategory(proposed.category || 'culturel'),
        city: proposed.city || '',
        venueName: proposed.venue_name || '',
        suggestedDates: { start: proposed.start_date || '', end: proposed.end_date || proposed.start_date || '' },
        detectedVia: row.source_url || 'Import fichier',
        confidence: Number(row.confidence_score || 0),
        reason: 'Suggestion importée — validation humaine requise',
        impactPredicted: 'faible',
        status: row.review_status === 'approved' ? 'approved' : row.review_status === 'dismissed' ? 'dismissed' : 'pending',
      };
    });
  }

  return { hotels, venues, sources, events, suggestions, warnings };
}
