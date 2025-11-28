-- ============================================================
-- SalesPrep-AI Complete Database Schema
-- Version: 2.0
-- Last Updated: 2024-11-28
-- 
-- Run this in Supabase SQL Editor to create/update all tables
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";  -- For embeddings

-- ============================================================
-- 1. ORGANIZATIONS (Multi-tenant container)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,  -- For URL-friendly names
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- ============================================================
-- 2. ORGANIZATION_MEMBERS (User <-> Org link)
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate memberships
  UNIQUE(organization_id, user_id)
);

-- Critical indexes for performance (used in EVERY request!)
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- ============================================================
-- 3. PROSPECTS (NEW! - Central prospect entity)
-- ============================================================
-- This is the missing piece! All research/prep/followup should link here
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Core fields
  company_name TEXT NOT NULL,
  company_name_normalized TEXT GENERATED ALWAYS AS (LOWER(TRIM(company_name))) STORED,
  
  -- Optional enrichment
  website TEXT,
  linkedin_url TEXT,
  industry TEXT,
  company_size TEXT,
  country TEXT,
  city TEXT,
  
  -- Contact info (primary contact)
  contact_name TEXT,
  contact_email TEXT,
  contact_role TEXT,
  contact_linkedin TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'researching', 'qualified', 'meeting_scheduled', 'proposal_sent', 'won', 'lost', 'inactive')),
  
  -- Metadata
  notes TEXT,
  tags TEXT[],  -- Array for flexible categorization
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate prospects per org (normalized name)
  UNIQUE(organization_id, company_name_normalized)
);

-- Indexes for prospect lookups
CREATE INDEX IF NOT EXISTS idx_prospects_org ON prospects(organization_id);
CREATE INDEX IF NOT EXISTS idx_prospects_name_normalized ON prospects(company_name_normalized);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_prospects_last_activity ON prospects(organization_id, last_activity_at DESC);

-- Full text search on company name
CREATE INDEX IF NOT EXISTS idx_prospects_name_search ON prospects USING gin(to_tsvector('simple', company_name));

-- ============================================================
-- 4. SALES_PROFILES (Per user sales profile)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile data
  full_name TEXT,
  role TEXT,
  experience_years INTEGER,
  sales_methodology TEXT,
  communication_style TEXT,
  strengths TEXT[],
  target_industries TEXT[],
  target_regions TEXT[],
  quarterly_goals TEXT,
  
  -- AI-generated content
  sales_narrative TEXT,
  ai_summary TEXT,
  
  -- Completeness tracking
  profile_completeness INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One sales profile per user per org
  UNIQUE(organization_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_profiles_user ON sales_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_profiles_org ON sales_profiles(organization_id);

-- ============================================================
-- 5. COMPANY_PROFILES (Per org company profile)
-- ============================================================
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Company info
  company_name TEXT,
  industry TEXT,
  website TEXT,
  
  -- Products (JSONB array)
  products JSONB DEFAULT '[]'::jsonb,
  
  -- Value propositions
  core_value_props TEXT[],
  differentiators TEXT[],
  
  -- ICP (Ideal Customer Profile)
  ideal_customer_profile JSONB DEFAULT '{}'::jsonb,
  
  -- Case studies (JSONB array)
  case_studies JSONB DEFAULT '[]'::jsonb,
  
  -- AI-generated content
  company_narrative TEXT,
  ai_summary TEXT,
  
  -- Completeness tracking
  profile_completeness INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One company profile per org
  UNIQUE(organization_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_profiles_org ON company_profiles(organization_id);

-- ============================================================
-- 6. PROFILE_VERSIONS (Version history)
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_type TEXT NOT NULL CHECK (profile_type IN ('sales', 'company')),
  profile_id UUID NOT NULL,
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profile_versions_profile ON profile_versions(profile_type, profile_id);

-- ============================================================
-- 7. RESEARCH_BRIEFS (Prospect research)
-- ============================================================
CREATE TABLE IF NOT EXISTS research_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Link to prospect (NEW! - replaces company_name string)
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  
  -- Legacy fields (keep for backwards compatibility, but prefer prospect_id)
  company_name TEXT NOT NULL,
  company_linkedin_url TEXT,
  country TEXT,
  city TEXT,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'researching', 'completed', 'failed')),
  
  -- Research data
  research_data JSONB DEFAULT '{}'::jsonb,
  brief_content TEXT,
  pdf_url TEXT,
  
  -- Error tracking
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_research_briefs_org ON research_briefs(organization_id);
CREATE INDEX IF NOT EXISTS idx_research_briefs_user ON research_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_research_briefs_prospect ON research_briefs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_research_briefs_status ON research_briefs(status);
CREATE INDEX IF NOT EXISTS idx_research_briefs_created ON research_briefs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_briefs_org_status ON research_briefs(organization_id, status);

