-- ==============================================================================
-- FLOWTYM REVENUE — MIGRATION 06 : DURCISSEMENT SCHÉMA & RLS MULTI-HÔTELS
-- Tables : integrations, integration_capabilities, integration_mappings
-- Isolation stricte par hotel_id (UUID) + résolution external_hotel_id + anti-doublon
-- ==============================================================================

-- 1. Ajouter hotel_id (UUID) directement sur integration_capabilities et integration_mappings
--    pour permettre une isolation RLS directe sans bypass NULL et des requêtes indexées par hôtel.
ALTER TABLE public.integration_capabilities
    ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS external_hotel_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

ALTER TABLE public.integration_mappings
    ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Rétro-remplissage sécurisé de hotel_id et external_hotel_id à partir de public.integrations
UPDATE public.integration_capabilities ic
SET
    hotel_id = i.hotel_id,
    external_hotel_id = i.external_hotel_id
FROM public.integrations i
WHERE ic.integration_id = i.id
  AND (ic.hotel_id IS NULL OR ic.external_hotel_id IS NULL);

UPDATE public.integration_mappings im
SET hotel_id = i.hotel_id
FROM public.integrations i
WHERE im.integration_id = i.id
  AND im.hotel_id IS NULL;

-- Index multi-hôtels performants
CREATE INDEX IF NOT EXISTS idx_integrations_hotel_uuid_active
    ON public.integrations(hotel_id, is_active, family);

CREATE INDEX IF NOT EXISTS idx_integration_capabilities_hotel_uuid
    ON public.integration_capabilities(hotel_id, integration_id);

CREATE INDEX IF NOT EXISTS idx_integration_mappings_hotel_entity
    ON public.integration_mappings(hotel_id, integration_id, entity_type, internal_code);

-- Empêcher tout doublon de code externe actif par intégration et type d'entité
CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_mappings_hotel_ext_code
    ON public.integration_mappings(hotel_id, integration_id, entity_type, UPPER(external_code))
    WHERE is_active = TRUE;

-- 2. Trigger automatique de cohérence hotel_id <-> external_hotel_id et héritage depuis integrations
CREATE OR REPLACE FUNCTION public.sync_integration_child_hotel_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_hotel_id UUID;
    v_ext_hotel_id VARCHAR(100);
BEGIN
    IF NEW.integration_id IS NOT NULL THEN
        SELECT hotel_id, external_hotel_id
        INTO v_hotel_id, v_ext_hotel_id
        FROM public.integrations
        WHERE id = NEW.integration_id
        LIMIT 1;

        IF v_hotel_id IS NOT NULL THEN
            NEW.hotel_id := v_hotel_id;
        END IF;
        IF v_ext_hotel_id IS NOT NULL THEN
            NEW.external_hotel_id := v_ext_hotel_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_hotel_uuid_integrations ON public.integrations;
CREATE TRIGGER trg_resolve_hotel_uuid_integrations
    BEFORE INSERT OR UPDATE ON public.integrations
    FOR EACH ROW EXECUTE FUNCTION public.resolve_hotel_uuid_from_external();

DROP TRIGGER IF EXISTS trg_sync_hotel_id_integration_capabilities ON public.integration_capabilities;
CREATE TRIGGER trg_sync_hotel_id_integration_capabilities
    BEFORE INSERT OR UPDATE ON public.integration_capabilities
    FOR EACH ROW EXECUTE FUNCTION public.sync_integration_child_hotel_id();

DROP TRIGGER IF EXISTS trg_sync_hotel_id_integration_mappings ON public.integration_mappings;
CREATE TRIGGER trg_sync_hotel_id_integration_mappings
    BEFORE INSERT OR UPDATE ON public.integration_mappings
    FOR EACH ROW EXECUTE FUNCTION public.sync_integration_child_hotel_id();

-- 3. Politiques RLS STRICTES par hotel_id (aucun USING (true), aucun contournement hotel_id IS NULL)
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_integrations_auth" ON public.integrations;
DROP POLICY IF EXISTS "rls_integrations_tenant" ON public.integrations;
CREATE POLICY "rls_integrations_tenant" ON public.integrations
    FOR ALL TO authenticated
    USING (
        public.can_access_hotel(hotel_id)
        OR EXISTS (
            SELECT 1 FROM public.hotels h
            WHERE h.external_id = external_hotel_id
              AND public.can_access_hotel(h.id)
        )
    )
    WITH CHECK (
        public.can_access_hotel(hotel_id)
        OR EXISTS (
            SELECT 1 FROM public.hotels h
            WHERE h.external_id = external_hotel_id
              AND public.can_access_hotel(h.id)
        )
    );

ALTER TABLE public.integration_capabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_integration_capabilities_auth" ON public.integration_capabilities;
DROP POLICY IF EXISTS "rls_integration_capabilities_tenant" ON public.integration_capabilities;
CREATE POLICY "rls_integration_capabilities_tenant" ON public.integration_capabilities
    FOR ALL TO authenticated
    USING (
        public.can_access_hotel(hotel_id)
        OR EXISTS (
            SELECT 1 FROM public.integrations i
            WHERE i.id = integration_id
              AND public.can_access_hotel(i.hotel_id)
        )
    )
    WITH CHECK (
        public.can_access_hotel(hotel_id)
        OR EXISTS (
            SELECT 1 FROM public.integrations i
            WHERE i.id = integration_id
              AND public.can_access_hotel(i.hotel_id)
        )
    );

ALTER TABLE public.integration_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_integration_mappings_auth" ON public.integration_mappings;
DROP POLICY IF EXISTS "rls_integration_mappings_tenant" ON public.integration_mappings;
CREATE POLICY "rls_integration_mappings_tenant" ON public.integration_mappings
    FOR ALL TO authenticated
    USING (
        public.can_access_hotel(hotel_id)
        OR EXISTS (
            SELECT 1 FROM public.integrations i
            WHERE i.id = integration_id
              AND public.can_access_hotel(i.hotel_id)
        )
    )
    WITH CHECK (
        public.can_access_hotel(hotel_id)
        OR EXISTS (
            SELECT 1 FROM public.integrations i
            WHERE i.id = integration_id
              AND public.can_access_hotel(i.hotel_id)
        )
    );
