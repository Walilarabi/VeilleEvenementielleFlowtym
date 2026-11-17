-- ==============================================================================
-- FLOWTYM REVENUE — CENTRE DE CONFIGURATION TARIFAIRE & STRUCTURES AVANCÉES
-- Extension PostgreSQL / Supabase (Idempotente, Multi-Hôtels & RLS)
-- ==============================================================================

-- 1. Extension idempotente de room_types (catégories de chambres, capacités & suppléments d'occupation)
ALTER TABLE public.room_types
    ADD COLUMN IF NOT EXISTS external_hotel_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS max_capacity INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS max_adults INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS max_children INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS standard_occupancy INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS surface_sqm NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS pms_room_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS cm_room_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS applicable_rate_plans TEXT[] NOT NULL DEFAULT ARRAY['BAR', 'NRF', 'BB'],
    ADD COLUMN IF NOT EXISTS occupancy_supplements JSONB NOT NULL DEFAULT '{"extraAdult":40,"extraChild":20,"thirdAdult":45,"singleDiscount":0,"triple":45}'::jsonb,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS provenance VARCHAR(40) NOT NULL DEFAULT 'local';

-- 2. Matrice de correspondance catégories internes <-> PMS / Channel Manager (anti-doublon)
CREATE TABLE IF NOT EXISTS public.room_type_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    internal_room_code VARCHAR(60) NOT NULL,
    external_system VARCHAR(30) NOT NULL CHECK (external_system IN ('pms', 'channel_manager')),
    external_room_code VARCHAR(120) NOT NULL,
    external_room_name VARCHAR(200),
    last_verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(external_hotel_id, external_system, external_room_code),
    UNIQUE(external_hotel_id, external_system, internal_room_code)
);

-- 3. Extension idempotente de rate_plans (devise, politiques, petit-déjeuner, dates de validité, provenance)
ALTER TABLE public.rate_plans
    ADD COLUMN IF NOT EXISTS external_hotel_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS plan_nature VARCHAR(30) NOT NULL DEFAULT 'derived',
    ADD COLUMN IF NOT EXISTS reference_plan_code VARCHAR(60),
    ADD COLUMN IF NOT EXISTS calculation_mode VARCHAR(30) NOT NULL DEFAULT 'independent',
    ADD COLUMN IF NOT EXISTS custom_formula TEXT,
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS payment_policy VARCHAR(120) NOT NULL DEFAULT 'Paiement sur place',
    ADD COLUMN IF NOT EXISTS breakfast_mode VARCHAR(40) NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS included_guests INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS min_stay_default INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS max_stay_default INTEGER,
    ADD COLUMN IF NOT EXISTS advance_booking_min_days INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS room_category_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS distribution_channels TEXT[] NOT NULL DEFAULT ARRAY['DIRECT_WEB','BOOKING','EXPEDIA'],
    ADD COLUMN IF NOT EXISTS pms_external_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS cm_external_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS valid_from DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS floor_eur NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS ceiling_eur NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS is_group_inherited BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS provenance VARCHAR(40) NOT NULL DEFAULT 'local';

-- 4. Correspondances externes des plans tarifaires
CREATE TABLE IF NOT EXISTS public.rate_plan_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    internal_plan_code VARCHAR(60) NOT NULL,
    external_system VARCHAR(30) NOT NULL CHECK (external_system IN ('pms', 'channel_manager')),
    external_plan_code VARCHAR(120) NOT NULL,
    external_plan_name VARCHAR(200),
    last_verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(external_hotel_id, external_system, external_plan_code),
    UNIQUE(external_hotel_id, external_system, internal_plan_code)
);

-- 5. Relations & dépendances entre plans tarifaires (avec contrôle anti-boucle applicatif & BDD)
CREATE TABLE IF NOT EXISTS public.rate_plan_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    source_reference_code VARCHAR(60) NOT NULL,
    target_derived_code VARCHAR(60) NOT NULL,
    calculation_mode VARCHAR(30) NOT NULL
        CHECK (calculation_mode IN ('independent', 'percent_minus', 'percent_plus', 'fixed_minus', 'fixed_plus', 'multiplier', 'custom_formula')),
    variation_value NUMERIC(12,4) NOT NULL DEFAULT 0,
    custom_formula TEXT,
    rounding_rule VARCHAR(20) NOT NULL DEFAULT 'nearest_euro',
    floor_eur NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CHECK (source_reference_code <> target_derived_code),
    UNIQUE(external_hotel_id, source_reference_code, target_derived_code)
);

-- 6. Configuration du Tarif de Référence (Global ou par Catégorie de chambre + Priorité + Validité)
CREATE TABLE IF NOT EXISTS public.rate_reference_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    scope VARCHAR(25) NOT NULL DEFAULT 'all_categories'
        CHECK (scope IN ('all_categories', 'per_category')),
    room_category_code VARCHAR(60) NOT NULL DEFAULT 'ALL',
    reference_plan_code VARCHAR(60) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    valid_from DATE,
    valid_to DATE,
    priority INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    inheritance_mode VARCHAR(25) NOT NULL DEFAULT 'hotel_override'
        CHECK (inheritance_mode IN ('hotel_override', 'inherit_group')),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(external_hotel_id, scope, room_category_code, priority)
);

-- 7. Conditions commerciales et règles FLEX / NRF par plan tarifaire
CREATE TABLE IF NOT EXISTS public.rate_plan_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    rate_plan_code VARCHAR(60) NOT NULL,
    cancellation_policy VARCHAR(50) NOT NULL DEFAULT 'Flexible',
    cancellation_deadline_hours INTEGER DEFAULT 24,
    payment_policy VARCHAR(120) NOT NULL DEFAULT 'Paiement sur place',
    flex_nrf_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    stay_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    booking_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(external_hotel_id, rate_plan_code)
);

