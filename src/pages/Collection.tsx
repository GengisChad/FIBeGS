import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCollectionCatalog } from "@/hooks/useCachedQuery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Image, Share2, CheckCircle2, Package, Palette, FolderOpen, Square, SquareCheckBig, ChevronLeft, ChevronRight, Save, Undo2 } from "lucide-react";
import RadarChart from "@/components/collection/RadarChart";
import VariantHoverCard from "@/components/collection/VariantHoverCard";
import LazyImage from "@/components/collection/LazyImage";
import AutoScrollCarousel from "@/components/collection/AutoScrollCarousel";

interface Category {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  parent_id: string | null;
}

interface Component {
  id: string;
  category_id: string;
  name: string;
  image_url: string | null;
  weight_min: number | null;
  weight_max: number | null;
  recommended_price: number | null;
  sort_order: number;
}

interface ComponentLink {
  parent_component_id: string;
  linked_component_id: string;
}

interface Variant {
  id: string;
  component_id: string;
  variant_name: string;
  image_url: string | null;
  sort_order: number;
}

interface VariantLink {
  parent_variant_id: string;
  linked_variant_id: string;
}

interface OwnedEntry {
  component_id: string;
  variant_id: string | null;
}

interface ComponentStat {
  component_id: string;
  stat_name: string;
  stat_value: number;
  stat_order: number;
}

const entryKey = (entry: OwnedEntry) => `${entry.component_id}:${entry.variant_id ?? "base"}`;

const normalizeCatalogKey = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const getCatalogTokens = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g)
    ?.filter(token => token.length >= 3 && !/^\d+$/.test(token)) ?? [];

const COLLECTION_LINE_FILTERS = [
  { id: "BX", label: "BX", match: /\bbx[-\s]?\d+|\bbx\b|hasbro|dual pack|starter|booster/i },
  { id: "UX", label: "UX", match: /\bux[-\s]?\d+|\bux\b|unique/i },
  { id: "CX", label: "CX", match: /\bcx[-\s]?\d+|\bcx\b|lock chip|assist|metal blade|main blade|over blade/i },
  { id: "XOVER", label: "X-Over", match: /x[-\s]?over|draciel|dragoon|dranzer|driger|l-?drago|leone|pegasus|valkyrie|xcalibur|spriggan/i },
  { id: "COLLAB", label: "Collab", match: /collab|eva|star wars|marvel|mandalorian|iron man|thanos|spider|venom|skywalker|stormtrooper|t\.?\s?rex/i },
  { id: "HASBRO", label: "Hasbro", match: /hasbro|dual pack|clash|marvel|star wars/i },
  { id: "EVENT", label: "Event", match: /rare|g[1-3]\s?prize|coro|campaign|event|limited|special|metal coat|wbba/i },
] as const;

type CollectionLineFilterId = typeof COLLECTION_LINE_FILTERS[number]["id"];

const getCatalogLineText = (component: Pick<Component, "name" | "image_url">, variants: Array<Pick<Variant, "variant_name" | "image_url">> = []) =>
  [
    component.name,
    component.image_url,
    ...variants.flatMap(variant => [variant.variant_name, variant.image_url]),
  ]
    .filter(Boolean)
    .join(" ");

const inferCatalogLineIds = (component: Pick<Component, "name" | "image_url">, variants: Array<Pick<Variant, "variant_name" | "image_url">> = []) => {
  const text = getCatalogLineText(component, variants);
  return COLLECTION_LINE_FILTERS.filter(filter => filter.match.test(text)).map(filter => filter.id);
};

const isAbbreviatedCatalogName = (value?: string | null) => /^\s*[a-z0-9+-]+\s*\([^)]+\)\s*$/i.test(value ?? "");

const getCatalogCanonicalKey = (value: string) => {
  const match = value.match(/^\s*[a-z0-9+-]+\s*\(([^)]+)\)\s*$/i);
  return normalizeCatalogKey(match ? match[1] : value);
};

const preferCatalogComponent = (a: Component, b: Component) => {
  const aAbbreviated = isAbbreviatedCatalogName(a.name);
  const bAbbreviated = isAbbreviatedCatalogName(b.name);
  if (aAbbreviated !== bAbbreviated) return aAbbreviated ? b : a;
  return ((a.sort_order ?? 0) <= (b.sort_order ?? 0)) ? a : b;
};

