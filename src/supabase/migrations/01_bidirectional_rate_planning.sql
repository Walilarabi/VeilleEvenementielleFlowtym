-- ==============================================================================
-- FLOWTYM REVENUE — PLANNING TARIFAIRE CONNECTÉ & SYNCHRONISATION BIDIRECTIONNELLE
-- Extension PostgreSQL / Supabase (Idempotente)
-- ==============================================================================

-- 1. Configuration de connectivité bidirectionnelle par hôtel (Mode A PMS vs Mode B Channel Manager vs Coexistence)
CREATE TABLE IF NOT EXISTS public.hotel_connectivity_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) UNIQUE NOT NULL,
    active_mode VARCHAR(30) NOT NULL DEFAULT 'channel_manager'
        CHECK (active_mode IN ('pms', 'channel_manager', 'dual_coordinated')),
    pms_provider VARCHAR(100) NOT NULL DEFAULT 'Opera PMS',
    channel_manager_provider VARCHAR(100) NOT NULL DEFAULT 'D-EDGE CRS',
    source_of_truth VARCHAR(30) NOT NULL DEFAULT 'flowtym'
        CHECK (source_of_truth IN ('flowtym', 'pms', 'channel_manager')),
    pms_responsibilities TEXT[] NOT NULL DEFAULT ARRAY['inventory', 'restrictions'],
    cm_responsibilities TEXT[] NOT NULL DEFAULT ARRAY['ota_distribution', 'rates'],
    conflict_priority_strategy VARCHAR(30) NOT NULL DEFAULT 'manual'
        CHECK (conflict_priority_strategy IN ('manual', 'priority_flowtym', 'priority_pms', 'priority_channel_manager')),
    anti_loop_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    webhook_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    webhook_url TEXT,
    polling_interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK (polling_interval_minutes > 0),
    dual_mode_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    last_push_at TIMESTAMP WITH TIME ZONE,
    last_pull_at TIMESTAMP WITH TIME ZONE,
    connection_health VARCHAR(20) NOT NULL DEFAULT 'connected'
        CHECK (connection_health IN ('connected', 'degraded', 'offline')),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Cellules du Planning Tarifaire (Typologie × Plan tarifaire × Date) avec versionnement optimiste & états de vérité
CREATE TABLE IF NOT EXISTS public.rate_calendar_cells (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_key VARCHAR(220) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    room_type_code VARCHAR(60) NOT NULL,
    room_type_name VARCHAR(150) NOT NULL,
    rate_plan_code VARCHAR(30) NOT NULL,
    rate_plan_name VARCHAR(150) NOT NULL,
    stay_date DATE NOT NULL,
    current_rate_eur NUMERIC(10,2) NOT NULL CHECK (current_rate_eur >= 0),
    previous_rate_eur NUMERIC(10,2),
    inventory_available INTEGER NOT NULL DEFAULT 0 CHECK (inventory_available >= 0),
    total_rooms_in_category INTEGER NOT NULL DEFAULT 1,
    min_stay INTEGER NOT NULL DEFAULT 1 CHECK (min_stay >= 1),
    max_stay INTEGER,
    cta BOOLEAN NOT NULL DEFAULT FALSE,
    ctd BOOLEAN NOT NULL DEFAULT FALSE,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    channel_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    flowtym_saved_rate_eur NUMERIC(10,2) NOT NULL,
    transmitted_rate_eur NUMERIC(10,2),
    confirmed_external_rate_eur NUMERIC(10,2),
    sync_status VARCHAR(25) NOT NULL DEFAULT 'synced'
        CHECK (sync_status IN ('pending', 'sending', 'synced', 'failed', 'rejected', 'conflict')),
    sync_error_message TEXT,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_ack_id VARCHAR(150),
    modification_origin VARCHAR(30) NOT NULL DEFAULT 'flowtym_auto'
        CHECK (modification_origin IN ('flowtym_auto', 'flowtym_manual', 'pms', 'channel_manager')),
    is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1,
    external_version INTEGER NOT NULL DEFAULT 1,
    last_external_rate_eur NUMERIC(10,2),
    last_external_updated_at TIMESTAMP WITH TIME ZONE,
    last_external_actor VARCHAR(255),
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system@flowtym.com',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(external_hotel_id, room_type_code, rate_plan_code, stay_date)
);

CREATE INDEX IF NOT EXISTS idx_rate_calendar_cells_hotel_date
    ON public.rate_calendar_cells(external_hotel_id, stay_date, room_type_code);