-- 8. Paramétrage Petit-Déjeuner & Prestations incluses
CREATE TABLE IF NOT EXISTS public.meal_plan_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) UNIQUE NOT NULL,
    meal_plan_name VARCHAR(120) NOT NULL DEFAULT 'Petit-Déjeuner Buffet Flowtym',
    description TEXT,
    public_adult_price_eur NUMERIC(10,2) NOT NULL DEFAULT 24.00 CHECK (public_adult_price_eur >= 0),
    internal_adult_cost_eur NUMERIC(10,2) NOT NULL DEFAULT 9.50 CHECK (internal_adult_cost_eur >= 0),
    child_price_eur NUMERIC(10,2) NOT NULL DEFAULT 12.00 CHECK (child_price_eur >= 0),
    vat_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    pricing_basis VARCHAR(20) NOT NULL DEFAULT 'per_person' CHECK (pricing_basis IN ('per_person', 'per_room')),
    beneficiary_category VARCHAR(40) NOT NULL DEFAULT 'adultes_et_enfants',
    included_count_default INTEGER NOT NULL DEFAULT 2,
    category_prices JSONB NOT NULL DEFAULT '[]'::jsonb,
    period_prices JSONB NOT NULL DEFAULT '[]'::jsonb,
    normalize_in_rm_engine BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 9. Suppléments, Packages & Promotions
CREATE TABLE IF NOT EXISTS public.rate_supplements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_item_id VARCHAR(120) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    code VARCHAR(60) NOT NULL,
    name VARCHAR(180) NOT NULL,
    category VARCHAR(50) NOT NULL,
    item_type VARCHAR(25) NOT NULL CHECK (item_type IN ('supplement', 'package', 'discount')),
    pricing_type VARCHAR(20) NOT NULL CHECK (pricing_type IN ('fixed_eur', 'percent')),
    value NUMERIC(10,2) NOT NULL,
    valid_from DATE,
    valid_to DATE,
    room_category_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    rate_plan_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    conditions TEXT,
    combinable BOOLEAN NOT NULL DEFAULT TRUE,
    exclude_from_reference_calc BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 10. Restrictions tarifaires par période, catégorie et plan
CREATE TABLE IF NOT EXISTS public.rate_restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_rule_id VARCHAR(120) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    name VARCHAR(180) NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    room_category_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    rate_plan_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    min_stay INTEGER,
    max_stay INTEGER,
    cta BOOLEAN NOT NULL DEFAULT FALSE,
    ctd BOOLEAN NOT NULL DEFAULT FALSE,
    stop_sell BOOLEAN NOT NULL DEFAULT FALSE,
    advance_booking_min_days INTEGER,
    allowed_arrival_days INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
    allowed_departure_days INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 11. Jobs & Lignes d'Importation (PMS / Channel Manager / Excel / CSV)
CREATE TABLE IF NOT EXISTS public.rate_import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_job_id VARCHAR(120) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    source VARCHAR(30) NOT NULL CHECK (source IN ('pms', 'channel_manager', 'excel', 'csv')),
    file_name VARCHAR(255),
    import_mode VARCHAR(30) NOT NULL CHECK (import_mode IN ('add_only', 'update_existing', 'ignore_existing')),
    items_count INTEGER NOT NULL DEFAULT 0,
    added_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    ignored_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    actor VARCHAR(255) NOT NULL,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rate_import_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.rate_import_jobs(id) ON DELETE CASCADE,
    external_code VARCHAR(80) NOT NULL,
    plan_name VARCHAR(180) NOT NULL,
    action VARCHAR(30) NOT NULL CHECK (action IN ('add', 'update', 'ignore', 'duplicate_conflict')),
    matched_internal_code VARCHAR(80),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 12. Tarifs Journaliers Normalisés (vue analytique persistée ou table dédiée synchronisée avec rate_calendar_cells)
CREATE TABLE IF NOT EXISTS public.daily_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_key VARCHAR(220) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    stay_date DATE NOT NULL,
    room_category_code VARCHAR(60) NOT NULL,
    rate_plan_code VARCHAR(60) NOT NULL,
    reference_plan_code VARCHAR(60),
    rate_eur NUMERIC(10,2) NOT NULL CHECK (rate_eur >= 0),
    normalized_excl_breakfast_eur NUMERIC(10,2),
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    is_independent BOOLEAN NOT NULL DEFAULT FALSE,
    sync_status VARCHAR(25) NOT NULL DEFAULT 'synced',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(external_hotel_id, stay_date, room_category_code, rate_plan_code)
);

-- 13. Historique Immuable de Configuration & Tarifs (rate_change_history)
CREATE TABLE IF NOT EXISTS public.rate_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_change_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_key VARCHAR(220) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    actor VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_prevent_rate_change_history_mutation ON public.rate_change_history;
CREATE TRIGGER trg_prevent_rate_change_history_mutation
    BEFORE UPDATE OR DELETE ON public.rate_change_history
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- RLS Multi-Hôtels sur l'ensemble des nouvelles tables
DO $$
DECLARE
    tbl TEXT;
    cfg_tables TEXT[] := ARRAY[
        'room_type_mappings',
        'rate_plan_mappings',
        'rate_plan_relations',
        'rate_reference_settings',
        'rate_plan_conditions',
        'meal_plan_settings',
        'rate_supplements',
        'rate_restrictions',
        'rate_import_jobs',
        'rate_import_items',
        'daily_rates',
        'rate_change_history'
    ];
BEGIN
    FOREACH tbl IN ARRAY cfg_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "rls_%s_auth" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "rls_%s_auth" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
            tbl, tbl
        );
    END LOOP;
END $$;
