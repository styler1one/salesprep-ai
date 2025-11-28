-- ============================================================
-- MIGRATION: Link existing data to prospects table
-- Run this AFTER migration_add_prospect_id.sql
-- ============================================================

-- This will:
-- 1. Create prospect records for all unique company names
-- 2. Link research_briefs to prospects
-- 3. Link meeting_preps to prospects
-- 4. Link followups to prospects

DO $$
DECLARE
  r RECORD;
  v_prospect_id UUID;
  v_count_research INTEGER := 0;
  v_count_preps INTEGER := 0;
  v_count_followups INTEGER := 0;
  v_count_prospects INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting data migration...';
  
  -- Migrate from research_briefs
  RAISE NOTICE 'Processing research_briefs...';
  FOR r IN 
    SELECT DISTINCT organization_id, company_name 
    FROM research_briefs 
    WHERE prospect_id IS NULL AND company_name IS NOT NULL AND company_name != ''
  LOOP
    v_prospect_id := get_or_create_prospect(r.organization_id, r.company_name);
    
    UPDATE research_briefs 
    SET prospect_id = v_prospect_id 
    WHERE organization_id = r.organization_id 
      AND LOWER(TRIM(company_name)) = LOWER(TRIM(r.company_name))
      AND prospect_id IS NULL;
    
    GET DIAGNOSTICS v_count_research = ROW_COUNT;
    v_count_prospects := v_count_prospects + 1;
  END LOOP;
  RAISE NOTICE 'Linked % research briefs', v_count_research;
  
  -- Migrate from meeting_preps
  RAISE NOTICE 'Processing meeting_preps...';
  FOR r IN 
    SELECT DISTINCT organization_id, prospect_company_name 
    FROM meeting_preps 
    WHERE prospect_id IS NULL AND prospect_company_name IS NOT NULL AND prospect_company_name != ''
  LOOP
    v_prospect_id := get_or_create_prospect(r.organization_id, r.prospect_company_name);
    
    UPDATE meeting_preps 
    SET prospect_id = v_prospect_id 
    WHERE organization_id = r.organization_id 
      AND LOWER(TRIM(prospect_company_name)) = LOWER(TRIM(r.prospect_company_name))
      AND prospect_id IS NULL;
    
    GET DIAGNOSTICS v_count_preps = ROW_COUNT;
  END LOOP;
  RAISE NOTICE 'Linked % meeting preps', v_count_preps;
  
  -- Migrate from followups
  RAISE NOTICE 'Processing followups...';
  FOR r IN 
    SELECT DISTINCT organization_id, prospect_company_name 
    FROM followups 
    WHERE prospect_id IS NULL AND prospect_company_name IS NOT NULL AND prospect_company_name != ''
  LOOP
    v_prospect_id := get_or_create_prospect(r.organization_id, r.prospect_company_name);
    
    UPDATE followups 
    SET prospect_id = v_prospect_id 
    WHERE organization_id = r.organization_id 
      AND LOWER(TRIM(prospect_company_name)) = LOWER(TRIM(r.prospect_company_name))
      AND prospect_id IS NULL;
    
    GET DIAGNOSTICS v_count_followups = ROW_COUNT;
  END LOOP;
  RAISE NOTICE 'Linked % followups', v_count_followups;
  
  -- Summary
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration completed!';
  RAISE NOTICE 'Prospects created/found: %', v_count_prospects;
  RAISE NOTICE '========================================';
END $$;

-- Verify the migration
SELECT 
  'research_briefs' as table_name,
  COUNT(*) as total,
  COUNT(prospect_id) as linked,
  COUNT(*) - COUNT(prospect_id) as unlinked
FROM research_briefs
UNION ALL
SELECT 
  'meeting_preps',
  COUNT(*),
  COUNT(prospect_id),
  COUNT(*) - COUNT(prospect_id)
FROM meeting_preps
UNION ALL
SELECT 
  'followups',
  COUNT(*),
  COUNT(prospect_id),
  COUNT(*) - COUNT(prospect_id)
FROM followups;

-- Show created prospects
SELECT 
  p.company_name,
  p.status,
  p.created_at,
  (SELECT COUNT(*) FROM research_briefs rb WHERE rb.prospect_id = p.id) as research_count,
  (SELECT COUNT(*) FROM meeting_preps mp WHERE mp.prospect_id = p.id) as prep_count,
  (SELECT COUNT(*) FROM followups f WHERE f.prospect_id = p.id) as followup_count
FROM prospects p
ORDER BY p.created_at DESC;
