const HIDDEN_PLACEHOLDER_COMPONENT_KEYS = new Set([
  "arc",
  "blast",
  "blitzb",
  "brush",
]);

export const normalizeCollectionComponentKey = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

export const isHiddenPlaceholderComponentName = (name?: string | null) =>
  HIDDEN_PLACEHOLDER_COMPONENT_KEYS.has(normalizeCollectionComponentKey(name));
