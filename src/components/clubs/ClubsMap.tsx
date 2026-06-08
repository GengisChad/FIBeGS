import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const ITALIAN_CITIES: Record<string, [number, number]> = {
  roma: [41.9028, 12.4964], milano: [45.4642, 9.19], napoli: [40.8518, 14.2681],
  torino: [45.0703, 7.6869], palermo: [38.1157, 13.3615], genova: [44.4056, 8.9463],
  bologna: [44.4949, 11.3426], firenze: [43.7696, 11.2558], bari: [41.1171, 16.8719],
  catania: [37.5079, 15.083], venezia: [45.4408, 12.3155], verona: [45.4384, 10.9916],
  messina: [38.1938, 15.5542], padova: [45.4064, 11.8768], trieste: [45.6495, 13.7768],
  brescia: [45.5416, 10.2118], parma: [44.8015, 10.3279], taranto: [40.4764, 17.2299],
  modena: [44.6471, 10.9252], perugia: [43.1107, 12.3908], cagliari: [39.2238, 9.1217],
  livorno: [43.5485, 10.3106], ravenna: [44.4184, 12.2035], foggia: [41.4622, 15.5446],
  salerno: [40.6824, 14.7681], rimini: [44.0678, 12.5695], ferrara: [44.8381, 11.6198],
  sassari: [40.7259, 8.556], latina: [41.4676, 12.9037], bergamo: [45.6983, 9.6773],
  monza: [45.5845, 9.2745], pescara: [42.4618, 14.2161], trento: [46.0748, 11.1217],
  como: [45.808, 9.0852], ancona: [43.6158, 13.5189], lecce: [40.3516, 18.175],
  bolzano: [46.4983, 11.3548], pisa: [43.7228, 10.4017], udine: [46.0711, 13.2346],
  arezzo: [43.4633, 11.8796], cesena: [44.1396, 12.2464], pesaro: [43.9096, 12.9131],
  vicenza: [45.5455, 11.5354], treviso: [45.6669, 12.2428], varese: [45.8206, 8.8257],
  "la spezia": [44.1025, 9.824], prato: [43.8777, 11.1024], cosenza: [39.3, 16.25],
  avellino: [40.9148, 14.7906], benevento: [41.1298, 14.7826], brindisi: [40.6327, 17.9463],
  catanzaro: [38.9098, 16.5879], crotone: [39.0839, 17.1276], frosinone: [41.6401, 13.3436],
  grosseto: [42.7633, 11.1124], campobasso: [41.5633, 14.6564], lucca: [43.8376, 10.4951],
  mantova: [45.1564, 10.7914], matera: [40.6664, 16.6043], novara: [45.4469, 8.622],
  potenza: [40.6388, 15.8059], ragusa: [36.9263, 14.7254], siena: [43.318, 11.3308],
  terni: [42.5614, 12.6428], trapani: [38.0174, 12.537], viterbo: [42.4201, 12.1086],
  cremona: [45.1339, 10.0236], pavia: [45.1847, 9.158], asti: [44.9002, 8.2067],
  alessandria: [44.9131, 8.615], cuneo: [44.3845, 7.5427], aosta: [45.7372, 7.3209],
  "reggio calabria": [38.1147, 15.6501], "reggio emilia": [44.6989, 10.6297],
  alba: [44.7009, 8.0357], ivrea: [45.4667, 7.8733], biella: [45.5628, 8.0583],
  lodi: [45.3138, 9.5034], lecco: [45.8566, 9.3976], sondrio: [46.1699, 9.8788],
  savona: [44.3091, 8.4772], imperia: [43.8895, 8.0278], sanremo: [43.8163, 7.7752],
  "reggio nell'emilia": [44.6989, 10.6297], piacenza: [45.0526, 9.6929],
  forli: [44.2226, 12.0407], belluno: [46.1427, 12.2172], rovigo: [45.0701, 11.7898],
  pordenone: [45.9564, 12.6615], gorizia: [45.9413, 13.6216],
  teramo: [42.6589, 13.7042], chieti: [42.3514, 14.1681], "l'aquila": [42.3498, 13.3995],
  isernia: [41.5961, 14.2328], caserta: [41.0742, 14.3325], "torre del greco": [40.7886, 14.3689],
  oristano: [39.9062, 8.5886], nuoro: [40.3216, 9.3312],
  agrigento: [37.3111, 13.5766], enna: [37.5676, 14.2746], siracusa: [37.0755, 15.2866],
  caltanissetta: [37.4903, 14.0631], "vibo valentia": [38.6761, 16.1004],
  lamezia: [38.9684, 16.3094], gioia: [38.4281, 16.2921],
  vigone: [44.8436, 7.4936], pinerolo: [44.8847, 7.3303],
  casteggio: [45.0139, 9.1261], "settimo torinese": [45.1375, 7.7678],
  "settimo t.se": [45.1375, 7.7678], tassarolo: [44.7261, 8.7753],
  capalbio: [42.4533, 11.4181], carrara: [44.0793, 10.0975],
  cassino: [41.4925, 13.8307], olbia: [40.9236, 9.4979],
  "rivarolo canavese": [45.3308, 7.7194],
  "santi cosma e damiano": [41.3056, 13.8175],
  "sesto fiorentino": [43.8333, 11.2],
};

