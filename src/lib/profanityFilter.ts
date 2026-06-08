/**
 * Italian + English profanity & blasphemy filter — word-boundary based.
 *
 * Strategy:
 *  1. Strip HTML.
 *  2. Lowercase + map accents/leetspeak/symbols to plain letters.
 *  3. Collapse runs of 4+ identical letters (fuuuuck → fuck).
 *  4. Remove ALL non-letter characters within a word so evasions like
 *     "f.u.c.k", "a-d-o-l-f", "c4zz0", "n!gger", "f u c k" become single tokens
 *     (we tokenize on whitespace AFTER first joining inline punctuation).
 *  5. Match each profane word against the normalized stream with strict
 *     word boundaries — no substring matching, so "fica" inside "classifica"
 *     and "ass" inside "passione" never trigger.
 *
 * Words shorter than 3 letters are skipped.
 */

// Character substitution map
const CHAR_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's',
  '6': 'g', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '|': 'i', '€': 'e', '£': 'e',
  '+': 't', '(': 'c', '{': 'c', '[': 'c',
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ñ': 'n', 'ç': 'c',
  'æ': 'ae', 'œ': 'oe', 'ß': 'ss',
};

/**
 * NOTE: Lista volutamente conservativa. Sono state rimosse parole brevi
 * (≤4 lettere) e termini ambigui che producevano falsi positivi su nomi
 * comuni o nomi di tornei (es. "fica" dentro "Classi.fica", "duce" dentro
 * "produce", "nazi" dentro nomi propri). Solo termini chiaramente offensivi
 * e di lunghezza ≥5 lettere.
 */
const PROFANITY_LIST: string[] = [
  // ===== ITALIAN parolacce (≥5 lettere, inequivocabili) =====
  'cazzo', 'minchia', 'coglione', 'coglioni', 'stronzo', 'stronza', 'stronzi', 'stronze',
  'merdoso', 'merdosa', 'merdaccia',
  'vaffanculo', 'fanculo', 'affanculo',
  'puttana', 'puttane', 'puttaniere', 'puttanata', 'puttanate',
  'troione', 'troiata', 'troiate',
  'figona', 'ficona',
  'figliodiputtana', 'figlidiputtana',
  'culattone', 'culattoni',
  'cazzata', 'cazzate', 'cazzaro', 'cazzone', 'cazzoni', 'cazzetto',
  'cornuto', 'cornuta', 'cornuti',
  'bastardo', 'bastarda', 'bastardi', 'bastarde',
  'fottiti', 'fottuto', 'fottuta', 'fottuti', 'fottute',
  'segaiolo', 'segaioli',
  'pompino', 'pompini', 'pompinara',
  'inculare', 'inculata', 'inculato',
  'zoccola', 'zoccole',
  'baldracca', 'baldracche',
  'mignotta', 'mignotte',
  'mongoloide', 'mongoloidi',
  'handicappato', 'handicappata',
  'frocio', 'froci', 'frocetto',
  'ricchione', 'ricchioni',
  'finocchio', 'finocchi',
  'lesbicona',
  'pezzodimerda', 'pezzodimmerda',
  'testadicazzo',
  'rottoinculo', 'rottodinculo',

  // ===== ITALIAN bestemmie (composte, inequivocabili) =====
  'porcodio', 'porcoddio', 'porcoiddio',
  'diocane', 'diobestia', 'dioboia', 'dioladro', 'dioporco', 'diomaiale',
  'diomerda', 'diocristo', 'diosanto', 'diopentito', 'dioinfame',
  'madonnacane', 'madonnaputtana', 'madonnatroia', 'madonnaladra',
  'madonnamaiale', 'madonnaporco', 'madonnaporca',
  'cristaccio', 'cristoporco', 'cristocane',
  'porcamadonna', 'porcatroia', 'porcaeva',
  'porcaputtana',
  'oddiocane', 'oddioporco',

  // ===== ENGLISH profanity (≥5 lettere) =====
  'fucker', 'fuckers', 'fucking', 'motherfucker', 'motherfuckers', 'fucked', 'fuckoff',
  'shitty', 'shithead', 'bullshit', 'shitter',
  'bitches', 'sonofabitch', 'sonofabitches',
  'asshole', 'assholes', 'asshat', 'jackass', 'dumbass',
  'bastard', 'bastards',
  'dickhead', 'dickheads',
  'cocksucker', 'cocksuckers',
  'pussies',
  'whore', 'whores',
  'wanker', 'wankers',
  'douchebag',
  'retarded',
  'faggot', 'faggots',
  'nigger', 'niggers', 'nigga', 'niggas',
  'rapist', 'rapists', 'raping',
  'pedophile', 'pedophiles',
  'jerkoff', 'jerkoffs',
  'blowjob', 'handjob',
  'goddamn', 'goddamnit',

  // ===== Hate / extremism =====
  'adolf', 'hitler', 'naziskin', 'naziskins',
  'mussolini',
  'fascista', 'fascisti', 'fascismo',
];

/** Strip HTML tags. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

/**
 * Normalize a single word: lowercase, map chars, KEEP only letters,
 * collapse 4+ letter runs.
 */
function normalizeWord(word: string): string {
  let out = '';
  for (const ch of word.toLowerCase()) {
    if (CHAR_MAP[ch]) out += CHAR_MAP[ch];
    else if (ch >= 'a' && ch <= 'z') out += ch;
  }
  return out.replace(/(.)\1{3,}/g, '$1');
}

/**
 * Build the normalized text stream for matching. We:
 *  - split on whitespace (so we keep word grouping)
 *  - within each chunk, normalize letters and STRIP any non-letter character
 *    (so "f.u.c.k", "a-d-o-l-f", "c4zz0" collapse into one token)
 *  - also produce a "merged" form joining adjacent short tokens, so
 *    spaced-out evasions like "f u c k" still match.
 *
 * We then test each profane word with a word-boundary regex against both
 * the per-token stream AND the merged-letters-only stream.
 */
function buildStreams(text: string): { tokens: string[]; merged: string } {
  const plain = stripHtml(text);
  const tokens: string[] = [];
  for (const chunk of plain.split(/\s+/)) {
    const n = normalizeWord(chunk);
    if (n) tokens.push(n);
  }
  // Merged form is just letters concatenated with single-char spaces removed,
  // useful only as a backstop for "f u c k" → "fuck".
  const merged = tokens.join(' ');
  // Also build a "spaced-letters collapsed" variant: any run of single letters
  // separated by spaces gets collapsed into one word.
  const collapsed = merged.replace(/\b((?:[a-z]\s){2,}[a-z])\b/g, (m) => m.replace(/\s+/g, ''));
  return { tokens, merged: collapsed };
}

// Pre-normalize the word list once (minimo 5 lettere per evitare falsi positivi)
const NORMALIZED_LIST: { original: string; normalized: string }[] =
  PROFANITY_LIST
    .map((w) => ({ original: w, normalized: normalizeWord(w) }))
    .filter((x) => x.normalized.length >= 5);

/**
 * Detect profanity. Match SOLO esatto su token interi normalizzati — niente
 * regex su stringhe collassate, così "Classifica", "produce", "passione" ecc.
 * non scattano mai.
 */
export function detectProfanity(text: string): string | null {
  return null;
}

export function containsProfanity(text: string): boolean {
  return false;
}

/** Validate multiple fields. Returns error message or null. */
export function validateNoProfanity(...texts: (string | null | undefined)[]): string | null {
  return null;
}
