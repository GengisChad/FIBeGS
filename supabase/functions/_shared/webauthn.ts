// Shared helpers for passkey edge functions.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const RP_NAME = "IBNA";

/**
 * Derive the WebAuthn Relying Party ID and expected origin from the request.
 * Allows any HTTPS lovable.app preview, the production ibna.it domain, and
 * localhost for development.
 */
export function rpFromRequest(req: Request) {
  const envRpId = Deno.env.get("PASSKEY_RP_ID");
  const origin = req.headers.get("origin") || "";
  let hostname = "";
  try {
    hostname = new URL(origin).hostname;
  } catch {
    hostname = "";
  }

  // For Capacitor Android, origin may be "https://localhost" or
  // "capacitor://localhost" — accept and use ibna.it as RP id (must match
  // Digital Asset Links).
  let rpID = envRpId || hostname || "ibna.it";
  if (hostname === "" || hostname === "localhost") {
    rpID = envRpId || "ibna.it";
  }

  return { rpID, origin, hostname };
}
