import { describe, expect, it } from "vitest";
import { detectMood } from "@/lib/mood";
import { pickQuickRoom, type RoomSummary } from "@/lib/room-meta";

describe("detectMood", () => {
  it("reads Thai and English laughter", () => {
    expect(detectMood("55555 ตลกมาก")).toBe("laugh");
    expect(detectMood("ฮ่าๆๆ")).toBe("laugh");
    expect(detectMood("hahaha")).toBe("laugh");
    expect(detectMood("lol")).toBe("laugh");
  });

  it("reads the other moods", () => {
    expect(detectMood("โกรธแล้วนะ")).toBe("angry");
    expect(detectMood("เศร้าจัง")).toBe("sad");
    expect(detectMood("รักเลย")).toBe("love");
    expect(detectMood("ว้าวว")).toBe("wow");
    expect(detectMood("😍")).toBe("love");
  });

  it("anger beats laughter when both appear", () => {
    expect(detectMood("555 โกรธ")).toBe("angry");
  });

  it("ignores look-alike words and plain chat", () => {
    expect(detectMood("กำลังโหลดอยู่")).toBeNull();
    expect(detectMood("ไปรักษาตัวก่อน")).toBeNull();
    expect(detectMood("สวัสดีทุกคน")).toBeNull();
    expect(detectMood("hash")).toBeNull();
  });
});

describe("pickQuickRoom", () => {
  const room = (id: string, listeners: number, createdAt = 0): RoomSummary => ({
    id,
    listeners,
    createdAt,
    title: id,
    topic: "",
    emoji: "☕",
    color: "coral",
  });

  it("picks the busiest room with a free seat", () => {
    expect(pickQuickRoom([room("a", 2), room("b", 12), room("c", 5)])?.id).toBe("c");
  });

  it("skips empty and full rooms", () => {
    expect(pickQuickRoom([room("a", 0), room("b", 12)])).toBeNull();
    expect(pickQuickRoom([])).toBeNull();
  });
});
