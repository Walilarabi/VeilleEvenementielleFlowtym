-- ==============================================================================
-- FLOWTYM REVENUE — ARCHITECTURE UNIVERSELLE DE CONNECTEURS, INVENTAIRE,
-- MAPPINGS MULTI-EXTERNES, SYNCHRONISATION & IMPORT EXCEL INTELLIGENT (MIGRATION 05)
-- Script 100% idempotent — Multi-Hôtels & Tenant RLS strict
-- ==============================================================================

-- 1. Extension des tables existantes pour supporter les nouveaux statuts & retours PMS/CM
ALTER TABLE public.room_types
    ADD COLUMN IF NOT EXISTS sellable_rooms INTEGER,
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.rate_calendar_cells
    ADD COLUMN IF NOT EXISTS pms_returned_rate_eur NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS cm_returned_rate_eur NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS pms_updated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS cm_updated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS channel_allocations JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Mise à jour de la contrainte sync_status si nécessaire pour inclure 'saved_local' et 'queued'
DO $$
BEGIN
    ALTER TABLE public.rate_calendar_cells DROP CONSTRAINT IF EXISTS rate_calendar_cells_sync_status_check;
    ALTER TABLE public.rate_calendar_cells
        ADD CONSTRAINT rate_calendar_cells_sync_status_check
        CHECK (sync_status IN ('saved_local', 'queued', 'pending', 'sending', 'synced', 'failed', 'rejected', 'conflict'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2. Inventaire journalier dédié (Left for sale / Chambres vendues / OOO / Allotements canaux)
CREATE TABLE IF NOT EXISTS public.daily_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_key VARCHAR(220) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    stay_date DATE NOT NULL,
    room_type_code VARCHAR(60) NOT NULL,
    physical_rooms INTEGER NOT NULL DEFAULT 1 CHECK (physical_rooms >= 0),
    sellable_rooms INTEGER NOT NULL DEFAULT 1 CHECK (sellable_rooms >= 0),
    rooms_sold INTEGER NOT NULL DEFAULT 0 CHECK (rooms_sold >= 0),
    left_for_sale INTEGER NOT NULL DEFAULT 0 CHECK (left_for_sale >= 0),
    out_of_order_rooms INTEGER NOT NULL DEFAULT 0 CHECK (out_of_order_rooms >= 0),
    channel_allocations JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_system VARCHAR(60) NOT NULL DEFAULT 'flowtym',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system@flowtym.com',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(external_hotel_id, stay_date, room_type_code)
);

CREATE INDEX IF NOT EXISTS idx_daily_inventory_hotel_date
    ON public.daily_inventory(external_hotel_id, stay_date, room_type_code);

-- 3. Règles structurées des plans tarifaires (ordre d'application, arrondis, suppléments)
CREATE TABLE IF NOT EXISTS public.rate_plan_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_rule_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    rate_plan_code VARCHAR(60) NOT NULL,
    rule_priority INTEGER NOT NULL DEFAULT 1,
    calculation_mode VARCHAR(30) NOT NULL DEFAULT 'independent',
    variation_value NUMERIC(12,4) NOT NULL DEFAULT 0,
    custom_formula TEXT,
    rounding_rule VARCHAR(25) NOT NULL DEFAULT 'nearest_euro',
    floor_eur NUMERIC(10,2),
    ceiling_eur NUMERIC(10,2),
    occupancy_supplements JSONB NOT NULL DEFAULT '{}'::jsonb,
    channel_markups JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Centre de Connecteurs Universels (PMS, Channel Manager, Rate Shopper, Custom API)
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_connector_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    family VARCHAR(30) NOT NULL CHECK (family IN ('pms', 'channel_manager', 'rate_shopper')),
    provider_id VARCHAR(60) NOT NULL,
    provider_name VARCHAR(120) NOT NULL,
    display_name VARCHAR(180) NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    auth_type VARCHAR(30) NOT NULL DEFAULT 'api_key' CHECK (auth_type IN ('api_key', 'oauth2', 'bearer', 'basic', 'custom_header')),
    endpoint_url TEXT,
    hotel_external_code VARCHAR(120),
    webhook_url TEXT,
    encrypted_secrets_payload TEXT, -- Chiffré côté serveur (AES-256-GCM), jamais exposé en clair
    credentials_masked_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
    active_sync_mode VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (active_sync_mode IN ('manual', 'scheduled', 'realtime_webhook')),
    polling_interval_minutes INTEGER NOT NULL DEFAULT 15,
    auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_primary_for_family BOOLEAN NOT NULL DEFAULT FALSE,
    connection_status VARCHAR(30) NOT NULL DEFAULT 'unconfigured'
        CHECK (connection_status IN ('unconfigured', 'sandbox_ready', 'connected', 'degraded', 'error')),
    execution_mode VARCHAR(30) NOT NULL DEFAULT 'sandbox_simulation'
        CHECK (execution_mode IN ('live_api', 'sandbox_simulation')),
    last_read_test_at TIMESTAMP WITH TIME ZONE,
    last_write_test_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_hotel_family
    ON public.integrations(external_hotel_id, family, provider_id);

-- 5. Capacités déclarées par connecteur
CREATE TABLE IF NOT EXISTS public.integration_capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
    read_rates BOOLEAN NOT NULL DEFAULT TRUE,
    write_rates BOOLEAN NOT NULL DEFAULT FALSE,
    read_restrictions BOOLEAN NOT NULL DEFAULT TRUE,
    write_restrictions BOOLEAN NOT NULL DEFAULT FALSE,
    read_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    write_inventory BOOLEAN NOT NULL DEFAULT FALSE,
    import_room_types BOOLEAN NOT NULL DEFAULT TRUE,
    import_rate_plans BOOLEAN NOT NULL DEFAULT TRUE,
    supports_webhooks BOOLEAN NOT NULL DEFAULT FALSE,
    supports_polling BOOLEAN NOT NULL DEFAULT TRUE,
    supports_delta_sync BOOLEAN NOT NULL DEFAULT FALSE,
    max_days_per_batch INTEGER NOT NULL DEFAULT 90,
    supported_restriction_types TEXT[] NOT NULL DEFAULT ARRAY['min_stay', 'stop_sell'],
    UNIQUE(integration_id)
);

-- 6. Correspondances multiples par catégorie de chambre et par plan tarifaire (multi-connecteurs)
CREATE TABLE IF NOT EXISTS public.room_type_external_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_mapping_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    connector_id VARCHAR(150) NOT NULL,
    provider_id VARCHAR(60) NOT NULL,
    system_family VARCHAR(30) NOT NULL CHECK (system_family IN ('pms', 'channel_manager', 'rate_shopper')),
    internal_room_code VARCHAR(60) NOT NULL,
    external_room_code VARCHAR(120) NOT NULL,
    external_room_name VARCHAR(200),
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    last_verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(external_hotel_id, connector_id, external_room_code)
);

