
-- Create compact JSONB-based collection table (1 row per user instead of hundreds)
CREATE TABLE public.user_collection_data (
  user_id uuid PRIMARY KEY,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_collection_data ENABLE ROW LEVEL SECURITY;

-- RLS: users can view anyone's collection (public catalog)
CREATE POLICY "Collection data viewable by everyone"
ON public.user_collection_data FOR SELECT TO public
USING (true);

-- RLS: users can manage their own collection
CREATE POLICY "Users can insert own collection"
ON public.user_collection_data FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collection"
ON public.user_collection_data FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all collections"
ON public.user_collection_data FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing data from normalized table to JSONB
INSERT INTO public.user_collection_data (user_id, items)
SELECT 
  uc.user_id,
  jsonb_agg(
    jsonb_build_object('c', uc.component_id, 'v', uc.variant_id)
  )
FROM public.user_collection uc
GROUP BY uc.user_id
ON CONFLICT (user_id) DO NOTHING;

-- Update the sync function to use the new table
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
  _current jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get current items or empty array
  SELECT COALESCE(items, '[]'::jsonb) INTO _current
  FROM user_collection_data WHERE user_id = _uid;

  IF _current IS NULL THEN
    _current := '[]'::jsonb;
  END IF;

  -- Remove items
  IF jsonb_array_length(_removes) > 0 THEN
    _current := (
      SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
      FROM jsonb_array_elements(_current) AS item
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(_removes) AS r
        WHERE (r->>'c') = (item->>'c')
          AND ((r->>'v') IS NOT DISTINCT FROM (item->>'v'))
      )
    );
  END IF;

  -- Add items (skip duplicates)
  IF jsonb_array_length(_adds) > 0 THEN
    FOR i IN 0..jsonb_array_length(_adds)-1 LOOP
      DECLARE
        _new_item jsonb := _adds->i;
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(_current) AS existing
          WHERE (existing->>'c') = (_new_item->>'c')
            AND ((existing->>'v') IS NOT DISTINCT FROM (_new_item->>'v'))
        ) THEN
          _current := _current || jsonb_build_array(
            jsonb_build_object('c', _new_item->>'c', 'v', _new_item->>'v')
          );
        END IF;
      END;
    END LOOP;
  END IF;

  -- Upsert
  INSERT INTO user_collection_data (user_id, items, updated_at)
  VALUES (_uid, _current, now())
  ON CONFLICT (user_id) DO UPDATE SET items = EXCLUDED.items, updated_at = now();
END;
$$;
