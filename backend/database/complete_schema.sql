-- ============================================================
-- SalesPrep-AI Complete Database Schema
-- Version: 3.0
-- Last Updated: 4 December 2025
-- 
-- This file consolidates ALL migrations into a single schema.
-- Use this as reference documentation - DO NOT run on existing DB!
-- 
-- Changes in 3.0:
-- - Added user_settings table (i18n preferences)
-- - Added coach_daily_tips table (Luna caching)
-- - Added deals, meetings, prospect_activities tables
-- - Added billing v2 with flow-based pricing
-- - Added seller context fields (style_guide, etc.)
-- - Added i18n language fields to all content tables
-- - Updated RLS policies for performance
-- - Consolidated all indexes
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
  
  -- i18n (added in migration_i18n_languages)
  default_working_language TEXT DEFAULT 'en' 
    CHECK (default_working_language IN ('nl', 'en', 'de', 'fr', 'es', 'hi', 'ar')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- ============================================================
-- 2. USERS (Sync from auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. ORGANIZATION_MEMBERS (User <-> Org link)
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  
  -- i18n override (added in migration_i18n_languages)
  working_language_override TEXT 
    CHECK (working_language_override IS NULL OR working_language_override IN ('nl', 'en', 'de', 'fr', 'es', 'hi', 'ar')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- ============================================================
-- 4. USER_SETTINGS (Per-user preferences)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Language preferences
  app_language VARCHAR(5) DEFAULT 'en',      -- UI language
  output_language VARCHAR(5) DEFAULT 'en',   -- AI output language
  email_language VARCHAR(5) DEFAULT 'en',    -- Email generation language
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ============================================================
-- 5. PROSPECTS (Central prospect entity)
-- ============================================================
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
  
  -- Contact info (primary contact - legacy, use prospect_contacts instead)
  contact_name TEXT,
  contact_email TEXT,
  contact_role TEXT,
  contact_linkedin TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'researching', 'qualified', 'meeting_scheduled', 'proposal_sent', 'won', 'lost', 'inactive')),
  
  -- i18n (added in migration_i18n_languages)
  preferred_language TEXT DEFAULT 'en'
    CHECK (preferred_language IN ('nl', 'en', 'de', 'fr', 'es', 'hi', 'ar')),
  
  -- Metadata
  notes TEXT,
  tags TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, company_name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_prospects_org ON prospects(organization_id);
CREATE INDEX IF NOT EXISTS idx_prospects_name_normalized ON prospects(company_name_normalized);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_prospects_last_activity ON prospects(organization_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_language ON prospects(organization_id, preferred_language);
CREATE INDEX IF NOT EXISTS idx_prospects_name_search ON prospects USING gin(to_tsvector('simple', company_name));

-- ============================================================
-- 6. PROSPECT_CONTACTS (Multiple contacts per prospect)
-- ============================================================
CREATE TABLE IF NOT EXISTS prospect_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Basic Contact Info
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  
  -- LinkedIn Analysis Data
  linkedin_headline TEXT,
  linkedin_summary TEXT,
  linkedin_experience JSONB,          -- [{company, title, duration}]
  linkedin_activity_level TEXT,       -- 'active', 'moderate', 'passive'
  linkedin_post_themes TEXT[],
  
  -- AI-Generated Insights (contact understanding)
  communication_style TEXT,           -- 'formal', 'informal', 'technical', 'strategic'
  probable_drivers TEXT,              -- Motivations
  decision_authority TEXT,            -- 'decision_maker', 'influencer', 'gatekeeper', 'user'
  urgency_signals TEXT,
  
  -- Contact Analysis
  profile_brief TEXT,                 -- Full markdown analysis
  pain_points_for_role TEXT,
  
  -- Legacy action fields (now generated in Prep instead)
  conversation_approach TEXT,         -- DEPRECATED: Generated in prep_generator
  opening_suggestions TEXT[],         -- DEPRECATED: Generated in prep_generator
  questions_to_ask TEXT[],            -- DEPRECATED: Generated in prep_generator
  topics_to_avoid TEXT[],             -- DEPRECATED: Generated in prep_generator
  
  -- Relationship Tracking
  is_primary BOOLEAN DEFAULT false,
  relationship_strength TEXT,         -- 'new', 'warm', 'strong'
  last_contact_date TIMESTAMPTZ,
  notes TEXT,
  
  -- Meta
  analyzed_at TIMESTAMPTZ,
  analysis_source TEXT,               -- 'linkedin', 'manual', 'crm_import'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_contacts_prospect ON prospect_contacts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_contacts_org ON prospect_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_prospect_contacts_primary ON prospect_contacts(prospect_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_prospect_contacts_name ON prospect_contacts(organization_id, LOWER(name));

-- ============================================================
-- 7. SALES_PROFILES (Per user sales profile)
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
  areas_to_improve TEXT[],
  target_industries TEXT[],
  target_regions TEXT[],
  target_company_sizes TEXT[],
  quarterly_goals TEXT,
  preferred_meeting_types TEXT[],
  
  -- AI-generated content
  sales_narrative TEXT,
  ai_summary TEXT,
  methodology_description TEXT,
  style_notes TEXT,
  
  -- Interview responses (JSONB for flexibility)
  interview_responses JSONB,
  
  -- Personalization settings (JSONB)
  personalization_settings JSONB,
  
  -- Style Guide (added in migration_seller_context)
  style_guide JSONB,                  -- {tone, formality, emoji_usage, signoff, writing_length, ...}
  email_tone TEXT,                    -- 'direct', 'warm', 'formal', 'casual'
  uses_emoji BOOLEAN DEFAULT FALSE,
  email_signoff TEXT,
  writing_length_preference TEXT,     -- 'concise', 'detailed'
  
  -- Completeness tracking
  profile_completeness INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  last_reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_profiles_user ON sales_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_profiles_org ON sales_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_profiles_style_guide ON sales_profiles USING GIN (style_guide);

-- ============================================================
-- 8. COMPANY_PROFILES (Per org company profile - SELLER's company)
-- ============================================================
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Company info
  company_name TEXT,
  industry TEXT,
  website TEXT,
  
  -- Products (JSONB array of {name, description, benefits, target_audience})
  products JSONB DEFAULT '[]'::jsonb,
  
  -- Value propositions
  core_value_props TEXT[],
  differentiators TEXT[],
  
  -- ICP - Ideal Customer Profile (JSONB object)
  -- Structure: {industries: [], company_sizes: [], pain_points: [], decision_makers: []}
  ideal_customer_profile JSONB DEFAULT '{}'::jsonb,
  
  -- Case studies (JSONB array)
  case_studies JSONB DEFAULT '[]'::jsonb,
  
  -- AI-generated content
  company_narrative TEXT,
  ai_summary TEXT,
  
  -- Completeness tracking
  profile_completeness INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_org ON company_profiles(organization_id);

-- ============================================================
-- 9. PROFILE_VERSIONS (Version history)
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

CREATE INDEX IF NOT EXISTS idx_profile_versions_profile ON profile_versions(profile_type, profile_id);

-- ============================================================
-- 10. RESEARCH_BRIEFS (Prospect research)
-- ============================================================
CREATE TABLE IF NOT EXISTS research_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Link to prospect (preferred)
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  
  -- Link to contact (optional)
  contact_id UUID REFERENCES prospect_contacts(id),
  
  -- Legacy fields (kept for backwards compatibility)
  company_name TEXT NOT NULL,
  company_linkedin_url TEXT,
  country TEXT,
  city TEXT,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'researching', 'completed', 'failed')),
  
  -- i18n (added in migration_i18n_languages)
  language TEXT DEFAULT 'en',
  
  -- Research data
  research_data JSONB DEFAULT '{}'::jsonb,
  brief_content TEXT,
  pdf_url TEXT,
  
  -- Error tracking
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_briefs_org ON research_briefs(organization_id);
CREATE INDEX IF NOT EXISTS idx_research_briefs_user ON research_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_research_briefs_prospect ON research_briefs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_research_briefs_contact ON research_briefs(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_research_briefs_status ON research_briefs(status);
CREATE INDEX IF NOT EXISTS idx_research_briefs_created ON research_briefs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_briefs_org_status ON research_briefs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_research_briefs_language ON research_briefs(organization_id, language);

-- ============================================================
-- 11. RESEARCH_SOURCES (Research data sources)
-- ============================================================
CREATE TABLE IF NOT EXISTS research_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  research_id UUID NOT NULL REFERENCES research_briefs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('claude', 'gemini', 'kvk', 'premium', 'web')),
  source_name TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_sources_research ON research_sources(research_id);

-- ============================================================
-- 12. DEALS (Sales opportunities - for grouping activities)
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- User-entered fields
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- CRM Sync fields (populated by future CRM integration)
  crm_deal_id TEXT,
  crm_source TEXT,                    -- 'hubspot', 'salesforce', 'pipedrive'
  crm_stage TEXT,
  crm_value_cents BIGINT,
  crm_currency TEXT,
  crm_probability INTEGER,            -- 0-100
  crm_expected_close DATE,
  crm_owner TEXT,
  crm_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_prospect ON deals(prospect_id);
CREATE INDEX IF NOT EXISTS idx_deals_organization ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_active ON deals(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_deals_crm ON deals(crm_deal_id) WHERE crm_deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_created ON deals(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_created_by ON deals(created_by);

-- ============================================================
-- 13. MEETINGS (Individual meetings)
-- ============================================================
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Meeting Info
  title TEXT NOT NULL,
  meeting_type TEXT,                  -- 'discovery', 'demo', 'negotiation', 'closing', 'review', 'other'
  
  -- Scheduling
  scheduled_date TIMESTAMPTZ,
  actual_date TIMESTAMPTZ,
  duration_minutes INTEGER,
  location TEXT,
  
  -- Attendees
  contact_ids UUID[] DEFAULT '{}',
  
  -- Notes
  notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('positive', 'neutral', 'negative')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_deal ON meetings(deal_id);
CREATE INDEX IF NOT EXISTS idx_meetings_prospect ON meetings(prospect_id);
CREATE INDEX IF NOT EXISTS idx_meetings_organization ON meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_meetings_created ON meetings(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);

-- ============================================================
-- 14. MEETING_PREPS (Meeting preparations)
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_preps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Links
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  research_brief_id UUID REFERENCES research_briefs(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  
  -- Contact links (added in migration_contact_links)
  contact_ids UUID[] DEFAULT '{}',
  
  -- Legacy field
  prospect_company_name TEXT,
  
  -- Meeting info
  meeting_type TEXT,
  meeting_date TIMESTAMPTZ,
  custom_notes TEXT,
  
  -- i18n (added in migration_i18n_languages)
  language TEXT DEFAULT 'en',
  
  -- Generated content
  brief_content TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meeting_preps_org ON meeting_preps(organization_id);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_user ON meeting_preps(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_prospect ON meeting_preps(prospect_id);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_research ON meeting_preps(research_brief_id);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_deal ON meeting_preps(deal_id);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_meeting ON meeting_preps(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_contact_ids ON meeting_preps USING GIN(contact_ids);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_org_status ON meeting_preps(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_created ON meeting_preps(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_preps_language ON meeting_preps(organization_id, language);

-- ============================================================
-- 15. FOLLOWUPS (Post-meeting follow-ups)
-- ============================================================
CREATE TABLE IF NOT EXISTS followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Links
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  meeting_prep_id UUID REFERENCES meeting_preps(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  
  -- Contact links (added in migration_contact_links)
  contact_ids UUID[] DEFAULT '{}',
  
  -- Legacy field
  prospect_company_name TEXT,
  
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
  full_summary_content TEXT,          -- Added in migration_enhanced_followup
  key_points TEXT[] DEFAULT '{}',
  concerns TEXT[] DEFAULT '{}',
  decisions TEXT[] DEFAULT '{}',
  next_steps TEXT[] DEFAULT '{}',
  action_items JSONB DEFAULT '[]'::jsonb,
  
  -- Commercial insights (added in migration_enhanced_followup)
  include_coaching BOOLEAN DEFAULT false,
  commercial_signals JSONB,           -- BANT, cross-sell, upsell, deal risks
  observations JSONB,                 -- Doubts, unspoken needs, opportunities
  coaching_feedback JSONB,            -- Sales coaching analysis
  
  -- Email draft
  email_draft TEXT,
  email_tone TEXT DEFAULT 'professional',
  
  -- i18n (added in migration_i18n_languages)
  language TEXT DEFAULT 'en',
  email_language TEXT DEFAULT 'en',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'transcribing', 'summarizing', 'completed', 'failed')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_followups_org ON followups(organization_id);
CREATE INDEX IF NOT EXISTS idx_followups_user ON followups(user_id);
CREATE INDEX IF NOT EXISTS idx_followups_prospect ON followups(prospect_id);
CREATE INDEX IF NOT EXISTS idx_followups_prep ON followups(meeting_prep_id);
CREATE INDEX IF NOT EXISTS idx_followups_deal ON followups(deal_id);
CREATE INDEX IF NOT EXISTS idx_followups_meeting ON followups(meeting_id);
CREATE INDEX IF NOT EXISTS idx_followups_contact_ids ON followups USING GIN(contact_ids);
CREATE INDEX IF NOT EXISTS idx_followups_org_status ON followups(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_followups_created ON followups(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_followups_language ON followups(organization_id, language);
CREATE INDEX IF NOT EXISTS idx_followups_include_coaching ON followups(include_coaching) WHERE include_coaching = true;

-- ============================================================
-- 16. FOLLOWUP_ACTIONS (Generated actions from follow-ups)
-- ============================================================
CREATE TABLE IF NOT EXISTS followup_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  followup_id UUID NOT NULL REFERENCES followups(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Action details
  action_type TEXT NOT NULL,          -- 'share_email', 'customer_report', 'internal_report', 'action_items', 'sales_coaching'
  title TEXT,
  content TEXT,                       -- Generated content (markdown)
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_followup_actions_followup ON followup_actions(followup_id);
CREATE INDEX IF NOT EXISTS idx_followup_actions_org ON followup_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_followup_actions_type ON followup_actions(action_type);

-- ============================================================
-- 17. PROSPECT_ACTIVITIES (Timeline logging)
-- ============================================================
CREATE TABLE IF NOT EXISTS prospect_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Activity Info
  activity_type TEXT NOT NULL,        -- 'research', 'contact_added', 'prep', 'meeting', 'followup', 'deal_created', 'note'
  activity_id UUID,
  
  -- Display
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  
  -- Extra data
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_prospect ON prospect_activities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON prospect_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_meeting ON prospect_activities(meeting_id);
CREATE INDEX IF NOT EXISTS idx_activities_organization ON prospect_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON prospect_activities(prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON prospect_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_prospect_activities_created_by ON prospect_activities(created_by);

-- ============================================================
-- 18. KNOWLEDGE_BASE_FILES (Uploaded documents)
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
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kb_files_org ON knowledge_base_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_kb_files_status ON knowledge_base_files(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_kb_files_created ON knowledge_base_files(organization_id, created_at DESC);

-- ============================================================
-- 19. KNOWLEDGE_BASE_CHUNKS (Document chunks with embeddings)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_base_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES knowledge_base_files(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Chunk data
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  
  -- Vector embedding (1536 dimensions for OpenAI/Voyage)
  embedding vector(1536),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_file ON knowledge_base_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_org ON knowledge_base_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON knowledge_base_chunks 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- 20. SUBSCRIPTION_PLANS (Static Configuration)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,                -- 'free', 'light_solo', 'unlimited_solo', 'enterprise'
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER,                -- Price in cents (0, 995, 2995, NULL)
  original_price_cents INTEGER,       -- Original price for strikethrough (added in billing_v2)
  billing_interval TEXT,              -- 'month', 'year', NULL
  stripe_price_id TEXT,               -- Stripe Price ID
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert v2 plans
INSERT INTO subscription_plans (id, name, description, price_cents, original_price_cents, billing_interval, features, display_order, is_active) VALUES
('free', 'Free', 'Start gratis met 2 flows', 0, NULL, NULL, '{
  "flow_limit": 2,
  "user_limit": 1,
  "crm_integration": false,
  "team_sharing": false,
  "priority_support": false
}'::jsonb, 1, true),
('light_solo', 'Light Solo', 'Voor de startende sales pro', 995, NULL, 'month', '{
  "flow_limit": 5,
  "user_limit": 1,
  "crm_integration": false,
  "team_sharing": false,
  "priority_support": false
}'::jsonb, 2, true),
('unlimited_solo', 'Unlimited Solo', 'Onbeperkt voor early adopters', 2995, 7995, 'month', '{
  "flow_limit": -1,
  "user_limit": 1,
  "crm_integration": false,
  "team_sharing": false,
  "priority_support": true
}'::jsonb, 3, true),
('enterprise', 'Enterprise', 'Voor teams met CRM integraties', NULL, NULL, NULL, '{
  "flow_limit": -1,
  "user_limit": -1,
  "crm_integration": true,
  "team_sharing": true,
  "priority_support": true,
  "crm_providers": ["dynamics", "salesforce", "hubspot", "pipedrive", "zoho"],
  "sso": true,
  "dedicated_support": true
}'::jsonb, 4, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 21. ORGANIZATION_SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id) DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',  -- 'trialing', 'active', 'past_due', 'canceled', 'suspended'
  
  -- Stripe references
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  
  -- Billing cycle
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  
  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_subs_stripe_customer ON organization_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_stripe_subscription ON organization_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_status ON organization_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_org_subs_plan ON organization_subscriptions(plan_id);

-- ============================================================
-- 22. USAGE_RECORDS (Per Billing Period)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Usage counters
  flow_count INTEGER DEFAULT 0,       -- Added in billing_v2 (primary metric)
  research_count INTEGER DEFAULT 0,
  preparation_count INTEGER DEFAULT 0,
  followup_count INTEGER DEFAULT 0,
  transcription_seconds INTEGER DEFAULT 0,
  kb_document_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_org_period ON usage_records(organization_id, period_start, period_end);

-- ============================================================
-- 23. PAYMENT_HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Stripe references
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  
  -- Payment details
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'eur',
  status TEXT NOT NULL,               -- 'paid', 'failed', 'refunded', 'pending'
  
  -- Invoice
  invoice_pdf_url TEXT,
  invoice_number TEXT,
  
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_org ON payment_history(organization_id, created_at DESC);

-- ============================================================
-- 24. STRIPE_WEBHOOK_EVENTS (Idempotency)
-- ============================================================
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,                -- Stripe event ID (evt_...)
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);

-- ============================================================
-- 25. COACH_DAILY_TIPS (Luna AI cache)
-- ============================================================
CREATE TABLE IF NOT EXISTS coach_daily_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tip_data JSONB NOT NULL,
  -- tip_data: {id, category, title, content, icon, is_personalized}
  is_personalized BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, tip_date)
);

CREATE INDEX IF NOT EXISTS idx_coach_daily_tips_user_date ON coach_daily_tips(user_id, tip_date);
CREATE INDEX IF NOT EXISTS idx_coach_daily_tips_created ON coach_daily_tips(created_at);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES
('knowledge-base-files', 'knowledge-base-files', false),
('followup-audio', 'followup-audio', false),
('research-pdfs', 'research-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = '';

-- Get or create prospect
CREATE OR REPLACE FUNCTION get_or_create_prospect(
  p_organization_id UUID,
  p_company_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_prospect_id UUID;
  v_normalized_name TEXT;
BEGIN
  v_normalized_name := LOWER(TRIM(p_company_name));
  
  SELECT id INTO v_prospect_id
  FROM prospects
  WHERE organization_id = p_organization_id
    AND company_name_normalized = v_normalized_name;
  
  IF v_prospect_id IS NULL THEN
    INSERT INTO prospects (organization_id, company_name)
    VALUES (p_organization_id, p_company_name)
    RETURNING id INTO v_prospect_id;
  END IF;
  
  RETURN v_prospect_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Get or create usage record
CREATE OR REPLACE FUNCTION get_or_create_usage_record(p_organization_id UUID)
RETURNS UUID AS $$
DECLARE
  v_usage_id UUID;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  v_period_start := date_trunc('month', NOW());
  v_period_end := v_period_start + INTERVAL '1 month';
  
  SELECT id INTO v_usage_id
  FROM usage_records
  WHERE organization_id = p_organization_id
    AND period_start = v_period_start;
  
  IF v_usage_id IS NULL THEN
    INSERT INTO usage_records (organization_id, period_start, period_end)
    VALUES (p_organization_id, v_period_start, v_period_end)
    RETURNING id INTO v_usage_id;
  END IF;
  
  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Check flow limit
CREATE OR REPLACE FUNCTION check_flow_limit(p_organization_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_plan_id TEXT;
  v_features JSONB;
  v_limit INTEGER;
  v_current INTEGER;
BEGIN
  SELECT plan_id INTO v_plan_id
  FROM organization_subscriptions
  WHERE organization_id = p_organization_id;
  
  IF v_plan_id IS NULL THEN
    v_plan_id := 'free';
  END IF;
  
  SELECT features INTO v_features
  FROM subscription_plans
  WHERE id = v_plan_id;
  
  v_limit := COALESCE((v_features->>'flow_limit')::INTEGER, 2);
  
  IF v_limit = -1 THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'current', 0,
      'limit', -1,
      'unlimited', true,
      'remaining', -1
    );
  END IF;
  
  SELECT COALESCE(flow_count, 0) INTO v_current
  FROM usage_records
  WHERE organization_id = p_organization_id
    AND period_start = date_trunc('month', NOW());
  
  RETURN jsonb_build_object(
    'allowed', COALESCE(v_current, 0) < v_limit,
    'current', COALESCE(v_current, 0),
    'limit', v_limit,
    'unlimited', false,
    'remaining', GREATEST(0, v_limit - COALESCE(v_current, 0))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Increment flow count
CREATE OR REPLACE FUNCTION increment_flow(p_organization_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_usage_id UUID;
BEGIN
  v_usage_id := get_or_create_usage_record(p_organization_id);
  
  UPDATE usage_records 
  SET flow_count = flow_count + 1,
      research_count = research_count + 1,
      updated_at = NOW() 
  WHERE id = v_usage_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update prospect activity trigger function
CREATE OR REPLACE FUNCTION update_prospect_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prospect_id IS NOT NULL THEN
    UPDATE prospects SET last_activity_at = NOW() WHERE id = NEW.prospect_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- Note: See migration_fix_rls_performance.sql for optimized policies
-- All tables have RLS enabled with org-based access control

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_preps ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_daily_tips ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW prospect_hub_summary 
WITH (security_invoker = true)
AS
SELECT 
  p.id AS prospect_id,
  p.organization_id,
  p.company_name,
  p.status,
  p.created_at,
  p.last_activity_at,
  (SELECT COUNT(*) FROM research_briefs rb WHERE rb.prospect_id = p.id AND rb.status = 'completed') AS research_count,
  (SELECT COUNT(*) FROM prospect_contacts pc WHERE pc.prospect_id = p.id) AS contact_count,
  (SELECT COUNT(*) FROM deals d WHERE d.prospect_id = p.id AND d.is_active = true) AS active_deal_count,
  (SELECT COUNT(*) FROM meetings m WHERE m.prospect_id = p.id) AS meeting_count,
  (SELECT COUNT(*) FROM meeting_preps mp WHERE mp.prospect_id = p.id AND mp.status = 'completed') AS prep_count,
  (SELECT COUNT(*) FROM followups f WHERE f.prospect_id = p.id AND f.status = 'completed') AS followup_count
FROM prospects p;

CREATE OR REPLACE VIEW deal_summary 
WITH (security_invoker = true)
AS
SELECT 
  d.id AS deal_id,
  d.prospect_id,
  d.organization_id,
  d.name,
  d.description,
  d.is_active,
  d.created_at,
  p.company_name,
  (SELECT COUNT(*) FROM meetings m WHERE m.deal_id = d.id) AS meeting_count,
  (SELECT COUNT(*) FROM meeting_preps mp WHERE mp.deal_id = d.id AND mp.status = 'completed') AS prep_count,
  (SELECT COUNT(*) FROM followups f WHERE f.deal_id = d.id AND f.status = 'completed') AS followup_count,
  d.crm_deal_id IS NOT NULL AS is_crm_synced,
  d.crm_stage,
  d.crm_value_cents,
  d.crm_currency,
  d.crm_synced_at
FROM deals d
JOIN prospects p ON p.id = d.prospect_id;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
-- Version: 3.0
-- Tables: 25
-- Views: 2
-- Functions: 6
-- 
-- This file is for REFERENCE ONLY. Do not run on existing database!
-- Use individual migration files for updates.
-- ============================================================