// Geocoding cache - persist across renders using sessionStorage
const GEOCODE_CACHE_KEY = "geocode_cache_v1";
let geocodeCache: Record<string, [number, number] | null> = {};
try {
  const stored = sessionStorage.getItem(GEOCODE_CACHE_KEY);
  if (stored) geocodeCache = JSON.parse(stored);
} catch { /* ignore */ }

function saveGeocodeCache() {
  try { sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(geocodeCache)); } catch { /* ignore */ }
}

async function geocodeCity(city: string): Promise<[number, number] | null> {
  const key = city.toLowerCase().trim();
  if (key in geocodeCache) return geocodeCache[key];
  if (ITALIAN_CITIES[key]) {
    geocodeCache[key] = ITALIAN_CITIES[key];
    return ITALIAN_CITIES[key];
  }
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ", Italia")}&format=json&limit=1&countrycodes=it`);
    const data = await resp.json();
    if (data?.[0]) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      geocodeCache[key] = coords;
      saveGeocodeCache();
      return coords;
    }
  } catch { /* ignore */ }
  geocodeCache[key] = null;
  saveGeocodeCache();
  return null;
}

function getCityCoordinates(city: string | null): [number, number] | null {
  if (!city) return null;
  const key = city.toLowerCase().trim();
  if (ITALIAN_CITIES[key]) return ITALIAN_CITIES[key];
  if (key in geocodeCache) return geocodeCache[key];
  return null;
}

function buildPlayerClusterPopup(cityKey: string, players: PlayerMapData[]): string {
  const cityName = cityKey.charAt(0).toUpperCase() + cityKey.slice(1);
  const rows = players.map((p) => {
    const name = p.display_name || p.username || "Giocatore";
    const avatar = p.avatar_url
      ? `<img src="${p.avatar_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0" />`
      : `<div style="width:28px;height:28px;border-radius:50%;background:hsl(var(--secondary));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:hsl(var(--primary));flex-shrink:0">${(name[0] || "?").toUpperCase()}</div>`;
    const adminBadge = p.is_admin ? `<span style="background:hsl(var(--destructive));color:#fff;padding:0 4px;border-radius:3px;font-size:8px;font-weight:700;margin-left:4px">ADM</span>` : "";
    const clubTag = p.club_name ? `<span style="font-size:9px;color:hsl(var(--muted-foreground))">🛡️ ${p.club_name}</span>` : "";
    return `<a href="/profilo/${p.username || p.id}" style="display:flex;align-items:center;gap:8px;padding:6px 4px;text-decoration:none;border-bottom:1px solid hsl(var(--border)/0.5);transition:background 0.15s" onmouseover="this.style.background='hsl(var(--accent)/0.3)'" onmouseout="this.style.background='transparent'">
      ${avatar}
      <div style="min-width:0;flex:1">
        <div style="font-size:12px;font-weight:600;color:hsl(var(--foreground));white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}${adminBadge}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${clubTag}
          <span style="font-size:9px;color:hsl(var(--muted-foreground))">${p.season_points}pt · ${p.season_wins}W</span>
        </div>
      </div>
    </a>`;
  }).join("");

  return `<div style="font-family:inherit">
    <div style="padding:8px 10px;border-bottom:1px solid hsl(var(--border));display:flex;align-items:center;justify-content:between;gap:6px">
      <span style="font-size:13px;font-weight:700;color:hsl(var(--foreground))">📍 ${cityName}</span>
      <span style="font-size:11px;color:hsl(var(--muted-foreground));margin-left:auto">${players.length} giocatori</span>
    </div>
    <div style="max-height:240px;overflow-y:auto;overscroll-behavior:contain;padding:0 2px">${rows}</div>
  </div>`;
}

function createLogoIcon(logoUrl: string | null, name: string): L.DivIcon {
  const initial = (name || "?")[0].toUpperCase();
  const inner = logoUrl
    ? `<img src="${logoUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:hsl(var(--primary));background:hsl(var(--secondary));border-radius:50%">${initial}</span>`
    : `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:hsl(var(--primary));background:hsl(var(--secondary));border-radius:50%">${initial}</span>`;

  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
    html: `<div style="width:40px;height:40px;border-radius:50%;border:3px solid hsl(var(--primary));overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.4);background:hsl(var(--card))">${inner}</div>`,
  });
}

