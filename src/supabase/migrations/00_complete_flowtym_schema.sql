-- ==============================================================================
-- FLOWTYM RMS & EVENT INTELLIGENCE — ARCHITECTURE BASE DE DONNÉES ENTREPRISE
-- PostgreSQL 15/16 / Supabase — Multi-Tenant SaaS Hôtelier & Revenue Management
-- Projet cible : https://aliploqizujgovnlgjvg.supabase.co
-- Script 100% idempotent : exécutable directement dans le SQL Editor Supabase
-- ==============================================================================

-- ==============================================================================
-- 0. EXTENSIONS & FONCTIONS UTILITAIRES DE BASE
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Protection d'immutabilité pour le journal d'audit légal (append-only)
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Les enregistrements d''audit sont immuables (UPDATE/DELETE interdit).';
END;
$$ LANGUAGE plpgsql;

-- Calcul de distance géodésique Haversine en km (indépendant du schéma PostGIS)
CREATE OR REPLACE FUNCTION public.haversine_distance_km(
    lat1 NUMERIC,
    lng1 NUMERIC,
    lat2 NUMERIC,
    lng2 NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    r NUMERIC := 6371.0;
    dlat NUMERIC;
    dlng NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
        RETURN NULL;
    END IF;
    dlat := RADIANS(lat2 - lat1);
    dlng := RADIANS(lng2 - lng1);
    a := SIN(dlat / 2) * SIN(dlat / 2)
       + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlng / 2) * SIN(dlng / 2);
    c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
    RETURN ROUND((r * c)::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================================================
-- 1. SOCLE MULTI-TENANT, UTILISATEURS & RBAC HÔTELIER
-- ==============================================================================

-- 1.1 Organisations (Groupes hôteliers / Tenants)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'enterprise'
        CHECK (subscription_tier IN ('starter', 'pro', 'enterprise')),
    billing_email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 1.2 Utilisateurs applicatifs & profils RBAC
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'revenue_manager'
        CHECK (role IN ('super_admin', 'admin', 'head_of_rm', 'revenue_manager', 'general_manager', 'analyst', 'viewer')),
    allowed_hotel_ids JSONB NOT NULL DEFAULT '"all"'::jsonb,
    permissions JSONB NOT NULL DEFAULT '{"canApproveRates":true,"canEditCompset":true,"canEditRMRules":true,"canManageUsers":false,"canExportData":true}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 1.3 Droits d'accès granulaires Utilisateur <-> Hôtel
CREATE TABLE IF NOT EXISTS public.user_hotel_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL, -- FK ajoutée après création de public.hotels
    access_role VARCHAR(50) NOT NULL DEFAULT 'revenue_manager'
        CHECK (access_role IN ('admin', 'revenue_manager', 'general_manager', 'analyst', 'viewer')),
    can_approve_rates BOOLEAN NOT NULL DEFAULT TRUE,
    can_edit_compset BOOLEAN NOT NULL DEFAULT TRUE,
    can_edit_rules BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, hotel_id)
);

-- ==============================================================================
-- 2. PARC HÔTELIER, TYPOLOGIES DE CHAMBRES & PLANS TARIFAIRES
-- ==============================================================================

-- 2.1 Établissements Hôteliers
CREATE TABLE IF NOT EXISTS public.hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(100) UNIQUE, -- ex: hotel-opera, hotel-marais, hotel-lyon
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    group_name VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL DEFAULT 'France',
    country_code VARCHAR(3) NOT NULL DEFAULT 'FRA',
    address TEXT,
    lat NUMERIC(9,6) NOT NULL,
    lng NUMERIC(9,6) NOT NULL,
    stars INTEGER CHECK (stars BETWEEN 1 AND 5),
    room_count INTEGER NOT NULL CHECK (room_count > 0),
    segment VARCHAR(50) NOT NULL DEFAULT 'Boutique'
        CHECK (segment IN ('Luxe', 'Boutique', 'Affaires', 'Économique', 'Economique', 'Resort')),
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    base_adr NUMERIC(10,2) NOT NULL DEFAULT 220.00 CHECK (base_adr > 0),
    rate_floor_eur NUMERIC(10,2) NOT NULL DEFAULT 180.00 CHECK (rate_floor_eur >= 0),
    rate_ceiling_eur NUMERIC(10,2) NOT NULL DEFAULT 550.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_hotel_floor_ceiling CHECK (rate_ceiling_eur >= rate_floor_eur)
);

-- FK différée sur user_hotel_access -> hotels
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_hotel_access_hotel'
    ) THEN
        ALTER TABLE public.user_hotel_access
            ADD CONSTRAINT fk_user_hotel_access_hotel
            FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2.2 Typologies de Chambres (inventaire physique par catégorie)
CREATE TABLE IF NOT EXISTS public.room_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(120) UNIQUE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- classique, superieure, deluxe_famille, suite
    name VARCHAR(150) NOT NULL,
    total_rooms INTEGER NOT NULL CHECK (total_rooms > 0),
    base_offset_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_offset_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    weight_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    max_occupancy INTEGER NOT NULL DEFAULT 2 CHECK (max_occupancy BETWEEN 1 AND 10),
    is_base_room_type BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(hotel_id, code)
);

-- 2.3 Plans Tarifaires & Dérivations (BAR, Non-Remboursable, PDJ, Corporate, OTA)
CREATE TABLE IF NOT EXISTS public.rate_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- BAR, NRF, BB, CORP, PROMO_OTA
    name VARCHAR(150) NOT NULL,
    plan_type VARCHAR(30) NOT NULL DEFAULT 'BAR'
        CHECK (plan_type IN ('BAR', 'NRF', 'BB', 'CORP', 'OTA_PROMO', 'PACKAGE', 'GROUP')),
    parent_rate_plan_id UUID REFERENCES public.rate_plans(id) ON DELETE SET NULL,
    derivation_type VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (derivation_type IN ('manual', 'percent', 'fixed')),
    derivation_value NUMERIC(10,2) NOT NULL DEFAULT 0.00, -- ex: -10.00 (%) ou +25.00 (EUR)
    cancellation_policy VARCHAR(50) NOT NULL DEFAULT 'Flexible'
        CHECK (cancellation_policy IN ('Flexible', 'Semi-flexible', 'Non-annulable')),
    breakfast_included BOOLEAN NOT NULL DEFAULT FALSE,
    is_commissionable BOOLEAN NOT NULL DEFAULT TRUE,
    default_commission_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    is_yieldable BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(hotel_id, code)
);

-- 2.4 Segments de Marché & Canaux de Distribution (référentiel organisation)
CREATE TABLE IF NOT EXISTS public.market_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- LEISURE_IND, CORP_IND, GROUP_MICE, OTA_PROMO
    name VARCHAR(150) NOT NULL,
    macro_segment VARCHAR(30) NOT NULL
        CHECK (macro_segment IN ('transient', 'corporate', 'group', 'mice', 'other')),
    avg_commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS public.distribution_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- DIRECT_WEB, BOOKING, EXPEDIA, GDS, CORPORATE_DIRECT
    name VARCHAR(150) NOT NULL,
    channel_type VARCHAR(30) NOT NULL
        CHECK (channel_type IN ('direct', 'ota', 'gds', 'wholesaler', 'direct_corp')),
    commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (commission_pct BETWEEN 0 AND 100),
    distribution_cost_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(organization_id, code)
);

-- ==============================================================================
-- 3. RÉFÉRENTIEL GÉOGRAPHIQUE & VEILLE ÉVÉNEMENTIELLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'France',
    region VARCHAR(100),
    commune VARCHAR(150),
    postal_code VARCHAR(20),
    lat NUMERIC(9,6) NOT NULL,
    lng NUMERIC(9,6) NOT NULL,
    coverage_score NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, country)
);

