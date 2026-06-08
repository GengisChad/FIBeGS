-- Fix collection ownership model: allow multiple variants per component
-- while keeping at most one base-component ownership row per user.

ALTER TABLE public.user_collection
DROP CONSTRAINT IF EXISTS user_collection_user_id_component_id_key;

-- One base row per user+component (variant_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS user_collection_unique_base_idx
ON public.user_collection (user_id, component_id)
WHERE variant_id IS NULL;

-- One row per user+variant (variant_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS user_collection_unique_variant_idx
ON public.user_collection (user_id, variant_id)
WHERE variant_id IS NOT NULL;