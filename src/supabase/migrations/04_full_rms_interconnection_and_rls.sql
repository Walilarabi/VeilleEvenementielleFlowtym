-- ==============================================================================
-- FLOWTYM REVENUE — MIGRATION 04 : INTERCONNEXION INTÉGRALE, TRIGGERS KPI & RLS
-- Idempotente · Multi-tenant · Résolution UUID · Calculs Centralisés PostgreSQL
-- ==============================================================================

-- 1. Fonction trigger universelle de résolution external_hotel_id -> hotel_id (UUID)
CREATE OR REPLACE FUNCTION public.resolve_hotel_uuid_from_external()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_hotel_uuid UUID;
BEGIN
    IF NEW.hotel_id IS NULL AND NEW.external_hotel_id IS NOT NULL AND NEW.external_hotel_id <> '' THEN
        SELECT id INTO v_hotel_uuid
        FROM public.hotels
        WHERE external_id = NEW.external_hotel_id
        LIMIT 1;
        IF v_hotel_uuid IS NOT NULL THEN
            NEW.hotel_id := v_hotel_uuid;
        END IF;
    ELSIF NEW.hotel_id IS NOT NULL AND (NEW.external_hotel_id IS NULL OR NEW.external_hotel_id = '') THEN
        SELECT external_id INTO NEW.external_hotel_id
        FROM public.hotels
        WHERE id = NEW.hotel_id
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Table de snapshots complets de configuration tarifaire (alignée backend /api/tariff-config)
CREATE TABLE IF NOT EXISTS public.tariff_config_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    external_hotel_id VARCHAR(100) UNIQUE NOT NULL,
    config_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Extension idempotente de rate_parity_checks pour persistance complète du monitoring de parité
ALTER TABLE public.rate_parity_checks
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(150) UNIQUE,
    ADD COLUMN IF NOT EXISTS external_hotel_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS room_type VARCHAR(120) NOT NULL DEFAULT 'Double Classique',
    ADD COLUMN IF NOT EXISTS severity VARCHAR(30) NOT NULL DEFAULT 'ok',
    ADD COLUMN IF NOT EXISTS ai_diagnostic TEXT,
    ADD COLUMN IF NOT EXISTS root_cause TEXT,
    ADD COLUMN IF NOT EXISTS recommended_action TEXT,
    ADD COLUMN IF NOT EXISTS slack_sent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS remediation_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS direct_url TEXT,
    ADD COLUMN IF NOT EXISTS ota_url TEXT;

-- Autoriser upsert par external_hotel_id sur hotel_id nullable avant trigger
ALTER TABLE public.rate_parity_checks
    ALTER COLUMN hotel_id DROP NOT NULL;

-- 4. Extension idempotente de dedge_inventory_days pour suivi OTB & revenu net exact
ALTER TABLE public.dedge_inventory_days
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS revenue_net_eur NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS adr_net_eur NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS revpar_eur NUMERIC(10,2) DEFAULT 0.00;

-- 5. Attachement du trigger de résolution hotel_id <-> external_hotel_id sur toutes les tables clés
DO $$
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY[
        'hotel_rms_configs',
        'rm_alerts',
        'rm_decision_records',
        'room_type_mappings',
        'rate_plan_mappings',
        'rate_plan_relations',
        'rate_reference_settings',
        'rate_plan_conditions',
        'meal_plan_settings',
        'rate_supplements',
        'rate_restrictions',
        'rate_import_jobs',
        'daily_rates',
        'rate_change_history',
        'dedge_inventory_days',
        'rate_calendar_cells',
        'rate_parity_checks',
        'tariff_config_snapshots'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_resolve_hotel_uuid_%s ON public.%I;', tbl, tbl);
            EXECUTE format(
                'CREATE TRIGGER trg_resolve_hotel_uuid_%s BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.resolve_hotel_uuid_from_external();',
                tbl, tbl
            );
        END IF;
    END LOOP;
END $$;

-- 6. Durcissement RLS STRICT sur toutes les tables de configuration tarifaire (remplace USING (true))
DO $$
DECLARE
    tbl TEXT;
    strict_hotel_tables TEXT[] := ARRAY[
        'room_type_mappings',
        'rate_plan_mappings',
        'rate_plan_relations',
        'rate_reference_settings',
        'rate_plan_conditions',
        'meal_plan_settings',
        'rate_supplements',
        'rate_restrictions',
        'rate_import_jobs',
        'daily_rates',
        'rate_change_history',
        'tariff_config_snapshots'
    ];
BEGIN
    FOREACH tbl IN ARRAY strict_hotel_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "rls_%s_auth" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "rls_%s_tenant" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "rls_%s_tenant" ON public.%I FOR ALL TO authenticated USING (public.can_access_hotel(hotel_id) OR EXISTS (SELECT 1 FROM public.hotels h WHERE h.external_id = external_hotel_id AND public.can_access_hotel(h.id))) WITH CHECK (public.can_access_hotel(hotel_id) OR EXISTS (SELECT 1 FROM public.hotels h WHERE h.external_id = external_hotel_id AND public.can_access_hotel(h.id)));',
            tbl, tbl
        );
    END LOOP;
