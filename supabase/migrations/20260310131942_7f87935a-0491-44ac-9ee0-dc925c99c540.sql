
CREATE OR REPLACE FUNCTION public.sync_user_collection(
  _adds jsonb DEFAULT '[]'::jsonb,
  _removes jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _add jsonb;
  _rem jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Batch insert adds
  IF jsonb_array_length(_adds) > 0 THEN
    INSERT INTO user_collection (user_id, component_id, variant_id)
    SELECT _uid, (a->>'component_id')::uuid, (a->>'variant_id')::uuid
    FROM jsonb_array_elements(_adds) AS a
    ON CONFLICT DO NOTHING;
  END IF;

  -- Batch delete removes
  IF jsonb_array_length(_removes) > 0 THEN
    DELETE FROM user_collection uc
    WHERE uc.user_id = _uid
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(_removes) AS r
        WHERE (r->>'component_id')::uuid = uc.component_id
          AND (
            (r->>'variant_id' IS NULL AND uc.variant_id IS NULL)
            OR (r->>'variant_id')::uuid = uc.variant_id
          )
      );
  END IF;
END;
$$;