interface ClubMapData {
  id: string;
  name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  memberCount: number;
  logo_url?: string | null;
  banner_url?: string | null;
  description?: string | null;
  region_name?: string | null;
  province?: string | null;
  last_tournament_date?: string | null;
  social_instagram?: string | null;
  social_discord?: string | null;
  social_whatsapp_group?: string | null;
}

function buildClubClusterPopup(label: string, clubs: (ClubMapData & { coords: [number, number] })[]): string {
  const rows = clubs.map((c) => {
    const logoHtml = c.logo_url
      ? `<img src="${c.logo_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid hsl(var(--primary))" />`
      : `<div style="width:28px;height:28px;border-radius:50%;background:hsl(var(--secondary));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:hsl(var(--primary));flex-shrink:0;border:1px solid hsl(var(--primary))">${(c.name[0] || "?").toUpperCase()}</div>`;
    return `<a href="/clubs/${c.id}" style="display:flex;align-items:center;gap:8px;padding:6px 4px;text-decoration:none;border-bottom:1px solid hsl(var(--border)/0.5);transition:background 0.15s" onmouseover="this.style.background='hsl(var(--accent)/0.3)'" onmouseout="this.style.background='transparent'">
      ${logoHtml}
      <div style="min-width:0;flex:1">
        <div style="font-size:12px;font-weight:600;color:hsl(var(--foreground));white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${c.city ? `<span style="font-size:9px;color:hsl(var(--muted-foreground))">📍 ${c.city}</span>` : ""}
          <span style="font-size:9px;color:hsl(var(--muted-foreground))">👥 ${c.memberCount}</span>
        </div>
      </div>
    </a>`;
  }).join("");

  return `<div style="font-family:inherit">
    <div style="padding:8px 10px;border-bottom:1px solid hsl(var(--border));display:flex;align-items:center;gap:6px">
      <span style="font-size:13px;font-weight:700;color:hsl(var(--foreground))">🛡️ ${label}</span>
      <span style="font-size:11px;color:hsl(var(--muted-foreground));margin-left:auto">${clubs.length} club</span>
    </div>
    <div style="max-height:240px;overflow-y:auto;overscroll-behavior:contain;padding:0 2px">${rows}</div>
  </div>`;
}

