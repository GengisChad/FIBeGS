CREATE OR REPLACE FUNCTION public.admin_delete_collection_variant(_variant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.collection_variant_links
  WHERE parent_variant_id = _variant_id OR linked_variant_id = _variant_id;

  UPDATE public.deck_beyblade_components
  SET variant_id = NULL
  WHERE variant_id = _variant_id;

  IF to_regclass('public.user_collection') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_collection'
        AND column_name = 'variant_id'
    ) THEN
      EXECUTE 'DELETE FROM public.user_collection WHERE variant_id = $1'
      USING _variant_id;
    END IF;
  END IF;

  UPDATE public.user_collection_data
  SET
    items = COALESCE((
      SELECT jsonb_agg(item)
      FROM jsonb_array_elements(items) AS item
      WHERE item->>'v' IS DISTINCT FROM _variant_id::text
    ), '[]'::jsonb),
    updated_at = now();

  DELETE FROM public.collection_component_variants
  WHERE id = _variant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_collection_component(_component_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _variant_ids uuid[];
  _variant_id_texts text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO _variant_ids
  FROM public.collection_component_variants
  WHERE component_id = _component_id;

  SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
  INTO _variant_id_texts
  FROM public.collection_component_variants
  WHERE component_id = _component_id;

  IF COALESCE(array_length(_variant_ids, 1), 0) > 0 THEN
    DELETE FROM public.collection_variant_links
    WHERE parent_variant_id = ANY(_variant_ids)
       OR linked_variant_id = ANY(_variant_ids);

    UPDATE public.deck_beyblade_components
    SET variant_id = NULL
    WHERE variant_id = ANY(_variant_ids);
  END IF;

  DELETE FROM public.collection_component_stats
  WHERE component_id = _component_id;

  DELETE FROM public.collection_component_links
  WHERE parent_component_id = _component_id
     OR linked_component_id = _component_id;

  DELETE FROM public.deck_beyblade_components
  WHERE component_id = _component_id;

  DELETE FROM public.club_order_products
  WHERE component_id = _component_id;

  DELETE FROM public.market_listing_components
  WHERE component_id = _component_id;

  DELETE FROM public.rpg_component_settings
  WHERE component_id = _component_id;

  DELETE FROM public.rpg_owned_components
  WHERE component_id = _component_id;

  UPDATE public.rpg_game_deck_beys SET blade_id = NULL WHERE blade_id = _component_id;
  UPDATE public.rpg_game_deck_beys SET ratchet_id = NULL WHERE ratchet_id = _component_id;
  UPDATE public.rpg_game_deck_beys SET bit_id = NULL WHERE bit_id = _component_id;
  UPDATE public.rpg_game_deck_beys SET lock_chip_id = NULL WHERE lock_chip_id = _component_id;
  UPDATE public.rpg_game_deck_beys SET ux_infinity_id = NULL WHERE ux_infinity_id = _component_id;
  UPDATE public.rpg_game_deck_beys SET cx_infinity_id = NULL WHERE cx_infinity_id = _component_id;
  UPDATE public.rpg_game_deck_beys SET cx_assist_id = NULL WHERE cx_assist_id = _component_id;
  UPDATE public.rpg_game_deck_beys SET ribs_id = NULL WHERE ribs_id = _component_id;

  IF to_regclass('public.user_collection') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_collection'
        AND column_name = 'variant_id'
    ) THEN
      EXECUTE 'DELETE FROM public.user_collection WHERE component_id = $1 OR variant_id = ANY($2)'
      USING _component_id, _variant_ids;
    ELSE
      EXECUTE 'DELETE FROM public.user_collection WHERE component_id = $1'
      USING _component_id;
    END IF;
  END IF;

  UPDATE public.user_collection_data
  SET
    items = COALESCE((
      SELECT jsonb_agg(item)
      FROM jsonb_array_elements(items) AS item
      WHERE item->>'c' IS DISTINCT FROM _component_id::text
        AND NOT (item->>'v' = ANY(_variant_id_texts))
    ), '[]'::jsonb),
    updated_at = now();

  DELETE FROM public.collection_component_variants
  WHERE component_id = _component_id;

  DELETE FROM public.collection_components
  WHERE id = _component_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_collection_variant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_collection_component(uuid) TO authenticated;