CREATE TABLE IF NOT EXISTS public.venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(150) UNIQUE,
    city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    venue_type VARCHAR(100) NOT NULL DEFAULT 'parc_expositions',
    capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
    address TEXT,
    commune VARCHAR(150),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'France',
    lat NUMERIC(9,6) NOT NULL,
    lng NUMERIC(9,6) NOT NULL,
    official_website TEXT,
    is_verified BOOLEAN DEFAULT TRUE,
    discovered_via VARCHAR(100) DEFAULT 'system_seed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hotel_geo_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) UNIQUE NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    main_radius_km NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    extended_radius_km NUMERIC(5,2) NOT NULL DEFAULT 45.00,
    distance_unit VARCHAR(10) NOT NULL DEFAULT 'km',
    territory_scope VARCHAR(50) DEFAULT 'metropole_standard',
    territory_name VARCHAR(150),
    strict_territory_isolation BOOLEAN NOT NULL DEFAULT TRUE,
    allow_justified_economic_exception BOOLEAN NOT NULL DEFAULT FALSE,
    economic_exception_min_attendance INTEGER DEFAULT 150000,
    auto_discover_venues BOOLEAN NOT NULL DEFAULT TRUE,
    auto_discover_sources BOOLEAN NOT NULL DEFAULT TRUE,
    auto_discover_events BOOLEAN NOT NULL DEFAULT TRUE,
    include_neighboring_cities BOOLEAN NOT NULL DEFAULT TRUE,
    multilingual_search BOOLEAN NOT NULL DEFAULT TRUE,
    enabled_category_codes TEXT[] DEFAULT '{}',
    last_search_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_search_scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 day'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hotel_venue_distances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    distance_km NUMERIC(6,2) NOT NULL,
    drive_time_mins INTEGER,
    transit_time_mins INTEGER,
    zone VARCHAR(30) NOT NULL CHECK (zone IN ('main_10km', 'extended_30km', 'out_of_radius')),
    commune VARCHAR(150),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hotel_id, venue_id)
);

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(150) UNIQUE,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    category VARCHAR(100) NOT NULL,
    venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
    venue_name VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'France',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    impact_level VARCHAR(50) DEFAULT 'modere',
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency VARCHAR(50),
    historical_growth VARCHAR(100),
    expected_attendance INTEGER DEFAULT 0,
    international_ratio NUMERIC(5,2) DEFAULT 0.00,
    score_breakdown JSONB DEFAULT '{}'::jsonb,
    final_rm_score INTEGER DEFAULT 0 CHECK (final_rm_score BETWEEN 0 AND 100),
    confidence_score NUMERIC(5,2) DEFAULT 95.00,
    sources TEXT[] DEFAULT '{}',
    official_url TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_watchlist BOOLEAN DEFAULT FALSE,
    is_yield_active BOOLEAN DEFAULT FALSE,
    is_anomaly BOOLEAN DEFAULT FALSE,
    notes TEXT,
    last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_events_date_range CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.event_occurrences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_date_confirmed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, start_date, end_date),
    CONSTRAINT chk_event_occ_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.event_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(150) UNIQUE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    source_type VARCHAR(100) NOT NULL DEFAULT 'official_organizer',
    category VARCHAR(100),
    city VARCHAR(100),
    reliability_score NUMERIC(5,2) DEFAULT 90.00,
    last_crawled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'healthy',
    detected_events_count INTEGER DEFAULT 0,
    is_official BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    source_id UUID REFERENCES public.event_sources(id) ON DELETE SET NULL,
    source_name VARCHAR(255),
    source_url TEXT,
    source_type VARCHAR(100),
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    excerpt TEXT NOT NULL,
    proof_url TEXT,
    trust_score NUMERIC(5,2) DEFAULT 95.00
);

CREATE TABLE IF NOT EXISTS public.event_hotel_impacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    distance_km NUMERIC(6,2) NOT NULL,
    distance_mins INTEGER NOT NULL,
    direct_demand_share NUMERIC(5,2) DEFAULT 0.00,
    compression_index INTEGER CHECK (compression_index BETWEEN 1 AND 10),
    rm_score INTEGER CHECK (rm_score BETWEEN 0 AND 100),
    recommended_action TEXT,
    estimated_adr_boost_percent NUMERIC(5,2) DEFAULT 0.00,
    min_stay_recommended INTEGER DEFAULT 1,
    stop_sell_suggested BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, hotel_id)
);

CREATE TABLE IF NOT EXISTS public.event_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(150) UNIQUE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    category VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    venue_name VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    expected_attendance INTEGER DEFAULT 0,
    score INTEGER CHECK (score BETWEEN 0 AND 100),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused')),
    detected_source TEXT,
    impact_level VARCHAR(50) DEFAULT 'modere',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(150) UNIQUE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    venue_name VARCHAR(255),
    suggested_start_date DATE NOT NULL,
    suggested_end_date DATE NOT NULL,
    detected_via TEXT NOT NULL,
    confidence NUMERIC(5,2) NOT NULL,
    reason TEXT NOT NULL,
    impact_predicted VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 4. COEUR PMS / CRS : RÉSERVATIONS, NUITÉES, OTB & COURBES DE PICKUP
-- ==============================================================================

-- 4.1 Dossiers de réservation (alimentation PMS / D-EDGE)
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    pms_reservation_id VARCHAR(120) NOT NULL,
    booking_date DATE NOT NULL,
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    nights INTEGER GENERATED ALWAYS AS (departure_date - arrival_date) STORED,
    room_type_id UUID REFERENCES public.room_types(id) ON DELETE SET NULL,
    rate_plan_id UUID REFERENCES public.rate_plans(id) ON DELETE SET NULL,
    segment_id UUID REFERENCES public.market_segments(id) ON DELETE SET NULL,
    channel_id UUID REFERENCES public.distribution_channels(id) ON DELETE SET NULL,
    rooms_count INTEGER NOT NULL DEFAULT 1 CHECK (rooms_count > 0),
    adults_count INTEGER NOT NULL DEFAULT 2 CHECK (adults_count >= 0),
    children_count INTEGER NOT NULL DEFAULT 0 CHECK (children_count >= 0),
    total_accommodation_eur NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_accommodation_eur >= 0),
    total_net_revenue_eur NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_net_revenue_eur >= 0),
    adr_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (adr_eur >= 0),
    lead_time_days INTEGER GENERATED ALWAYS AS (arrival_date - booking_date) STORED,
    status VARCHAR(30) NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    source_system VARCHAR(50) NOT NULL DEFAULT 'D-EDGE CRS',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(hotel_id, pms_reservation_id),
    CONSTRAINT chk_res_stay_dates CHECK (departure_date > arrival_date)
);

-- 4.2 Ventilation nuitée par nuitée (calcul exact RevPAR / ADR / Mix journalier)
CREATE TABLE IF NOT EXISTS public.reservation_stay_nights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    stay_date DATE NOT NULL,
    room_type_id UUID REFERENCES public.room_types(id) ON DELETE SET NULL,
    rate_plan_id UUID REFERENCES public.rate_plans(id) ON DELETE SET NULL,
    segment_id UUID REFERENCES public.market_segments(id) ON DELETE SET NULL,
    channel_id UUID REFERENCES public.distribution_channels(id) ON DELETE SET NULL,
    room_nights INTEGER NOT NULL DEFAULT 1 CHECK (room_nights > 0),
    gross_rate_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_rate_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    distribution_cost_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    is_active_otb BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(reservation_id, stay_date)
);

-- 4.3 Snapshots quotidiens OTB & Pickup (Pace curves par date d'observation)
CREATE TABLE IF NOT EXISTS public.otb_pace_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    stay_date DATE NOT NULL,
    room_type_id UUID REFERENCES public.room_types(id) ON DELETE CASCADE,
    days_before_arrival INTEGER GENERATED ALWAYS AS (stay_date - snapshot_date) STORED,
    rooms_capacity INTEGER NOT NULL CHECK (rooms_capacity > 0),
    rooms_ooo INTEGER NOT NULL DEFAULT 0 CHECK (rooms_ooo >= 0),
    rooms_sold_otb INTEGER NOT NULL DEFAULT 0 CHECK (rooms_sold_otb >= 0),
    rooms_available INTEGER NOT NULL DEFAULT 0 CHECK (rooms_available >= 0),
    occupancy_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (occupancy_pct BETWEEN 0 AND 100),
    otb_revenue_eur NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    otb_adr_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    pickup_1d INTEGER NOT NULL DEFAULT 0,
    pickup_3d INTEGER NOT NULL DEFAULT 0,
    pickup_7d INTEGER NOT NULL DEFAULT 0,
    pickup_14d INTEGER NOT NULL DEFAULT 0,
    pickup_30d INTEGER NOT NULL DEFAULT 0,
    cancellations_1d INTEGER NOT NULL DEFAULT 0,
    turnaways_1d INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(hotel_id, snapshot_date, stay_date, room_type_id)
);

-- 4.4 Inventaire temps réel D-EDGE CRS
CREATE TABLE IF NOT EXISTS public.dedge_inventory_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    date_str DATE NOT NULL,
    total_rooms INTEGER NOT NULL,
    rooms_sold INTEGER NOT NULL,
    rooms_available INTEGER NOT NULL,
    occupancy_percent NUMERIC(5,2) NOT NULL,
    current_bar NUMERIC(10,2) NOT NULL,
    pickup_24h INTEGER DEFAULT 0,
    pickup_72h INTEGER DEFAULT 0,
    pickup_7d INTEGER DEFAULT 0,
    cancellations_24h INTEGER DEFAULT 0,
    booking_velocity VARCHAR(30) DEFAULT 'normale',
    min_stay_restriction INTEGER DEFAULT 1,
    stop_sell_active BOOLEAN DEFAULT FALSE,
    average_lead_time_days NUMERIC(6,1) DEFAULT 14.0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(external_hotel_id, date_str)
);

