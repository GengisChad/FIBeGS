/**
 * End-to-end encryption for private chats (libsodium crypto_box).
 *
 * - Each user has a Curve25519 keypair. Public key is stored on `profiles.public_key`.
 * - Private key is escrowed per account in `user_chat_keys` so every authenticated
 *   device can decrypt the same chats.
 * - Messages are encrypted with `crypto_box_easy(plaintext, nonce, recipientPub, mySecret)`
 *   and stored on the server as base64 ciphertext + base64 nonce. Server cannot read.
 *
 * Historic account keys are kept in `user_chat_key_history` so older messages stay
 * readable after a device/key rotation.
 */
import sodium from "libsodium-wrappers";
import { supabase } from "@/integrations/supabase/client";

let _ready: Promise<void> | null = null;
const ready = () => (_ready ??= sodium.ready);

const skKey = (userId: string) => `ibna_chat_sk_v1_${userId}`;
const pkKey = (userId: string) => `ibna_chat_pk_v1_${userId}`;

const b64 = {
  enc: (u: Uint8Array) => btoa(String.fromCharCode(...u)),
  dec: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

// ---------- IndexedDB backup (survives some localStorage clears) ----------
const IDB_NAME = "ibna_chat_keys";
const IDB_STORE = "keys";
function idb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function idbGet(key: string): Promise<string | null> {
  const db = await idb(); if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
    tx.onsuccess = () => resolve((tx.result as string) ?? null);
    tx.onerror = () => resolve(null);
  });
}
async function idbSet(key: string, value: string): Promise<void> {
  const db = await idb(); if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put(value, key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function readKey(name: string): Promise<string | null> {
  const ls = (() => { try { return localStorage.getItem(name); } catch { return null; } })();
  if (ls) return ls;
  const fromIdb = await idbGet(name);
  if (fromIdb) {
    try { localStorage.setItem(name, fromIdb); } catch { /* ignore */ }
    return fromIdb;
  }
  return null;
}
async function writeKey(name: string, value: string): Promise<void> {
  try { localStorage.setItem(name, value); } catch { /* ignore */ }
  await idbSet(name, value);
}

/**
 * Save a keypair into the server-side history so any device, present or future,
 * can decrypt historic messages encrypted with it. Idempotent.
 */
async function pushKeyToHistory(userId: string, publicKeyB64: string, privateKeyB64: string) {
  try {
    await supabase
      .from("user_chat_key_history")
      .upsert(
        { user_id: userId, public_key: publicKeyB64, private_key: privateKeyB64 },
        { onConflict: "user_id,public_key", ignoreDuplicates: true },
      );
    historyCache.delete(userId);
  } catch { /* best-effort */ }
}

export async function ensureKeyPair(userId: string): Promise<{ publicKeyB64: string }> {
  await ready();

  // Server escrow (user_chat_keys) is the source of truth so every device of the
  // same account shares the same active keypair. Always check it first.
  let sk: string | null = null;
  let pk: string | null = null;
  const cachedSk = await readKey(skKey(userId));
  const cachedPk = await readKey(pkKey(userId));

  const { data: serverKey } = await supabase
    .from("user_chat_keys")
    .select("public_key, private_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (serverKey?.private_key && serverKey?.public_key) {
    if (cachedSk && cachedPk && cachedPk !== serverKey.public_key) {
      await pushKeyToHistory(userId, cachedPk, cachedSk);
    }
    sk = serverKey.private_key;
    pk = serverKey.public_key;
    await writeKey(skKey(userId), sk);
    await writeKey(pkKey(userId), pk);
    await pushKeyToHistory(userId, pk, sk);
  } else {
    // Legacy: try local cache (device that pre-dates escrow).
    sk = cachedSk;
    pk = cachedPk;
  }

  // Still nothing → generate a fresh keypair and upload to server escrow + history.
  if (!sk || !pk) {
    const kp = sodium.crypto_box_keypair();
    pk = b64.enc(kp.publicKey);
    sk = b64.enc(kp.privateKey);
    await writeKey(skKey(userId), sk);
    await writeKey(pkKey(userId), pk);

    await supabase.from("user_chat_keys").upsert({
      user_id: userId, public_key: pk, private_key: sk,
    });
    await pushKeyToHistory(userId, pk, sk);
  } else if (!serverKey?.private_key) {
    // Legacy local key, no server escrow yet — backfill both.
    await supabase.from("user_chat_keys").upsert({
      user_id: userId, public_key: pk, private_key: sk,
    });
    await pushKeyToHistory(userId, pk, sk);
  }

  // Sync public_key on profile if different (peers encrypt to this one).
  const { data } = await supabase.from("profiles").select("public_key").eq("user_id", userId).maybeSingle();
  if (!data?.public_key || data.public_key !== pk) {
    await supabase.from("profiles").update({ public_key: pk }).eq("user_id", userId);
  }

  return { publicKeyB64: pk };
}

export function hasLocalKey(userId: string): boolean {
  try { return !!localStorage.getItem(skKey(userId)); } catch { return false; }
}

async function getMySecret(userId: string): Promise<Uint8Array> {
  await ready();
  const sk = await readKey(skKey(userId));
  if (!sk) throw new Error("Chiave privata non trovata.");
  return b64.dec(sk);
}

// In-memory cache of all historic private keys (base64) for the logged user.
const historyCache = new Map<string, string[]>();
async function getAllMySecrets(userId: string): Promise<Uint8Array[]> {
  await ready();
  let list = historyCache.get(userId);
  if (!list) {
    const [{ data: current }, { data: history }] = await Promise.all([
      supabase.from("user_chat_keys").select("private_key").eq("user_id", userId).maybeSingle(),
      supabase.from("user_chat_key_history").select("private_key").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    list = [];
    if (current?.private_key) list.push(current.private_key);
    for (const row of (history ?? []) as Array<{ private_key: string | null }>) {
      if (row.private_key && !list.includes(row.private_key)) list.push(row.private_key);
    }
    const localSk = await readKey(skKey(userId));
    if (localSk && !list.includes(localSk)) list.unshift(localSk);
    historyCache.set(userId, list);
  }
  return list.map((s) => b64.dec(s));
}

const peerPublicKeyHistoryCache = new Map<string, string[]>();
async function getPeerPublicKeyHistory(peerUserId: string): Promise<Uint8Array[]> {
  await ready();
  let list = peerPublicKeyHistoryCache.get(peerUserId);
  if (!list) {
    const [{ data: profile }, { data: rpcRows }] = await Promise.all([
      supabase.from("profiles").select("public_key").eq("user_id", peerUserId).maybeSingle(),
      (supabase as any).rpc("get_chat_public_key_history", { _user_id: peerUserId }),
    ]);
    list = [];
    if (profile?.public_key) list.push(profile.public_key);
    for (const row of ((rpcRows ?? []) as Array<{ public_key: string | null }>)) {
      if (row.public_key && !list.includes(row.public_key)) list.push(row.public_key);
    }
    peerPublicKeyHistoryCache.set(peerUserId, list);
  }
  return list.map((s) => b64.dec(s));
}

export async function getPeerPublicKey(peerUserId: string): Promise<Uint8Array | null> {
  const keys = await getPeerPublicKeyHistory(peerUserId);
  return keys[0] ?? null;
}

export async function encryptMessage(myUserId: string, peerPub: Uint8Array, plaintext: string) {
  await ready();
  const mySk = await getMySecret(myUserId);
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const enc = new TextEncoder().encode(plaintext);
  const cipher = sodium.crypto_box_easy(enc, nonce, peerPub, mySk);
  return { content_encrypted: b64.enc(cipher), nonce: b64.enc(nonce) };
}

export async function decryptMessage(
  myUserId: string,
  peerPub: Uint8Array,
  content_encrypted: string,
  nonce: string,
  peerUserId?: string,
): Promise<string> {
  await ready();
  const cipher = b64.dec(content_encrypted);
  const n = b64.dec(nonce);
  const peerKeys = peerUserId ? await getPeerPublicKeyHistory(peerUserId) : [];
  const peerCandidates = [peerPub, ...peerKeys].filter((key, index, keys) =>
    keys.findIndex((other) => b64.enc(other) === b64.enc(key)) === index,
  );

  // Try the current account key first with all possible sender public keys.
  try {
    const mySk = await getMySecret(myUserId);
    for (const pub of peerCandidates) {
      try {
        return new TextDecoder().decode(sodium.crypto_box_open_easy(cipher, n, pub, mySk));
      } catch { /* try next peer key */ }
    }
  } catch { /* fall through to history */ }

  // Fall back to every historic recipient key and every historic sender public key.
  try {
    const allSecrets = await getAllMySecrets(myUserId);
    for (const sk of allSecrets) {
      for (const pub of peerCandidates) {
        try {
          return new TextDecoder().decode(sodium.crypto_box_open_easy(cipher, n, pub, sk));
        } catch { /* try next key combination */ }
      }
    }
  } catch { /* ignore */ }

  return "🔒 Messaggio non leggibile (cifrato con una chiave non più disponibile)";
}
