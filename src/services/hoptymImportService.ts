import { getSupabaseClient } from './supabaseClient';
import { parseHoptymDate as dateValue, parseHoptymNumber as numberValue, parseHoptymBoolean as booleanValue } from './hoptymImportUtils';
import { summarizeCompetitorRates, calculateNetPickup, calculateMeanLeadTime, calculateOccupancyPercent } from './hoptymMetrics';

export type HoptymImportDataset = 'historical' | 'inventory' | 'reservations' | 'rates' | 'events';
export interface HoptymImportResult {
  success: boolean;
  jobId?: string;
  read: number;
  written: number;
  rejected: number;
  message: string;
  errors: string[];
}

type Row = Record<string, unknown>;

const HEADER_ALIASES: Record<string, string[]> = {
  stayDate: ['stay_date', 'date_sejour', 'date_arrivee', 'arrival_date', 'arrival', 'date', 'jour'],
  snapshotAt: ['snapshot_at', 'date_extraction', 'date_snapshot', 'observed_at', 'date_maj'],
  roomsSold: ['rooms_sold', 'chambres_vendues', 'room_nights', 'room_nights_otb', 'rooms_otb', 'chambres_occupees'],
  totalRooms: ['total_rooms', 'room_count', 'nombre_chambres', 'capacite', 'capacity'],
  sellableRooms: ['sellable_rooms', 'chambres_commercialisables', 'available_inventory'],
  roomsAvailable: ['rooms_available', 'available_rooms', 'chambres_disponibles', 'availability', 'disponibilite'],
  outOfOrder: ['out_of_order_rooms', 'ooo', 'chambres_hors_service'],
  complimentary: ['complimentary_rooms', 'comp_rooms', 'chambres_gratuites'],
  occupancy: ['occupancy_pct', 'occupancy', 'occupation', 'taux_occupation', 'taux_occupation_pct'],
  adr: ['adr_net', 'net_adr', 'adr', 'average_daily_rate', 'prix_moyen'],
  revpar: ['revpar', 'rev_par'],
  revenue: ['accommodation_revenue', 'room_revenue', 'revenue', 'ca_hebergement', 'chiffre_affaires'],
  totalRevenue: ['total_revenue', 'ca_total'],
  reservations: ['reservations_count', 'reservation_count', 'bookings', 'nombre_reservations'],
  guests: ['guests_count', 'guests', 'pax', 'clients'],
  cancellations: ['cancellations_count', 'cancellations', 'annulations'],
  cancellationRate: ['cancellation_rate_pct', 'cancellation_rate', 'taux_annulation'],
  leadTime: ['lead_time_days', 'lead_time', 'booking_window', 'delai_reservation'],
  currency: ['currency', 'devise', 'currency_code'],
  competitor: ['competitor_name', 'competitor', 'hotel_name', 'hotel', 'concurrent', 'nom_concurrent'],
  rate: ['rate_amount', 'rate', 'price', 'prix', 'tarif', 'public_bar', 'bar'],
  minStay: ['min_stay', 'minlos', 'minimum_stay', 'sejour_minimum'],
  cta: ['cta', 'closed_to_arrival', 'ferme_arrivee'],
  ctd: ['ctd', 'closed_to_departure', 'ferme_depart'],
  newRooms: ['new_rooms_booked', 'new_bookings', 'nouvelles_reservations', 'pickup_rooms'],
  movedIn: ['moved_in_rooms', 'transferts_entrants'],
  movedOut: ['moved_out_rooms', 'transferts_sortants'],
  periodStart: ['period_start', 'pickup_period_start', 'date_debut_periode'],
  pickupWindow: ['pickup_window_hours', 'pickup_window', 'fenetre_pickup'],
  roomType: ['room_type', 'roomtype', 'typologie', 'type_chambre'],
  ratePlan: ['rate_plan', 'rateplan', 'plan_tarifaire', 'tarif'],
  channel: ['channel', 'canal', 'distribution_channel'],
  segment: ['segment', 'market_segment', 'segment_marche'],
  eventTitle: ['event_title', 'event', 'title', 'nom_evenement', 'evenement'],
  eventStart: ['start_date', 'event_start', 'date_debut', 'debut'],
  eventEnd: ['end_date', 'event_end', 'date_fin', 'fin'],
  eventUrl: ['official_url', 'url', 'source_url', 'event_url'],
  attendance: ['expected_attendance', 'attendance', 'visitors', 'frequentation', 'participants'],
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function readValue(row: Row, key: keyof typeof HEADER_ALIASES): unknown {
  const aliases = HEADER_ALIASES[key].map(normalizeHeader);
  const found = Object.entries(row).find(([header]) => aliases.includes(normalizeHeader(header)));
  return found?.[1];
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function batches<T>(items: T[], size = 200): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function makeHistoricalRow(row: Row, tenant: { organizationId: string; hotelId: string }, batchId: string, sourceName: string) {
  const stayDate = dateValue(readValue(row, 'stayDate'));
  if (!stayDate) return null;
  const date = new Date(`${stayDate}T00:00:00.000Z`);
  const roomsSold = numberValue(readValue(row, 'roomsSold'));
  const totalRooms = numberValue(readValue(row, 'totalRooms'));
  const revenue = numberValue(readValue(row, 'revenue'));
  const occupancyInput = numberValue(readValue(row, 'occupancy'));
  const adrInput = numberValue(readValue(row, 'adr'));
  const revparInput = numberValue(readValue(row, 'revpar'));
  const occupancy = occupancyInput ?? calculateOccupancyPercent(roomsSold, totalRooms);
  const adr = adrInput ?? (revenue !== null && roomsSold ? revenue / roomsSold : null);
  const revpar = revparInput ?? (revenue !== null && totalRooms ? revenue / totalRooms : null);
  return {
    organization_id: tenant.organizationId,
    hotel_id: tenant.hotelId,
    stay_date: stayDate,
    day_of_week: date.getUTCDay(),
    week_of_year: isoWeek(date),
    month_of_year: date.getUTCMonth() + 1,
    year_of_stay: date.getUTCFullYear(),
    total_marketable_rooms: totalRooms,
    available_rooms: numberValue(readValue(row, 'roomsAvailable')),
    rooms_sold: roomsSold,
    occupancy_pct: occupancy,
    reservations_count: numberValue(readValue(row, 'reservations')),
    guests_count: numberValue(readValue(row, 'guests')),
    adr_net: adr,
    revpar,
    accommodation_revenue: revenue,
    total_revenue: numberValue(readValue(row, 'totalRevenue')),
    cancellations_count: numberValue(readValue(row, 'cancellations')),
    cancellation_rate_pct: numberValue(readValue(row, 'cancellationRate')),
    lead_time_days: numberValue(readValue(row, 'leadTime')),
    public_bar: numberValue(readValue(row, 'rate')),
    otb_j90: numberValue(row.otb_j90 ?? row.OTB_J90),
    otb_j60: numberValue(row.otb_j60 ?? row.OTB_J60),
    otb_j30: numberValue(row.otb_j30 ?? row.OTB_J30),
    otb_j14: numberValue(row.otb_j14 ?? row.OTB_J14),
    otb_j7: numberValue(row.otb_j7 ?? row.OTB_J7),
    otb_j3: numberValue(row.otb_j3 ?? row.OTB_J3),
    otb_j1: numberValue(row.otb_j1 ?? row.OTB_J1),
    pickup_j90_j60: numberValue(row.pickup_j90_j60 ?? row.PICKUP_J90_J60),
    pickup_j60_j30: numberValue(row.pickup_j60_j30 ?? row.PICKUP_J60_J30),
    pickup_j30_j14: numberValue(row.pickup_j30_j14 ?? row.PICKUP_J30_J14),
    pickup_j14_j7: numberValue(row.pickup_j14_j7 ?? row.PICKUP_J14_J7),
    pickup_j7_j3: numberValue(row.pickup_j7_j3 ?? row.PICKUP_J7_J3),
    pickup_j3_j1: numberValue(row.pickup_j3_j1 ?? row.PICKUP_J3_J1),
    pickup_j1_arrival: numberValue(row.pickup_j1_arrival ?? row.PICKUP_J1_ARRIVAL),
    currency: String(readValue(row, 'currency') || 'EUR').slice(0, 3).toUpperCase(),
    source_status: 'imported',
    source_name: sourceName,
    import_batch_id: batchId,
    raw_record: row,
  };
}

async function resolveTenant(hotelName: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Client Supabase indisponible.');
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Une session Supabase authentifiée est obligatoire pour importer.');
  const { data: profile, error: profileError } = await client
    .from('users')
    .select('id,organization_id,role')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.organization_id) throw new Error('Profil utilisateur ou organisation Flowtym introuvable.');
  const { data: hotel, error: hotelError } = await client
    .from('hotels')
    .select('id,organization_id,name,room_count,currency')
    .eq('organization_id', profile.organization_id)
    .eq('name', hotelName)
    .maybeSingle();
  if (hotelError) throw hotelError;
  if (!hotel) throw new Error(`L'hôtel « ${hotelName} » n'est pas rattaché à votre organisation dans Supabase. Aucun import effectué.`);
  return { client, userId: authData.user.id, organizationId: profile.organization_id, hotelId: hotel.id, hotel };
}

export async function importHoptymFile(args: {
  dataset: HoptymImportDataset;
  hotelName: string;
  fileName: string;
  providerName?: string;
  records: Row[];
}): Promise<HoptymImportResult> {
  const errors: string[] = [];
  const read = args.records.length;
  if (!read) return { success: false, read: 0, written: 0, rejected: 0, message: 'Le fichier ne contient aucune ligne.', errors: [] };

  let tenant: Awaited<ReturnType<typeof resolveTenant>>;
  try {
    tenant = await resolveTenant(args.hotelName);
  } catch (error: any) {
    return { success: false, read, written: 0, rejected: read, message: error?.message || 'Contexte hôtel non vérifié.', errors: [] };
  }

  const { client, organizationId, hotelId, userId } = tenant;
  const jobIdempotency = crypto.randomUUID();
  const { data: job, error: jobError } = await client.from('data_ingestion_jobs').insert({
    organization_id: organizationId,
    hotel_id: hotelId,
    source_system: 'manual_file',
    job_type: args.dataset,
    status: 'running',
    idempotency_key: jobIdempotency,
    started_at: new Date().toISOString(),
    records_read: read,
    created_by: userId,
    metadata: { file_name: args.fileName, dataset: args.dataset },
  }).select('id').single();

  if (jobError || !job) {
    return { success: false, read, written: 0, rejected: read, message: jobError?.message || 'Impossible de créer le journal d’import (RLS ou schéma).', errors: [] };
  }

  let written = 0;
  let acceptedInputRecords = 0;
  const sourceName = `file:${args.fileName.slice(0, 180)}`;

  try {
    if (args.dataset === 'historical') {
      const mapped = args.records.map((row) => makeHistoricalRow(row, { organizationId, hotelId }, job.id, sourceName));
      const valid = mapped.filter((row): row is NonNullable<typeof row> => Boolean(row));
      acceptedInputRecords = valid.length;
      const invalid = read - valid.length;
      for (const batch of batches(valid)) {
        const { error } = await client.from('hotel_historical_daily').upsert(batch, { onConflict: 'hotel_id,stay_date,source_name' });
        if (error) throw error;
        written += batch.length;
      }
      if (invalid) errors.push(`${invalid} ligne(s) sans date de séjour valide.`);
    } else if (args.dataset === 'inventory') {
      const mapped = args.records.flatMap((row) => {
        const stayDate = dateValue(readValue(row, 'stayDate'));
        if (!stayDate) return [];
        const total = numberValue(readValue(row, 'totalRooms')) ?? tenant.hotel.room_count;
        const sold = numberValue(readValue(row, 'roomsSold'));
        const available = numberValue(readValue(row, 'roomsAvailable'));
        const sellable = numberValue(readValue(row, 'sellableRooms')) ?? (total !== null && total !== undefined ? total - (numberValue(readValue(row, 'outOfOrder')) ?? 0) : null);
        const occupancyInput = numberValue(readValue(row, 'occupancy'));
        const occupancy = occupancyInput ?? calculateOccupancyPercent(sold, sellable);
        return [{
          organization_id: organizationId, hotel_id: hotelId, stay_date: stayDate,
          snapshot_at: new Date().toISOString(), source_system: 'manual_file', source_status: 'imported',
          total_rooms: total, sellable_rooms: sellable, rooms_sold: sold, rooms_available: available,
          out_of_order_rooms: numberValue(readValue(row, 'outOfOrder')),
          complimentary_rooms: numberValue(readValue(row, 'complimentary')),
          occupancy_pct: occupancy, current_bar: numberValue(readValue(row, 'rate')),
          currency: String(readValue(row, 'currency') || tenant.hotel.currency || 'EUR').slice(0, 3).toUpperCase(),
          min_stay: numberValue(readValue(row, 'minStay')),
          closed_to_arrival: booleanValue(readValue(row, 'cta')),
          closed_to_departure: booleanValue(readValue(row, 'ctd')),
          raw_payload: row,
        }];
      });
      acceptedInputRecords = mapped.length;
      if (!mapped.length) throw new Error('Aucune ligne de disponibilité avec date de séjour exploitable.');
      for (const batch of batches(mapped)) {
        const { error } = await client.from('hotel_inventory_snapshots').insert(batch);
        if (error) throw error;
        written += batch.length;
      }
    } else if (args.dataset === 'reservations') {
      const grouped = new Map<string, any>();
      for (const row of args.records) {
        const stayDate = dateValue(readValue(row, 'stayDate'));
        if (!stayDate) continue;
        const channel = String(readValue(row, 'channel') || 'unknown').slice(0, 100);
        const segment = String(readValue(row, 'segment') || 'unknown').slice(0, 100);
        const currency = String(readValue(row, 'currency') || tenant.hotel.currency || 'EUR').slice(0, 3).toUpperCase();
        const key = [stayDate, channel, segment, currency].join('|');
        const current = grouped.get(key) || {
          organization_id: organizationId, hotel_id: hotelId, stay_date: stayDate,
          snapshot_at: new Date().toISOString(), source_system: 'manual_file', source_status: 'imported',
          segment, channel, currency, rooms_otb: 0, room_nights_otb: 0, booked_revenue: 0,
          cancellation_count: 0, leadTimeTotal: 0, leadTimeCount: 0,
          new_rooms_booked: 0, cancelled_rooms: 0, moved_in_rooms: 0, moved_out_rooms: 0,
        };
        const rooms = numberValue(readValue(row, 'roomsSold')) ?? 0;
        current.new_rooms_booked += numberValue(readValue(row, 'newRooms')) ?? 0;
        current.moved_in_rooms += numberValue(readValue(row, 'movedIn')) ?? 0;
        current.moved_out_rooms += numberValue(readValue(row, 'movedOut')) ?? 0;
        current.rooms_otb += rooms;
        current.room_nights_otb += numberValue(readValue(row, 'roomsSold')) ?? 0;
        current.booked_revenue += numberValue(readValue(row, 'revenue')) ?? 0;
        current.cancellation_count += numberValue(readValue(row, 'cancellations')) ?? 0;
        current.cancelled_rooms += numberValue(readValue(row, 'cancellations')) ?? 0;
        const lead = numberValue(readValue(row, 'leadTime'));
        if (lead !== null) { current.leadTimeTotal += lead; current.leadTimeCount += 1; }
        grouped.set(key, current);
      }
      acceptedInputRecords = args.records.filter((row) => Boolean(dateValue(readValue(row, 'stayDate')))).length;
      const mapped = Array.from(grouped.values()).map((row) => {
        const { leadTimeTotal, leadTimeCount, ...output } = row;
        const pickupWindow = numberValue(readValue(args.records[0], 'pickupWindow'));
        const periodStart = dateValue(readValue(args.records[0], 'periodStart'));
        const allowedWindow = [24, 72, 168].includes(pickupWindow || 0) ? pickupWindow : null;
        return { ...output, booked_adr: output.rooms_otb > 0 ? output.booked_revenue / output.rooms_otb : null, lead_time_days: leadTimeCount ? calculateMeanLeadTime([leadTimeTotal / leadTimeCount]) : null, net_pickup_rooms: calculateNetPickup({ newRoomsBooked: output.new_rooms_booked, cancelledRooms: output.cancelled_rooms, movedInRooms: output.moved_in_rooms, movedOutRooms: output.moved_out_rooms }), pickup_window_hours: allowedWindow, period_start: periodStart ? periodStart + 'T00:00:00.000Z' : null };
      });
      if (!mapped.length) throw new Error('Aucune réservation avec date de séjour exploitable.');
      for (const batch of batches(mapped)) {
        const { error } = await client.from('hotel_reservation_snapshots').insert(batch);
        if (error) throw error;
        written += batch.length;
      }
    } else if (args.dataset === 'rates') {
      const observedAt = new Date().toISOString();
      const valid = args.records.flatMap((row) => {
        const stayDate = dateValue(readValue(row, 'stayDate'));
        const competitorName = String(readValue(row, 'competitor') || '').trim();
        if (!stayDate || !competitorName) return [];
        const rate = numberValue(readValue(row, 'rate'));
        const availability = readValue(row, 'roomsAvailable');
        const soldOut = numberValue(availability) === 0 || /sold.?out|complet|indisponible/i.test(String(availability || ''));
        return [{
          organization_id: organizationId, hotel_id: hotelId, stay_date: stayDate,
          competitor_name: competitorName, room_type: String(readValue(row, 'roomType') || '').slice(0, 120) || null,
          rate_plan: String(readValue(row, 'ratePlan') || '').slice(0, 120) || null,
          channel: String(readValue(row, 'channel') || 'unknown').slice(0, 100),
          currency: String(readValue(row, 'currency') || tenant.hotel.currency || 'EUR').slice(0, 3).toUpperCase(),
          rate_amount: rate, availability_status: soldOut ? 'sold_out' : ((numberValue(availability) ?? -1) > 0 || /available|disponible/i.test(String(availability || '')) ? 'available' : 'unknown'),
          observed_at: observedAt, source_status: 'imported', comparability: { status: 'unverified', reason: 'Import fichier sans validation de typologie, occupation, plan tarifaire, conditions et LOS.' }, los: 1,
        }];
      });
      if (!valid.length) throw new Error('Aucune observation concurrentielle avec date et nom du concurrent.');
      acceptedInputRecords = valid.length;
      const { data: competitors, error: competitorsError } = await client.from('competitor_hotels').select('id,competitor_name').eq('hotel_id', hotelId).eq('organization_id', organizationId);
      if (competitorsError) throw competitorsError;
      const competitorIds = new Map((competitors || []).map((item: any) => [String(item.competitor_name).trim().toLowerCase(), item.id]));
      const { data: extraction, error: extractionError } = await client.from('lighthouse_extractions').insert({
        organization_id: organizationId, hotel_id: hotelId, file_name: args.fileName,
        provider: args.providerName || 'manual_file', extraction_type: 'manual_import', observed_at: observedAt,
        currency: String(readValue(args.records[0], 'currency') || tenant.hotel.currency || 'EUR').slice(0, 3).toUpperCase(),
        source_status: 'imported', records_count: valid.length, imported_by: userId,
        metadata: { original_dataset: 'rate_shopper_import', provider_name: args.providerName || 'manual_file' },
      }).select('id').single();
      if (extractionError || !extraction) throw extractionError || new Error('Création de l’extraction impossible.');
      const observations = valid.map((row) => ({ ...row, competitor_id: competitorIds.get(String(row.competitor_name).trim().toLowerCase()) || null, extraction_id: extraction.id }));
      for (const batch of batches(observations)) {
        const { error } = await client.from('lighthouse_rate_observations').insert(batch);
        if (error) throw error;
        written += batch.length;
      }

      // Store market statistics only; never infer or publish a suggested BAR from unverified rates.
      try {
        const byDate = new Map<string, typeof valid>();
        for (const item of valid) byDate.set(item.stay_date, [...(byDate.get(item.stay_date) || []), item]);
        for (const [stayDate, dayRows] of byDate) {
          const currencies = [...new Set(dayRows.map((item) => item.currency))];
          if (currencies.length !== 1) {
            errors.push(`${stayDate}: statistiques marché non calculées, devises concurrentes mélangées.`);
            continue;
          }
          const summary = summarizeCompetitorRates(dayRows);
          const amounts = summary.prices;
          if (!amounts.length) continue;
          const marketMedian = summary.median;
          const existing = await client.from('daily_rate_intelligence')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('hotel_id', hotelId)
            .eq('stay_date', stayDate)
            .eq('engine_version', 'market-baseline-0.1')
            .is('room_type_id', null)
            .is('rate_plan_id', null)
            .maybeSingle();
          if (existing.error) throw existing.error;
          const intelligence = {
            organization_id: organizationId,
            hotel_id: hotelId,
            stay_date: stayDate,
            currency: currencies[0],
            lighthouse_median: /lighthouse|ota insight/i.test(args.providerName || '') ? marketMedian : null,
            flowtym_compset_median: marketMedian,
            compset_min: summary.minimum,
            compset_max: summary.maximum,
            data_quality_status: 'degraded',
            recommendation_status: 'pending',
            engine_version: 'market-baseline-0.1',
            explanation: 'Statistiques concurrentielles importées. Comparabilité, BAR hôtel et demande non encore validés : aucune suggestion tarifaire n’est calculée.',
            evidence: { provider: args.providerName || 'manual_file', observation_count: summary.observationCount, competitor_count: summary.competitorCount },
            input_snapshot: { source_file: args.fileName, observations: dayRows },
          };
          const write = existing.data?.id
            ? await client.from('daily_rate_intelligence').update(intelligence).eq('id', existing.data.id)
            : await client.from('daily_rate_intelligence').insert(intelligence);
          if (write.error) throw write.error;
        }
      } catch (statsError: any) {
        errors.push(`Statistiques concurrentielles non persistées : ${statsError?.message || 'erreur inconnue'}`);
      }
    } else if (args.dataset === 'events') {
      const mapped = args.records.flatMap((row) => {
        const title = String(readValue(row, 'eventTitle') || '').trim();
        const start = dateValue(readValue(row, 'eventStart'));
        if (!title || !start) return [];
        const end = dateValue(readValue(row, 'eventEnd')) || start;
        return [{
          organization_id: organizationId, hotel_id: hotelId,
          proposed_event: { title, start_date: start, end_date: end, expected_attendance: numberValue(readValue(row, 'attendance')), raw_record: row },
          source_url: String(readValue(row, 'eventUrl') || '').slice(0, 2000) || null,
          confidence_score: 50, review_status: 'pending',
        }];
      });
      acceptedInputRecords = mapped.length;
      if (!mapped.length) throw new Error('Aucun événement avec titre et date de début exploitables.');
      for (const batch of batches(mapped)) {
        const { error } = await client.from('event_suggestions').insert(batch);
        if (error) throw error;
        written += batch.length;
      }
    }

    const rejected = Math.max(0, read - acceptedInputRecords);
    const finalStatus = rejected > 0 || errors.length > 0 ? 'partial' : 'completed';
    const { error: finalizeError } = await client.from('data_ingestion_jobs').update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      records_written: written,
      records_rejected: rejected,
      error_summary: errors.length ? errors.join(' ').slice(0, 2000) : null,
    }).eq('id', job.id);
    if (finalizeError) throw finalizeError;
    const { error: auditError } = await client.from('hotel_historical_import_logs').insert({
      organization_id: organizationId, hotel_id: hotelId, file_name: args.fileName,
      records_count: written, rejected_count: rejected,
      file_size_bytes: null,
      import_status: finalStatus === 'completed' ? 'completed' : 'warning',
      warnings: errors, errors: [], detected_columns: Object.keys(args.records[0] || {}), imported_by: userId,
    });
    if (auditError) throw auditError;
    return {
      success: written > 0,
      jobId: job.id,
      read, written, rejected,
      message: `${written} ligne(s) enregistrée(s), ${rejected} rejetée(s).`,
      errors,
    };
  } catch (error: any) {
    const message = error?.message || 'Erreur inconnue pendant la persistance.';
    await client.from('data_ingestion_jobs').update({
      status: written > 0 ? 'partial' : 'failed',
      finished_at: new Date().toISOString(),
      records_written: written,
      records_rejected: read - written,
      error_summary: message.slice(0, 2000),
    }).eq('id', job.id);
    return { success: false, jobId: job.id, read, written, rejected: read - written, message, errors: [message] };
  }
}