-- 3. Registre des Recommandations du Moteur RM liées au Planning Tarifaire
CREATE TABLE IF NOT EXISTS public.rate_recommendations_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommendation_id VARCHAR(180) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    stay_date DATE NOT NULL,
    room_type_code VARCHAR(60) NOT NULL,
    rate_plan_code VARCHAR(30) NOT NULL,
    current_rate_eur NUMERIC(10,2) NOT NULL,
    recommended_rate_eur NUMERIC(10,2) NOT NULL,
    delta_eur NUMERIC(10,2) NOT NULL,
    delta_pct NUMERIC(6,2) NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    justification TEXT NOT NULL,
    algorithm_version VARCHAR(50) NOT NULL DEFAULT 'FLOWTYM-RM-v4.2',
    suggested_min_stay INTEGER NOT NULL DEFAULT 1,
    suggested_stop_sell BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(25) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'modified', 'rejected', 'expired')),
    rejection_reason TEXT,
    decided_by VARCHAR(255),
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Journal & File des Opérations de Synchronisation Bidirectionnelle (Sens 1 Push & Sens 2 Pull/Webhook)
CREATE TABLE IF NOT EXISTS public.rate_sync_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_op_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    cell_key VARCHAR(220) NOT NULL,
    stay_date DATE NOT NULL,
    room_type_code VARCHAR(60) NOT NULL,
    rate_plan_code VARCHAR(30) NOT NULL,
    direction VARCHAR(30) NOT NULL
        CHECK (direction IN ('outbound_push', 'inbound_pull', 'webhook_inbound')),
    target_system VARCHAR(30) NOT NULL
        CHECK (target_system IN ('pms', 'channel_manager')),
    origin VARCHAR(30) NOT NULL
        CHECK (origin IN ('flowtym_auto', 'flowtym_manual', 'pms', 'channel_manager')),
    idempotency_key VARCHAR(200) UNIQUE NOT NULL,
    previous_rate_eur NUMERIC(10,2),
    new_rate_eur NUMERIC(10,2) NOT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sending', 'synced', 'failed', 'rejected', 'conflict')),
    external_ack_id VARCHAR(150),
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_rate_sync_ops_hotel_date
    ON public.rate_sync_operations(external_hotel_id, created_at DESC);

-- 5. Table des Conflits Concurrents (Détection & Résolution explicite)
CREATE TABLE IF NOT EXISTS public.rate_sync_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_conflict_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    cell_key VARCHAR(220) NOT NULL,
    stay_date DATE NOT NULL,
    room_type_code VARCHAR(60) NOT NULL,
    room_type_name VARCHAR(150) NOT NULL,
    rate_plan_code VARCHAR(30) NOT NULL,
    flowtym_rate_eur NUMERIC(10,2) NOT NULL,
    flowtym_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    flowtym_actor VARCHAR(255) NOT NULL,
    external_rate_eur NUMERIC(10,2) NOT NULL,
    external_source VARCHAR(30) NOT NULL CHECK (external_source IN ('pms', 'channel_manager')),
    external_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    external_actor VARCHAR(255) NOT NULL,
    base_version INTEGER NOT NULL,
    external_version INTEGER NOT NULL,
    pending_recommendation_id VARCHAR(180),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    resolution_choice VARCHAR(30),
    resolved_rate_eur NUMERIC(10,2),
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 6. Historique Immuable des Modifications de Cellules (Traçabilité & Annulation sans suppression)
CREATE TABLE IF NOT EXISTS public.rate_cell_audit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_history_id VARCHAR(150) UNIQUE NOT NULL,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) NOT NULL,
    cell_key VARCHAR(220) NOT NULL,
    stay_date DATE NOT NULL,
    room_type_code VARCHAR(60) NOT NULL,
    rate_plan_code VARCHAR(30) NOT NULL,
    action_type VARCHAR(40) NOT NULL
        CHECK (action_type IN (
            'recommendation_accepted',
            'recommendation_rejected',
            'manual_edit',
            'bulk_edit',
            'inbound_external_sync',
            'conflict_resolved',
            'reverted',
            'sync_retry'
        )),
    previous_rate_eur NUMERIC(10,2),
    new_rate_eur NUMERIC(10,2) NOT NULL,
    origin VARCHAR(30) NOT NULL
        CHECK (origin IN ('flowtym_auto', 'flowtym_manual', 'pms', 'channel_manager')),
    sync_status VARCHAR(25) NOT NULL
        CHECK (sync_status IN ('pending', 'sending', 'synced', 'failed', 'rejected', 'conflict')),
    recommendation_id VARCHAR(180),
    sync_operation_id VARCHAR(150),
    reverted_from_history_id VARCHAR(150),
    actor VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Protection d'immutabilité sur rate_cell_audit_history (aucun UPDATE/DELETE)
DROP TRIGGER IF EXISTS trg_prevent_rate_history_mutation ON public.rate_cell_audit_history;
CREATE TRIGGER trg_prevent_rate_history_mutation
    BEFORE UPDATE OR DELETE ON public.rate_cell_audit_history
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- RLS sur les nouvelles tables
DO $$
DECLARE
    tbl TEXT;
    new_tables TEXT[] := ARRAY[
        'hotel_connectivity_configs',
        'rate_calendar_cells',
        'rate_recommendations_ledger',
        'rate_sync_operations',
        'rate_sync_conflicts',
        'rate_cell_audit_history'
    ];
BEGIN
    FOREACH tbl IN ARRAY new_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "rls_%s_auth" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "rls_%s_auth" ON public.%I FOR ALL TO authenticated USING (hotel_id IS NULL OR public.can_access_hotel(hotel_id)) WITH CHECK (hotel_id IS NULL OR public.can_access_hotel(hotel_id));',
            tbl, tbl
        );
    END LOOP;
END $$;