function buildClubPopup(club: ClubMapData & { coords: [number, number] }): string {
  const bannerBg = club.banner_url
    ? `background-image:url('${club.banner_url}');background-size:cover;background-position:center;`
    : `background:linear-gradient(135deg,hsl(var(--primary)/0.15),hsl(var(--card)));`;

  const logoHtml = club.logo_url
    ? `<img src="${club.logo_url}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;border:2px solid hsl(var(--primary))" />`
    : `<div style="width:32px;height:32px;border-radius:8px;background:hsl(var(--secondary));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:hsl(var(--primary));border:2px solid hsl(var(--primary))">${(club.name[0] || "?").toUpperCase()}</div>`;

  const lastTournament = club.last_tournament_date
    ? new Date(club.last_tournament_date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })
    : "Nessuno";

  return `<div style="position:relative;border-radius:12px;overflow:hidden;min-width:200px;max-width:240px;font-family:inherit">
    <div style="position:absolute;inset:0;${bannerBg}filter:blur(6px) brightness(0.25);z-index:0;transform:scale(1.15)"></div>
    <div style="position:relative;z-index:1;padding:12px;color:hsl(var(--foreground))">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        ${logoHtml}
        <div>
          <div style="font-weight:bold;color:white;font-size:13px">${club.name}</div>
          ${club.region_name ? `<p style="margin:0;font-size:10px;color:rgba(255,255,255,0.6)">${club.region_name}</p>` : ""}
        </div>
      </div>
      ${club.description ? `<p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.55);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${club.description}</p>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1)">
        ${club.city ? `<div style="font-size:10px;color:rgba(255,255,255,0.6)">📍 ${club.city}</div>` : ""}
        <div style="font-size:10px;color:rgba(255,255,255,0.6)">👥 ${club.memberCount} membri</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.6)">🏆 ${lastTournament}</div>
      </div>
      <a href="/clubs/${club.id}" style="display:block;text-align:center;margin-top:8px;padding:5px 0;background:hsl(var(--primary));color:hsl(var(--primary-foreground));border-radius:6px;font-size:11px;font-weight:600;text-decoration:none">INFO</a>
    </div>
  </div>`;
}

export interface PlayerMapData {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  city: string | null;
  avatar_url: string | null;
  points: number;
  wins: number;
  season_points: number;
  season_wins: number;
  club_name: string | null;
  club_role: string | null;
  is_admin: boolean;
  is_active: boolean;
  last_seen_at: string | null;
  collection_pct: number;
  province: string | null;
  region_name: string | null;
}

interface ClubsMapProps {
  clubs: ClubMapData[];
  players?: PlayerMapData[];
}

function roleLabel(role: string | null): string {
  switch (role) {
    case "leader": return "Club Leader";
    case "vice_leader": return "Vice Club Leader";
    case "staff": return "Staff";
    case "member": return "Membro";
    default: return "";
  }
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Mai visto";
  const now = new Date();
  const last = new Date(lastSeenAt);
  const diffMs = now.getTime() - last.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "ora" : "ore"} fa`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? "giorno" : "giorni"} fa`;
}

function buildPlayerPopup(player: PlayerMapData): string {
  const name = player.display_name || player.username || "Giocatore";
  const avatarHtml = player.avatar_url
    ? `<img src="${player.avatar_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid hsl(var(--primary))" />`
    : `<div style="width:36px;height:36px;border-radius:50%;background:hsl(var(--secondary));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:hsl(var(--primary));border:2px solid hsl(var(--primary))">${(name[0] || "?").toUpperCase()}</div>`;

  const adminBadge = player.is_admin
    ? `<span style="background:hsl(var(--destructive));color:white;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px">ADMIN</span>`
    : "";

  const statusHtml = player.is_active
    ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:4px;vertical-align:middle"></span><span style="font-size:10px;color:#22c55e">Attivo di recente</span>`
    : player.last_seen_at
      ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#6b7280;margin-right:4px;vertical-align:middle"></span><span style="font-size:10px;color:#6b7280">Ultimo torneo ${formatLastSeen(player.last_seen_at)}</span>`
      : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#6b7280;margin-right:4px;vertical-align:middle"></span><span style="font-size:10px;color:#6b7280">Mai partecipato</span>`;

  const clubInfo = player.club_name
    ? `<p style="margin:3px 0 0;font-size:11px;color:hsl(var(--muted-foreground))">🛡️ ${player.club_name}${player.club_role ? ` · ${roleLabel(player.club_role)}` : ""}</p>`
    : `<p style="margin:3px 0 0;font-size:11px;color:hsl(var(--muted-foreground));opacity:0.6">Senza club</p>`;

  return `<div style="background:hsl(var(--card));color:hsl(var(--foreground));padding:12px;border-radius:12px;font-family:inherit;min-width:180px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      ${avatarHtml}
      <div>
        <a href="/profilo/${player.username || player.id}" style="font-weight:bold;color:hsl(var(--primary));font-size:13px;text-decoration:none">${name}</a>${adminBadge}
        <div style="margin-top:2px">${statusHtml}</div>
      </div>
    </div>
    ${player.city ? `<p style="margin:0 0 4px;color:hsl(var(--muted-foreground));font-size:11px">📍 ${player.city}</p>` : ""}
    ${clubInfo}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px;padding-top:6px;border-top:1px solid hsl(var(--border))">
      <div style="font-size:10px;color:hsl(var(--muted-foreground))">Punti <span style="font-weight:700;color:hsl(var(--foreground))">${player.points}</span></div>
      <div style="font-size:10px;color:hsl(var(--muted-foreground))">Vittorie <span style="font-weight:700;color:hsl(var(--foreground))">${player.wins}</span></div>
      <div style="font-size:10px;color:hsl(var(--muted-foreground))">Stagione <span style="font-weight:700;color:hsl(var(--primary))">${player.season_points} pt</span></div>
      <div style="font-size:10px;color:hsl(var(--muted-foreground))">Stagione <span style="font-weight:700;color:hsl(var(--primary))">${player.season_wins} W</span></div>
    </div>
    <div style="margin-top:6px;font-size:10px;color:hsl(var(--muted-foreground))">
      📦 Collezione: <span style="font-weight:700;color:hsl(var(--foreground))">${player.collection_pct}%</span>
      <div style="margin-top:3px;height:4px;background:hsl(var(--secondary));border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${player.collection_pct}%;background:hsl(var(--primary));border-radius:2px"></div>
      </div>
    </div>
  </div>`;
}