-- ============================================================
-- 8. RESEARCH_SOURCES (Research data sources)
-- ============================================================
CREATE TABLE IF NOT EXISTS research_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  research_id UUID NOT NULL REFERENCES research_briefs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('claude', 'gemini', 'kvk', 'premium', 'web')),
  source_name TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_research_sources_research ON research_sources(research_id);

-- ============================================================
-- 9. MEETING_PREPS (Meeting preparations)
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_preps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Link to prospect (NEW!)
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  
  -- Legacy field (keep for backwards compatibility)
  prospect_company_name TEXT,
  
  -- Link to research
  research_brief_id UUID REFERENCES research_briefs(id) ON DELETE SET NULL,
  
  -- Meeting info
  meeting_type TEXT,
  meeting_date TIMESTAMPTZ,
  custom_notes TEXT,
  
  -- Generated content
  brief_content TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_preps_org ON meeting_preps(organization_id);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_user ON meeting_preps(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_prospect ON meeting_preps(prospect_id);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_research ON meeting_preps(research_brief_id);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_org_status ON meeting_preps(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_created ON meeting_preps(organization_id, created_at DESC);

-- ============================================================
-- 10. FOLLOWUPS (Post-meeting follow-ups)
-- ============================================================
CREATE TABLE IF NOT EXISTS followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Link to prospect (NEW!)
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  
  -- Legacy field (keep for backwards compatibility)
  prospect_company_name TEXT,
  
  -- Link to meeting prep (optional)
  meeting_prep_id UUID REFERENCES meeting_preps(id) ON DELETE SET NULL,
  
  -- Meeting info
  meeting_date DATE,
  meeting_subject TEXT,
  
  -- Audio/transcript
  audio_url TEXT,
  audio_filename TEXT,
  audio_size_bytes INTEGER,
  audio_duration_seconds INTEGER,
  
  -- Transcription
  transcription_text TEXT,
  transcription_segments JSONB DEFAULT '[]'::jsonb,
  speaker_count INTEGER DEFAULT 0,
  
  -- Generated summary
  executive_summary TEXT,
  key_points TEXT[] DEFAULT '{}',
  concerns TEXT[] DEFAULT '{}',
  decisions TEXT[] DEFAULT '{}',
  next_steps TEXT[] DEFAULT '{}',
  action_items JSONB DEFAULT '[]'::jsonb,
  
  -- Email draft
  email_draft TEXT,
  email_tone TEXT DEFAULT 'professional',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'transcribing', 'summarizing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_followups_org ON followups(organization_id);
CREATE INDEX IF NOT EXISTS idx_followups_user ON followups(user_id);
CREATE INDEX IF NOT EXISTS idx_followups_prospect ON followups(prospect_id);
CREATE INDEX IF NOT EXISTS idx_followups_prep ON followups(meeting_prep_id);
CREATE INDEX IF NOT EXISTS idx_followups_org_status ON followups(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_followups_created ON followups(organization_id, created_at DESC);

-- ============================================================
-- 11. KNOWLEDGE_BASE_FILES (Uploaded documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_base_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- File info
  filename TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  
  -- Processing
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'completed', 'failed')),
  chunk_count INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kb_files_org ON knowledge_base_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_kb_files_status ON knowledge_base_files(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_kb_files_created ON knowledge_base_files(organization_id, created_at DESC);

-- ============================================================
-- 12. KNOWLEDGE_BASE_CHUNKS (Document chunks with embeddings)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_base_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES knowledge_base_files(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Chunk data
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  
  -- Vector embedding (1536 dimensions for OpenAI, 768 for others)
  embedding vector(1536),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kb_chunks_file ON knowledge_base_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_org ON knowledge_base_chunks(organization_id);

-- Vector similarity search index (for RAG)
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON knowledge_base_chunks 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_preps ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_chunks ENABLE ROW LEVEL SECURITY;

-- Helper function: Get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

-- ========================
-- ORGANIZATIONS policies
-- ========================
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (id IN (SELECT get_user_org_ids()));

-- ========================
-- ORGANIZATION_MEMBERS policies
-- ========================
CREATE POLICY "Users can view members of their orgs"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ========================
-- PROSPECTS policies
-- ========================
CREATE POLICY "Users can view prospects in their org"
  ON prospects FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert prospects in their org"
  ON prospects FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update prospects in their org"
  ON prospects FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can delete prospects in their org"
  ON prospects FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ========================
-- SALES_PROFILES policies
-- ========================
CREATE POLICY "Users can view sales profiles in their org"
  ON sales_profiles FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can manage their own sales profile"
  ON sales_profiles FOR ALL
  USING (user_id = auth.uid());

-- ========================
-- COMPANY_PROFILES policies
-- ========================
CREATE POLICY "Users can view company profile in their org"
  ON company_profiles FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can manage company profile in their org"
  ON company_profiles FOR ALL
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ========================
-- RESEARCH_BRIEFS policies
-- ========================
CREATE POLICY "Users can view research in their org"
  ON research_briefs FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert research in their org"
  ON research_briefs FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update research in their org"
  ON research_briefs FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can delete research in their org"
  ON research_briefs FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ========================
-- RESEARCH_SOURCES policies
-- ========================
CREATE POLICY "Users can view sources of their research"
  ON research_sources FOR SELECT
  USING (
    research_id IN (
      SELECT id FROM research_briefs WHERE organization_id IN (SELECT get_user_org_ids())
    )
  );

CREATE POLICY "Users can insert sources for their research"
  ON research_sources FOR INSERT
  WITH CHECK (
    research_id IN (
      SELECT id FROM research_briefs WHERE organization_id IN (SELECT get_user_org_ids())
    )
  );

-- ========================
-- MEETING_PREPS policies
-- ========================
CREATE POLICY "Users can view preps in their org"
  ON meeting_preps FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert preps in their org"
  ON meeting_preps FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update preps in their org"
  ON meeting_preps FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can delete preps in their org"
  ON meeting_preps FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ========================
-- FOLLOWUPS policies
-- ========================
CREATE POLICY "Users can view followups in their org"
  ON followups FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert followups in their org"
  ON followups FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update followups in their org"
  ON followups FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can delete followups in their org"
  ON followups FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ========================
-- KNOWLEDGE_BASE_FILES policies
-- ========================
CREATE POLICY "Users can view KB files in their org"
  ON knowledge_base_files FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert KB files in their org"
  ON knowledge_base_files FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update KB files in their org"
  ON knowledge_base_files FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can delete KB files in their org"
  ON knowledge_base_files FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ========================
-- KNOWLEDGE_BASE_CHUNKS policies
-- ========================
CREATE POLICY "Users can view KB chunks in their org"
  ON knowledge_base_chunks FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert KB chunks in their org"
  ON knowledge_base_chunks FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Knowledge base files bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base-files', 'knowledge-base-files', false)
ON CONFLICT (id) DO NOTHING;

-- Follow-up audio bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('followup-audio', 'followup-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Research PDFs bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-pdfs', 'research-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

-- Allow authenticated users to manage files in knowledge-base-files
CREATE POLICY "Authenticated users can upload KB files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge-base-files');

CREATE POLICY "Authenticated users can read KB files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-base-files');

CREATE POLICY "Authenticated users can delete KB files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-base-files');

-- Allow authenticated users to manage files in followup-audio
CREATE POLICY "Authenticated users can upload audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'followup-audio');

CREATE POLICY "Authenticated users can read audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'followup-audio');

CREATE POLICY "Authenticated users can delete audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'followup-audio');

-- Allow authenticated users to manage research PDFs
CREATE POLICY "Authenticated users can upload research PDFs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'research-pdfs');

CREATE POLICY "Authenticated users can read research PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'research-pdfs');


-- ============================================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON sales_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to get or create prospect (for backwards compatibility)
CREATE OR REPLACE FUNCTION get_or_create_prospect(
  p_organization_id UUID,
  p_company_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_prospect_id UUID;
  v_normalized_name TEXT;
BEGIN
  v_normalized_name := LOWER(TRIM(p_company_name));
  
  -- Try to find existing prospect
  SELECT id INTO v_prospect_id
  FROM prospects
  WHERE organization_id = p_organization_id
    AND company_name_normalized = v_normalized_name;
  
  -- Create if not exists
  IF v_prospect_id IS NULL THEN
    INSERT INTO prospects (organization_id, company_name)
    VALUES (p_organization_id, p_company_name)
    RETURNING id INTO v_prospect_id;
  END IF;
  
  RETURN v_prospect_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update prospect last_activity_at
CREATE OR REPLACE FUNCTION update_prospect_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prospect_id IS NOT NULL THEN
    UPDATE prospects SET last_activity_at = NOW() WHERE id = NEW.prospect_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply activity triggers
CREATE TRIGGER update_prospect_activity_research 
  AFTER INSERT OR UPDATE ON research_briefs
  FOR EACH ROW EXECUTE FUNCTION update_prospect_activity();

CREATE TRIGGER update_prospect_activity_prep 
  AFTER INSERT OR UPDATE ON meeting_preps
  FOR EACH ROW EXECUTE FUNCTION update_prospect_activity();

CREATE TRIGGER update_prospect_activity_followup 
  AFTER INSERT OR UPDATE ON followups
  FOR EACH ROW EXECUTE FUNCTION update_prospect_activity();


-- ============================================================
-- MIGRATION: Link existing data to prospects (run once)
-- ============================================================

-- This migrates existing data by creating prospects from unique company names
-- Run this AFTER the schema is applied

-- DO $$
-- DECLARE
--   r RECORD;
--   v_prospect_id UUID;
-- BEGIN
--   -- Migrate from research_briefs
--   FOR r IN 
--     SELECT DISTINCT organization_id, company_name 
--     FROM research_briefs 
--     WHERE prospect_id IS NULL AND company_name IS NOT NULL
--   LOOP
--     v_prospect_id := get_or_create_prospect(r.organization_id, r.company_name);
--     UPDATE research_briefs 
--     SET prospect_id = v_prospect_id 
--     WHERE organization_id = r.organization_id 
--       AND LOWER(TRIM(company_name)) = LOWER(TRIM(r.company_name))
--       AND prospect_id IS NULL;
--   END LOOP;
--   
--   -- Migrate from meeting_preps
--   FOR r IN 
--     SELECT DISTINCT organization_id, prospect_company_name 
--     FROM meeting_preps 
--     WHERE prospect_id IS NULL AND prospect_company_name IS NOT NULL
--   LOOP
--     v_prospect_id := get_or_create_prospect(r.organization_id, r.prospect_company_name);
--     UPDATE meeting_preps 
--     SET prospect_id = v_prospect_id 
--     WHERE organization_id = r.organization_id 
--       AND LOWER(TRIM(prospect_company_name)) = LOWER(TRIM(r.prospect_company_name))
--       AND prospect_id IS NULL;
--   END LOOP;
--   
--   -- Migrate from followups
--   FOR r IN 
--     SELECT DISTINCT organization_id, prospect_company_name 
--     FROM followups 
--     WHERE prospect_id IS NULL AND prospect_company_name IS NOT NULL
--   LOOP
--     v_prospect_id := get_or_create_prospect(r.organization_id, r.prospect_company_name);
--     UPDATE followups 
--     SET prospect_id = v_prospect_id 
--     WHERE organization_id = r.organization_id 
--       AND LOWER(TRIM(prospect_company_name)) = LOWER(TRIM(r.prospect_company_name))
--       AND prospect_id IS NULL;
--   END LOOP;
-- END $$;
