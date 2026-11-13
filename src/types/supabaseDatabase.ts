/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — Contrats TypeScript alignés sur le schéma PostgreSQL / Supabase
 */

export type SubscriptionTier = 'starter' | 'pro' | 'enterprise';
export type UserRoleDb =
  | 'super_admin'
  | 'admin'
  | 'head_of_rm'
  | 'revenue_manager'
  | 'general_manager'
  | 'analyst'
  | 'viewer';

export type RatePlanType = 'BAR' | 'NRF' | 'BB' | 'CORP' | 'OTA_PROMO' | 'PACKAGE' | 'GROUP';
export type DerivationType = 'manual' | 'percent' | 'fixed';
export type MacroSegment = 'transient' | 'corporate' | 'group' | 'mice' | 'other';
export type ChannelType = 'direct' | 'ota' | 'gds' | 'wholesaler' | 'direct_corp';
export type ReservationStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type ValidationStatus = 'pending' | 'accepted' | 'modified' | 'rejected' | 'postponed';
export type AriPushStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'retrying';
export type ParityStatus = 'ok' | 'undercut_minor' | 'undercut_critical' | 'ota_higher';

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  subscription_tier: SubscriptionTier;
  billing_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomTypeRow {
  id: string;
  external_id: string | null;
  hotel_id: string;
  code: string;
  name: string;
  total_rooms: number;
  base_offset_eur: number;
  base_offset_pct: number;
  weight_percent: number;
  max_occupancy: number;
  is_base_room_type: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface RatePlanRow {
  id: string;
  hotel_id: string;
  code: string;
  name: string;
  plan_type: RatePlanType;
  parent_rate_plan_id: string | null;
  derivation_type: DerivationType;
  derivation_value: number;
  cancellation_policy: 'Flexible' | 'Semi-flexible' | 'Non-annulable';
  breakfast_included: boolean;
  is_commissionable: boolean;
  default_commission_pct: number;
  is_yieldable: boolean;
  is_active: boolean;
}

export interface PricingGuardrailRow {
  id: string;
  hotel_id: string;
  room_type_id: string | null;
  min_rate_eur: number;
  max_rate_eur: number;
  max_daily_step_eur: number;
  max_daily_step_pct: number;
  compset_max_spread_eur: number;
  require_human_approval: boolean;
  auto_stop_sell_score_threshold: number;
  updated_at: string;
}

export interface OtbPaceSnapshotRow {
  id: string;
  hotel_id: string;
  snapshot_date: string;
  stay_date: string;
  room_type_id: string | null;
  days_before_arrival: number;
  rooms_capacity: number;
  rooms_ooo: number;
  rooms_sold_otb: number;
  rooms_available: number;
  occupancy_pct: number;
  otb_revenue_eur: number;
  otb_adr_eur: number;
  pickup_1d: number;
  pickup_3d: number;
  pickup_7d: number;
  pickup_14d: number;
  pickup_30d: number;
  cancellations_1d: number;
  turnaways_1d: number;
}

export interface DailyRateRecommendationRow {
  id: string;
  hotel_id: string;
  stay_date: string;
  room_type_id: string | null;
  day_of_week: string;
  is_weekend: boolean;
  demand_index: number;
  demand_level: 'faible' | 'modere' | 'normal' | 'eleve' | 'tres_fort' | 'exceptionnel';
  current_bar_eur: number;
  current_min_stay: number;
  current_stop_sell: boolean;
  lighthouse_median_eur: number | null;
  flowtym_median_eur: number | null;
  compset_min_eur: number | null;
  compset_max_eur: number | null;
  compset_avg_eur: number | null;
  compset_sold_out_count: number;
  compset_total_count: number;
  my_compset_rank: number | null;
  total_rooms: number;
  remaining_rooms: number;
  rooms_sold_otb: number;
  occupancy_percent: number;
  pickup_24h: number;
  pickup_3d: number;
  pickup_7d: number;
  booking_pace: string;
  adr_net_eur: number;
  revpar_eur: number;
  lead_time_days_avg: number;
  suggested_bar_eur: number;
  delta_vs_current_eur: number;
  delta_vs_current_pct: number;
  strategy_code: string;
  strategy_label: string;
  justification_epistemic: Record<string, unknown>;
  confidence_score: number;
  safety_alert_type: string | null;
  validation_status: ValidationStatus;
  applied_bar_eur: number | null;
  applied_min_stay: number | null;
  decision_reason_code: string | null;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
}

export interface DailyRestrictionRow {
  id: string;
  hotel_id: string;
  stay_date: string;
  room_type_id: string | null;
  rate_plan_id: string | null;
  channel_id: string | null;
  min_los: number;
  max_los: number | null;
  cta: boolean;
  ctd: boolean;
  stop_sell: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface RateParityCheckRow {
  id: string;
  hotel_id: string;
  stay_date: string;
  direct_bar_eur: number;
  lowest_ota_channel: string;
  lowest_ota_rate_eur: number;
  parity_gap_eur: number;
  parity_status: ParityStatus;
  detected_at: string;
}

export interface AriPushJobRow {
  id: string;
  hotel_id: string;
  provider: string;
  stay_date_start: string;
  stay_date_end: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: AriPushStatus;
  attempts: number;
  last_error: string | null;
  triggered_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AuditLogRow {
  id: string;
  organization_id: string;
  hotel_id: string | null;
  actor_user_id: string | null;
  actor_email: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