// Map GeoJSON region names to the DB region names
const REGION_NAME_MAP: Record<string, string> = {
  "Valle d'Aosta/Vallée d'Aoste": "Valle d'Aosta",
  "Trentino-Alto Adige/Südtirol": "Trentino-Alto Adige",
  "Friuli-Venezia Giulia": "Friuli Venezia Giulia",
};

function normalizeRegionName(geojsonName: string): string {
  return REGION_NAME_MAP[geojsonName] || geojsonName;
}

function reverseRegionName(dbName: string): string {
  for (const [geoName, mapped] of Object.entries(REGION_NAME_MAP)) {
    if (mapped === dbName) return geoName;
  }
  return dbName;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getSafePopupLatLng(map: L.Map, latlng: L.LatLngExpression, width = 280, height = 320): L.LatLng {
  const size = map.getSize();
  const padding = 16;
  const popupWidth = Math.min(width, Math.max(180, size.x - padding * 2));
  const popupHeight = Math.min(height, Math.max(180, size.y - padding * 3));
  const point = map.latLngToContainerPoint(latlng);
  const minX = popupWidth / 2 + padding;
  const maxX = size.x - popupWidth / 2 - padding;
  const minY = popupHeight + padding;
  const maxY = size.y - padding;
  const safeX = maxX >= minX ? clamp(point.x, minX, maxX) : size.x / 2;
  const safeY = maxY >= minY ? clamp(point.y, minY, maxY) : maxY;
  return map.containerPointToLatLng(L.point(safeX, safeY));
}

function openClusterPopup(map: L.Map, latlng: L.LatLngExpression, content: string) {
  const size = map.getSize();
  L.popup({
    className: "dark-popup player-cluster-popup",
    closeButton: true,
    maxWidth: Math.min(280, Math.max(180, size.x - 32)),
    maxHeight: Math.min(320, Math.max(180, size.y - 48)),
    autoPan: false,
  })
    .setLatLng(getSafePopupLatLng(map, latlng))
    .setContent(content)
    .openOn(map);
}

export const ClubsMap = ({ clubs, players = [] }: ClubsMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"clubs" | "players">("clubs");
  const [geocodedCoords, setGeocodedCoords] = useState<Record<string, [number, number]>>({});
  const [zoomLevel, setZoomLevel] = useState(6);
  const [regionsGeoJson, setRegionsGeoJson] = useState<any>(null);
  const regionLayerRef = useRef<L.GeoJSON | null>(null);

  // Load regions GeoJSON once
  useEffect(() => {
    fetch("/data/italy-regions.geojson")
      .then(r => r.json())
      .then(setRegionsGeoJson)
      .catch(() => {});
  }, []);

  // Group players by city key
  const playersByCity = useMemo(() => {
    const groups: Record<string, PlayerMapData[]> = {};
    players.forEach((p) => {
      const key = (p.city || "").toLowerCase().trim();
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [players]);

  // Group players by province
  const playersByProvince = useMemo(() => {
    const groups: Record<string, PlayerMapData[]> = {};
    players.forEach((p) => {
      const key = p.province || "Sconosciuta";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [players]);

  // Group players by region
  const playersByRegion = useMemo(() => {
    const groups: Record<string, PlayerMapData[]> = {};
    players.forEach((p) => {
      const key = p.region_name || "Sconosciuta";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [players]);

  // Geocode missing cities — for players (when filter=players) AND for clubs without coords
  useEffect(() => {
    const missingFromPlayers = filter === "players"
      ? Object.keys(playersByCity).filter(k => !getCityCoordinates(k) && !(k in geocodedCoords))
      : [];
    const missingFromClubs = clubs
      .filter(c => (c.latitude == null || c.longitude == null) && c.city)
      .map(c => (c.city as string).toLowerCase().trim())
      .filter(k => k && !getCityCoordinates(k) && !(k in geocodedCoords));
    const missing = Array.from(new Set([...missingFromPlayers, ...missingFromClubs]));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const newCoords: Record<string, [number, number]> = {};
      for (const city of missing.slice(0, 50)) {
        if (cancelled) break;
        const coords = await geocodeCity(city);
        if (coords) newCoords[city] = coords;
        await new Promise(r => setTimeout(r, 200));
      }
      if (!cancelled && Object.keys(newCoords).length > 0) {
        setGeocodedCoords(prev => ({ ...prev, ...newCoords }));
      }
    })();
    return () => { cancelled = true; };
  }, [filter, playersByCity, clubs, geocodedCoords]);

  const getCoords = useCallback((city: string): [number, number] | null => {
    const key = city.toLowerCase().trim();
    return ITALIAN_CITIES[key] || geocodedCoords[key] || (geocodeCache[key] ?? null);
  }, [geocodedCoords]);

  // Compute centroid of a group of players using their city coords
  const getGroupCentroid = useCallback((groupPlayers: PlayerMapData[]): [number, number] | null => {
    let sumLat = 0, sumLng = 0, count = 0;
    groupPlayers.forEach(p => {
      const c = p.city ? getCoords(p.city) : null;
      if (c) { sumLat += c[0]; sumLng += c[1]; count++; }
    });
    if (count === 0) return null;
    return [sumLat / count, sumLng / count];
  }, [getCoords]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const isMobile = window.innerWidth < 768;
    const map = L.map(containerRef.current, {
      center: [42.0, 12.5],
      zoom: 6,
      minZoom: 5,
      maxBounds: L.latLngBounds([35.0, 5.0], [48.0, 20.0]),
      maxBoundsViscosity: 1.0,
      zoomControl: true,
      dragging: !isMobile,
      touchZoom: true,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    if (isMobile) {
      map.on('touchstart', (e: any) => {
        if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length >= 2) {
          map.dragging.enable();
        }
      });
      map.on('touchend', () => {
        map.dragging.disable();
      });
    }

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    setTimeout(() => { map.invalidateSize(); }, 200);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const markersData = useMemo(() => clubs
    .map((club) => {
      const coords =
        club.latitude && club.longitude
          ? [club.latitude, club.longitude] as [number, number]
          : (club.city ? getCoords(club.city) : null);
      if (!coords) return null;
      return { ...club, coords };
    })
    .filter(Boolean) as (ClubMapData & { coords: [number, number] })[], [clubs, getCoords]);

  // Group clubs by region / province / city
  const clubsByRegion = useMemo(() => {
    const g: Record<string, (ClubMapData & { coords: [number, number] })[]> = {};
    markersData.forEach(c => {
      const k = c.region_name || "Sconosciuta";
      (g[k] ||= []).push(c);
    });
    return g;
  }, [markersData]);

  const clubsByProvince = useMemo(() => {
    const g: Record<string, (ClubMapData & { coords: [number, number] })[]> = {};
    markersData.forEach(c => {
      const k = c.province || c.city || "Sconosciuta";
      (g[k] ||= []).push(c);
    });
    return g;
  }, [markersData]);

  const clubsByCity = useMemo(() => {
    const g: Record<string, (ClubMapData & { coords: [number, number] })[]> = {};
    markersData.forEach(c => {
      const k = (c.city || "").toLowerCase().trim() || "sconosciuta";
      (g[k] ||= []).push(c);
    });
    return g;
  }, [markersData]);

  // Determine grouping level based on zoom
  const clusterLevel = useMemo((): "region" | "province" | "city" => {
    if (zoomLevel <= 6) return "region";
    if (zoomLevel <= 8) return "province";
    return "city";
  }, [zoomLevel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    // Remove previous region layer
    if (regionLayerRef.current) {
      map.removeLayer(regionLayerRef.current);
      regionLayerRef.current = null;
    }

    if (filter === "players") {
      // At region level with GeoJSON available → show polygons
      if (clusterLevel === "region" && regionsGeoJson) {
        const regionLayer = L.geoJSON(regionsGeoJson, {
          style: (feature) => {
            const regName = normalizeRegionName(feature?.properties?.reg_name || "");
            const count = playersByRegion[regName]?.length || 0;
            const opacity = count > 0 ? Math.min(0.6, 0.15 + count / 200) : 0.05;
            return {
              fillColor: count > 0 ? "hsl(var(--primary))" : "#555",
              fillOpacity: opacity,
              color: "hsl(var(--primary))",
              weight: 1.5,
              opacity: 0.6,
            };
          },
          onEachFeature: (feature, layer) => {
            const geoName = feature.properties?.reg_name || "";
            const regName = normalizeRegionName(geoName);
            const regionPlayers = playersByRegion[regName] || [];
            const count = regionPlayers.length;

            // Add count label at centroid
            if (count > 0) {
              const bounds = (layer as L.Polygon).getBounds();
              const center = bounds.getCenter();
              const labelIcon = L.divIcon({
                className: "",
                iconSize: [36, 18],
                iconAnchor: [18, 9],
                html: `<div style="background:hsl(var(--card)/0.9);border:1px solid hsl(var(--primary));border-radius:4px;padding:1px 4px;font-size:9px;font-weight:700;color:hsl(var(--primary));text-align:center;white-space:nowrap;pointer-events:none;backdrop-filter:blur(4px);line-height:1.3">${count}</div>`,
              });
              L.marker(center, { icon: labelIcon, interactive: false }).addTo(map);
            }

            // Hover highlight
            layer.on("mouseover", () => {
              (layer as any).setStyle({
                fillOpacity: count > 0 ? 0.5 : 0.1,
                weight: 2.5,
                opacity: 1,
              });
            });
            layer.on("mouseout", () => {
              regionLayer.resetStyle(layer);
            });

            // Click → popup with player list
            if (count > 0) {
              layer.on("click", (event: L.LeafletMouseEvent) => {
                openClusterPopup(map, event.latlng, buildPlayerClusterPopup(regName, regionPlayers));
              });
            }
          },
        }).addTo(map);
        regionLayerRef.current = regionLayer;
      } else {
        // Province / City level → use bubble markers
        const groups = clusterLevel === "province" ? playersByProvince : playersByCity;
        const getGroupCoords = clusterLevel === "province"
          ? (_key: string, ps: PlayerMapData[]) => getGroupCentroid(ps)
          : (key: string, _ps: PlayerMapData[]) => getCoords(key);

        Object.entries(groups).forEach(([groupKey, groupPlayers]) => {
          if (groupKey === "Sconosciuta") return;
          const coords = getGroupCoords(groupKey, groupPlayers);
          if (!coords) return;

          const count = groupPlayers.length;
          const zoomScale = clusterLevel === "province" ? 0.85 : 1;
          const baseSize = 24 + Math.log2(count + 1) * 5;
          const size = Math.max(24, Math.min(50, baseSize * zoomScale));

          const label = clusterLevel === "city"
            ? groupKey.charAt(0).toUpperCase() + groupKey.slice(1)
            : groupKey;

          const clusterIcon = L.divIcon({
            className: "",
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:hsl(var(--secondary));border:2px solid hsl(var(--primary));display:flex;align-items:center;justify-content:center;color:hsl(var(--primary));font-weight:700;font-size:${size > 40 ? 13 : 11}px;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;transition:transform 0.2s" title="${label}">${count}</div>`,
          });

          const marker = L.marker(coords, { icon: clusterIcon }).addTo(map);
          marker.bindPopup(buildPlayerClusterPopup(clusterLevel !== "city" ? label : groupKey, groupPlayers), {
            className: "dark-popup player-cluster-popup",
            closeButton: true,
            maxWidth: 280,
            maxHeight: 320,
          });
        });
      }
    }

    if (filter === "clubs") {
      // At region level → polygons with counts
      if (clusterLevel === "region" && regionsGeoJson) {
        const regionLayer = L.geoJSON(regionsGeoJson, {
          style: (feature) => {
            const regName = normalizeRegionName(feature?.properties?.reg_name || "");
            const count = clubsByRegion[regName]?.length || 0;
            const opacity = count > 0 ? Math.min(0.6, 0.15 + count / 30) : 0.05;
            return {
              fillColor: count > 0 ? "hsl(var(--primary))" : "#555",
              fillOpacity: opacity,
              color: "hsl(var(--primary))",
              weight: 1.5,
              opacity: 0.6,
            };
          },
          onEachFeature: (feature, layer) => {
            const regName = normalizeRegionName(feature.properties?.reg_name || "");
            const regionClubs = clubsByRegion[regName] || [];
            const count = regionClubs.length;
            if (count > 0) {
              const center = (layer as L.Polygon).getBounds().getCenter();
              const labelIcon = L.divIcon({
                className: "",
                iconSize: [36, 18],
                iconAnchor: [18, 9],
                html: `<div style="background:hsl(var(--card)/0.9);border:1px solid hsl(var(--primary));border-radius:4px;padding:1px 4px;font-size:9px;font-weight:700;color:hsl(var(--primary));text-align:center;white-space:nowrap;pointer-events:none;backdrop-filter:blur(4px);line-height:1.3">${count}</div>`,
              });
              L.marker(center, { icon: labelIcon, interactive: false }).addTo(map);
              layer.on("mouseover", () => (layer as any).setStyle({ fillOpacity: 0.5, weight: 2.5, opacity: 1 }));
              layer.on("mouseout", () => regionLayer.resetStyle(layer));
              layer.on("click", (event: L.LeafletMouseEvent) => {
                openClusterPopup(map, event.latlng, buildClubClusterPopup(regName, regionClubs));
              });
            }
          },
        }).addTo(map);
        regionLayerRef.current = regionLayer;
      } else if (clusterLevel === "province") {
        Object.entries(clubsByProvince).forEach(([key, list]) => {
          if (key === "Sconosciuta" || list.length === 0) return;
          const sumLat = list.reduce((s, c) => s + c.coords[0], 0);
          const sumLng = list.reduce((s, c) => s + c.coords[1], 0);
          const center: [number, number] = [sumLat / list.length, sumLng / list.length];
          const count = list.length;
          const size = Math.max(28, Math.min(50, 24 + Math.log2(count + 1) * 6));
          const icon = L.divIcon({
            className: "",
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:hsl(var(--secondary));border:2px solid hsl(var(--primary));display:flex;align-items:center;justify-content:center;color:hsl(var(--primary));font-weight:700;font-size:${size > 40 ? 13 : 11}px;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer">${count}</div>`,
          });
          L.marker(center, { icon }).addTo(map).bindPopup(buildClubClusterPopup(key, list), {
            className: "dark-popup player-cluster-popup",
            closeButton: true,
            maxWidth: 280,
            maxHeight: 320,
          });
        });
      } else {
        // City level → individual logo markers (or grouped if same city)
        Object.entries(clubsByCity).forEach(([key, list]) => {
          if (key === "sconosciuta" || list.length === 0) return;
          if (list.length === 1) {
            const club = list[0];
            const icon = createLogoIcon(club.logo_url || null, club.name);
            L.marker(club.coords, { icon }).addTo(map).bindPopup(buildClubPopup(club), {
              className: "dark-popup",
              closeButton: false,
              maxWidth: 260,
            });
          } else {
            const sumLat = list.reduce((s, c) => s + c.coords[0], 0);
            const sumLng = list.reduce((s, c) => s + c.coords[1], 0);
            const center: [number, number] = [sumLat / list.length, sumLng / list.length];
            const count = list.length;
            const size = Math.max(28, Math.min(46, 24 + count * 3));
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            const icon = L.divIcon({
              className: "",
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
              html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:hsl(var(--secondary));border:2px solid hsl(var(--primary));display:flex;align-items:center;justify-content:center;color:hsl(var(--primary));font-weight:700;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${count}</div>`,
            });
            L.marker(center, { icon }).addTo(map).bindPopup(buildClubClusterPopup(label, list), {
              className: "dark-popup player-cluster-popup",
              closeButton: true,
              maxWidth: 280,
              maxHeight: 320,
            });
          }
        });
      }
    }
  }, [markersData, playersByCity, playersByProvince, playersByRegion, clubsByRegion, clubsByProvince, clubsByCity, filter, getCoords, geocodedCoords, clusterLevel, getGroupCentroid, regionsGeoJson]);

  const filterButtons: { key: typeof filter; label: string }[] = [
    { key: "clubs", label: "Club" },
    { key: "players", label: "Giocatori" },
  ];

  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-card h-full min-h-[400px] relative z-0">
      {/* Filter buttons */}
      <div className="absolute top-3 right-3 z-[1000] flex gap-1 bg-card/90 backdrop-blur-sm rounded-lg border border-border p-1">
        {filterButtons.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <style>{`
        .dark-popup .leaflet-popup-content-wrapper {
          background: hsl(var(--card)) !important;
          color: hsl(var(--foreground)) !important;
          border-radius: 12px !important;
          border: 1px solid hsl(var(--border)) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
          padding: 0 !important;
        }
        .dark-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .dark-popup .leaflet-popup-tip {
          background: hsl(var(--card)) !important;
          border: 1px solid hsl(var(--border)) !important;
          box-shadow: none !important;
        }
        .player-cluster-popup .leaflet-popup-content {
          overflow: hidden !important;
        }
        .player-cluster-popup .leaflet-popup-content div::-webkit-scrollbar {
          width: 5px;
        }
        .player-cluster-popup .leaflet-popup-content div::-webkit-scrollbar-track {
          background: hsl(var(--secondary));
          border-radius: 3px;
        }
        .player-cluster-popup .leaflet-popup-content div::-webkit-scrollbar-thumb {
          background: hsl(var(--primary)/0.5);
          border-radius: 3px;
        }
        .player-cluster-popup .leaflet-popup-content div::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary)/0.7);
        }
      `}</style>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
};