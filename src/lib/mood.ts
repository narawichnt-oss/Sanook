// Spots a feeling in a chat message so the sender's avatar can act it out
// without anyone picking an emoji. Pure, so it runs the same on every client.

export const MOODS = {
  laugh: "😂",
  angry: "😡",
  love: "❤️",
  wow: "😮",
  sad: "😢",
} as const;

export type Mood = keyof typeof MOODS;

// Checked in order; the first match wins. Thai has no word breaks, so these
// match anywhere in the message.
const RULES: [Mood, RegExp][] = [
  ["angry", /โกรธ|โมโห|หงุดหงิด|ไม่พอใจ|angry|mad\b|😡|😠|🤬/i],
  ["sad", /เศร้า|ร้องไห้|เสียใจ|ฮือ|\bsad\b|😢|😭|🥲/i],
  // "รัก" but not "รักษา" (to treat); "ว้าว" only — "โห" hides inside words like "โหลด".
  ["love", /รัก(?!ษา)|ชอบมาก|\blove\b|❤️|😍|🥰|💕/i],
  ["wow", /ว้าว|ว๊าว|อึ้ง|\bwow\b|\bomg\b|😮|😱|🤯/i],
  ["laugh", /555|ฮ่า|ขำ|ตลก|\bha(ha)+\b|\blol\b|lmao|😂|🤣|😆/i],
];

export function detectMood(text: string): Mood | null {
  for (const [mood, pattern] of RULES) if (pattern.test(text)) return mood;
  return null;
}
