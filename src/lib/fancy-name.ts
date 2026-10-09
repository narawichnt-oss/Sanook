// Decorated nicknames: Unicode "font" lookalikes for Latin letters and digits,
// plus frames and symbols. Thai and everything else pass through unchanged.

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";

type CharMap = Map<string, string>;

/** Maps A–Z / a–z / 0–9 onto consecutive code points, with per-letter exceptions. */
function offsets(upper: number | null, lower: number | null, digit: number | null, holes: Record<string, number> = {}): CharMap {
  const map: CharMap = new Map();
  const add = (chars: string, start: number | null) => {
    if (start === null) return;
    [...chars].forEach((c, i) => map.set(c, String.fromCodePoint(holes[c] ?? start + i)));
  };
  add(UPPER, upper);
  add(LOWER, lower);
  add(DIGITS, digit);
  return map;
}

function table(from: string, to: string): CharMap {
  const target = [...to];
  return new Map([...from].map((c, i) => [c, target[i]]));
}

const SMALL_CAPS = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ";

export const NAME_STYLES = [
  { id: "plain", label: "Aa", map: new Map() as CharMap },
  { id: "script", label: "𝓢𝓬𝓻𝓲𝓹𝓽", map: offsets(0x1d4d0, 0x1d4ea, null) },
  { id: "bold", label: "𝐁𝐨𝐥𝐝", map: offsets(0x1d400, 0x1d41a, 0x1d7ce) },
  {
    id: "double",
    label: "𝔻𝕠𝕦𝕓𝕝𝕖",
    map: offsets(0x1d538, 0x1d552, 0x1d7d8, { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 }),
  },
  { id: "gothic", label: "𝕲𝖔𝖙𝖍𝖎𝖈", map: offsets(0x1d56c, 0x1d586, null) },
  { id: "mono", label: "𝙼𝚘𝚗𝚘", map: offsets(0x1d670, 0x1d68a, 0x1d7f6) },
  { id: "small", label: "ꜱᴍᴀʟʟ", map: new Map([...table(UPPER, SMALL_CAPS), ...table(LOWER, SMALL_CAPS)]) },
  { id: "circle", label: "Ⓒⓘⓡⓒⓛⓔ", map: offsets(0x24b6, 0x24d0, 0x2460, { "0": 0x24ea }) },
  { id: "wide", label: "Ｗｉｄｅ", map: offsets(0xff21, 0xff41, 0xff10) },
] as const;

export type NameStyleId = (typeof NAME_STYLES)[number]["id"];

// Small caps maps both cases to one glyph; reading back gives lowercase.
const TO_PLAIN: CharMap = new Map();
for (const style of NAME_STYLES) {
  for (const [plain, fancy] of style.map) if (!TO_PLAIN.has(fancy)) TO_PLAIN.set(fancy, plain);
}
for (const [plain, fancy] of table(LOWER, SMALL_CAPS)) if (fancy !== plain) TO_PLAIN.set(fancy, plain);

export function toPlain(text: string): string {
  return [...text].map((c) => TO_PLAIN.get(c) ?? c).join("");
}

export function applyStyle(text: string, id: NameStyleId): string {
  const style = NAME_STYLES.find((s) => s.id === id) ?? NAME_STYLES[0];
  return [...toPlain(text)].map((c) => style.map.get(c) ?? c).join("");
}

export const NAME_FRAMES = [
  ["꧁", "꧂"],
  ["★彡", "彡★"],
  ["𓆩", "𓆪"],
  ["♡", "♡"],
  ["『", "』"],
  ["✿", "✿"],
  ["⚡", "⚡"],
] as const;

export const NAME_SYMBOLS = ["★", "♡", "✿", "☾", "✧", "ツ", "♪", "ღ", "彡", "♛", "🔥", "👑"] as const;

/** Removes any frame from the list, so picking another one swaps instead of nesting. */
export function stripFrame(text: string): string {
  for (const [left, right] of NAME_FRAMES) {
    if (text.startsWith(left) && text.endsWith(right) && text.length > left.length + right.length) {
      return text.slice(left.length, text.length - right.length).trim();
    }
  }
  return text;
}

export function applyFrame(text: string, frame: readonly [string, string] | null): string {
  const inner = stripFrame(text);
  return frame ? `${frame[0]}${inner}${frame[1]}` : inner;
}