END $$;

ALTER TABLE public.rate_import_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_rate_import_items_auth" ON public.rate_import_items;
DROP POLICY IF EXISTS "rls_rate_import_items_tenant" ON public.rate_import_items;
CREATE POLICY "rls_rate_import_items_tenant" ON public.rate_import_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rate_import_jobs j
            WHERE j.id = job_id AND public.can_access_hotel(j.hotel_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.rate_import_jobs j
            WHERE j.id = job_id AND public.can_access_hotel(j.hotel_id)
        )
    );

-- Policies explicites sur system_admin_configs & system_operation_logs
ALTER TABLE public.system_admin_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_system_admin_configs_org" ON public.system_admin_configs;
CREATE POLICY "rls_system_admin_configs_org" ON public.system_admin_configs
    FOR ALL TO authenticated
    USING (organization_id IS NULL OR organization_id = public.get_my_organization_id())
    WITH CHECK (organization_id IS NULL OR organization_id = public.get_my_organization_id());

ALTER TABLE public.system_operation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_system_operation_logs_org" ON public.system_operation_logs;
CREATE POLICY "rls_system_operation_logs_org" ON public.system_operation_logs
    FOR ALL TO authenticated
    USING (organization_id IS NULL OR organization_id = public.get_my_organization_id())
    WITH CHECK (organization_id IS NULL OR organization_id = public.get_my_organization_id());