CREATE TABLE IF NOT EXISTS public.rate_plan_external_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_mapping_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    connector_id VARCHAR(150) NOT NULL,
    provider_id VARCHAR(60) NOT NULL,
    system_family VARCHAR(30) NOT NULL CHECK (system_family IN ('pms', 'channel_manager', 'rate_shopper')),
    internal_plan_code VARCHAR(60) NOT NULL,
    external_plan_code VARCHAR(120) NOT NULL,
    external_plan_name VARCHAR(200),
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    last_verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(external_hotel_id, connector_id, external_plan_code)
);

CREATE TABLE IF NOT EXISTS public.integration_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('room_type', 'rate_plan', 'channel', 'restriction')),
    internal_code VARCHAR(80) NOT NULL,
    external_code VARCHAR(150) NOT NULL,
    external_label VARCHAR(200),
    mapping_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(external_hotel_id, integration_id, entity_type, external_code)
);

-- 7. Jobs, Logs Techniques et Conflits de Synchronisation
CREATE TABLE IF NOT EXISTS public.synchronization_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_job_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    connector_id VARCHAR(150),
    provider_id VARCHAR(60),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
    scope_summary TEXT NOT NULL,
    cells_total INTEGER NOT NULL DEFAULT 0,
    cells_succeeded INTEGER NOT NULL DEFAULT 0,
    cells_failed INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(25) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'partial_error', 'failed')),
    actor VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.synchronization_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_log_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    connector_id VARCHAR(150) NOT NULL,
    provider_id VARCHAR(60) NOT NULL,
    family VARCHAR(30) NOT NULL,
    operation_type VARCHAR(40) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    status VARCHAR(25) NOT NULL CHECK (status IN ('queued', 'sending', 'synced', 'failed', 'rejected', 'conflict')),
    execution_mode VARCHAR(30) NOT NULL DEFAULT 'sandbox_simulation',
    room_type_code VARCHAR(60),
    rate_plan_code VARCHAR(60),
    stay_date_from DATE,
    stay_date_to DATE,
    cells_affected INTEGER NOT NULL DEFAULT 0,
    traceability_id VARCHAR(180) NOT NULL,
    external_ack_id VARCHAR(180),
    duration_ms INTEGER NOT NULL DEFAULT 0,
    actor VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    payload_preview TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_hotel_created
    ON public.synchronization_logs(external_hotel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.synchronization_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_conflict_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    cell_key VARCHAR(220) NOT NULL,
    connector_id VARCHAR(150),
    flowtym_value_json JSONB NOT NULL,
    external_value_json JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    resolution_strategy VARCHAR(30),
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 8. Jobs d'Import Excel, Modèles Réutilisables de Mapping & Erreurs d'Import
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_job_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    provider_preset VARCHAR(40) NOT NULL DEFAULT 'dedge_planning',
    status VARCHAR(30) NOT NULL DEFAULT 'completed',
    created_rooms_count INTEGER NOT NULL DEFAULT 0,
    created_plans_count INTEGER NOT NULL DEFAULT 0,
    updated_rates_count INTEGER NOT NULL DEFAULT 0,
    updated_inventory_count INTEGER NOT NULL DEFAULT 0,
    anomalies_count INTEGER NOT NULL DEFAULT 0,
    actor VARCHAR(255) NOT NULL,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.import_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_template_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    template_name VARCHAR(180) NOT NULL,
    provider_preset VARCHAR(40) NOT NULL,
    mapping_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.import_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    row_index INTEGER,
    sheet_name VARCHAR(120),
    stay_date DATE,
    room_label VARCHAR(180),
    plan_label VARCHAR(180),
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    error_code VARCHAR(60) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 9. File de modifications planifiées dans le futur
CREATE TABLE IF NOT EXISTS public.scheduled_rate_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_schedule_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'executed', 'cancelled', 'failed')),
    payload JSONB NOT NULL,
    actor VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 10. Liaison automatique hotel_id via external_hotel_id + Tenant RLS strict
DO $$
DECLARE
    tbl TEXT;
    new_tables TEXT[] := ARRAY[
        'daily_inventory',
        'rate_plan_rules',
        'integrations',
        'integration_capabilities',
        'room_type_external_mappings',
        'rate_plan_external_mappings',
        'integration_mappings',
        'synchronization_jobs',
        'synchronization_logs',
        'synchronization_conflicts',
        'import_jobs',
        'import_mappings',
        'import_errors',
        'scheduled_rate_changes'
    ];
BEGIN
    FOREACH tbl IN ARRAY new_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "rls_%s_auth" ON public.%I;', tbl, tbl);
        IF tbl IN ('integration_capabilities', 'import_errors') THEN
            EXECUTE format(
                'CREATE POLICY "rls_%s_auth" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
                tbl, tbl
            );
        ELSE
            EXECUTE format(
                'CREATE POLICY "rls_%s_auth" ON public.%I FOR ALL TO authenticated USING (hotel_id IS NULL OR public.can_access_hotel(hotel_id)) WITH CHECK (hotel_id IS NULL OR public.can_access_hotel(hotel_id));',
                tbl, tbl
            );
        END IF;
    END LOOP;
END $$;
