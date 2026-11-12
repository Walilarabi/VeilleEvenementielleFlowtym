-- ==============================================================================
-- FLOWTYM REVENUE — SUPABASE MIGRATION : HISTORICAL DATA & PREDICTIVE RM ENGINE
-- Tables dédiées aux données historiques, snapshots de demande et backtesting
-- Conforme RLS multi-tenant étanche avec isolation par organization_id
-- ==============================================================================

-- 1. Table des Données Historiques Quotidiennes (Onglet 1 : Colonnes A à BZ)
CREATE TABLE IF NOT EXISTS public.hotel_historical_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    
    -- A. Identification et calendrier
    date_stay DATE NOT NULL,
    day_of_week VARCHAR(20) NOT NULL,
    week_of_year INTEGER NOT NULL CHECK (week_of_year BETWEEN 1 AND 54),
    month_of_year INTEGER NOT NULL CHECK (month_of_year BETWEEN 1 AND 12),
    year_of_stay INTEGER NOT NULL CHECK (year_of_stay BETWEEN 2000 AND 2100),
    is_holiday BOOLEAN DEFAULT FALSE,
    is_school_holiday BOOLEAN DEFAULT FALSE,
    school_holiday_zone VARCHAR(50),
    is_holiday_eve BOOLEAN DEFAULT FALSE,
    season VARCHAR(20) DEFAULT 'Moyenne', -- Haute, Moyenne, Basse
    day_type VARCHAR(20) DEFAULT 'Semaine', -- Semaine, Weekend, Pont

    -- B. Événements et attractivité
    event_name VARCHAR(255),
    event_category VARCHAR(100),
    event_start_date DATE,
    event_end_date DATE,
    event_duration_days INTEGER,
    event_importance VARCHAR(50), -- Faible, Moyen, Majeur, Critique
    event_estimated_visitors INTEGER,
    event_venue_capacity INTEGER,
    event_distance_km NUMERIC(6,2),
    event_is_international BOOLEAN DEFAULT FALSE,
    has_multiple_events BOOLEAN DEFAULT FALSE,

    -- C. Capacité et occupation
    total_marketable_rooms INTEGER NOT NULL CHECK (total_marketable_rooms > 0),
    available_rooms_for_sale INTEGER NOT NULL CHECK (available_rooms_for_sale >= 0),
    rooms_sold INTEGER NOT NULL CHECK (rooms_sold >= 0),
    complimentary_rooms INTEGER DEFAULT 0,
    out_of_order_rooms INTEGER DEFAULT 0,
    occupancy_percent NUMERIC(5,2) NOT NULL CHECK (occupancy_percent >= 0 AND occupancy_percent <= 100),
    turnaways_count INTEGER DEFAULT 0,
    reservations_count INTEGER DEFAULT 0,
    guests_count INTEGER DEFAULT 0,

    -- D. Performance financière
    adr_net_eur NUMERIC(10,2) NOT NULL CHECK (adr_net_eur >= 0),
    revpar_eur NUMERIC(10,2) NOT NULL CHECK (revpar_eur >= 0),
    accommodation_revenue_eur NUMERIC(12,2) NOT NULL CHECK (accommodation_revenue_eur >= 0),
    avg_sold_room_price NUMERIC(10,2) NOT NULL,
    total_hotel_revenue_eur NUMERIC(12,2),
    trevpar_eur NUMERIC(10,2),
    avg_distribution_cost_eur NUMERIC(10,2),
    avg_commission_percent NUMERIC(5,2),
    avg_net_rate_after_commissions_eur NUMERIC(10,2) NOT NULL,

    -- E. Snapshots passés & Pickup
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

    -- F. Distribution
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

    -- G. Concurrence
    public_bar_eur NUMERIC(10,2),
    compset_avg_eur NUMERIC(10,2),
    compset_min_eur NUMERIC(10,2),
    compset_max_eur NUMERIC(10,2),
    rate_position_index NUMERIC(6,2),
    compset_availability_avg NUMERIC(5,2),
    compset_available_hotels_count INTEGER,

    -- Métadonnées d'importation
    import_batch_id UUID,
    source_provenance VARCHAR(100) DEFAULT 'excel_import',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Contrainte d'unicité par hôtel et date de séjour (empêche les doublons)
    UNIQUE(hotel_id, date_stay)
);

-- 2. Table des Snapshots Historiques de Demande (Onglet 2)
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

-- 3. Table des Profils et Paramètres d'Établissement (Onglet 3)
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

-- 4. Table des Journaux d'Imports (Traçabilité et audit)
CREATE TABLE IF NOT EXISTS public.hotel_historical_import_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    
    file_name VARCHAR(255) NOT NULL,
    file_size_kb NUMERIC(10,2) NOT NULL,
    records_count INTEGER NOT NULL DEFAULT 0,
    snapshots_count INTEGER NOT NULL DEFAULT 0,
    date_range VARCHAR(100),
    status VARCHAR(50) DEFAULT 'valid', -- valid, warning, error
    warnings_count INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    errors_details JSONB DEFAULT '[]'::jsonb,
    detected_columns JSONB DEFAULT '[]'::jsonb,
    imported_by VARCHAR(255) NOT NULL,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Table des Évaluations de Backtesting
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

-- Index pour des requêtes d'agrégation ultra-rapides
CREATE INDEX IF NOT EXISTS idx_hist_daily_hotel_date ON public.hotel_historical_daily(hotel_id, date_stay);
CREATE INDEX IF NOT EXISTS idx_hist_daily_dow ON public.hotel_historical_daily(hotel_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_hist_daily_month ON public.hotel_historical_daily(hotel_id, month_of_year);
CREATE INDEX IF NOT EXISTS idx_hist_daily_event ON public.hotel_historical_daily(hotel_id, event_category);
CREATE INDEX IF NOT EXISTS idx_hist_snapshots_hotel_dates ON public.hotel_historical_demand_snapshots(hotel_id, observation_date, arrival_date);

-- 6. Row Level Security (RLS)
ALTER TABLE public.hotel_historical_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_historical_demand_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_parameters_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_historical_import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_backtest_evaluations ENABLE ROW LEVEL SECURITY;

-- Politiques RLS avec vérification étanche de l'organisation
CREATE POLICY "Users can manage historical daily data for their organization"
ON public.hotel_historical_daily
FOR ALL
USING (organization_id IN (
    SELECT organization_id FROM public.users WHERE users.id = auth.uid()
))
WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.users WHERE users.id = auth.uid()
));

CREATE POLICY "Users can manage demand snapshots for their organization"
ON public.hotel_historical_demand_snapshots
FOR ALL
USING (organization_id IN (
    SELECT organization_id FROM public.users WHERE users.id = auth.uid()
))
WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.users WHERE users.id = auth.uid()
));

CREATE POLICY "Users can manage hotel parameters for their organization"
ON public.hotel_parameters_profiles
FOR ALL
USING (organization_id IN (
    SELECT organization_id FROM public.users WHERE users.id = auth.uid()
))
WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.users WHERE users.id = auth.uid()
));

CREATE POLICY "Users can view import logs for their organization"
ON public.hotel_historical_import_logs
FOR ALL
USING (organization_id IN (
    SELECT organization_id FROM public.users WHERE users.id = auth.uid()
));

CREATE POLICY "Users can view backtest evaluations for their organization"
ON public.hotel_backtest_evaluations
FOR ALL
USING (organization_id IN (
    SELECT organization_id FROM public.users WHERE users.id = auth.uid()
));
