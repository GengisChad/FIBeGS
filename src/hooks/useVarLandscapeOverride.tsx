import { useCallback, useEffect, useState } from "react";

export type VarLandscapeOverride = "portrait" | "landscape";

const KEY = "var:landscape-override";
const EVT = "var:landscape-override-change";

function read(): VarLandscapeOverride {
  if (typeof window === "undefined") return "portrait";
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "landscape" || v === "on" ? "landscape" : "portrait";
  } catch {
    return "portrait";
  }
}

/**
 * Modalità manuale persistente per il VAR.
 * Non usa più l'orientamento fisico del telefono: cambia solo quando l'utente preme il pulsante.
 */
export function useVarLandscapeOverride() {
  const [override, setOverrideState] = useState<VarLandscapeOverride>(read);

  useEffect(() => {
    const sync = () => setOverrideState(read());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setOverride = useCallback((v: VarLandscapeOverride) => {
    try { window.localStorage.setItem(KEY, v); } catch {}
    setOverrideState(v);
    window.dispatchEvent(new Event(EVT));
  }, []);

  const toggle = useCallback(() => {
    setOverride(read() === "landscape" ? "portrait" : "landscape");
  }, [setOverride]);

  return { override, mode: override, setOverride, toggle, forced: override === "landscape" };
}