-- ==============================================================================
-- 5. MOTEUR REVENUE MANAGEMENT : SAISONNALITÉ, GARDE-FOUS, PRICING, COMPSET & ARI
-- ==============================================================================

-- 5.1 Calendriers de saisonnalité par hôtel
CREATE TABLE IF NOT EXISTS public.season_calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    season_type VARCHAR(30) NOT NULL
        CHECK (season_type IN ('basse', 'moyenne', 'haute', 'pic', 'evenement_majeur')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    target_occupancy_pct NUMERIC(5,2) NOT NULL DEFAULT 75.00,
    adr_multiplier NUMERIC(5,3) NOT NULL DEFAULT 1.000,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_season_dates CHECK (end_date >= start_date)
);

-- 5.2 Garde-fous tarifaires stricts (par hôtel et optionnellement par typologie)
CREATE TABLE IF NOT EXISTS public.pricing_guardrails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    room_type_id UUID REFERENCES public.room_types(id) ON DELETE CASCADE,
    min_rate_eur NUMERIC(10,2) NOT NULL DEFAULT 180.00 CHECK (min_rate_eur >= 0),
    max_rate_eur NUMERIC(10,2) NOT NULL DEFAULT 550.00,
    max_daily_step_eur NUMERIC(10,2) NOT NULL DEFAULT 120.00 CHECK (max_daily_step_eur > 0),
    max_daily_step_pct NUMERIC(5,2) NOT NULL DEFAULT 38.00 CHECK (max_daily_step_pct > 0),
    compset_max_spread_eur NUMERIC(10,2) NOT NULL DEFAULT 80.00,
    require_human_approval BOOLEAN NOT NULL DEFAULT TRUE,
    auto_stop_sell_score_threshold INTEGER NOT NULL DEFAULT 85 CHECK (auto_stop_sell_score_threshold BETWEEN 0 AND 100),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(hotel_id, room_type_id),
    CONSTRAINT chk_guardrail_bounds CHECK (max_rate_eur >= min_rate_eur)
);

-- 5.3 Règles de calibration apprises (apprentissage contrôlé & réversible)
CREATE TABLE IF NOT EXISTS public.learned_calibration_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    rule_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'yield_override',
    condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    adjustment_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    adjustment_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    confidence_weight NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    sample_count INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_reversible BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reverted_at TIMESTAMP WITH TIME ZONE
);

-- 5.4 Grille centrale de Recommandations Tarifaires Journalières (21 colonnes RM)
CREATE TABLE IF NOT EXISTS public.daily_rate_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    stay_date DATE NOT NULL,
    room_type_id UUID REFERENCES public.room_types(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL,
    is_weekend BOOLEAN NOT NULL DEFAULT FALSE,
    demand_index INTEGER NOT NULL CHECK (demand_index BETWEEN 0 AND 100),
    demand_level VARCHAR(30) NOT NULL
        CHECK (demand_level IN ('faible', 'modere', 'normal', 'eleve', 'tres_fort', 'exceptionnel')),
    current_bar_eur NUMERIC(10,2) NOT NULL CHECK (current_bar_eur > 0),
    current_min_stay INTEGER NOT NULL DEFAULT 1,
    current_stop_sell BOOLEAN NOT NULL DEFAULT FALSE,
    lighthouse_median_eur NUMERIC(10,2),
    flowtym_median_eur NUMERIC(10,2),
    compset_min_eur NUMERIC(10,2),
    compset_max_eur NUMERIC(10,2),
    compset_avg_eur NUMERIC(10,2),
    compset_sold_out_count INTEGER NOT NULL DEFAULT 0,
    compset_total_count INTEGER NOT NULL DEFAULT 10,
    my_compset_rank INTEGER,
    total_rooms INTEGER NOT NULL DEFAULT 45,
    remaining_rooms INTEGER NOT NULL DEFAULT 0 CHECK (remaining_rooms >= 0),
    rooms_sold_otb INTEGER NOT NULL DEFAULT 0 CHECK (rooms_sold_otb >= 0),
    occupancy_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (occupancy_percent BETWEEN 0 AND 100),
    pickup_24h INTEGER NOT NULL DEFAULT 0,
    pickup_3d INTEGER NOT NULL DEFAULT 0,
    pickup_7d INTEGER NOT NULL DEFAULT 0,
    booking_pace VARCHAR(50) NOT NULL DEFAULT 'normale',
    adr_net_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    revpar_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    lead_time_days_avg NUMERIC(6,1) NOT NULL DEFAULT 14.0,
    suggested_bar_eur NUMERIC(10,2) NOT NULL CHECK (suggested_bar_eur > 0),
    delta_vs_current_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    delta_vs_current_pct NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    strategy_code VARCHAR(50) NOT NULL DEFAULT 'equilibre',
    strategy_label VARCHAR(120) NOT NULL DEFAULT 'Équilibre RevPAR',
    justification_epistemic JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_score INTEGER NOT NULL DEFAULT 85 CHECK (confidence_score BETWEEN 0 AND 100),
    safety_alert_type VARCHAR(50),
    validation_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (validation_status IN ('pending', 'accepted', 'modified', 'rejected', 'postponed')),
    applied_bar_eur NUMERIC(10,2),
    applied_min_stay INTEGER,
    decision_reason_code VARCHAR(50),
    decision_note TEXT,
    decided_by VARCHAR(255),
    decided_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(hotel_id, stay_date, room_type_id)
);

-- 5.5 Restrictions ARI journalières (MinLOS, MaxLOS, CTA, CTD, Stop-Sell)
CREATE TABLE IF NOT EXISTS public.daily_restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    stay_date DATE NOT NULL,
    room_type_id UUID REFERENCES public.room_types(id) ON DELETE CASCADE,
    rate_plan_id UUID REFERENCES public.rate_plans(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES public.distribution_channels(id) ON DELETE CASCADE,
    min_los INTEGER NOT NULL DEFAULT 1 CHECK (min_los >= 1),
    max_los INTEGER,
    cta BOOLEAN NOT NULL DEFAULT FALSE,
    ctd BOOLEAN NOT NULL DEFAULT FALSE,
    stop_sell BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(hotel_id, stay_date, room_type_id, rate_plan_id, channel_id)
);

-- 5.6 CompSet (10 concurrents max par hôtel) & Relevés Lighthouse / Parité
CREATE TABLE IF NOT EXISTS public.competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(150) UNIQUE,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    stars INTEGER CHECK (stars BETWEEN 1 AND 5),
    city VARCHAR(100) NOT NULL,
    distance_km NUMERIC(6,2) DEFAULT 0.5,
    default_room_type VARCHAR(100) DEFAULT 'Classique',
    cancellation_policy VARCHAR(50) DEFAULT 'Flexible',
    breakfast_included BOOLEAN DEFAULT FALSE,
    is_fully_comparable BOOLEAN DEFAULT TRUE,
    non_comparable_reason TEXT,
    base_rate_eur NUMERIC(10,2) NOT NULL DEFAULT 250.00,
    color VARCHAR(20) DEFAULT '#3b82f6',
    weight NUMERIC(4,2) DEFAULT 1.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rate_shop_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'lighthouse'
        CHECK (provider IN ('lighthouse', 'excel_import', 'manual')),
    file_name VARCHAR(255),
    horizon_days INTEGER NOT NULL DEFAULT 90,
    records_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'completed'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lighthouse_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES public.rate_shop_batches(id) ON DELETE SET NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    competitor_name VARCHAR(255) NOT NULL,
    date_str DATE NOT NULL,
    room_type VARCHAR(100) DEFAULT 'Classique',
    rate_plan VARCHAR(100) DEFAULT 'BAR',
    rate_eur NUMERIC(10,2), -- STRICTEMENT NULL si épuisé / indisponible (jamais 0)
    currency VARCHAR(10) DEFAULT 'EUR',
    is_sold_out BOOLEAN DEFAULT FALSE,
    availability_status VARCHAR(50) DEFAULT 'disponible'
        CHECK (availability_status IN ('disponible', 'epuise', 'restriction', 'non_disponible')),
    is_comparable BOOLEAN DEFAULT TRUE,
    cancellation_policy VARCHAR(50) DEFAULT 'Flexible',
    breakfast_included BOOLEAN DEFAULT FALSE,
    pos VARCHAR(100) DEFAULT 'Booking.com',
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delta_percent_vs_prior NUMERIC(6,2) DEFAULT 0.00,
    rate_delta_1d_eur NUMERIC(10,2),
    rate_delta_3d_eur NUMERIC(10,2),
    rate_delta_7d_eur NUMERIC(10,2),
    UNIQUE(external_hotel_id, competitor_name, date_str, room_type, rate_plan)
);

