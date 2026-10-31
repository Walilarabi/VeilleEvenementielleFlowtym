-- ==============================================================================
-- FLOWTYM EVENT INTELLIGENCE — SUPABASE POSTGRESQL SCHEMA (WITH RLS & AUDIT)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users (extending auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'revenue_manager', -- admin, revenue_manager, gm, analyst
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Hotels
CREATE TABLE IF NOT EXISTS public.hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    group_name VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    address TEXT,
    lat NUMERIC(9,6) NOT NULL,
    lng NUMERIC(9,6) NOT NULL,
    stars INTEGER CHECK (stars BETWEEN 1 AND 5),
    room_count INTEGER NOT NULL,
    segment VARCHAR(50) NOT NULL, -- Luxe, Boutique, Affaires, Economique, Resort
    base_adr NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Cities
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    lat NUMERIC(9,6) NOT NULL,
    lng NUMERIC(9,6) NOT NULL,
    coverage_score NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Venues (Infrastructures)
CREATE TABLE IF NOT EXISTS public.venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    venue_type VARCHAR(100) NOT NULL, -- parc_expositions, arena, stade, etc.
    capacity INTEGER NOT NULL,
    address TEXT,
    lat NUMERIC(9,6) NOT NULL,
    lng NUMERIC(9,6) NOT NULL,
    official_website TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Events
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    category VARCHAR(100) NOT NULL,
    venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed', -- confirmed, estimated_recurrent, announced_pending
    impact_level VARCHAR(50) DEFAULT 'modere', -- hyper, critique, modere, faible
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency VARCHAR(50),
    expected_attendance INTEGER DEFAULT 0,
    international_ratio NUMERIC(5,2) DEFAULT 0.00,
    confidence_score NUMERIC(5,2) DEFAULT 95.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Event Occurrences (Dates)
CREATE TABLE IF NOT EXISTS public.event_occurrences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_date_confirmed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Event Sources
CREATE TABLE IF NOT EXISTS public.event_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    source_type VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    reliability_score NUMERIC(5,2) DEFAULT 90.00,
    last_crawled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'healthy',
    is_official BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Event Evidence (Vérification & Preuves)
CREATE TABLE IF NOT EXISTS public.event_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    source_id UUID REFERENCES public.event_sources(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    excerpt TEXT NOT NULL,
    proof_url TEXT,
    trust_score NUMERIC(5,2) DEFAULT 95.00
);

-- 10. Event Hotel Impacts & RM Scores (Calculs personnalisés par hôtel)
CREATE TABLE IF NOT EXISTS public.event_hotel_impacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
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

-- 11. Event Suggestions (Détection IA & Validation RM)
CREATE TABLE IF NOT EXISTS public.event_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    suggested_start_date DATE NOT NULL,
    suggested_end_date DATE NOT NULL,
    detected_via TEXT NOT NULL,
    confidence NUMERIC(5,2) NOT NULL,
    reason TEXT NOT NULL,
    impact_predicted VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, dismissed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Row Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_hotel_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization data"
ON public.hotels FOR SELECT
USING (organization_id IN (
    SELECT organization_id FROM public.users WHERE users.id = auth.uid()
));

CREATE POLICY "Events are viewable by authenticated users"
ON public.events FOR SELECT
TO authenticated
USING (true);
