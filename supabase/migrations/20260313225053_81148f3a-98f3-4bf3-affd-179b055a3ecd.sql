
-- Update bulk_create_ghost_profiles to also bypass validation trigger
CREATE OR REPLACE FUNCTION public.bulk_create_ghost_profiles(
  _profiles jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable triggers that block ghost profile creation
  ALTER TABLE profiles DISABLE TRIGGER trg_claim_pending_results;
  ALTER TABLE profiles DISABLE TRIGGER trg_validate_profile;

  INSERT INTO profiles (user_id, username, display_name, region_id, points, wins)
  SELECT
    (item->>'user_id')::uuid,
    item->>'username',
    item->>'display_name',
    NULLIF(item->>'region_id', '')::uuid,
    0,
    0
  FROM jsonb_array_elements(_profiles) AS item
  ON CONFLICT (user_id) DO NOTHING;

  -- Re-enable triggers
  ALTER TABLE profiles ENABLE TRIGGER trg_validate_profile;
  ALTER TABLE profiles ENABLE TRIGGER trg_claim_pending_results;
END;
$$;