CREATE TABLE IF NOT EXISTS public.rate_parity_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    stay_date DATE NOT NULL,
    direct_bar_eur NUMERIC(10,2) NOT NULL,
    lowest_ota_channel VARCHAR(100) NOT NULL,
    lowest_ota_rate_eur NUMERIC(10,2) NOT NULL,
    parity_gap_eur NUMERIC(10,2) GENERATED ALWAYS AS (lowest_ota_rate_eur - direct_bar_eur) STORED,
    parity_status VARCHAR(30) NOT NULL DEFAULT 'ok'
        CHECK (parity_status IN ('ok', 'undercut_minor', 'undercut_critical', 'ota_higher')),
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(hotel_id, stay_date, lowest_ota_channel)
);

-- 5.7 Paramétrage RMS, Alertes & Décisions
CREATE TABLE IF NOT EXISTS public.hotel_rms_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) UNIQUE NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    room_typologies JSONB NOT NULL DEFAULT '[]'::jsonb,
    rm_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    comp_set JSONB NOT NULL DEFAULT '[]'::jsonb,
    comp_set_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_watch JSONB NOT NULL DEFAULT '{}'::jsonb,
    notifications JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rm_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(150) UNIQUE,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    event_id VARCHAR(150),
    event_title VARCHAR(255) NOT NULL,
    venue_name VARCHAR(255),
    category VARCHAR(100) NOT NULL,
    date_str DATE NOT NULL,
    demand_level VARCHAR(50) NOT NULL,
    current_rate NUMERIC(10,2) NOT NULL,
    recommended_rate NUMERIC(10,2) NOT NULL,
    gap_eur NUMERIC(10,2) NOT NULL,
    gap_percent NUMERIC(6,2) NOT NULL,
    confidence_score NUMERIC(5,2) NOT NULL,
    sources TEXT[] DEFAULT '{}',
    urgency VARCHAR(50) NOT NULL DEFAULT 'moyenne',
    status VARCHAR(50) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'accepted', 'modified', 'rejected', 'postponed')),
    reason TEXT NOT NULL,
    compression_factor TEXT,
    compset_average_rate NUMERIC(10,2),
    sold_out_competitors_count INTEGER DEFAULT 0,
    min_stay_recommended INTEGER DEFAULT 1,
    cta_recommended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rm_decision_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(150) UNIQUE,
    alert_id VARCHAR(150) NOT NULL,
    event_id VARCHAR(150),
    event_title VARCHAR(255) NOT NULL,
    date_str DATE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL,
    external_hotel_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('accepted', 'modified', 'rejected', 'postponed')),
    original_current_rate NUMERIC(10,2) NOT NULL,
    recommended_rate NUMERIC(10,2) NOT NULL,
    applied_rate NUMERIC(10,2) NOT NULL,
    comment TEXT,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    decided_by VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.major_event_email_alert_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) UNIQUE NOT NULL DEFAULT 'global',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    min_score INTEGER NOT NULL DEFAULT 70 CHECK (min_score BETWEEN 0 AND 100),
    send_time VARCHAR(10) NOT NULL DEFAULT '07:30',
    frequency VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', 'weekly')),
    recipients TEXT[] NOT NULL DEFAULT ARRAY['WaliLarabi@gmail.com'],
    include_ongoing BOOLEAN NOT NULL DEFAULT TRUE,
    horizon_days INTEGER NOT NULL DEFAULT 60,
    include_yield_recommendations BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.major_event_email_alert_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(150) UNIQUE,
    config_id UUID REFERENCES public.major_event_email_alert_configs(id) ON DELETE CASCADE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recipients TEXT[] NOT NULL DEFAULT '{}',
    events_count INTEGER NOT NULL DEFAULT 0,
    min_score INTEGER NOT NULL DEFAULT 70,
    top_event_title VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'sent'
);

-- 5.8 File d'attente transactionnelle ARI Push (Channel Manager D-EDGE / CRS)
CREATE TABLE IF NOT EXISTS public.ari_push_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'dedge_crs',
    stay_date_start DATE NOT NULL,
    stay_date_end DATE NOT NULL,
    payload JSONB NOT NULL,
    idempotency_key VARCHAR(180) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'retrying')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    triggered_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================
-- 6. DONNÉES HISTORIQUES, BACKTESTING & AUDIT LÉGAL IMMUTABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.hotel_historical_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    date_stay DATE NOT NULL,
    day_of_week VARCHAR(20) NOT NULL,
    week_of_year INTEGER NOT NULL CHECK (week_of_year BETWEEN 1 AND 54),
    month_of_year INTEGER NOT NULL CHECK (month_of_year BETWEEN 1 AND 12),
    year_of_stay INTEGER NOT NULL CHECK (year_of_stay BETWEEN 2000 AND 2100),
    is_holiday BOOLEAN DEFAULT FALSE,
    is_school_holiday BOOLEAN DEFAULT FALSE,
    school_holiday_zone VARCHAR(50),
    is_holiday_eve BOOLEAN DEFAULT FALSE,
    season VARCHAR(20) DEFAULT 'Moyenne',
    day_type VARCHAR(20) DEFAULT 'Semaine',
    event_name VARCHAR(255),
    event_category VARCHAR(100),
    event_start_date DATE,
    event_end_date DATE,
    event_duration_days INTEGER,
    event_importance VARCHAR(50),
    event_estimated_visitors INTEGER,
    event_venue_capacity INTEGER,
    event_distance_km NUMERIC(6,2),
    event_is_international BOOLEAN DEFAULT FALSE,
    has_multiple_events BOOLEAN DEFAULT FALSE,
    total_marketable_rooms INTEGER NOT NULL CHECK (total_marketable_rooms > 0),
    available_rooms_for_sale INTEGER NOT NULL CHECK (available_rooms_for_sale >= 0),
    rooms_sold INTEGER NOT NULL CHECK (rooms_sold >= 0),
    complimentary_rooms INTEGER DEFAULT 0,
    out_of_order_rooms INTEGER DEFAULT 0,
    occupancy_percent NUMERIC(5,2) NOT NULL CHECK (occupancy_percent >= 0 AND occupancy_percent <= 100),
    turnaways_count INTEGER DEFAULT 0,
    reservations_count INTEGER DEFAULT 0,
    guests_count INTEGER DEFAULT 0,
    adr_net_eur NUMERIC(10,2) NOT NULL CHECK (adr_net_eur >= 0),
    revpar_eur NUMERIC(10,2) NOT NULL CHECK (revpar_eur >= 0),
    accommodation_revenue_eur NUMERIC(12,2) NOT NULL CHECK (accommodation_revenue_eur >= 0),
    avg_sold_room_price NUMERIC(10,2) NOT NULL,
    total_hotel_revenue_eur NUMERIC(12,2),
    trevpar_eur NUMERIC(10,2),
    avg_distribution_cost_eur NUMERIC(10,2),
    avg_commission_percent NUMERIC(5,2),
    avg_net_rate_after_commissions_eur NUMERIC(10,2) NOT NULL,
    otb_j90 INTEGER,
    otb_j60 INTEGER,
    otb_j30 INTEGER,
    otb_j14 INTEGER,
    otb_j7 INTEGER,
    otb_j3 INTEGER,
    otb_j1 INTEGER,
    pickup_j90_to_j60 INTEGER,
    pickup_j60_to_j30 INTEGER,
    pickup_j30_to_j14 INTEGER,
    pickup_j14_to_j7 INTEGER,
    pickup_j7_to_j3 INTEGER,
    pickup_j3_to_j1 INTEGER,
    pickup_j1_to_arrival INTEGER,
    avg_lead_time_days NUMERIC(6,1),
    cancellations_count INTEGER DEFAULT 0,
    cancellation_rate_percent NUMERIC(5,2) DEFAULT 0.00,
    no_show_count INTEGER DEFAULT 0,
    direct_reservations INTEGER,
    booking_reservations INTEGER,
    expedia_reservations INTEGER,
    gds_reservations INTEGER,
    group_reservations INTEGER,
    corporate_reservations INTEGER,
    other_ota_reservations INTEGER,
    direct_share_percent NUMERIC(5,2),
    ota_share_percent NUMERIC(5,2),
    restrictions_applied TEXT,
    applied_min_stay INTEGER DEFAULT 1,
    is_closed_to_arrival BOOLEAN DEFAULT FALSE,
    is_closed_to_departure BOOLEAN DEFAULT FALSE,
    public_bar_eur NUMERIC(10,2),
    compset_avg_eur NUMERIC(10,2),
    compset_min_eur NUMERIC(10,2),
    compset_max_eur NUMERIC(10,2),
    rate_position_index NUMERIC(6,2),
    compset_availability_avg NUMERIC(5,2),
    compset_available_hotels_count INTEGER,
    import_batch_id UUID,
    source_provenance VARCHAR(100) DEFAULT 'excel_import',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hotel_id, date_stay)
);