-- 7. Recalcul automatique Inventaire D-EDGE & OTB depuis les réservations (Trigger + RPC)
CREATE OR REPLACE FUNCTION public.recalculate_hotel_kpis(
    p_hotel_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '90 days')::DATE
)
RETURNS TABLE (
    stay_date DATE,
    total_rooms INTEGER,
    rooms_sold INTEGER,
    rooms_available INTEGER,
    occupancy_percent NUMERIC(5,2),
    adr_net_eur NUMERIC(10,2),
    revpar_eur NUMERIC(10,2),
    compset_median_eur NUMERIC(10,2),
    recommended_bar_eur NUMERIC(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hotel RECORD;
BEGIN
    SELECT id, external_id, room_count, base_adr, floor_rate, ceiling_rate
    INTO v_hotel
    FROM public.hotels
    WHERE id = p_hotel_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Hôtel introuvable: %', p_hotel_id;
    END IF;

    IF NOT public.can_access_hotel(p_hotel_id) THEN
        RAISE EXCEPTION 'Accès refusé pour cet hôtel.';
    END IF;

    RETURN QUERY
    WITH date_series AS (
        SELECT gs::DATE AS d
        FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') gs
    ),
    res_agg AS (
        SELECT
            rn.stay_date AS d,
            COUNT(*) FILTER (WHERE rn.is_active_otb = TRUE)::INTEGER AS sold_cnt,
            COALESCE(ROUND(AVG(rn.room_rate_net_eur) FILTER (WHERE rn.is_active_otb = TRUE), 2), v_hotel.base_adr) AS avg_adr,
            COALESCE(SUM(rn.room_rate_net_eur) FILTER (WHERE rn.is_active_otb = TRUE), 0) AS net_rev
        FROM public.reservation_stay_nights rn
        WHERE rn.hotel_id = p_hotel_id
          AND rn.stay_date BETWEEN p_start_date AND p_end_date
        GROUP BY rn.stay_date
    ),
    inv_day AS (
        SELECT d.date_str, d.rooms_sold, d.rooms_available, d.occupancy_percent
        FROM public.dedge_inventory_days d
        WHERE (d.hotel_id = p_hotel_id OR d.external_hotel_id = v_hotel.external_id)
          AND d.date_str BETWEEN p_start_date AND p_end_date
    ),
    comp_agg AS (
        SELECT c.date_str, c.compset_median_eur
        FROM public.v_compset_daily_benchmark c
        WHERE c.external_hotel_id = v_hotel.external_id
          AND c.date_str BETWEEN p_start_date AND p_end_date
    )
    SELECT
        ds.d AS stay_date,
        v_hotel.room_count AS total_rooms,
        COALESCE(ra.sold_cnt, inv.rooms_sold, 0) AS rooms_sold,
        GREATEST(0, v_hotel.room_count - COALESCE(ra.sold_cnt, inv.rooms_sold, 0)) AS rooms_available,
        ROUND(
            LEAST(100.0, GREATEST(0.0, (COALESCE(ra.sold_cnt, inv.rooms_sold, 0)::NUMERIC / NULLIF(v_hotel.room_count, 0)) * 100.0)),
            2
        ) AS occupancy_percent,
        COALESCE(ra.avg_adr, v_hotel.base_adr) AS adr_net_eur,
        ROUND(
            (COALESCE(ra.sold_cnt, inv.rooms_sold, 0)::NUMERIC * COALESCE(ra.avg_adr, v_hotel.base_adr)) / NULLIF(v_hotel.room_count, 0),
            2
        ) AS revpar_eur,
        ca.compset_median_eur,
        LEAST(
            v_hotel.ceiling_rate,
            GREATEST(
                v_hotel.floor_rate,
                COALESCE(rec.applied_bar_eur, rec.suggested_bar_eur, ca.compset_median_eur, v_hotel.base_adr)
            )
        ) AS recommended_bar_eur
    FROM date_series ds
    LEFT JOIN res_agg ra ON ra.d = ds.d
    LEFT JOIN inv_day inv ON inv.date_str = ds.d
    LEFT JOIN comp_agg ca ON ca.date_str = ds.d
    LEFT JOIN public.daily_rate_recommendations rec
        ON rec.hotel_id = p_hotel_id AND rec.stay_date = ds.d AND rec.room_type_id IS NULL
    ORDER BY ds.d ASC;
END;
$$;

-- Trigger qui synchronise les nuits réservées vers dedge_inventory_days et otb_pace_snapshots
CREATE OR REPLACE FUNCTION public.sync_stay_night_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hotel RECORD;
    v_stay_date DATE;
    v_sold INTEGER;
    v_rev NUMERIC(12,2);
    v_occ NUMERIC(5,2);
    v_adr NUMERIC(10,2);
BEGIN
    v_stay_date := COALESCE(NEW.stay_date, OLD.stay_date);
    SELECT id, external_id, organization_id, room_count, base_adr
    INTO v_hotel
    FROM public.hotels
    WHERE id = COALESCE(NEW.hotel_id, OLD.hotel_id);

    IF NOT FOUND THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT
        COUNT(*) FILTER (WHERE is_active_otb = TRUE)::INTEGER,
        COALESCE(SUM(room_rate_net_eur) FILTER (WHERE is_active_otb = TRUE), 0)
    INTO v_sold, v_rev
    FROM public.reservation_stay_nights
    WHERE hotel_id = v_hotel.id AND stay_date = v_stay_date;

    v_occ := ROUND(LEAST(100.0, (v_sold::NUMERIC / NULLIF(v_hotel.room_count, 0)) * 100.0), 2);
    v_adr := CASE WHEN v_sold > 0 THEN ROUND(v_rev / v_sold, 2) ELSE v_hotel.base_adr END;

    INSERT INTO public.dedge_inventory_days (
        hotel_id, external_hotel_id, organization_id, date_str,
        total_rooms, rooms_sold, rooms_available, occupancy_percent,
        revenue_net_eur, adr_net_eur, revpar_eur, updated_at
    ) VALUES (
        v_hotel.id, v_hotel.external_id, v_hotel.organization_id, v_stay_date,
        v_hotel.room_count, v_sold, GREATEST(0, v_hotel.room_count - v_sold), v_occ,
        v_rev, v_adr, ROUND(v_rev / NULLIF(v_hotel.room_count, 0), 2), NOW()
    )
    ON CONFLICT (external_hotel_id, date_str)
    DO UPDATE SET
        rooms_sold = EXCLUDED.rooms_sold,
        rooms_available = EXCLUDED.rooms_available,
        occupancy_percent = EXCLUDED.occupancy_percent,
        revenue_net_eur = EXCLUDED.revenue_net_eur,
        adr_net_eur = EXCLUDED.adr_net_eur,
        revpar_eur = EXCLUDED.revpar_eur,
        updated_at = NOW();

    INSERT INTO public.otb_pace_snapshots (
        hotel_id, snapshot_date, stay_date, rooms_otb, revenue_otb_eur,
        occupancy_percent, adr_net_eur, revpar_eur
    ) VALUES (
        v_hotel.id, CURRENT_DATE, v_stay_date, v_sold, v_rev,
        v_occ, v_adr, ROUND(v_rev / NULLIF(v_hotel.room_count, 0), 2)
    )
    ON CONFLICT (hotel_id, snapshot_date, stay_date)
    DO UPDATE SET
        rooms_otb = EXCLUDED.rooms_otb,
        revenue_otb_eur = EXCLUDED.revenue_otb_eur,
        occupancy_percent = EXCLUDED.occupancy_percent,
        adr_net_eur = EXCLUDED.adr_net_eur,
        revpar_eur = EXCLUDED.revpar_eur;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stay_night_inventory ON public.reservation_stay_nights;
CREATE TRIGGER trg_sync_stay_night_inventory
    AFTER INSERT OR UPDATE OR DELETE ON public.reservation_stay_nights
    FOR EACH ROW EXECUTE FUNCTION public.sync_stay_night_to_inventory();

-- 8. Vue SQL unifiée v_hotel_daily_kpis (KPI temps réel par hôtel et date)
CREATE OR REPLACE VIEW public.v_hotel_daily_kpis AS
SELECT
    h.id AS hotel_id,
    h.external_id,
    h.organization_id,
    h.name AS hotel_name,
    h.city,
    h.room_count AS total_rooms,
    inv.date_str AS stay_date,
    inv.rooms_sold,
    inv.rooms_available,
    inv.occupancy_percent,
    COALESCE(NULLIF(inv.adr_net_eur, 0), rec.adr_net_eur, h.base_adr) AS adr_net_eur,
    ROUND(
        (inv.rooms_sold::NUMERIC * COALESCE(NULLIF(inv.adr_net_eur, 0), rec.adr_net_eur, h.base_adr)) / NULLIF(h.room_count, 0),
        2
    ) AS revpar_eur,
    inv.pickup_24h,
    inv.pickup_72h,
    inv.pickup_7d,
    comp.compset_median_eur,
    comp.compset_avg_eur,
    comp.sold_out_competitors_count,
    rec.suggested_bar_eur,
    rec.applied_bar_eur,
    rec.validation_status,
    par.parity_status,
    par.parity_gap_eur
FROM public.hotels h
JOIN public.dedge_inventory_days inv
    ON inv.hotel_id = h.id OR inv.external_hotel_id = h.external_id
LEFT JOIN public.v_compset_daily_benchmark comp
    ON comp.external_hotel_id = h.external_id AND comp.date_str = inv.date_str
LEFT JOIN public.daily_rate_recommendations rec
    ON rec.hotel_id = h.id AND rec.stay_date = inv.date_str AND rec.room_type_id IS NULL
LEFT JOIN public.rate_parity_checks par
    ON (par.hotel_id = h.id OR par.external_hotel_id = h.external_id) AND par.stay_date = inv.date_str;
