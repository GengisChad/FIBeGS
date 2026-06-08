
-- RPC to bulk-create ghost profiles bypassing the claim trigger
CREATE OR REPLACE FUNCTION public.bulk_create_ghost_profiles(
  _profiles jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable the claim trigger
  ALTER TABLE profiles DISABLE TRIGGER trg_claim_pending_results;

  -- Insert ghost profiles from JSON array
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

  -- Re-enable the trigger
  ALTER TABLE profiles ENABLE TRIGGER trg_claim_pending_results;
END;
$$;
