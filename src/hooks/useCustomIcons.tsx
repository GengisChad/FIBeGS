import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const LIVE_HOSTS = new Set(["ibna.it", "www.ibna.it", "ibnapp.lovable.app"]);

export const isLiveSite = () => {
  if (typeof window === "undefined") return false;
  return LIVE_HOSTS.has(window.location.hostname);
};

export type CustomIconRow = {
  icon_key: string;
  image_url: string;
};

const fetchCustomIcons = async (): Promise<Record<string, CustomIconRow>> => {
  if (isLiveSite()) return {};
  const { data, error } = await (supabase as any)
    .from("custom_icons")
    .select("icon_key, image_url");
  if (error || !data) return {};
  const map: Record<string, CustomIconRow> = {};
  for (const r of data as CustomIconRow[]) map[r.icon_key] = r;
  return map;
};

export const useCustomIconsMap = () =>
  useQuery({
    queryKey: ["custom-icons-map"],
    queryFn: fetchCustomIcons,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !isLiveSite(),
  });

export const useCustomIcon = (iconKey: string): CustomIconRow | undefined => {
  const { data } = useCustomIconsMap();
  return data?.[iconKey];
};