const applyRelatedComponentImageFallbacks = (items: Component[]) => {
  const withImages = items.filter(component => component.image_url);
  return items.map(component => {
    if (component.image_url) return component;
    const tokens = getCatalogTokens(component.name);
    if (!tokens.length) return component;

    const fallback = withImages
      .map(candidate => {
        const candidateTokens = new Set(getCatalogTokens(candidate.name));
        const common = tokens.filter(token => candidateTokens.has(token));
        const normalizedName = normalizeCatalogKey(component.name);
        const normalizedCandidate = normalizeCatalogKey(candidate.name);
        const containsName = normalizedName.length >= 3 && normalizedCandidate.includes(normalizedName);
        const containsCandidate = normalizedCandidate.length >= 3 && normalizedName.includes(normalizedCandidate);
        const score =
          common.length * 20 +
          (candidate.category_id === component.category_id ? 8 : 0) +
          (containsName ? 12 : 0) +
          (containsCandidate ? 8 : 0) -
          Math.max(0, candidate.name.length - component.name.length) / 100;
        return { candidate, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || (a.candidate.sort_order ?? 0) - (b.candidate.sort_order ?? 0))
      [0]?.candidate;

    return fallback?.image_url ? { ...component, image_url: fallback.image_url } : component;
  });
};

const applyVariantImageFallbacks = (items: Variant[], components: Component[]) => {
  const componentById = new Map(components.map(component => [component.id, component]));
  const variantsWithImages = items.filter(variant => variant.image_url);

  return items.map(variant => {
    if (variant.image_url) return variant;
    const component = componentById.get(variant.component_id);
    const tokens = getCatalogTokens(`${component?.name ?? ""} ${variant.variant_name}`);

    const fallbackVariant = tokens.length
      ? variantsWithImages
          .map(candidate => {
            const candidateComponent = componentById.get(candidate.component_id);
            const candidateTokens = new Set(getCatalogTokens(`${candidateComponent?.name ?? ""} ${candidate.variant_name}`));
            const common = tokens.filter(token => candidateTokens.has(token));
            const sameComponent = candidate.component_id === variant.component_id;
            const score = common.length * 20 + (sameComponent ? 20 : 0) - Math.max(0, candidate.variant_name.length - variant.variant_name.length) / 100;
            return { candidate, score };
          })
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score || (a.candidate.sort_order ?? 0) - (b.candidate.sort_order ?? 0))
          [0]?.candidate
      : null;

    return {
      ...variant,
      image_url: fallbackVariant?.image_url ?? component?.image_url ?? null,
    };
  });
};

const remapComponentLinks = (links: ComponentLink[], componentMap: Map<string, string>) => {
  const seen = new Set<string>();
  return links.flatMap(link => {
    const parent_component_id = componentMap.get(link.parent_component_id) ?? link.parent_component_id;
    const linked_component_id = componentMap.get(link.linked_component_id) ?? link.linked_component_id;
    const key = `${parent_component_id}:${linked_component_id}`;
    if (parent_component_id === linked_component_id || seen.has(key)) return [];
    seen.add(key);
    return [{ parent_component_id, linked_component_id }];
  });
};

const remapVariantLinks = (links: VariantLink[], variantMap: Map<string, string>) => {
  const seen = new Set<string>();
  return links.flatMap(link => {
    const parent_variant_id = variantMap.get(link.parent_variant_id) ?? link.parent_variant_id;
    const linked_variant_id = variantMap.get(link.linked_variant_id) ?? link.linked_variant_id;
    const key = `${parent_variant_id}:${linked_variant_id}`;
    if (parent_variant_id === linked_variant_id || seen.has(key)) return [];
    seen.add(key);
    return [{ parent_variant_id, linked_variant_id }];
  });
};

const uniqueEntries = (entries: OwnedEntry[]) => {
  const map = new Map<string, OwnedEntry>();
  entries.forEach(entry => map.set(entryKey(entry), entry));
  return Array.from(map.values());
};

const Collection = () => {
  const { username } = useParams<{ username?: string }>();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [links, setLinks] = useState<ComponentLink[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantLinks, setVariantLinks] = useState<VariantLink[]>([]);
  const [ownedEntries, setOwnedEntries] = useState<OwnedEntry[]>([]);
  const [componentStats, setComponentStats] = useState<ComponentStat[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showStatsId, setShowStatsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileOwner, setProfileOwner] = useState<{ display_name: string | null; username: string | null; user_id: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeLineFilters, setActiveLineFilters] = useState<CollectionLineFilterId[]>([]);
  const componentAliasRef = useRef<Map<string, string>>(new Map());
  const variantAliasRef = useRef<Map<string, string>>(new Map());

  // Batch change tracking
  const [pendingAdds, setPendingAdds] = useState<OwnedEntry[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<OwnedEntry[]>([]);
  const originalEntriesRef = useRef<OwnedEntry[]>([]);

  const isOwnCollection = !username || (profileOwner && user && profileOwner.user_id === user.id);

  const hasPendingChanges = pendingAdds.length > 0 || pendingRemoves.length > 0;

  // Effective owned = original + adds - removes
  const effectiveOwnedEntries = useMemo(() => {
    let result = [...ownedEntries];
    // Add pending adds
    for (const add of pendingAdds) {
      if (!result.some(e => e.component_id === add.component_id && e.variant_id === add.variant_id)) {
        result.push(add);
      }
    }
    // Remove pending removes
    result = result.filter(e => !pendingRemoves.some(r => r.component_id === e.component_id && r.variant_id === e.variant_id));
    return result;
  }, [ownedEntries, pendingAdds, pendingRemoves]);

  const applyOwnedEntries = useCallback((nextEntries: OwnedEntry[]) => {
    const next = uniqueEntries(nextEntries);
    const originalKeys = new Set(ownedEntries.map(entryKey));
    const nextKeys = new Set(next.map(entryKey));

    setPendingAdds(next.filter(entry => !originalKeys.has(entryKey(entry))));
    setPendingRemoves(ownedEntries.filter(entry => !nextKeys.has(entryKey(entry))));
  }, [ownedEntries]);

  const ownedIds = useMemo(() => new Set(effectiveOwnedEntries.filter(e => !e.variant_id).map(e => e.component_id)), [effectiveOwnedEntries]);
  const ownedVariantIds = useMemo(() => new Set(effectiveOwnedEntries.filter(e => e.variant_id).map(e => e.variant_id!)), [effectiveOwnedEntries]);

  // Use cached catalog data (shared across all collection visits)
  const { data: catalog, isLoading: catalogLoading } = useCollectionCatalog();

  useEffect(() => {
    if (catalog) {
      // Filter out products-only categories (used for club orders, not collection)
      const visibleCategories = (catalog.categories as Category[]).filter((c: any) => !c.is_products_only);
      const visibleCatIds = new Set(visibleCategories.map(c => c.id));
      const rawComponents = (catalog.components as Component[]).filter((c: any) => visibleCatIds.has(c.category_id));
      const componentGroups = new Map<string, Component[]>();
      rawComponents.forEach(component => {
        const key = `${component.category_id}:${getCatalogCanonicalKey(component.name)}`;
        if (!componentGroups.has(key)) componentGroups.set(key, []);
        componentGroups.get(key)!.push(component);
      });

      const componentMap = new Map<string, string>();
      const dedupedComponents: Component[] = [];
      componentGroups.forEach(group => {
        const survivor = group.reduce((best, component) => preferCatalogComponent(best, component));
        group.forEach(component => componentMap.set(component.id, survivor.id));
        dedupedComponents.push({
          ...survivor,
          image_url: survivor.image_url ?? group.find(component => component.image_url)?.image_url ?? null,
          weight_min: survivor.weight_min ?? group.find(component => component.weight_min != null)?.weight_min ?? null,
          weight_max: survivor.weight_max ?? group.find(component => component.weight_max != null)?.weight_max ?? null,
          recommended_price: survivor.recommended_price ?? group.find(component => component.recommended_price != null)?.recommended_price ?? null,
        });
      });

      const variantMap = new Map<string, string>();
      const variantsByKey = new Map<string, Variant>();
      (catalog.variants as Variant[]).forEach(variant => {
        const component_id = componentMap.get(variant.component_id) ?? variant.component_id;
        if (!visibleCatIds.has(rawComponents.find(component => component.id === variant.component_id)?.category_id ?? "")) return;
        const nextVariant = { ...variant, component_id };
        const key = `${component_id}:${normalizeCatalogKey(variant.variant_name)}`;
        const existing = variantsByKey.get(key);
        if (!existing) {
          variantsByKey.set(key, nextVariant);
          variantMap.set(variant.id, nextVariant.id);
          return;
        }
        const keeper = (existing.sort_order ?? 0) <= (nextVariant.sort_order ?? 0) ? existing : nextVariant;
        const merged = {
          ...keeper,
          image_url: keeper.image_url ?? existing.image_url ?? nextVariant.image_url ?? null,
        };
        variantsByKey.set(key, merged);
        variantMap.set(existing.id, merged.id);
        variantMap.set(nextVariant.id, merged.id);
      });

      const statsByKey = new Map<string, ComponentStat>();
      (catalog.componentStats as ComponentStat[]).forEach(stat => {
        const component_id = componentMap.get(stat.component_id) ?? stat.component_id;
        const key = `${component_id}:${stat.stat_order}:${stat.stat_name}`;
        const existing = statsByKey.get(key);
        if (!existing || (existing.stat_value <= 0 && stat.stat_value > 0)) {
          statsByKey.set(key, { ...stat, component_id });
        }
      });

      componentAliasRef.current = componentMap;
      variantAliasRef.current = variantMap;
      const componentsWithFallbacks = applyRelatedComponentImageFallbacks(dedupedComponents);
      setCategories(visibleCategories);
      setComponents(componentsWithFallbacks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)));
      setLinks(remapComponentLinks(catalog.links as ComponentLink[], componentMap));
      setVariants(applyVariantImageFallbacks(Array.from(variantsByKey.values()), componentsWithFallbacks).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.variant_name.localeCompare(b.variant_name)));
      setVariantLinks(remapVariantLinks(catalog.variantLinks as VariantLink[], variantMap));
      setComponentStats(Array.from(statsByKey.values()));
    }
  }, [catalog]);

  useEffect(() => {
    if (catalogLoading) return;
    const loadUserData = async () => {
      let targetUserId: string | null = null;

      // Determine target user and fetch profile + collection in parallel when possible
      if (username) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .eq("username", username)
          .maybeSingle();
        if (profile) {
          setProfileOwner(profile as any);
          targetUserId = profile.user_id;
        }
      } else if (user) {
        targetUserId = user.id;
      }

      if (targetUserId) {
        // Parallelize profile (for own view) and collection data
        const promises: Array<PromiseLike<any>> = [
          supabase.from("user_collection_data").select("items").eq("user_id", targetUserId).maybeSingle(),
        ];
        if (!username && user) {
          promises.push(supabase.from("profiles").select("user_id, display_name, username").eq("user_id", user.id).maybeSingle());
        }

        const results = await Promise.all(promises);
        const row = results[0].data;
        const items = (row?.items as any[] ?? []).map((i: any) => ({
          component_id: componentAliasRef.current.get(i.c) ?? i.c,
          variant_id: i.v ? (variantAliasRef.current.get(i.v) ?? i.v) : null,
        }));
        setOwnedEntries(items);

        if (results[1]?.data) setProfileOwner(results[1].data as any);
      }

      setLoading(false);
    };
    loadUserData();
  }, [username, user, catalogLoading]);

  const collectLinkedComponentIds = useCallback((startIds: Iterable<string>) => {
    const ids = new Set(startIds);
    let changed = true;
    while (changed) {
      changed = false;
      links.forEach(link => {
        if (ids.has(link.parent_component_id) && !ids.has(link.linked_component_id)) {
          ids.add(link.linked_component_id);
          changed = true;
        }
      });
    }
    return ids;
  }, [links]);

  const closeCompleteComponents = useCallback((componentIds: Set<string>) => {
    let changed = true;
    while (changed) {
      changed = false;
      const parents = Array.from(new Set(links.map(link => link.parent_component_id)));
      parents.forEach(parentId => {
        const children = links.filter(link => link.parent_component_id === parentId).map(link => link.linked_component_id);
        if (children.length > 0 && children.every(childId => componentIds.has(childId)) && !componentIds.has(parentId)) {
          componentIds.add(parentId);
          changed = true;
        }
      });
    }
    return componentIds;
  }, [links]);

  const pruneIncompleteCompleteComponents = useCallback((componentIds: Set<string>) => {
    let changed = true;
    while (changed) {
      changed = false;
      const parents = Array.from(new Set(links.map(link => link.parent_component_id)));
      parents.forEach(parentId => {
        const children = links.filter(link => link.parent_component_id === parentId).map(link => link.linked_component_id);
        if (children.length > 0 && componentIds.has(parentId) && !children.every(childId => componentIds.has(childId))) {
          componentIds.delete(parentId);
          changed = true;
        }
      });
    }
    return componentIds;
  }, [links]);

  const collectLinkedVariantIds = useCallback((startIds: Iterable<string>) => {
    const ids = new Set(startIds);
    let changed = true;
    while (changed) {
      changed = false;
      variantLinks.forEach(link => {
        if (ids.has(link.parent_variant_id) && !ids.has(link.linked_variant_id)) {
          ids.add(link.linked_variant_id);
          changed = true;
        }
      });
    }
    return ids;
  }, [variantLinks]);

  const closeCompleteVariants = useCallback((variantIds: Set<string>) => {
    let changed = true;
    while (changed) {
      changed = false;
      const parents = Array.from(new Set(variantLinks.map(link => link.parent_variant_id)));
      parents.forEach(parentId => {
        const children = variantLinks.filter(link => link.parent_variant_id === parentId).map(link => link.linked_variant_id);
        if (children.length > 0 && children.every(childId => variantIds.has(childId)) && !variantIds.has(parentId)) {
          variantIds.add(parentId);
          changed = true;
        }
      });
    }
    return variantIds;
  }, [variantLinks]);

  const pruneIncompleteCompleteVariants = useCallback((variantIds: Set<string>) => {
    let changed = true;
    while (changed) {
      changed = false;
      const parents = Array.from(new Set(variantLinks.map(link => link.parent_variant_id)));
      parents.forEach(parentId => {
        const children = variantLinks.filter(link => link.parent_variant_id === parentId).map(link => link.linked_variant_id);
        if (children.length > 0 && variantIds.has(parentId) && !children.every(childId => variantIds.has(childId))) {
          variantIds.delete(parentId);
          changed = true;
        }
      });
    }
    return variantIds;
  }, [variantLinks]);

  const toggleComponent = useCallback((compId: string, checked: boolean) => {
    if (!user) {
      toast({ title: "Devi effettuare il login", variant: "destructive" });
      return;
    }

    const variantEntries = effectiveOwnedEntries.filter(entry => entry.variant_id);
    const componentIds = new Set(effectiveOwnedEntries.filter(entry => !entry.variant_id).map(entry => entry.component_id));

    if (checked) {
      collectLinkedComponentIds([compId]).forEach(id => componentIds.add(id));
      closeCompleteComponents(componentIds);
    } else {
      componentIds.delete(compId);
      pruneIncompleteCompleteComponents(componentIds);
    }

    applyOwnedEntries([
      ...Array.from(componentIds).map(component_id => ({ component_id, variant_id: null })),
      ...variantEntries,
    ]);
  }, [applyOwnedEntries, closeCompleteComponents, collectLinkedComponentIds, effectiveOwnedEntries, pruneIncompleteCompleteComponents, user]);

  const toggleVariant = useCallback((compId: string, variantId: string, checked: boolean) => {
    if (!user) {
      toast({ title: "Devi effettuare il login", variant: "destructive" });
      return;
    }

    const baseEntries = effectiveOwnedEntries.filter(entry => !entry.variant_id);
    const variantIds = new Set(effectiveOwnedEntries.filter(entry => entry.variant_id).map(entry => entry.variant_id!));

    if (checked) {
      collectLinkedVariantIds([variantId]).forEach(id => variantIds.add(id));
      closeCompleteVariants(variantIds);
    } else {
      variantIds.delete(variantId);
      pruneIncompleteCompleteVariants(variantIds);
    }

    const nextVariantEntries = Array.from(variantIds).flatMap(id => {
      const variant = variants.find(v => v.id === id);
      return variant ? [{ component_id: variant.component_id, variant_id: id }] : [];
    });

    applyOwnedEntries([...baseEntries, ...nextVariantEntries]);
  }, [applyOwnedEntries, closeCompleteVariants, collectLinkedVariantIds, effectiveOwnedEntries, pruneIncompleteCompleteVariants, user, variants]);

  const saveChanges = useCallback(async () => {
    if (!user || !hasPendingChanges) return;
    setSaving(true);
    try {
      // Single RPC call handles both inserts and deletes in one transaction
      const { error } = await supabase.rpc("sync_user_collection", {
        _adds: pendingAdds.map(e => ({
          c: e.component_id,
          v: e.variant_id,
        })),
        _removes: pendingRemoves.map(e => ({
          c: e.component_id,
          v: e.variant_id,
        })),
      });
      if (error) throw error;

      // Update local state to reflect saved changes
      setOwnedEntries(effectiveOwnedEntries);
      originalEntriesRef.current = effectiveOwnedEntries;
      setPendingAdds([]);
      setPendingRemoves([]);
      toast({ title: "Collezione salvata! ✅" });
    } catch (err) {
      console.error("Save error:", err);
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [user, hasPendingChanges, pendingAdds, pendingRemoves, effectiveOwnedEntries]);

  const discardChanges = useCallback(() => {
    setPendingAdds([]);
    setPendingRemoves([]);
  }, []);

  useEffect(() => {
    setActiveLineFilters([]);
  }, [selectedCategory]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingAdds.length > 0 || pendingRemoves.length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingAdds, pendingRemoves]);

  // Sub-categories support
  const rootCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const getSubCategories = useCallback((parentId: string) => categories.filter(c => c.parent_id === parentId), [categories]);

  // Get all category IDs including subs for a root category
  const getCategoryIdsIncludingSubs = useCallback((catId: string): string[] => {
    const subs = getSubCategories(catId);
    return [catId, ...subs.map(s => s.id)];
  }, [getSubCategories]);

  const getCategoryPreviewImage = useCallback((catId: string, includeSubs = false) => {
    const catIds = includeSubs ? getCategoryIdsIncludingSubs(catId) : [catId];
    return components
      .filter(c => catIds.includes(c.category_id) && c.image_url)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
      [0]?.image_url ?? null;
  }, [components, getCategoryIdsIncludingSubs]);

  const categoryComponents = useMemo(() => {
    if (!selectedCategory) return [];
    const catIds = getCategoryIdsIncludingSubs(selectedCategory);
    return components.filter(c => catIds.includes(c.category_id));
  }, [selectedCategory, components, getCategoryIdsIncludingSubs]);

  const categoryVariantsByComponent = useMemo(() => {
    const map = new Map<string, Variant[]>();
    categoryComponents.forEach(component => {
      map.set(component.id, variants.filter(variant => variant.component_id === component.id));
    });
    return map;
  }, [categoryComponents, variants]);

  const availableLineFilters = useMemo(() => {
    if (!selectedCategory) return [];
    const available = new Set<CollectionLineFilterId>();
    categoryComponents.forEach(component => {
      inferCatalogLineIds(component, categoryVariantsByComponent.get(component.id) ?? []).forEach(id => available.add(id));
    });
    return COLLECTION_LINE_FILTERS.filter(filter => available.has(filter.id));
  }, [categoryComponents, categoryVariantsByComponent, selectedCategory]);

  const filteredCategoryComponents = useMemo(() => {
    if (!activeLineFilters.length) return categoryComponents;
    return categoryComponents.filter(component => {
      const lineIds = inferCatalogLineIds(component, categoryVariantsByComponent.get(component.id) ?? []);
      return lineIds.some(id => activeLineFilters.includes(id));
    });
  }, [activeLineFilters, categoryComponents, categoryVariantsByComponent]);

  const getFilteredVariantsForComponent = useCallback((component: Component) => {
    const compVariants = categoryVariantsByComponent.get(component.id) ?? [];
    if (!activeLineFilters.length) return compVariants;
    return compVariants.filter(variant => {
      const lineIds = inferCatalogLineIds(component, [variant]);
      return lineIds.some(id => activeLineFilters.includes(id));
    });
  }, [activeLineFilters, categoryVariantsByComponent]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; owned: number }> = {};
    rootCategories.forEach(cat => {
      const catIds = getCategoryIdsIncludingSubs(cat.id);
      const catComps = components.filter(c => catIds.includes(c.category_id));
      const catVariants = variants.filter(v => catComps.some(c => c.id === v.component_id));
      const total = catComps.length + catVariants.length;
      const ownedBase = catComps.filter(c => ownedIds.has(c.id)).length;
      const ownedVars = catVariants.filter(v => ownedVariantIds.has(v.id)).length;
      counts[cat.id] = { total, owned: ownedBase + ownedVars };
    });
    return counts;
  }, [rootCategories, components, variants, ownedIds, ownedVariantIds, getCategoryIdsIncludingSubs]);

  const totalOwned = useMemo(() => Object.values(categoryCounts).reduce((s, c) => s + c.owned, 0), [categoryCounts]);
  const totalComponents = useMemo(() => Object.values(categoryCounts).reduce((s, c) => s + c.total, 0), [categoryCounts]);

  const getStatsForComponent = useCallback((compId: string) => {
    return componentStats
      .filter(s => s.component_id === compId && s.stat_value > 0)
      .sort((a, b) => a.stat_order - b.stat_order)
      .map(s => ({ name: s.stat_name, value: s.stat_value }));
  }, [componentStats]);

  // For variant hover: get linked components
  const getLinkedComponentsForVariant = useCallback((variantId: string) => {
    const linkedVarIds = variantLinks
      .filter(l => l.parent_variant_id === variantId)
      .map(l => l.linked_variant_id);
    const linkedComps: { id: string; name: string; image_url: string | null }[] = [];
    for (const lvId of linkedVarIds) {
      const v = variants.find(x => x.id === lvId);
      if (v) {
        const comp = components.find(c => c.id === v.component_id);
        if (comp) linkedComps.push({ id: comp.id, name: `${comp.name} (${v.variant_name})`, image_url: v.image_url || comp.image_url });
      }
    }
    // Also get component links
    return linkedComps;
  }, [variantLinks, variants, components]);

  const shareCollection = () => {
    if (profileOwner?.username) {
      const url = `${window.location.origin}/collezione/${profileOwner.username}`;
      navigator.clipboard.writeText(url);
      toast({ title: "Link copiato negli appunti!" });
    } else {
      toast({ title: "Imposta un username nel profilo per condividere la collezione", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16 flex items-center justify-center">
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (username && !profileOwner) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Utente non trovato</h1>
          <p className="text-muted-foreground">L'utente "{username}" non esiste.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const ownerName = profileOwner?.display_name || profileOwner?.username || "La tua";

  // Determine what to show in the category view
  const selectedCat = categories.find(c => c.id === selectedCategory);
  const isRootWithSubs = selectedCat && !selectedCat.parent_id && getSubCategories(selectedCat.id).length > 0;
  const subCats = selectedCat ? getSubCategories(selectedCat.id) : [];

  const toggleLineFilter = (filterId: CollectionLineFilterId, checked: boolean) => {
    setActiveLineFilters(current =>
      checked
        ? Array.from(new Set([...current, filterId]))
        : current.filter(id => id !== filterId)
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="section-title text-3xl flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              {isOwnCollection ? "La Mia Collezione" : `Collezione di ${ownerName}`}
            </h1>
            <p className="text-muted-foreground mt-1">
              {totalOwned} / {totalComponents} componenti
            </p>
          </div>
          {isOwnCollection && (
            <Button variant="outline" onClick={shareCollection}>
              <Share2 size={16} className="mr-2" /> Condividi
            </Button>
          )}
        </div>

        {/* Category Grid or Component List */}
        {!selectedCategory ? (
          <div className="flex flex-wrap justify-center gap-4">
            {rootCategories.map(cat => {
              const counts = categoryCounts[cat.id] ?? { total: 0, owned: 0 };
              const isComplete = counts.total > 0 && counts.owned === counts.total;
              const subs = getSubCategories(cat.id);
              const previewImage = getCategoryPreviewImage(cat.id, true);
              return (
                <div
                  key={cat.id}
                  className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary w-[calc(33.333%-12px)] sm:w-[calc(25%-12px)] md:w-[calc(20%-13px)] lg:w-[calc(16.666%-14px)] ${isComplete ? "ring-2 ring-primary" : "border-border"}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <div className="aspect-square bg-muted flex items-center justify-center p-4">
                    {previewImage ? (
                      <img src={previewImage} alt={cat.name} className="w-full h-full object-contain select-none" draggable={false} />
                    ) : (
                      <Image className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-2 bg-card flex items-center justify-between gap-1">
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate">{cat.name}</p>
                      {subs.length > 0 && (
                        <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <FolderOpen size={7} /> {subs.length} sotto-cat.
                        </p>
                      )}
                    </div>
                    <Badge variant={isComplete ? "default" : "outline"} className="text-[10px] shrink-0 px-1.5 py-0">
                      {counts.owned}/{counts.total}
                    </Badge>
                  </div>
                  {isComplete && (
                    <div className="absolute top-1.5 right-1.5">
                      <CheckCircle2 className="h-5 w-5 text-primary drop-shadow" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <Button variant="ghost" className="mb-4" onClick={() => {
              // If viewing a sub-category, go back to parent
              if (selectedCat?.parent_id) {
                setSelectedCategory(selectedCat.parent_id);
              } else {
                setSelectedCategory(null);
              }
            }}>
              ← {selectedCat?.parent_id ? `Torna a ${categories.find(c => c.id === selectedCat.parent_id)?.name}` : "Torna alle categorie"}
            </Button>
            <h2 className="text-xl font-bold mb-4">
              {selectedCat?.name}
            </h2>

            {availableLineFilters.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
                {availableLineFilters.map(filter => {
                  const checked = activeLineFilters.includes(filter.id);
                  return (
                    <label
                      key={filter.id}
                      className={`flex h-8 items-center gap-2 rounded-md border px-2 text-xs font-semibold transition-colors ${
                        checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/60 text-muted-foreground"
                      }`}
                    >
                      <Switch
                        checked={checked}
                        onCheckedChange={(value) => toggleLineFilter(filter.id, value)}
                        className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
                      />
                      {filter.label}
                    </label>
                  );
                })}
                {activeLineFilters.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setActiveLineFilters([])}>
                    Tutto
                  </Button>
                )}
              </div>
            )}

            {/* Show sub-categories if root with subs */}
            {isRootWithSubs && (
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-3">Sotto-categorie</p>
                <div className="flex flex-wrap justify-center gap-3 mb-6">
                  {subCats.map(sub => {
                    const previewImage = getCategoryPreviewImage(sub.id);
                    return (
                      <div
                        key={sub.id}
                        className="border border-border rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all w-[calc(25%-9px)] sm:w-[calc(20%-10px)] md:w-[calc(12.5%-11px)]"
                        onClick={() => setSelectedCategory(sub.id)}
                      >
                        <div className="aspect-square bg-muted flex items-center justify-center p-3">
                          {previewImage ? (
                            <img src={previewImage} alt={sub.name} className="w-full h-full object-contain select-none" draggable={false} />
                          ) : (
                            <FolderOpen className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="p-1.5 bg-card">
                          <p className="font-semibold text-[10px] truncate text-center">{sub.name}</p>
                          <p className="text-[8px] text-muted-foreground text-center">
                            {components.filter(c => c.category_id === sub.id).length} parti
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-4">
              {filteredCategoryComponents.map(comp => {
                const compVariants = getFilteredVariantsForComponent(comp);
                const hasVariants = compVariants.length > 0;
                const owned = ownedIds.has(comp.id);
                const stats = getStatsForComponent(comp.id);

                return (
                  <div key={comp.id} className="flex flex-col w-[calc(33.333%-12px)] sm:w-[calc(25%-12px)] md:w-[calc(16.666%-14px)] lg:w-[calc(14.285%-14px)]">
                    <div
                      className={`relative rounded-lg border overflow-hidden transition-all ${stats.length >= 3 ? "cursor-pointer" : ""} group/card ${
                        owned
                          ? "border-primary ring-1 ring-primary/30"
                          : "border-border opacity-60 hover:opacity-100"
                      }`}
                      onClick={() => {
                        if (stats.length < 3) return;
                        if (window.matchMedia("(hover: none)").matches) {
                          setShowStatsId(prev => prev === comp.id ? null : comp.id);
                        }
                      }}
                      onDoubleClick={() => {
                        if (isOwnCollection) {
                          toggleComponent(comp.id, !owned);
                        }
                      }}
                    >
                      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative p-4">
                        {comp.image_url ? (
                          <LazyImage
                            src={comp.image_url}
                            alt={comp.name}
                            className={`w-full h-full transition-all duration-300 ${stats.length >= 3 ? "group-hover/card:blur-md group-hover/card:scale-105 group-hover/card:brightness-50" : ""} ${showStatsId === comp.id && stats.length >= 3 ? "blur-md scale-105 brightness-50" : ""}`}
                          />
                        ) : (
                          <Image
                            size={24}
                            className={`text-muted-foreground transition-all duration-300 ${stats.length >= 3 ? "group-hover/card:blur-md group-hover/card:brightness-50" : ""} ${showStatsId === comp.id && stats.length >= 3 ? "blur-md brightness-50" : ""}`}
                          />
                        )}
                        {stats.length >= 3 && (
                          <>
                            <div className="absolute inset-0 items-center justify-center bg-black/50 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 hidden md:flex">
                              <RadarChart stats={stats} size={160} />
                            </div>
                            {showStatsId === comp.id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50 animate-fade-in md:hidden">
                                <RadarChart stats={stats} size={160} />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {/* Checkbox for ownership */}
                      {isOwnCollection && (
                        <button
                          className="absolute top-1.5 right-1.5 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleComponent(comp.id, !owned);
                          }}
                        >
                          {owned ? (
                            <SquareCheckBig size={18} className="text-primary drop-shadow" />
                          ) : (
                            <Square size={18} className="text-muted-foreground hover:text-foreground drop-shadow" />
                          )}
                        </button>
                      )}
                      {!isOwnCollection && owned && (
                        <div className="absolute top-1.5 right-1.5 z-10">
                          <CheckCircle2 size={20} className="text-primary drop-shadow" />
                        </div>
                      )}
                      <div className="p-1.5 bg-card text-center">
                        <p className="text-[10px] font-semibold truncate">{comp.name}</p>
                        {comp.recommended_price != null && (
                          <p className="text-[9px] text-muted-foreground">€{comp.recommended_price}</p>
                        )}
                      </div>
                    </div>

                    {/* Variant carousel */}
                    {hasVariants && (
                      <div className="mt-2 relative group/carousel">
                        {/* Left arrow - PC only, only if >2 variants */}
                        {compVariants.length > 2 && (
                          <button
                            className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-card border border-border items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity shadow-md"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              const container = (e.currentTarget.parentElement as HTMLElement)?.querySelector('.variant-scroll') as HTMLElement;
                              if (container) container.scrollLeft = Math.max(0, container.scrollLeft - 120);
                            }}
                          >
                            <ChevronLeft size={14} className="text-foreground" />
                          </button>
                        )}
                        {/* Right arrow - PC only, only if >2 variants */}
                        {compVariants.length > 2 && (
                          <button
                            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-card border border-border items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity shadow-md"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              const container = (e.currentTarget.parentElement as HTMLElement)?.querySelector('.variant-scroll') as HTMLElement;
                              if (container) container.scrollLeft = Math.min(container.scrollWidth - container.clientWidth, container.scrollLeft + 120);
                            }}
                          >
                            <ChevronRight size={14} className="text-foreground" />
                          </button>
                        )}

                        <AutoScrollCarousel className="variant-scroll flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1" speed={25} enabled={compVariants.length > 2}>
                          {compVariants.map(v => {
                            const vOwned = ownedVariantIds.has(v.id);
                            const linkedComps = getLinkedComponentsForVariant(v.id);
                            const parentComp = { id: comp.id, name: comp.name, image_url: comp.image_url };
                            return (
                              <VariantHoverCard
                                key={v.id}
                                variant={v}
                                parentComponent={parentComp}
                                linkedComponents={linkedComps}
                              >
                                <div
                                  title={v.variant_name}
                                  className={`relative flex-shrink-0 w-16 h-20 snap-start rounded-lg border-2 overflow-hidden transition-all ${
                                    isOwnCollection ? "cursor-pointer active:scale-95" : ""
                                  } ${
                                    vOwned
                                      ? "border-primary ring-1 ring-primary/30"
                                      : "border-border opacity-50 hover:opacity-100"
                                  }`}
                                  onClick={() => isOwnCollection && toggleVariant(comp.id, v.id, !vOwned)}
                                >
                                  <div className="w-full h-14 bg-muted flex items-center justify-center p-1">
                                    {v.image_url ? (
                                      <LazyImage src={v.image_url} alt={v.variant_name} className="w-full h-full" />
                                    ) : (
                                      <Palette size={16} className="text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="h-6 flex items-center justify-center bg-card px-0.5">
                                    <p className="text-[8px] font-medium truncate text-center leading-tight">{v.variant_name}</p>
                                  </div>
                                  {vOwned && (
                                    <div className="absolute top-0.5 right-0.5">
                                      <CheckCircle2 size={12} className="text-primary drop-shadow" />
                                    </div>
                                  )}
                                </div>
                              </VariantHoverCard>
                            );
                          })}
                        </AutoScrollCarousel>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating save bar */}
      {isOwnCollection && hasPendingChanges && (
        <div className="fixed bottom-24 sm:bottom-6 left-0 right-0 flex justify-center z-50 animate-fade-in px-4">
          <div className="flex items-center gap-2 bg-card border border-border rounded-full shadow-lg px-4 py-2">
            <Badge variant="secondary" className="text-xs">
              {pendingAdds.length + pendingRemoves.length} modifiche
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={discardChanges}
              className="gap-1"
            >
              <Undo2 size={14} /> Annulla
            </Button>
            <Button
              size="sm"
              onClick={saveChanges}
              disabled={saving}
              className="gap-1"
            >
              <Save size={14} /> {saving ? "Salvataggio..." : "Salva"}
            </Button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Collection;
