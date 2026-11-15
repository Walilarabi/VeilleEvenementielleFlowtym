export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cities: {
        Row: {
          country_code: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          normalized_name: string
          region: string | null
          territory_code: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          normalized_name: string
          region?: string | null
          territory_code?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          normalized_name?: string
          region?: string | null
          territory_code?: string | null
        }
        Relationships: []
      }
      competitor_hotels: {
        Row: {
          address: string | null
          competitor_name: string
          created_at: string
          distance_meters: number | null
          hotel_id: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          organization_id: string
          provider_competitor_id: string | null
          room_count: number | null
          room_type_mapping: Json
          stars: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          competitor_name: string
          created_at?: string
          distance_meters?: number | null
          hotel_id: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          organization_id: string
          provider_competitor_id?: string | null
          room_count?: number | null
          room_type_mapping?: Json
          stars?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          competitor_name?: string
          created_at?: string
          distance_meters?: number | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          provider_competitor_id?: string | null
          room_count?: number | null
          room_type_mapping?: Json
          stars?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_hotels_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "competitor_hotels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_demand_forecasts: {
        Row: {
          adr_p50: number | null
          confidence_score: number | null
          created_at: string
          demand_index: number | null
          drivers: Json
          forecast_run_id: string
          hotel_id: string
          id: string
          occupancy_p10: number | null
          occupancy_p50: number | null
          occupancy_p90: number | null
          organization_id: string
          revpar_p50: number | null
          room_type_id: string | null
          source_status: string
          stay_date: string
        }
        Insert: {
          adr_p50?: number | null
          confidence_score?: number | null
          created_at?: string
          demand_index?: number | null
          drivers?: Json
          forecast_run_id: string
          hotel_id: string
          id?: string
          occupancy_p10?: number | null
          occupancy_p50?: number | null
          occupancy_p90?: number | null
          organization_id: string
          revpar_p50?: number | null
          room_type_id?: string | null
          source_status?: string
          stay_date: string
        }
        Update: {
          adr_p50?: number | null
          confidence_score?: number | null
          created_at?: string
          demand_index?: number | null
          drivers?: Json
          forecast_run_id?: string
          hotel_id?: string
          id?: string
          occupancy_p10?: number | null
          occupancy_p50?: number | null
          occupancy_p90?: number | null
          organization_id?: string
          revpar_p50?: number | null
          room_type_id?: string | null
          source_status?: string
          stay_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_demand_forecasts_forecast_run_id_fkey"
            columns: ["forecast_run_id"]
            isOneToOne: false
            referencedRelation: "revenue_forecast_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_demand_forecasts_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "daily_demand_forecasts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_demand_forecasts_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_room_type_same_hotel_fk"
            columns: ["room_type_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
        ]
      }
      daily_rate_intelligence: {
        Row: {
          approved_min_stay: number | null
          approved_rate: number | null
          compset_max: number | null
          compset_min: number | null
          confidence_score: number | null
          created_at: string
          currency: string
          current_bar: number | null
          data_quality_status: string
          decision_at: string | null
          decision_by: string | null
          delta_amount: number | null
          delta_pct: number | null
          demand_index: number | null
          demand_level: string | null
          engine_version: string
          evidence: Json
          explanation: string | null
          flowtym_compset_median: number | null
          forecast_occupancy_p10: number | null
          forecast_occupancy_p50: number | null
          forecast_occupancy_p90: number | null
          hotel_id: string
          id: string
          input_snapshot: Json
          lighthouse_median: number | null
          occupancy_pct: number | null
          organization_id: string
          pickup_24h: number | null
          pickup_3d: number | null
          pickup_7d: number | null
          rate_plan_id: string | null
          recommendation_status: string
          room_type_id: string | null
          rooms_remaining: number | null
          stay_date: string
          strategy_code: string | null
          suggested_bar: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          approved_min_stay?: number | null
          approved_rate?: number | null
          compset_max?: number | null
          compset_min?: number | null
          confidence_score?: number | null
          created_at?: string
          currency?: string
          current_bar?: number | null
          data_quality_status?: string
          decision_at?: string | null
          decision_by?: string | null
          delta_amount?: number | null
          delta_pct?: number | null
          demand_index?: number | null
          demand_level?: string | null
          engine_version: string
          evidence?: Json
          explanation?: string | null
          flowtym_compset_median?: number | null
          forecast_occupancy_p10?: number | null
          forecast_occupancy_p50?: number | null
          forecast_occupancy_p90?: number | null
          hotel_id: string
          id?: string
          input_snapshot?: Json
          lighthouse_median?: number | null
          occupancy_pct?: number | null
          organization_id: string
          pickup_24h?: number | null
          pickup_3d?: number | null
          pickup_7d?: number | null
          rate_plan_id?: string | null
          recommendation_status?: string
          room_type_id?: string | null
          rooms_remaining?: number | null
          stay_date: string
          strategy_code?: string | null
          suggested_bar?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          approved_min_stay?: number | null
          approved_rate?: number | null
          compset_max?: number | null
          compset_min?: number | null
          confidence_score?: number | null
          created_at?: string
          currency?: string
          current_bar?: number | null
          data_quality_status?: string
          decision_at?: string | null
          decision_by?: string | null
          delta_amount?: number | null
          delta_pct?: number | null
          demand_index?: number | null
          demand_level?: string | null
          engine_version?: string
          evidence?: Json
          explanation?: string | null
          flowtym_compset_median?: number | null
          forecast_occupancy_p10?: number | null
          forecast_occupancy_p50?: number | null
          forecast_occupancy_p90?: number | null
          hotel_id?: string
          id?: string
          input_snapshot?: Json
          lighthouse_median?: number | null
          occupancy_pct?: number | null
          organization_id?: string
          pickup_24h?: number | null
          pickup_3d?: number | null
          pickup_7d?: number | null
          rate_plan_id?: string | null
          recommendation_status?: string
          room_type_id?: string | null
          rooms_remaining?: number | null
          stay_date?: string
          strategy_code?: string | null
          suggested_bar?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_rate_intelligence_decision_by_fkey"
            columns: ["decision_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_rate_intelligence_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "daily_rate_intelligence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_rate_intelligence_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "hotel_rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_rate_intelligence_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_rate_plan_same_hotel_fk"
            columns: ["rate_plan_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_rate_plans"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "daily_rate_room_type_same_hotel_fk"
            columns: ["room_type_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
        ]
      }
      data_ingestion_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          error_summary: string | null
          finished_at: string | null
          hotel_id: string
          id: string
          idempotency_key: string | null
          integration_id: string | null
          job_type: string
          metadata: Json
          organization_id: string
          records_read: number
          records_rejected: number
          records_written: number
          source_system: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_summary?: string | null
          finished_at?: string | null
          hotel_id: string
          id?: string
          idempotency_key?: string | null
          integration_id?: string | null
          job_type: string
          metadata?: Json
          organization_id: string
          records_read?: number
          records_rejected?: number
          records_written?: number
          source_system: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_summary?: string | null
          finished_at?: string | null
          hotel_id?: string
          id?: string
          idempotency_key?: string | null
          integration_id?: string | null
          job_type?: string
          metadata?: Json
          organization_id?: string
          records_read?: number
          records_rejected?: number
          records_written?: number
          source_system?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_ingestion_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_ingestion_jobs_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "data_ingestion_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_ingestion_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_integration_same_hotel_fk"
            columns: ["integration_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
        ]
      }
      event_evidence: {
        Row: {
          captured_at: string
          created_at: string
          event_id: string
          evidence_type: string
          excerpt: string | null
          id: string
          occurrence_id: string | null
          source_id: string | null
          source_name: string
          source_url: string
          trust_score: number | null
          verified_at: string | null
        }
        Insert: {
          captured_at?: string
          created_at?: string
          event_id: string
          evidence_type?: string
          excerpt?: string | null
          id?: string
          occurrence_id?: string | null
          source_id?: string | null
          source_name: string
          source_url: string
          trust_score?: number | null
          verified_at?: string | null
        }
        Update: {
          captured_at?: string
          created_at?: string
          event_id?: string
          evidence_type?: string
          excerpt?: string | null
          id?: string
          occurrence_id?: string | null
          source_id?: string | null
          source_name?: string
          source_url?: string
          trust_score?: number | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_evidence_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_evidence_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "event_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_evidence_occurrence_matches_event_fk"
            columns: ["occurrence_id", "event_id"]
            isOneToOne: false
            referencedRelation: "event_occurrences"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "event_evidence_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "event_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      event_hotel_impacts: {
        Row: {
          attendance_score: number | null
          calculated_at: string | null
          capacity_score: number | null
          confidence_score: number | null
          created_at: string
          distance_km: number | null
          drive_time_minutes: number | null
          duration_score: number | null
          estimated_adr_lift_pct: number | null
          estimated_demand_lift_pct: number | null
          event_id: string
          extra_nights_score: number | null
          final_rm_score: number | null
          historical_demand_sample_count: number | null
          historical_demand_score: number | null
          hotel_id: string
          id: string
          impact_status: string
          international_score: number | null
          notoriety_score: number | null
          occurrence_id: string | null
          organization_id: string
          proximity_score: number | null
          recommended_action: string | null
          recurrence_score: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          score_components: Json
          segment_fit_score: number | null
          source_confidence_score: number | null
          source_evidence: Json
          transit_time_minutes: number | null
          updated_at: string
        }
        Insert: {
          attendance_score?: number | null
          calculated_at?: string | null
          capacity_score?: number | null
          confidence_score?: number | null
          created_at?: string
          distance_km?: number | null
          drive_time_minutes?: number | null
          duration_score?: number | null
          estimated_adr_lift_pct?: number | null
          estimated_demand_lift_pct?: number | null
          event_id: string
          extra_nights_score?: number | null
          final_rm_score?: number | null
          historical_demand_sample_count?: number | null
          historical_demand_score?: number | null
          hotel_id: string
          id?: string
          impact_status?: string
          international_score?: number | null
          notoriety_score?: number | null
          occurrence_id?: string | null
          organization_id: string
          proximity_score?: number | null
          recommended_action?: string | null
          recurrence_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score_components?: Json
          segment_fit_score?: number | null
          source_confidence_score?: number | null
          source_evidence?: Json
          transit_time_minutes?: number | null
          updated_at?: string
        }
        Update: {
          attendance_score?: number | null
          calculated_at?: string | null
          capacity_score?: number | null
          confidence_score?: number | null
          created_at?: string
          distance_km?: number | null
          drive_time_minutes?: number | null
          duration_score?: number | null
          estimated_adr_lift_pct?: number | null
          estimated_demand_lift_pct?: number | null
          event_id?: string
          extra_nights_score?: number | null
          final_rm_score?: number | null
          historical_demand_sample_count?: number | null
          historical_demand_score?: number | null
          hotel_id?: string
          id?: string
          impact_status?: string
          international_score?: number | null
          notoriety_score?: number | null
          occurrence_id?: string | null
          organization_id?: string
          proximity_score?: number | null
          recommended_action?: string | null
          recurrence_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score_components?: Json
          segment_fit_score?: number | null
          source_confidence_score?: number | null
          source_evidence?: Json
          transit_time_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_hotel_impacts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hotel_impacts_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "event_hotel_impacts_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "event_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hotel_impacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hotel_impacts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_impact_occurrence_matches_event_fk"
            columns: ["occurrence_id", "event_id"]
            isOneToOne: false
            referencedRelation: "event_occurrences"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      event_impact_decision_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          after_state: Json
          before_state: Json
          created_at: string
          hotel_id: string
          id: string
          impact_id: string
          organization_id: string
          reason_code: string
          reason_text: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          after_state: Json
          before_state: Json
          created_at?: string
          hotel_id: string
          id?: string
          impact_id: string
          organization_id: string
          reason_code: string
          reason_text?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          hotel_id?: string
          id?: string
          impact_id?: string
          organization_id?: string
          reason_code?: string
          reason_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_impact_decision_audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_impact_decision_audit_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_impact_decision_audit_logs_impact_id_fkey"
            columns: ["impact_id"]
            isOneToOne: false
            referencedRelation: "event_hotel_impacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_impact_decision_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_occurrences: {
        Row: {
          attendance_estimate: number | null
          created_at: string
          date_status: string
          end_date: string
          event_id: string
          id: string
          notes: string | null
          start_date: string
        }
        Insert: {
          attendance_estimate?: number | null
          created_at?: string
          date_status?: string
          end_date: string
          event_id: string
          id?: string
          notes?: string | null
          start_date: string
        }
        Update: {
          attendance_estimate?: number | null
          created_at?: string
          date_status?: string
          end_date?: string
          event_id?: string
          id?: string
          notes?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sources: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          id: string
          is_official: boolean
          last_crawled_at: string | null
          name: string
          reliability_score: number
          source_type: string
          source_url: string
          status: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          is_official?: boolean
          last_crawled_at?: string | null
          name: string
          reliability_score?: number
          source_type: string
          source_url: string
          status?: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          is_official?: boolean
          last_crawled_at?: string | null
          name?: string
          reliability_score?: number
          source_type?: string
          source_url?: string
          status?: string
        }
        Relationships: []
      }
      event_suggestions: {
        Row: {
          confidence_score: number | null
          created_at: string
          hotel_id: string
          id: string
          organization_id: string
          proposed_event: Json
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_url: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          hotel_id: string
          id?: string
          organization_id: string
          proposed_event: Json
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          hotel_id?: string
          id?: string
          organization_id?: string
          proposed_event?: Json
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_suggestions_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "event_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string
          city: string
          country_code: string
          created_at: string
          expected_attendance: number | null
          first_verified_at: string | null
          id: string
          international_ratio_pct: number | null
          last_verified_at: string | null
          normalized_title: string
          official_url: string | null
          recurrence_frequency: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          category: string
          city: string
          country_code: string
          created_at?: string
          expected_attendance?: number | null
          first_verified_at?: string | null
          id?: string
          international_ratio_pct?: number | null
          last_verified_at?: string | null
          normalized_title: string
          official_url?: string | null
          recurrence_frequency?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          category?: string
          city?: string
          country_code?: string
          created_at?: string
          expected_attendance?: number | null
          first_verified_at?: string | null
          id?: string
          international_ratio_pct?: number | null
          last_verified_at?: string | null
          normalized_title?: string
          official_url?: string | null
          recurrence_frequency?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_backtest_evaluations: {
        Row: {
          baseline_metrics: Json
          bias_pct: number | null
          calibration: Json
          created_by: string | null
          evaluated_at: string
          evaluated_from: string
          evaluated_to: string
          horizon_days: number | null
          hotel_id: string
          id: string
          leakage_checks: Json
          mae: number | null
          metrics_by_horizon: Json
          model_name: string
          model_version: string
          organization_id: string
          rmse: number | null
          sample_count: number
          wape: number | null
        }
        Insert: {
          baseline_metrics?: Json
          bias_pct?: number | null
          calibration?: Json
          created_by?: string | null
          evaluated_at?: string
          evaluated_from: string
          evaluated_to: string
          horizon_days?: number | null
          hotel_id: string
          id?: string
          leakage_checks?: Json
          mae?: number | null
          metrics_by_horizon?: Json
          model_name: string
          model_version: string
          organization_id: string
          rmse?: number | null
          sample_count?: number
          wape?: number | null
        }
        Update: {
          baseline_metrics?: Json
          bias_pct?: number | null
          calibration?: Json
          created_by?: string | null
          evaluated_at?: string
          evaluated_from?: string
          evaluated_to?: string
          horizon_days?: number | null
          hotel_id?: string
          id?: string
          leakage_checks?: Json
          mae?: number | null
          metrics_by_horizon?: Json
          model_name?: string
          model_version?: string
          organization_id?: string
          rmse?: number | null
          sample_count?: number
          wape?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_backtest_evaluations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_backtest_evaluations_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_backtest_evaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_calibration_rules: {
        Row: {
          confidence_level: number | null
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          organization_id: string
          r_squared: number | null
          rule_key: string
          rule_status: string
          rule_type: string
          rule_value: Json
          rule_version: number
          sample_count: number
          source_method: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          confidence_level?: number | null
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          organization_id: string
          r_squared?: number | null
          rule_key: string
          rule_status?: string
          rule_type: string
          rule_value: Json
          rule_version?: number
          sample_count: number
          source_method: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          confidence_level?: number | null
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          organization_id?: string
          r_squared?: number | null
          rule_key?: string
          rule_status?: string
          rule_type?: string
          rule_value?: Json
          rule_version?: number
          sample_count?: number
          source_method?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_calibration_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_calibration_rules_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_calibration_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_demand_censoring_observations: {
        Row: {
          booking_attempt_count: number | null
          censoring_status: string
          channel: string | null
          created_at: string
          currency: string | null
          estimated_lost_rooms: number | null
          evidence: Json
          hotel_id: string
          id: string
          last_available_at: string | null
          observed_at: string
          organization_id: string
          rate_plan_id: string | null
          rejected_attempt_count: number | null
          room_type_id: string | null
          search_demand_count: number | null
          sold_out_at: string | null
          source_name: string
          source_status: string
          stay_date: string
        }
        Insert: {
          booking_attempt_count?: number | null
          censoring_status: string
          channel?: string | null
          created_at?: string
          currency?: string | null
          estimated_lost_rooms?: number | null
          evidence?: Json
          hotel_id: string
          id?: string
          last_available_at?: string | null
          observed_at: string
          organization_id: string
          rate_plan_id?: string | null
          rejected_attempt_count?: number | null
          room_type_id?: string | null
          search_demand_count?: number | null
          sold_out_at?: string | null
          source_name: string
          source_status: string
          stay_date: string
        }
        Update: {
          booking_attempt_count?: number | null
          censoring_status?: string
          channel?: string | null
          created_at?: string
          currency?: string | null
          estimated_lost_rooms?: number | null
          evidence?: Json
          hotel_id?: string
          id?: string
          last_available_at?: string | null
          observed_at?: string
          organization_id?: string
          rate_plan_id?: string | null
          rejected_attempt_count?: number | null
          room_type_id?: string | null
          search_demand_count?: number | null
          sold_out_at?: string | null
          source_name?: string
          source_status?: string
          stay_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_demand_censoring_observ_rate_plan_id_hotel_id_organi_fkey"
            columns: ["rate_plan_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_rate_plans"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_demand_censoring_observ_room_type_id_hotel_id_organi_fkey"
            columns: ["room_type_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_demand_censoring_observatio_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_demand_censoring_observations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_historical_daily: {
        Row: {
          accommodation_revenue: number | null
          adr_net: number | null
          available_rooms: number | null
          booking_reservations: number | null
          cancellation_rate_pct: number | null
          cancellations_count: number | null
          commission_pct: number | null
          complimentary_rooms: number | null
          compset_avg: number | null
          compset_max: number | null
          compset_min: number | null
          corporate_reservations: number | null
          created_at: string
          currency: string
          day_of_week: number | null
          day_type: string | null
          direct_reservations: number | null
          distribution_cost: number | null
          event_category: string | null
          event_distance_km: number | null
          event_end_date: string | null
          event_name: string | null
          event_start_date: string | null
          event_visitors: number | null
          expedia_reservations: number | null
          gds_reservations: number | null
          group_reservations: number | null
          guests_count: number | null
          hotel_id: string
          id: string
          import_batch_id: string | null
          is_holiday: boolean | null
          is_school_holiday: boolean | null
          lead_time_days: number | null
          month_of_year: number | null
          net_adr: number | null
          occupancy_pct: number | null
          organization_id: string
          otb_j1: number | null
          otb_j14: number | null
          otb_j3: number | null
          otb_j30: number | null
          otb_j60: number | null
          otb_j7: number | null
          otb_j90: number | null
          other_ota_reservations: number | null
          out_of_order_rooms: number | null
          pickup_j1_arrival: number | null
          pickup_j14_j7: number | null
          pickup_j3_j1: number | null
          pickup_j30_j14: number | null
          pickup_j60_j30: number | null
          pickup_j7_j3: number | null
          pickup_j90_j60: number | null
          public_bar: number | null
          rate_position_index: number | null
          raw_record: Json
          reservations_count: number | null
          revpar: number | null
          rooms_sold: number | null
          school_holiday_zone: string | null
          season: string | null
          source_name: string | null
          source_record_id: string | null
          source_status: string
          stay_date: string
          total_marketable_rooms: number | null
          total_revenue: number | null
          updated_at: string
          week_of_year: number | null
          year_of_stay: number | null
        }
        Insert: {
          accommodation_revenue?: number | null
          adr_net?: number | null
          available_rooms?: number | null
          booking_reservations?: number | null
          cancellation_rate_pct?: number | null
          cancellations_count?: number | null
          commission_pct?: number | null
          complimentary_rooms?: number | null
          compset_avg?: number | null
          compset_max?: number | null
          compset_min?: number | null
          corporate_reservations?: number | null
          created_at?: string
          currency?: string
          day_of_week?: number | null
          day_type?: string | null
          direct_reservations?: number | null
          distribution_cost?: number | null
          event_category?: string | null
          event_distance_km?: number | null
          event_end_date?: string | null
          event_name?: string | null
          event_start_date?: string | null
          event_visitors?: number | null
          expedia_reservations?: number | null
          gds_reservations?: number | null
          group_reservations?: number | null
          guests_count?: number | null
          hotel_id: string
          id?: string
          import_batch_id?: string | null
          is_holiday?: boolean | null
          is_school_holiday?: boolean | null
          lead_time_days?: number | null
          month_of_year?: number | null
          net_adr?: number | null
          occupancy_pct?: number | null
          organization_id: string
          otb_j1?: number | null
          otb_j14?: number | null
          otb_j3?: number | null
          otb_j30?: number | null
          otb_j60?: number | null
          otb_j7?: number | null
          otb_j90?: number | null
          other_ota_reservations?: number | null
          out_of_order_rooms?: number | null
          pickup_j1_arrival?: number | null
          pickup_j14_j7?: number | null
          pickup_j3_j1?: number | null
          pickup_j30_j14?: number | null
          pickup_j60_j30?: number | null
          pickup_j7_j3?: number | null
          pickup_j90_j60?: number | null
          public_bar?: number | null
          rate_position_index?: number | null
          raw_record?: Json
          reservations_count?: number | null
          revpar?: number | null
          rooms_sold?: number | null
          school_holiday_zone?: string | null
          season?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_status?: string
          stay_date: string
          total_marketable_rooms?: number | null
          total_revenue?: number | null
          updated_at?: string
          week_of_year?: number | null
          year_of_stay?: number | null
        }
        Update: {
          accommodation_revenue?: number | null
          adr_net?: number | null
          available_rooms?: number | null
          booking_reservations?: number | null
          cancellation_rate_pct?: number | null
          cancellations_count?: number | null
          commission_pct?: number | null
          complimentary_rooms?: number | null
          compset_avg?: number | null
          compset_max?: number | null
          compset_min?: number | null
          corporate_reservations?: number | null
          created_at?: string
          currency?: string
          day_of_week?: number | null
          day_type?: string | null
          direct_reservations?: number | null
          distribution_cost?: number | null
          event_category?: string | null
          event_distance_km?: number | null
          event_end_date?: string | null
          event_name?: string | null
          event_start_date?: string | null
          event_visitors?: number | null
          expedia_reservations?: number | null
          gds_reservations?: number | null
          group_reservations?: number | null
          guests_count?: number | null
          hotel_id?: string
          id?: string
          import_batch_id?: string | null
          is_holiday?: boolean | null
          is_school_holiday?: boolean | null
          lead_time_days?: number | null
          month_of_year?: number | null
          net_adr?: number | null
          occupancy_pct?: number | null
          organization_id?: string
          otb_j1?: number | null
          otb_j14?: number | null
          otb_j3?: number | null
          otb_j30?: number | null
          otb_j60?: number | null
          otb_j7?: number | null
          otb_j90?: number | null
          other_ota_reservations?: number | null
          out_of_order_rooms?: number | null
          pickup_j1_arrival?: number | null
          pickup_j14_j7?: number | null
          pickup_j3_j1?: number | null
          pickup_j30_j14?: number | null
          pickup_j60_j30?: number | null
          pickup_j7_j3?: number | null
          pickup_j90_j60?: number | null
          public_bar?: number | null
          rate_position_index?: number | null
          raw_record?: Json
          reservations_count?: number | null
          revpar?: number | null
          rooms_sold?: number | null
          school_holiday_zone?: string | null
          season?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_status?: string
          stay_date?: string
          total_marketable_rooms?: number | null
          total_revenue?: number | null
          updated_at?: string
          week_of_year?: number | null
          year_of_stay?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_historical_daily_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_historical_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_historical_demand_snapshots: {
        Row: {
          arrival_date: string
          booked_adr: number | null
          booked_revenue: number | null
          cancellations_since_previous: number | null
          compset_rate: number | null
          created_at: string
          days_before_arrival: number
          hotel_id: string
          id: string
          import_batch_id: string | null
          observation_date: string
          organization_id: string
          pickup_since_previous: number | null
          projected_occupancy_pct: number | null
          public_rate: number | null
          rooms_available: number | null
          rooms_booked_otb: number | null
          source_name: string | null
          source_status: string
        }
        Insert: {
          arrival_date: string
          booked_adr?: number | null
          booked_revenue?: number | null
          cancellations_since_previous?: number | null
          compset_rate?: number | null
          created_at?: string
          days_before_arrival: number
          hotel_id: string
          id?: string
          import_batch_id?: string | null
          observation_date: string
          organization_id: string
          pickup_since_previous?: number | null
          projected_occupancy_pct?: number | null
          public_rate?: number | null
          rooms_available?: number | null
          rooms_booked_otb?: number | null
          source_name?: string | null
          source_status?: string
        }
        Update: {
          arrival_date?: string
          booked_adr?: number | null
          booked_revenue?: number | null
          cancellations_since_previous?: number | null
          compset_rate?: number | null
          created_at?: string
          days_before_arrival?: number
          hotel_id?: string
          id?: string
          import_batch_id?: string | null
          observation_date?: string
          organization_id?: string
          pickup_since_previous?: number | null
          projected_occupancy_pct?: number | null
          public_rate?: number | null
          rooms_available?: number | null
          rooms_booked_otb?: number | null
          source_name?: string | null
          source_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_historical_demand_snapshots_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_historical_demand_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_historical_import_logs: {
        Row: {
          date_end: string | null
          date_start: string | null
          detected_columns: Json
          errors: Json
          file_name: string
          file_size_bytes: number | null
          hotel_id: string
          id: string
          import_status: string
          imported_at: string
          imported_by: string | null
          organization_id: string
          records_count: number
          rejected_count: number
          warnings: Json
        }
        Insert: {
          date_end?: string | null
          date_start?: string | null
          detected_columns?: Json
          errors?: Json
          file_name: string
          file_size_bytes?: number | null
          hotel_id: string
          id?: string
          import_status?: string
          imported_at?: string
          imported_by?: string | null
          organization_id: string
          records_count?: number
          rejected_count?: number
          warnings?: Json
        }
        Update: {
          date_end?: string | null
          date_start?: string | null
          detected_columns?: Json
          errors?: Json
          file_name?: string
          file_size_bytes?: number | null
          hotel_id?: string
          id?: string
          import_status?: string
          imported_at?: string
          imported_by?: string | null
          organization_id?: string
          records_count?: number
          rejected_count?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hotel_historical_import_logs_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_historical_import_logs_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_historical_import_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_inventory_snapshots: {
        Row: {
          closed_to_arrival: boolean | null
          closed_to_departure: boolean | null
          complimentary_rooms: number | null
          created_at: string
          currency: string
          current_bar: number | null
          hotel_id: string
          id: string
          ingestion_job_id: string | null
          min_stay: number | null
          occupancy_pct: number | null
          organization_id: string
          out_of_order_rooms: number | null
          raw_payload: Json
          room_type_id: string | null
          rooms_available: number | null
          rooms_sold: number | null
          sellable_rooms: number | null
          snapshot_at: string
          source_status: string
          source_system: string
          stay_date: string
          total_rooms: number | null
        }
        Insert: {
          closed_to_arrival?: boolean | null
          closed_to_departure?: boolean | null
          complimentary_rooms?: number | null
          created_at?: string
          currency?: string
          current_bar?: number | null
          hotel_id: string
          id?: string
          ingestion_job_id?: string | null
          min_stay?: number | null
          occupancy_pct?: number | null
          organization_id: string
          out_of_order_rooms?: number | null
          raw_payload?: Json
          room_type_id?: string | null
          rooms_available?: number | null
          rooms_sold?: number | null
          sellable_rooms?: number | null
          snapshot_at: string
          source_status?: string
          source_system: string
          stay_date: string
          total_rooms?: number | null
        }
        Update: {
          closed_to_arrival?: boolean | null
          closed_to_departure?: boolean | null
          complimentary_rooms?: number | null
          created_at?: string
          currency?: string
          current_bar?: number | null
          hotel_id?: string
          id?: string
          ingestion_job_id?: string | null
          min_stay?: number | null
          occupancy_pct?: number | null
          organization_id?: string
          out_of_order_rooms?: number | null
          raw_payload?: Json
          room_type_id?: string | null
          rooms_available?: number | null
          rooms_sold?: number | null
          sellable_rooms?: number | null
          snapshot_at?: string
          source_status?: string
          source_system?: string
          stay_date?: string
          total_rooms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_inventory_snapshots_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_inventory_snapshots_ingestion_job_same_hotel_fk"
            columns: ["ingestion_job_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "data_ingestion_jobs"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_inventory_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_inventory_snapshots_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_room_type_same_hotel_fk"
            columns: ["room_type_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
        ]
      }
      hotel_memberships: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          membership_role: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          id?: string
          membership_role?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          membership_role?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_memberships_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_parameters_profiles: {
        Row: {
          ceiling_rate: number | null
          compset_config: Json
          created_at: string
          currency: string
          demand_thresholds: Json
          distribution_cost_pct: number | null
          floor_rate: number | null
          hotel_id: string
          id: string
          max_daily_rate_change_pct: number | null
          organization_id: string
          room_type_config: Json
          target_adr: number | null
          target_occupancy_pct: number | null
          target_revpar: number | null
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ceiling_rate?: number | null
          compset_config?: Json
          created_at?: string
          currency?: string
          demand_thresholds?: Json
          distribution_cost_pct?: number | null
          floor_rate?: number | null
          hotel_id: string
          id?: string
          max_daily_rate_change_pct?: number | null
          organization_id: string
          room_type_config?: Json
          target_adr?: number | null
          target_occupancy_pct?: number | null
          target_revpar?: number | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ceiling_rate?: number | null
          compset_config?: Json
          created_at?: string
          currency?: string
          demand_thresholds?: Json
          distribution_cost_pct?: number | null
          floor_rate?: number | null
          hotel_id?: string
          id?: string
          max_daily_rate_change_pct?: number | null
          organization_id?: string
          room_type_config?: Json
          target_adr?: number | null
          target_occupancy_pct?: number | null
          target_revpar?: number | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_parameters_profiles_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_parameters_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_parameters_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_price_experiment_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          after_state: Json
          before_state: Json
          created_at: string
          experiment_id: string
          hotel_id: string
          id: string
          organization_id: string
          reason_code: string
          reason_text: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          after_state: Json
          before_state: Json
          created_at?: string
          experiment_id: string
          hotel_id: string
          id?: string
          organization_id: string
          reason_code: string
          reason_text?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          experiment_id?: string
          hotel_id?: string
          id?: string
          organization_id?: string
          reason_code?: string
          reason_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_price_experiment_audit__experiment_id_hotel_id_organ_fkey"
            columns: ["experiment_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_price_experiments"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_price_experiment_audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_price_experiment_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_price_experiment_observations: {
        Row: {
          assigned_price: number
          cancelled_rooms: number
          channel: string
          created_at: string
          currency: string
          evidence: Json
          experiment_id: string
          exposure_count: number
          group_type: string
          hotel_id: string
          id: string
          observed_at: string
          organization_id: string
          rate_plan_id: string | null
          revenue_net: number | null
          room_type_id: string | null
          rooms_sold: number
          source_name: string
          source_status: string
          stay_date: string
        }
        Insert: {
          assigned_price: number
          cancelled_rooms?: number
          channel: string
          created_at?: string
          currency: string
          evidence?: Json
          experiment_id: string
          exposure_count: number
          group_type: string
          hotel_id: string
          id?: string
          observed_at: string
          organization_id: string
          rate_plan_id?: string | null
          revenue_net?: number | null
          room_type_id?: string | null
          rooms_sold: number
          source_name: string
          source_status: string
          stay_date: string
        }
        Update: {
          assigned_price?: number
          cancelled_rooms?: number
          channel?: string
          created_at?: string
          currency?: string
          evidence?: Json
          experiment_id?: string
          exposure_count?: number
          group_type?: string
          hotel_id?: string
          id?: string
          observed_at?: string
          organization_id?: string
          rate_plan_id?: string | null
          revenue_net?: number | null
          room_type_id?: string | null
          rooms_sold?: number
          source_name?: string
          source_status?: string
          stay_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_price_experiment_observ_experiment_id_hotel_id_organ_fkey"
            columns: ["experiment_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_price_experiments"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_price_experiment_observ_rate_plan_id_hotel_id_organi_fkey"
            columns: ["rate_plan_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_rate_plans"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_price_experiment_observ_room_type_id_hotel_id_organi_fkey"
            columns: ["room_type_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_price_experiment_observatio_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_price_experiment_observations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_price_experiments: {
        Row: {
          assignment_unit: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          design: Json
          end_date: string
          experiment_code: string
          experiment_name: string
          experiment_status: string
          hotel_id: string
          hypothesis: string | null
          id: string
          organization_id: string
          randomization_evidence: Json | null
          randomization_method: string | null
          randomization_verified: boolean
          randomization_verified_at: string | null
          randomization_verified_by: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          assignment_unit: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          design?: Json
          end_date: string
          experiment_code: string
          experiment_name: string
          experiment_status?: string
          hotel_id: string
          hypothesis?: string | null
          id?: string
          organization_id: string
          randomization_evidence?: Json | null
          randomization_method?: string | null
          randomization_verified?: boolean
          randomization_verified_at?: string | null
          randomization_verified_by?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          assignment_unit?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          design?: Json
          end_date?: string
          experiment_code?: string
          experiment_name?: string
          experiment_status?: string
          hotel_id?: string
          hypothesis?: string | null
          id?: string
          organization_id?: string
          randomization_evidence?: Json | null
          randomization_method?: string | null
          randomization_verified?: boolean
          randomization_verified_at?: string | null
          randomization_verified_by?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_price_experiments_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_price_experiments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_price_experiments_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_price_experiments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_price_experiments_randomization_verified_by_fkey"
            columns: ["randomization_verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_rate_plan_observations: {
        Row: {
          availability_status: string
          created_at: string
          currency: string
          hotel_id: string
          id: string
          ingestion_job_id: string | null
          organization_id: string
          rate_amount: number | null
          rate_plan_id: string
          raw_payload: Json
          room_type_id: string
          snapshot_at: string
          source_status: string
          source_system: string
          stay_date: string
        }
        Insert: {
          availability_status: string
          created_at?: string
          currency?: string
          hotel_id: string
          id?: string
          ingestion_job_id?: string | null
          organization_id: string
          rate_amount?: number | null
          rate_plan_id: string
          raw_payload?: Json
          room_type_id: string
          snapshot_at: string
          source_status?: string
          source_system: string
          stay_date: string
        }
        Update: {
          availability_status?: string
          created_at?: string
          currency?: string
          hotel_id?: string
          id?: string
          ingestion_job_id?: string | null
          organization_id?: string
          rate_amount?: number | null
          rate_plan_id?: string
          raw_payload?: Json
          room_type_id?: string
          snapshot_at?: string
          source_status?: string
          source_system?: string
          stay_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rate_plan_observations_hotel_org_fk"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_rate_plan_observations_ingestion_job_same_hotel_fk"
            columns: ["ingestion_job_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "data_ingestion_jobs"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_rate_plan_observations_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rate_plan_observations_rate_plan_fk"
            columns: ["rate_plan_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_rate_plans"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_rate_plan_observations_room_type_fk"
            columns: ["room_type_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
        ]
      }
      hotel_rate_plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          hotel_id: string
          id: string
          is_active: boolean
          is_public: boolean
          meal_plan: string | null
          name: string
          organization_id: string
          refundable: boolean | null
          room_type_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          hotel_id: string
          id?: string
          is_active?: boolean
          is_public?: boolean
          meal_plan?: string | null
          name: string
          organization_id: string
          refundable?: boolean | null
          room_type_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          hotel_id?: string
          id?: string
          is_active?: boolean
          is_public?: boolean
          meal_plan?: string | null
          name?: string
          organization_id?: string
          refundable?: boolean | null
          room_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rate_plans_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_rate_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rate_plans_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_plans_room_type_same_hotel_fk"
            columns: ["room_type_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
        ]
      }
      hotel_reservation_snapshots: {
        Row: {
          booked_adr: number | null
          booked_revenue: number | null
          cancellation_count: number | null
          cancelled_rooms: number | null
          channel: string | null
          created_at: string
          currency: string
          hotel_id: string
          id: string
          lead_time_days: number | null
          moved_in_rooms: number
          moved_out_rooms: number
          net_pickup_rooms: number | null
          new_rooms_booked: number | null
          organization_id: string
          period_start: string | null
          pickup_window_hours: number | null
          room_nights_otb: number | null
          room_type_id: string | null
          rooms_otb: number | null
          segment: string | null
          snapshot_at: string
          source_status: string
          source_system: string
          stay_date: string
        }
        Insert: {
          booked_adr?: number | null
          booked_revenue?: number | null
          cancellation_count?: number | null
          cancelled_rooms?: number | null
          channel?: string | null
          created_at?: string
          currency?: string
          hotel_id: string
          id?: string
          lead_time_days?: number | null
          moved_in_rooms?: number
          moved_out_rooms?: number
          net_pickup_rooms?: number | null
          new_rooms_booked?: number | null
          organization_id: string
          period_start?: string | null
          pickup_window_hours?: number | null
          room_nights_otb?: number | null
          room_type_id?: string | null
          rooms_otb?: number | null
          segment?: string | null
          snapshot_at: string
          source_status?: string
          source_system: string
          stay_date: string
        }
        Update: {
          booked_adr?: number | null
          booked_revenue?: number | null
          cancellation_count?: number | null
          cancelled_rooms?: number | null
          channel?: string | null
          created_at?: string
          currency?: string
          hotel_id?: string
          id?: string
          lead_time_days?: number | null
          moved_in_rooms?: number
          moved_out_rooms?: number
          net_pickup_rooms?: number | null
          new_rooms_booked?: number | null
          organization_id?: string
          period_start?: string | null
          pickup_window_hours?: number | null
          room_nights_otb?: number | null
          room_type_id?: string | null
          rooms_otb?: number | null
          segment?: string | null
          snapshot_at?: string
          source_status?: string
          source_system?: string
          stay_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_reservation_snapshots_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_reservation_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_reservation_snapshots_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_room_type_same_hotel_fk"
            columns: ["room_type_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotel_room_types"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
        ]
      }
      hotel_room_types: {
        Row: {
          capacity: number | null
          code: string
          created_at: string
          hotel_id: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          rooms_count: number | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          code: string
          created_at?: string
          hotel_id: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          rooms_count?: number | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          code?: string
          created_at?: string
          hotel_id?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          rooms_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_room_types_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_room_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_settings_audit_logs: {
        Row: {
          action_type: string
          actor_user_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          hotel_id: string
          id: string
          organization_id: string
          reason_text: string | null
        }
        Insert: {
          action_type: string
          actor_user_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          hotel_id: string
          id?: string
          organization_id: string
          reason_text?: string | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          hotel_id?: string
          id?: string
          organization_id?: string
          reason_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_settings_audit_logs_actor_fk"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_settings_audit_logs_hotel_org_fk"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hotel_settings_audit_logs_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          base_adr: number | null
          city: string
          country: string
          created_at: string
          currency: string
          extended_radius_km: number
          group_name: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          main_radius_km: number
          max_rate_change_pct: number | null
          name: string
          organization_id: string
          rate_ceiling: number | null
          rate_floor: number | null
          room_count: number | null
          segment: string | null
          stars: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          base_adr?: number | null
          city: string
          country: string
          created_at?: string
          currency?: string
          extended_radius_km?: number
          group_name?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          main_radius_km?: number
          max_rate_change_pct?: number | null
          name: string
          organization_id: string
          rate_ceiling?: number | null
          rate_floor?: number | null
          room_count?: number | null
          segment?: string | null
          stars?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          base_adr?: number | null
          city?: string
          country?: string
          created_at?: string
          currency?: string
          extended_radius_km?: number
          group_name?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          main_radius_km?: number
          max_rate_change_pct?: number | null
          name?: string
          organization_id?: string
          rate_ceiling?: number | null
          rate_floor?: number | null
          room_count?: number | null
          segment?: string | null
          stars?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          connection_name: string
          connection_status: string
          created_at: string
          credential_secret_ref: string | null
          external_account_ref: string | null
          hotel_id: string
          id: string
          last_error_at: string | null
          last_error_code: string | null
          last_success_at: string | null
          organization_id: string
          provider: string
          settings: Json
          updated_at: string
        }
        Insert: {
          connection_name: string
          connection_status?: string
          created_at?: string
          credential_secret_ref?: string | null
          external_account_ref?: string | null
          hotel_id: string
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_success_at?: string | null
          organization_id: string
          provider: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          connection_name?: string
          connection_status?: string
          created_at?: string
          credential_secret_ref?: string | null
          external_account_ref?: string | null
          hotel_id?: string
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_success_at?: string | null
          organization_id?: string
          provider?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lighthouse_extractions: {
        Row: {
          created_at: string
          currency: string
          extraction_type: string
          file_name: string | null
          guests_count: number | null
          hotel_id: string
          id: string
          imported_by: string | null
          los_nights: number | null
          metadata: Json
          observed_at: string
          occupancy_context: string | null
          organization_id: string
          provider: string
          records_count: number
          source_status: string
          stay_end: string | null
          stay_start: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          extraction_type?: string
          file_name?: string | null
          guests_count?: number | null
          hotel_id: string
          id?: string
          imported_by?: string | null
          los_nights?: number | null
          metadata?: Json
          observed_at: string
          occupancy_context?: string | null
          organization_id: string
          provider?: string
          records_count?: number
          source_status?: string
          stay_end?: string | null
          stay_start?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          extraction_type?: string
          file_name?: string | null
          guests_count?: number | null
          hotel_id?: string
          id?: string
          imported_by?: string | null
          los_nights?: number | null
          metadata?: Json
          observed_at?: string
          occupancy_context?: string | null
          organization_id?: string
          provider?: string
          records_count?: number
          source_status?: string
          stay_end?: string | null
          stay_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lighthouse_extractions_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "lighthouse_extractions_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lighthouse_extractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lighthouse_market_observations: {
        Row: {
          compset_average: number | null
          compset_max: number | null
          compset_min: number | null
          created_at: string
          currency: string
          demand_evolution_1d: number | null
          demand_evolution_3d: number | null
          demand_evolution_7d: number | null
          demand_index: number | null
          demand_index_raw: number | null
          demand_index_scale: string
          extraction_id: string
          file_name: string | null
          guests_count: number | null
          hotel_availability_status: string | null
          hotel_id: string
          hotel_lowest_rate: number | null
          id: string
          ingestion_job_id: string | null
          los_nights: number | null
          market_median_rate: number | null
          market_rank: number | null
          market_rank_total: number | null
          observed_at: string
          organization_id: string
          raw_payload: Json
          source_channel: string
          source_hash: string | null
          source_status: string
          source_system: string
          stay_date: string
          total_available_hotels: number | null
          total_sold_out_hotels: number | null
        }
        Insert: {
          compset_average?: number | null
          compset_max?: number | null
          compset_min?: number | null
          created_at?: string
          currency?: string
          demand_evolution_1d?: number | null
          demand_evolution_3d?: number | null
          demand_evolution_7d?: number | null
          demand_index?: number | null
          demand_index_raw?: number | null
          demand_index_scale?: string
          extraction_id: string
          file_name?: string | null
          guests_count?: number | null
          hotel_availability_status?: string | null
          hotel_id: string
          hotel_lowest_rate?: number | null
          id?: string
          ingestion_job_id?: string | null
          los_nights?: number | null
          market_median_rate?: number | null
          market_rank?: number | null
          market_rank_total?: number | null
          observed_at: string
          organization_id: string
          raw_payload?: Json
          source_channel: string
          source_hash?: string | null
          source_status?: string
          source_system?: string
          stay_date: string
          total_available_hotels?: number | null
          total_sold_out_hotels?: number | null
        }
        Update: {
          compset_average?: number | null
          compset_max?: number | null
          compset_min?: number | null
          created_at?: string
          currency?: string
          demand_evolution_1d?: number | null
          demand_evolution_3d?: number | null
          demand_evolution_7d?: number | null
          demand_index?: number | null
          demand_index_raw?: number | null
          demand_index_scale?: string
          extraction_id?: string
          file_name?: string | null
          guests_count?: number | null
          hotel_availability_status?: string | null
          hotel_id?: string
          hotel_lowest_rate?: number | null
          id?: string
          ingestion_job_id?: string | null
          los_nights?: number | null
          market_median_rate?: number | null
          market_rank?: number | null
          market_rank_total?: number | null
          observed_at?: string
          organization_id?: string
          raw_payload?: Json
          source_channel?: string
          source_hash?: string | null
          source_status?: string
          source_system?: string
          stay_date?: string
          total_available_hotels?: number | null
          total_sold_out_hotels?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lighthouse_market_observations_extraction_fk"
            columns: ["extraction_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "lighthouse_extractions"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "lighthouse_market_observations_hotel_org_fk"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "lighthouse_market_observations_ingestion_job_fk"
            columns: ["ingestion_job_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "data_ingestion_jobs"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "lighthouse_market_observations_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lighthouse_rate_observations: {
        Row: {
          availability_status: string
          channel: string | null
          comparability: Json
          competitor_id: string | null
          competitor_name: string
          created_at: string
          currency: string
          extraction_id: string | null
          hotel_id: string
          id: string
          los: number | null
          observed_at: string
          organization_id: string
          pos: number | null
          rate_amount: number | null
          rate_plan: string | null
          room_type: string | null
          source_status: string
          stay_date: string
        }
        Insert: {
          availability_status: string
          channel?: string | null
          comparability?: Json
          competitor_id?: string | null
          competitor_name: string
          created_at?: string
          currency?: string
          extraction_id?: string | null
          hotel_id: string
          id?: string
          los?: number | null
          observed_at: string
          organization_id: string
          pos?: number | null
          rate_amount?: number | null
          rate_plan?: string | null
          room_type?: string | null
          source_status?: string
          stay_date: string
        }
        Update: {
          availability_status?: string
          channel?: string | null
          comparability?: Json
          competitor_id?: string | null
          competitor_name?: string
          created_at?: string
          currency?: string
          extraction_id?: string | null
          hotel_id?: string
          id?: string
          los?: number | null
          observed_at?: string
          organization_id?: string
          pos?: number | null
          rate_amount?: number | null
          rate_plan?: string | null
          room_type?: string | null
          source_status?: string
          stay_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "lighthouse_competitor_same_hotel_fk"
            columns: ["competitor_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "competitor_hotels"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "lighthouse_extraction_same_hotel_fk"
            columns: ["extraction_id", "hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "lighthouse_extractions"
            referencedColumns: ["id", "hotel_id", "organization_id"]
          },
          {
            foreignKeyName: "lighthouse_rate_observations_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitor_hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lighthouse_rate_observations_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "lighthouse_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lighthouse_rate_observations_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "lighthouse_rate_observations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      revenue_forecast_runs: {
        Row: {
          as_of: string
          created_at: string
          created_by: string | null
          error_message: string | null
          horizon_end: string
          horizon_start: string
          hotel_id: string
          id: string
          input_freshness: Json
          model_name: string
          model_version: string
          organization_id: string
          parameters: Json
          run_status: string
        }
        Insert: {
          as_of: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          horizon_end: string
          horizon_start: string
          hotel_id: string
          id?: string
          input_freshness?: Json
          model_name: string
          model_version: string
          organization_id: string
          parameters?: Json
          run_status?: string
        }
        Update: {
          as_of?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          horizon_end?: string
          horizon_start?: string
          hotel_id?: string
          id?: string
          input_freshness?: Json
          model_name?: string
          model_version?: string
          organization_id?: string
          parameters?: Json
          run_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_forecast_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_forecast_runs_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "revenue_forecast_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rm_decision_audit_logs: {
        Row: {
          action_type: string
          actor_user_id: string | null
          created_at: string
          final_rate: number | null
          hotel_id: string
          id: string
          organization_id: string
          previous_rate: number | null
          provider_result: Json | null
          rate_intelligence_id: string | null
          reason_code: string | null
          reason_text: string | null
          source_snapshot: Json
          stay_date: string
          suggested_rate: number | null
        }
        Insert: {
          action_type: string
          actor_user_id?: string | null
          created_at?: string
          final_rate?: number | null
          hotel_id: string
          id?: string
          organization_id: string
          previous_rate?: number | null
          provider_result?: Json | null
          rate_intelligence_id?: string | null
          reason_code?: string | null
          reason_text?: string | null
          source_snapshot?: Json
          stay_date: string
          suggested_rate?: number | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string | null
          created_at?: string
          final_rate?: number | null
          hotel_id?: string
          id?: string
          organization_id?: string
          previous_rate?: number | null
          provider_result?: Json | null
          rate_intelligence_id?: string | null
          reason_code?: string | null
          reason_text?: string | null
          source_snapshot?: Json
          stay_date?: string
          suggested_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rm_decision_audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_decision_audit_logs_hotel_id_organization_id_fkey"
            columns: ["hotel_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "rm_decision_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_decision_audit_logs_rate_intelligence_id_fkey"
            columns: ["rate_intelligence_id"]
            isOneToOne: false
            referencedRelation: "daily_rate_intelligence"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          organization_id?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          capacity: number | null
          city: string
          city_id: string | null
          country_code: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          official_website: string | null
          postal_code: string | null
          updated_at: string
          venue_type: string
          verification_status: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city: string
          city_id?: string | null
          country_code: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          official_website?: string | null
          postal_code?: string | null
          updated_at?: string
          venue_type: string
          verification_status?: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string
          city_id?: string | null
          country_code?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          official_website?: string | null
          postal_code?: string | null
          updated_at?: string
          venue_type?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      persist_rm_recommendation: {
        Args: {
          p_confidence_score: number
          p_currency: string
          p_current_bar: number
          p_data_quality_status: string
          p_delta_amount: number
          p_delta_pct: number
          p_demand_index: number
          p_demand_level: string
          p_engine_version: string
          p_evidence: Json
          p_explanation: string
          p_flowtym_compset_median: number
          p_hotel_id: string
          p_input_snapshot: Json
          p_lighthouse_median: number
          p_occupancy_pct: number
          p_organization_id: string
          p_pickup_24h: number
          p_pickup_3d: number
          p_pickup_7d: number
          p_rooms_remaining: number
          p_stay_date: string
          p_strategy_code: string
          p_suggested_bar: number
        }
        Returns: {
          id: string
          recommendation_status: string
        }[]
      }
      persist_rm_recommendation_v2: {
        Args: {
          p_confidence_score: number
          p_currency: string
          p_current_bar: number
          p_data_quality_status: string
          p_delta_amount: number
          p_delta_pct: number
          p_demand_index: number
          p_demand_level: string
          p_engine_version: string
          p_evidence: Json
          p_explanation: string
          p_flowtym_compset_median: number
          p_hotel_id: string
          p_input_snapshot: Json
          p_lighthouse_median: number
          p_occupancy_pct: number
          p_organization_id: string
          p_pickup_24h: number
          p_pickup_3d: number
          p_pickup_7d: number
          p_rate_plan_id: string
          p_room_type_id: string
          p_rooms_remaining: number
          p_stay_date: string
          p_strategy_code: string
          p_suggested_bar: number
        }
        Returns: {
          id: string
          recommendation_status: string
        }[]
      }
      record_event_impact_decision: {
        Args: {
          p_action: string
          p_hotel_id: string
          p_impact_id: string
          p_reason_code: string
          p_reason_text?: string
        }
        Returns: {
          id: string
          impact_status: string
        }[]
      }
      record_rm_decision: {
        Args: {
          p_action: string
          p_applied_min_stay?: number
          p_applied_rate?: number
          p_hotel_id: string
          p_rate_intelligence_id: string
          p_reason_code?: string
          p_reason_text?: string
        }
        Returns: {
          approved_min_stay: number | null
          approved_rate: number | null
          compset_max: number | null
          compset_min: number | null
          confidence_score: number | null
          created_at: string
          currency: string
          current_bar: number | null
          data_quality_status: string
          decision_at: string | null
          decision_by: string | null
          delta_amount: number | null
          delta_pct: number | null
          demand_index: number | null
          demand_level: string | null
          engine_version: string
          evidence: Json
          explanation: string | null
          flowtym_compset_median: number | null
          forecast_occupancy_p10: number | null
          forecast_occupancy_p50: number | null
          forecast_occupancy_p90: number | null
          hotel_id: string
          id: string
          input_snapshot: Json
          lighthouse_median: number | null
          occupancy_pct: number | null
          organization_id: string
          pickup_24h: number | null
          pickup_3d: number | null
          pickup_7d: number | null
          rate_plan_id: string | null
          recommendation_status: string
          room_type_id: string | null
          rooms_remaining: number | null
          stay_date: string
          strategy_code: string | null
          suggested_bar: number | null
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "daily_rate_intelligence"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_price_experiment: {
        Args: {
          p_action: string
          p_evidence?: Json
          p_experiment_id: string
          p_hotel_id: string
          p_reason_code: string
          p_reason_text?: string
        }
        Returns: {
          experiment_status: string
          id: string
          randomization_verified: boolean
        }[]
      }
      update_hotel_coordinates: {
        Args: { p_hotel_id: string; p_lat: number; p_lng: number }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