CREATE TABLE IF NOT EXISTS public.hotel_historical_demand_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    observation_date DATE NOT NULL,
    arrival_date DATE NOT NULL,
    days_before_arrival INTEGER NOT NULL,
    rooms_booked_otb INTEGER NOT NULL CHECK (rooms_booked_otb >= 0),
    rooms_available INTEGER NOT NULL CHECK (rooms_available >= 0),
    projected_occupancy_percent NUMERIC(5,2) NOT NULL,
    booked_adr_eur NUMERIC(10,2) NOT NULL,
    booked_revenue_eur NUMERIC(12,2) NOT NULL,
    pickup_since_prev_snapshot INTEGER DEFAULT 0,
    cancellations_since_prev_snapshot INTEGER DEFAULT 0,
    public_rate_at_snapshot_eur NUMERIC(10,2),
    compset_rate_at_snapshot_eur NUMERIC(10,2),
    turnaways_at_snapshot INTEGER DEFAULT 0,
    data_source VARCHAR(100) DEFAULT 'D-EDGE CRS',
    import_batch_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hotel_id, observation_date, arrival_date)
);

CREATE TABLE IF NOT EXISTS public.hotel_parameters_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    hotel_positioning VARCHAR(100) DEFAULT 'Boutique Hôtel',
    primary_segment VARCHAR(100) DEFAULT 'Loisirs Individuels',
    primary_market VARCHAR(100) DEFAULT 'France & Europe',
    currency VARCHAR(10) DEFAULT 'EUR',
    timezone VARCHAR(50) DEFAULT 'Europe/Paris',
    target_adr_eur NUMERIC(10,2) NOT NULL DEFAULT 280.00,
    target_occupancy_percent NUMERIC(5,2) NOT NULL DEFAULT 85.00,
    target_revpar_eur NUMERIC(10,2) NOT NULL DEFAULT 238.00,
    floor_rate_eur NUMERIC(10,2) NOT NULL DEFAULT 180.00,
    ceiling_rate_eur NUMERIC(10,2) NOT NULL DEFAULT 550.00,
    avg_distribution_cost_eur NUMERIC(10,2) DEFAULT 32.50,
    compset_reference_hotels JSONB DEFAULT '[]'::jsonb,
    room_types_breakdown JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hotel_id)
);

CREATE TABLE IF NOT EXISTS public.hotel_historical_import_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size_kb NUMERIC(10,2) NOT NULL,
    records_count INTEGER NOT NULL DEFAULT 0,
    snapshots_count INTEGER NOT NULL DEFAULT 0,
    date_range VARCHAR(100),
    status VARCHAR(50) DEFAULT 'valid',
    warnings_count INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    errors_details JSONB DEFAULT '[]'::jsonb,
    detected_columns JSONB DEFAULT '[]'::jsonb,
    imported_by VARCHAR(255) NOT NULL,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hotel_backtest_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    evaluated_period VARCHAR(100) NOT NULL,
    total_days_evaluated INTEGER NOT NULL,
    overall_accuracy_percent NUMERIC(5,2) NOT NULL,
    metrics_by_horizon JSONB NOT NULL,
    strengths JSONB DEFAULT '[]'::jsonb,
    recommended_model_adjustments JSONB DEFAULT '[]'::jsonb,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal d'audit légal immuable (append-only, protégé par trigger)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_email VARCHAR(255) NOT NULL,
    entity_type VARCHAR(80) NOT NULL, -- rate_decision, guardrail, compset, ari_push, hotel_config
    entity_id VARCHAR(150) NOT NULL,
    action VARCHAR(50) NOT NULL, -- accept, modify, reject, push, update, revert
    before_state JSONB,
    after_state JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. ADMINISTRATION SYSTÈME & JOURNAL OPÉRATIONNEL
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.system_admin_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    reference_date_mode VARCHAR(50) NOT NULL DEFAULT 'fixed_demo_2026_11_12',
    enable_predictive_scenarios BOOLEAN NOT NULL DEFAULT TRUE,
    enable_seasonal_festive_overlay BOOLEAN NOT NULL DEFAULT TRUE,
    enable_school_holidays_overlay BOOLEAN NOT NULL DEFAULT TRUE,
    enable_backtesting_engine BOOLEAN NOT NULL DEFAULT TRUE,
    session_timeout_minutes INTEGER NOT NULL DEFAULT 120,
    enforce_audit_trail BOOLEAN NOT NULL DEFAULT TRUE,
    integrations JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_operation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(150) UNIQUE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    timestamp_str VARCHAR(30) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    hotel_id_ref VARCHAR(100) NOT NULL DEFAULT 'all',
    category VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 8. INDEXATION HAUTE PERFORMANCE (B-TREE COMPOSITE, PARTIEL & GIN)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_auth ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_hotels_org ON public.hotels(organization_id);
CREATE INDEX IF NOT EXISTS idx_hotels_city ON public.hotels(city);
CREATE INDEX IF NOT EXISTS idx_hotels_external_id ON public.hotels(external_id);
CREATE INDEX IF NOT EXISTS idx_room_types_hotel ON public.room_types(hotel_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rate_plans_hotel ON public.rate_plans(hotel_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_venues_city ON public.venues(city);
CREATE INDEX IF NOT EXISTS idx_events_dates ON public.events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_city_score ON public.events(city, final_rm_score DESC);
CREATE INDEX IF NOT EXISTS idx_events_sources_gin ON public.events USING GIN(sources);
CREATE INDEX IF NOT EXISTS idx_event_occ_dates ON public.event_occurrences(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_event_impacts_hotel ON public.event_hotel_impacts(hotel_id, rm_score DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_hotel_arrival ON public.reservations(hotel_id, arrival_date, status);
CREATE INDEX IF NOT EXISTS idx_res_nights_hotel_stay ON public.reservation_stay_nights(hotel_id, stay_date) WHERE is_active_otb = TRUE;
CREATE INDEX IF NOT EXISTS idx_otb_pace_lookup ON public.otb_pace_snapshots(hotel_id, stay_date, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_rate_rec_lookup ON public.daily_rate_recommendations(hotel_id, stay_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_guardrails_hotel_default ON public.pricing_guardrails(hotel_id) WHERE room_type_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_rate_rec_hotel_default ON public.daily_rate_recommendations(hotel_id, stay_date) WHERE room_type_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_rate_rec_pending ON public.daily_rate_recommendations(hotel_id, stay_date) WHERE validation_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_daily_restrictions_lookup ON public.daily_restrictions(hotel_id, stay_date);
CREATE INDEX IF NOT EXISTS idx_rm_alerts_hotel_date ON public.rm_alerts(external_hotel_id, date_str);
CREATE INDEX IF NOT EXISTS idx_rm_alerts_active ON public.rm_alerts(external_hotel_id, date_str) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rm_decisions_hotel_date ON public.rm_decision_records(external_hotel_id, date_str);
CREATE INDEX IF NOT EXISTS idx_dedge_inv_hotel_date ON public.dedge_inventory_days(external_hotel_id, date_str);
CREATE INDEX IF NOT EXISTS idx_lighthouse_hotel_date ON public.lighthouse_rates(external_hotel_id, date_str);
CREATE INDEX IF NOT EXISTS idx_rate_parity_hotel_date ON public.rate_parity_checks(hotel_id, stay_date) WHERE parity_status IN ('undercut_minor', 'undercut_critical');
CREATE INDEX IF NOT EXISTS idx_ari_push_pending ON public.ari_push_jobs(status, created_at) WHERE status IN ('queued', 'retrying');
CREATE INDEX IF NOT EXISTS idx_hist_daily_hotel_date ON public.hotel_historical_daily(hotel_id, date_stay);
CREATE INDEX IF NOT EXISTS idx_hist_daily_dow ON public.hotel_historical_daily(hotel_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_hist_daily_month ON public.hotel_historical_daily(hotel_id, month_of_year);
CREATE INDEX IF NOT EXISTS idx_hist_daily_event ON public.hotel_historical_daily(hotel_id, event_category);
CREATE INDEX IF NOT EXISTS idx_hist_snapshots_hotel_dates ON public.hotel_historical_demand_snapshots(hotel_id, observation_date, arrival_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_date ON public.audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel_entity ON public.audit_logs(hotel_id, entity_type, created_at DESC);

-- ==============================================================================
-- 9. TRIGGERS UPDATED_AT & IMMUTABILITÉ AUDIT
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_hotels_updated_at ON public.hotels;
CREATE TRIGGER trg_hotels_updated_at BEFORE UPDATE ON public.hotels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_room_types_updated_at ON public.room_types;
CREATE TRIGGER trg_room_types_updated_at BEFORE UPDATE ON public.room_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rate_plans_updated_at ON public.rate_plans;
CREATE TRIGGER trg_rate_plans_updated_at BEFORE UPDATE ON public.rate_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_venues_updated_at ON public.venues;
CREATE TRIGGER trg_venues_updated_at BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_reservations_updated_at ON public.reservations;
CREATE TRIGGER trg_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_daily_rate_rec_updated_at ON public.daily_rate_recommendations;
CREATE TRIGGER trg_daily_rate_rec_updated_at BEFORE UPDATE ON public.daily_rate_recommendations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_hotel_rms_configs_updated_at ON public.hotel_rms_configs;
CREATE TRIGGER trg_hotel_rms_configs_updated_at BEFORE UPDATE ON public.hotel_rms_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rm_alerts_updated_at ON public.rm_alerts;
CREATE TRIGGER trg_rm_alerts_updated_at BEFORE UPDATE ON public.rm_alerts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_hist_daily_updated_at ON public.hotel_historical_daily;
CREATE TRIGGER trg_hist_daily_updated_at BEFORE UPDATE ON public.hotel_historical_daily FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- ==============================================================================
-- 10. VUES ANALYTIQUES & FONCTIONS TRANSACTIONNELLES (RPC)
-- ==============================================================================

-- 10.1 Agrégat CompSet journalier (exclusion stricte des sold-out / null du calcul médian)
CREATE OR REPLACE VIEW public.v_compset_daily_benchmark AS
SELECT
    external_hotel_id,
    date_str,
    COUNT(*) AS total_observations,
    COUNT(*) FILTER (WHERE is_sold_out = FALSE AND rate_eur IS NOT NULL) AS available_competitors_count,
    COUNT(*) FILTER (WHERE is_sold_out = TRUE OR availability_status = 'epuise') AS sold_out_competitors_count,
    MIN(rate_eur) FILTER (WHERE is_sold_out = FALSE AND rate_eur IS NOT NULL) AS compset_min_eur,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rate_eur)
        FILTER (WHERE is_sold_out = FALSE AND rate_eur IS NOT NULL) AS compset_median_eur,
    ROUND(AVG(rate_eur) FILTER (WHERE is_sold_out = FALSE AND rate_eur IS NOT NULL), 2) AS compset_avg_eur,
    MAX(rate_eur) FILTER (WHERE is_sold_out = FALSE AND rate_eur IS NOT NULL) AS compset_max_eur
FROM public.lighthouse_rates
GROUP BY external_hotel_id, date_str;

-- 10.2 Matrice consolidée KPI journaliers par hôtel
CREATE OR REPLACE VIEW public.v_hotel_daily_kpi_summary AS
SELECT
    h.id AS hotel_id,
    h.external_id,
    h.organization_id,
    h.name AS hotel_name,
    h.city,
    r.stay_date,
    r.demand_index,
    r.demand_level,
    r.current_bar_eur,
    r.suggested_bar_eur,
    r.applied_bar_eur,
    r.validation_status,
    r.rooms_sold_otb,
    r.remaining_rooms,
    r.occupancy_percent,
    r.adr_net_eur,
    r.revpar_eur,
    r.pickup_24h,
    r.pickup_7d,
    c.compset_median_eur,
    c.compset_avg_eur,
    c.sold_out_competitors_count,
    p.parity_status,
    p.parity_gap_eur
FROM public.daily_rate_recommendations r
JOIN public.hotels h ON h.id = r.hotel_id
LEFT JOIN public.v_compset_daily_benchmark c
    ON c.external_hotel_id = h.external_id AND c.date_str = r.stay_date
LEFT JOIN public.rate_parity_checks p
    ON p.hotel_id = h.id AND p.stay_date = r.stay_date;

-- 10.3 Matrice Impact Événementiel x Parc Hôtelier
CREATE OR REPLACE VIEW public.v_event_hotel_impact_matrix AS
SELECT
    e.id AS event_id,
    e.external_id AS event_external_id,
    e.title,
    e.category,
    e.city AS event_city,
    e.start_date,
    e.end_date,
    e.expected_attendance,
    e.status AS event_status,
    h.id AS hotel_id,
    h.external_id AS hotel_external_id,
    h.name AS hotel_name,
    h.city AS hotel_city,
    i.distance_km,
    i.distance_mins,
    i.compression_index,
    i.rm_score,
    i.estimated_adr_boost_percent,
    i.min_stay_recommended,
    i.stop_sell_suggested,
    i.recommended_action
FROM public.event_hotel_impacts i
JOIN public.events e ON e.id = i.event_id
JOIN public.hotels h ON h.id = i.hotel_id;

-- 10.4 Fonctions de sécurité RLS (SECURITY DEFINER + search_path verrouillé)
CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS UUID AS $$
    SELECT organization_id
    FROM public.users
    WHERE auth_user_id = auth.uid() OR id = auth.uid()
    LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_access_hotel(p_hotel_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user RECORD;
    v_hotel_org UUID;
BEGIN
    SELECT organization_id INTO v_hotel_org FROM public.hotels WHERE id = p_hotel_id;
    IF v_hotel_org IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT id, organization_id, role, allowed_hotel_ids
    INTO v_user
    FROM public.users
    WHERE (auth_user_id = auth.uid() OR id = auth.uid()) AND is_active = TRUE
    LIMIT 1;

    IF v_user.id IS NULL OR v_user.organization_id <> v_hotel_org THEN
        RETURN FALSE;
    END IF;

    IF v_user.role IN ('super_admin', 'admin', 'head_of_rm') OR v_user.allowed_hotel_ids = '"all"'::jsonb THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_hotel_access
        WHERE user_id = v_user.id AND hotel_id = p_hotel_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 10.5 RPC atomique de validation d'une recommandation tarifaire + file ARI + audit immuable
CREATE OR REPLACE FUNCTION public.apply_rm_rate_decision(
    p_recommendation_id UUID,
    p_action VARCHAR,
    p_applied_bar_eur NUMERIC,
    p_applied_min_stay INTEGER DEFAULT 1,
    p_reason_code VARCHAR DEFAULT NULL,
    p_comment TEXT DEFAULT NULL,
    p_actor_email VARCHAR DEFAULT 'system@flowtym.com'
)
RETURNS JSONB AS $$
DECLARE
    v_rec public.daily_rate_recommendations%ROWTYPE;
    v_hotel public.hotels%ROWTYPE;
    v_job_id UUID;
BEGIN
    SELECT * INTO v_rec FROM public.daily_rate_recommendations WHERE id = p_recommendation_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recommandation introuvable : %', p_recommendation_id;
    END IF;

    SELECT * INTO v_hotel FROM public.hotels WHERE id = v_rec.hotel_id;

    UPDATE public.daily_rate_recommendations
    SET
        validation_status = p_action,
        applied_bar_eur = CASE WHEN p_action IN ('accepted', 'modified') THEN p_applied_bar_eur ELSE applied_bar_eur END,
        applied_min_stay = COALESCE(p_applied_min_stay, current_min_stay),
        decision_reason_code = p_reason_code,
        decision_note = p_comment,
        decided_by = p_actor_email,
        decided_at = NOW()
    WHERE id = p_recommendation_id;

    IF p_action IN ('accepted', 'modified') THEN
        INSERT INTO public.ari_push_jobs (
            hotel_id, provider, stay_date_start, stay_date_end, payload, idempotency_key, triggered_by
        ) VALUES (
            v_rec.hotel_id,
            'dedge_crs',
            v_rec.stay_date,
            v_rec.stay_date,
            jsonb_build_object(
                'room_type_id', v_rec.room_type_id,
                'bar_eur', p_applied_bar_eur,
                'min_los', COALESCE(p_applied_min_stay, 1)
            ),
            v_rec.hotel_id::TEXT || '_' || v_rec.stay_date::TEXT || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
            p_actor_email
        )
        RETURNING id INTO v_job_id;
    END IF;

    INSERT INTO public.audit_logs (
        organization_id, hotel_id, actor_email, entity_type, entity_id, action, before_state, after_state
    ) VALUES (
        v_hotel.organization_id,
        v_rec.hotel_id,
        p_actor_email,
        'rate_decision',
        p_recommendation_id::TEXT,
        p_action,
        jsonb_build_object('current_bar_eur', v_rec.current_bar_eur, 'suggested_bar_eur', v_rec.suggested_bar_eur),
        jsonb_build_object('applied_bar_eur', p_applied_bar_eur, 'applied_min_stay', p_applied_min_stay, 'reason_code', p_reason_code)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'recommendation_id', p_recommendation_id,
        'ari_job_id', v_job_id,
        'status', p_action
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 11. SÉCURITÉ ROW LEVEL SECURITY (RLS) COMPLÈTE SUR TOUTES LES TABLES
-- ==============================================================================

DO $$
DECLARE
    tbl TEXT;
    all_tables TEXT[] := ARRAY[
        'organizations', 'users', 'user_hotel_access', 'hotels', 'room_types',
        'rate_plans', 'market_segments', 'distribution_channels', 'cities', 'venues',
        'hotel_geo_settings', 'hotel_venue_distances', 'events', 'event_occurrences',
        'event_sources', 'event_evidence', 'event_hotel_impacts', 'event_proposals',
        'event_suggestions', 'reservations', 'reservation_stay_nights', 'otb_pace_snapshots',
        'dedge_inventory_days', 'season_calendars', 'pricing_guardrails',
        'learned_calibration_rules', 'daily_rate_recommendations', 'daily_restrictions',
        'competitors', 'rate_shop_batches', 'lighthouse_rates', 'rate_parity_checks',
        'hotel_rms_configs', 'rm_alerts', 'rm_decision_records',
        'major_event_email_alert_configs', 'major_event_email_alert_logs', 'ari_push_jobs',
        'hotel_historical_daily', 'hotel_historical_demand_snapshots',
        'hotel_parameters_profiles', 'hotel_historical_import_logs',
        'hotel_backtest_evaluations', 'audit_logs', 'system_admin_configs',
        'system_operation_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY all_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    END LOOP;
END $$;

-- 11.1 Politiques Tenant-Isolated (Organizations, Users, Hotels, Configs, Audit)
DROP POLICY IF EXISTS "rls_org_select" ON public.organizations;
CREATE POLICY "rls_org_select" ON public.organizations
    FOR SELECT TO authenticated USING (id = public.get_my_organization_id());

DROP POLICY IF EXISTS "rls_users_org" ON public.users;
CREATE POLICY "rls_users_org" ON public.users
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_organization_id())
    WITH CHECK (organization_id = public.get_my_organization_id());

DROP POLICY IF EXISTS "rls_user_hotel_access" ON public.user_hotel_access;
CREATE POLICY "rls_user_hotel_access" ON public.user_hotel_access
    FOR ALL TO authenticated
    USING (public.can_access_hotel(hotel_id))
    WITH CHECK (public.can_access_hotel(hotel_id));

DROP POLICY IF EXISTS "rls_hotels_public_read" ON public.hotels;
CREATE POLICY "rls_hotels_public_read" ON public.hotels
    FOR SELECT TO anon USING (is_active = TRUE);

DROP POLICY IF EXISTS "rls_hotels_tenant" ON public.hotels;
CREATE POLICY "rls_hotels_tenant" ON public.hotels
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_organization_id())
    WITH CHECK (organization_id = public.get_my_organization_id());

-- 11.2 Politiques génériques par hotel_id (via can_access_hotel)
DO $$
DECLARE
    t TEXT;
    hotel_scoped_tables TEXT[] := ARRAY[
        'room_types', 'rate_plans', 'hotel_venue_distances', 'event_hotel_impacts',
        'reservations', 'reservation_stay_nights', 'otb_pace_snapshots',
        'season_calendars', 'pricing_guardrails', 'learned_calibration_rules',
        'daily_rate_recommendations', 'daily_restrictions', 'rate_parity_checks',
        'ari_push_jobs'
    ];
BEGIN
    FOREACH t IN ARRAY hotel_scoped_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "rls_%s_hotel_scope" ON public.%I;', t, t);
        EXECUTE format(
            'CREATE POLICY "rls_%s_hotel_scope" ON public.%I FOR ALL TO authenticated USING (public.can_access_hotel(hotel_id)) WITH CHECK (public.can_access_hotel(hotel_id));',
            t, t
        );
    END LOOP;
END $$;

-- 11.3 Politiques par organization_id
DO $$
DECLARE
    t TEXT;
    org_scoped_tables TEXT[] := ARRAY[
        'market_segments', 'distribution_channels', 'hotel_geo_settings',
        'event_proposals', 'event_suggestions', 'hotel_rms_configs',
        'hotel_historical_daily', 'hotel_historical_demand_snapshots',
        'hotel_parameters_profiles', 'hotel_historical_import_logs',
        'hotel_backtest_evaluations', 'system_admin_configs', 'system_operation_logs'
    ];
BEGIN
    FOREACH t IN ARRAY org_scoped_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "rls_%s_org_scope" ON public.%I;', t, t);
        EXECUTE format(
            'CREATE POLICY "rls_%s_org_scope" ON public.%I FOR ALL TO authenticated USING (organization_id = public.get_my_organization_id()) WITH CHECK (organization_id = public.get_my_organization_id());',
            t, t
        );
    END LOOP;
END $$;

-- 11.4 Politiques tables opérationnelles liées par hotel_id nullable ou external_hotel_id
DROP POLICY IF EXISTS "rls_competitors_auth" ON public.competitors;
CREATE POLICY "rls_competitors_auth" ON public.competitors
    FOR ALL TO authenticated
    USING (hotel_id IS NULL OR public.can_access_hotel(hotel_id))
    WITH CHECK (hotel_id IS NULL OR public.can_access_hotel(hotel_id));

DROP POLICY IF EXISTS "rls_rate_shop_batches_auth" ON public.rate_shop_batches;
CREATE POLICY "rls_rate_shop_batches_auth" ON public.rate_shop_batches
    FOR ALL TO authenticated
    USING (hotel_id IS NULL OR public.can_access_hotel(hotel_id))
    WITH CHECK (hotel_id IS NULL OR public.can_access_hotel(hotel_id));

DROP POLICY IF EXISTS "rls_lighthouse_rates_auth" ON public.lighthouse_rates;
CREATE POLICY "rls_lighthouse_rates_auth" ON public.lighthouse_rates
    FOR ALL TO authenticated
    USING (hotel_id IS NULL OR public.can_access_hotel(hotel_id))
    WITH CHECK (hotel_id IS NULL OR public.can_access_hotel(hotel_id));

DROP POLICY IF EXISTS "rls_dedge_inventory_auth" ON public.dedge_inventory_days;
CREATE POLICY "rls_dedge_inventory_auth" ON public.dedge_inventory_days
    FOR ALL TO authenticated
    USING (hotel_id IS NULL OR public.can_access_hotel(hotel_id))
    WITH CHECK (hotel_id IS NULL OR public.can_access_hotel(hotel_id));

DROP POLICY IF EXISTS "rls_rm_alerts_auth" ON public.rm_alerts;
CREATE POLICY "rls_rm_alerts_auth" ON public.rm_alerts
    FOR ALL TO authenticated
    USING (hotel_id IS NULL OR public.can_access_hotel(hotel_id))
    WITH CHECK (hotel_id IS NULL OR public.can_access_hotel(hotel_id));

DROP POLICY IF EXISTS "rls_rm_decisions_auth" ON public.rm_decision_records;
CREATE POLICY "rls_rm_decisions_auth" ON public.rm_decision_records
    FOR ALL TO authenticated
    USING (hotel_id IS NULL OR public.can_access_hotel(hotel_id))
    WITH CHECK (hotel_id IS NULL OR public.can_access_hotel(hotel_id));

DROP POLICY IF EXISTS "rls_email_alert_configs_auth" ON public.major_event_email_alert_configs;
CREATE POLICY "rls_email_alert_configs_auth" ON public.major_event_email_alert_configs
    FOR ALL TO authenticated
    USING (hotel_id IS NULL OR public.can_access_hotel(hotel_id))
    WITH CHECK (hotel_id IS NULL OR public.can_access_hotel(hotel_id));

DROP POLICY IF EXISTS "rls_email_alert_logs_auth" ON public.major_event_email_alert_logs;
CREATE POLICY "rls_email_alert_logs_auth" ON public.major_event_email_alert_logs
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- 11.5 Audit Logs (Lecture + Insertion uniquement, aucune mutation)
DROP POLICY IF EXISTS "rls_audit_logs_read" ON public.audit_logs;
CREATE POLICY "rls_audit_logs_read" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (organization_id = public.get_my_organization_id());

DROP POLICY IF EXISTS "rls_audit_logs_insert" ON public.audit_logs;
CREATE POLICY "rls_audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (organization_id = public.get_my_organization_id());

-- 11.6 Référentiels mutualisés (villes, lieux, sources, événements, preuves)
DROP POLICY IF EXISTS "rls_cities_read" ON public.cities;
CREATE POLICY "rls_cities_read" ON public.cities FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "rls_cities_write" ON public.cities;
CREATE POLICY "rls_cities_write" ON public.cities FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "rls_venues_read" ON public.venues;
CREATE POLICY "rls_venues_read" ON public.venues FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "rls_venues_write" ON public.venues;
CREATE POLICY "rls_venues_write" ON public.venues FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "rls_sources_read" ON public.event_sources;
CREATE POLICY "rls_sources_read" ON public.event_sources FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "rls_sources_write" ON public.event_sources;
CREATE POLICY "rls_sources_write" ON public.event_sources FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "rls_events_read" ON public.events;
CREATE POLICY "rls_events_read" ON public.events FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "rls_events_write" ON public.events;
CREATE POLICY "rls_events_write" ON public.events FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "rls_event_occ_read" ON public.event_occurrences;
CREATE POLICY "rls_event_occ_read" ON public.event_occurrences FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "rls_event_occ_write" ON public.event_occurrences;
CREATE POLICY "rls_event_occ_write" ON public.event_occurrences FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "rls_event_evid_read" ON public.event_evidence;
CREATE POLICY "rls_event_evid_read" ON public.event_evidence FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "rls_event_evid_write" ON public.event_evidence;
CREATE POLICY "rls_event_evid_write" ON public.event_evidence FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ==============================================================================
-- 12. DONNÉES INITIALES (ORGANISATION, PARC HÔTELIER, SEGMENTS, CANAUX & PLANS)
-- ==============================================================================

INSERT INTO public.organizations (id, name, slug, subscription_tier)
VALUES ('00000000-0000-4000-8000-000000000001', 'Flowtym Hospitality Group', 'flowtym-hospitality-group', 'enterprise')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.hotels (
    id, external_id, organization_id, code, name, group_name, city, country, country_code, address, lat, lng, stars, room_count, segment, base_adr, rate_floor_eur, rate_ceiling_eur
) VALUES
    ('10000000-0000-4000-8000-000000000001', 'hotel-opera', '00000000-0000-4000-8000-000000000001', 'PAR-OPE', 'Grand Hôtel Folkestone Opéra (4★)', 'Flowtym Hospitality Group', 'Paris', 'France', 'FRA', '14 Rue de Castellane, 75008 Paris', 48.872200, 2.324500, 4, 45, 'Boutique', 260.00, 180.00, 550.00),
    ('10000000-0000-4000-8000-000000000002', 'hotel-marais', '00000000-0000-4000-8000-000000000001', 'PAR-MAR', 'Hôtel Le Marais Boutique', 'Flowtym Hospitality Group', 'Paris', 'France', 'FRA', '22 Rue des Francs-Bourgeois, 75004 Paris', 48.857500, 2.361900, 4, 48, 'Boutique', 310.00, 200.00, 620.00),
    ('10000000-0000-4000-8000-000000000003', 'hotel-lyon', '00000000-0000-4000-8000-000000000001', 'LYS-BEL', 'Lyon Bellecour Plaza', 'Flowtym Hospitality Group', 'Lyon', 'France', 'FRA', '18 Place Bellecour, 69002 Lyon', 45.757800, 4.832000, 4, 110, 'Affaires', 210.00, 130.00, 420.00),
    ('10000000-0000-4000-8000-000000000004', 'hotel-nice', '00000000-0000-4000-8000-000000000001', 'NCE-PRO', 'Nice Promenade Palace', 'Flowtym Hospitality Group', 'Nice', 'France', 'FRA', '55 Promenade des Anglais, 06000 Nice', 43.694800, 7.252000, 5, 168, 'Luxe', 420.00, 240.00, 950.00),
    ('10000000-0000-4000-8000-000000000005', 'hotel-marseille', '00000000-0000-4000-8000-000000000001', 'MRS-VIE', 'Marseille Vieux-Port Harbour Hôtel', 'Flowtym Hospitality Group', 'Marseille', 'France', 'FRA', '46 Quai du Port, 13002 Marseille', 43.296100, 5.368800, 4, 92, 'Boutique', 195.00, 125.00, 420.00),
    ('10000000-0000-4000-8000-000000000006', 'hotel-lille', '00000000-0000-4000-8000-000000000001', 'LIL-GRA', 'Lille Grand-Place Opéra Boutique', 'Flowtym Hospitality Group', 'Lille', 'France', 'FRA', '15 Place du Théâtre, 59000 Lille', 50.637200, 3.065200, 4, 74, 'Affaires', 175.00, 115.00, 390.00)
ON CONFLICT (external_id) DO NOTHING;

-- Segments & Canaux par défaut
INSERT INTO public.market_segments (organization_id, code, name, macro_segment, avg_commission_pct)
VALUES
    ('00000000-0000-4000-8000-000000000001', 'LEISURE_IND', 'Loisirs Individuels', 'transient', 12.00),
    ('00000000-0000-4000-8000-000000000001', 'CORP_IND', 'Affaires / Corporate', 'corporate', 6.50),
    ('00000000-0000-4000-8000-000000000001', 'GROUP_MICE', 'Groupes / Congrès / MICE', 'mice', 8.00)
ON CONFLICT (organization_id, code) DO NOTHING;

INSERT INTO public.distribution_channels (organization_id, code, name, channel_type, commission_pct, distribution_cost_eur)
VALUES
    ('00000000-0000-4000-8000-000000000001', 'DIRECT_WEB', 'Site Officiel & Direct', 'direct', 2.50, 6.50),
    ('00000000-0000-4000-8000-000000000001', 'BOOKING', 'Booking.com', 'ota', 17.00, 44.00),
    ('00000000-0000-4000-8000-000000000001', 'EXPEDIA', 'Expedia', 'ota', 18.00, 46.50),
    ('00000000-0000-4000-8000-000000000001', 'GDS', 'GDS Corporate (Amadeus / Sabre)', 'gds', 10.00, 26.00)
ON CONFLICT (organization_id, code) DO NOTHING;

-- Typologies & Plans tarifaires initiaux pour Grand Hôtel Folkestone Opéra (45 chambres)
INSERT INTO public.room_types (external_id, hotel_id, code, name, total_rooms, base_offset_eur, weight_percent, is_base_room_type, sort_order)
VALUES
    ('hotel-opera-cat-1', '10000000-0000-4000-8000-000000000001', 'classique', 'Chambre Classique Double', 23, 0.00, 51.00, TRUE, 1),
    ('hotel-opera-cat-2', '10000000-0000-4000-8000-000000000001', 'superieure', 'Chambre Supérieure', 8, 35.00, 18.00, FALSE, 2),
    ('hotel-opera-cat-3', '10000000-0000-4000-8000-000000000001', 'deluxe_famille', 'Chambre Deluxe / Familiale', 14, 75.00, 31.00, FALSE, 3)
ON CONFLICT (hotel_id, code) DO NOTHING;

INSERT INTO public.rate_plans (hotel_id, code, name, plan_type, derivation_type, derivation_value, cancellation_policy, breakfast_included)
VALUES
    ('10000000-0000-4000-8000-000000000001', 'BAR', 'Best Available Rate (Flexible)', 'BAR', 'manual', 0.00, 'Flexible', FALSE),
    ('10000000-0000-4000-8000-000000000001', 'NRF', 'Non-Remboursable (-12%)', 'NRF', 'percent', -12.00, 'Non-annulable', FALSE),
    ('10000000-0000-4000-8000-000000000001', 'BB', 'Tarif avec Petit-Déjeuner', 'BB', 'fixed', 24.00, 'Flexible', TRUE)
ON CONFLICT (hotel_id, code) DO NOTHING;

INSERT INTO public.pricing_guardrails (hotel_id, room_type_id, min_rate_eur, max_rate_eur, max_daily_step_eur, max_daily_step_pct)
SELECT h.id, NULL, h.rate_floor_eur, h.rate_ceiling_eur, 120.00, 38.00
FROM public.hotels h
WHERE NOT EXISTS (
    SELECT 1 FROM public.pricing_guardrails pg
    WHERE pg.hotel_id = h.id AND pg.room_type_id IS NULL
);

INSERT INTO public.system_admin_configs (organization_id, currency, timezone, reference_date_mode)
VALUES ('00000000-0000-4000-8000-000000000001', 'EUR', 'Europe/Paris', 'fixed_demo_2026_11_12')
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO public.major_event_email_alert_configs (external_hotel_id, enabled, min_score, send_time, frequency, recipients, include_ongoing, horizon_days, include_yield_recommendations)
VALUES ('global', TRUE, 70, '07:30', 'daily', ARRAY['WaliLarabi@gmail.com'], TRUE, 60, TRUE)
ON CONFLICT (external_hotel_id) DO NOTHING;
