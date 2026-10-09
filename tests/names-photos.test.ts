import { describe, expect, it } from "vitest";
import { applyFrame, applyStyle, toPlain } from "@/lib/fancy-name";
import { cleanName, graphemes, isPhotoDataUrl, parseJoinInput, truncateGraphemes } from "@/lib/room-meta";

describe("cleanName", () => {
  it("keeps fancy letters, symbols, emoji and Thai", () => {
    for (const name of ["𝓢𝓪𝓷𝓸𝓸𝓴", "꧁ต้น꧂", "★彡ᴍɪɴᴛ彡★", "👨‍👩‍👧 บ้านเรา", "กิ่ง♡", "Ｗｉｄｅ"]) {
      expect(cleanName(name)).toBe(name);
    }
  });

  it("drops invisible and direction-flipping characters", () => {
    expect(cleanName("a​b‮c")).toBe("abc");
    expect(cleanName("ㅤㅤ")).toBe("");
    expect(cleanName("⠀​ ")).toBe("");
  });

  it("tames Zalgo stacks but leaves Thai vowel + tone marks alone", () => {
    const zalgo = "a" + "́".repeat(20);
    expect([...cleanName(zalgo)].length).toBe(4);
    expect(cleanName("กิ่น้ำ")).toBe("กิ่น้ำ");
  });
});

describe("graphemes", () => {
  it("counts what people see", () => {
    expect(graphemes("กิ่ง")).toHaveLength(2);
    expect(graphemes("👨‍👩‍👧")).toHaveLength(1);
    expect(graphemes("𝓢𝓪𝓷")).toHaveLength(3);
    expect(truncateGraphemes("𝓢𝓪𝓷𝓸𝓸𝓴", 3)).toBe("𝓢𝓪𝓷");
  });
});

describe("parseJoinInput with special names", () => {
  it("accepts 20 fancy letters even though each is two code units", () => {
    const name = "𝓐".repeat(20);
    expect(parseJoinInput({ roomId: "abcd1234", name }).ok).toBe(true);
    expect(parseJoinInput({ roomId: "abcd1234", name: name + "𝓐" }).ok).toBe(false);
  });

  it("rejects names that are only invisible characters", () => {
    expect(parseJoinInput({ roomId: "abcd1234", name: "ㅤ​" }).ok).toBe(false);
  });
});

describe("fancy names", () => {
  it("restyles Latin letters and digits, leaves Thai alone", () => {
    expect(applyStyle("Ton 7 ต้น", "bold")).toBe("𝐓𝐨𝐧 𝟕 ต้น");
    expect(applyStyle("Chop", "double")).toBe("ℂ𝕙𝕠𝕡");
  });

  it("switches styles instead of stacking them", () => {
    const bold = applyStyle("Mint", "bold");
    expect(applyStyle(bold, "script")).toBe(applyStyle("Mint", "script"));
    expect(toPlain(applyStyle("Mint", "wide"))).toBe("Mint");
    expect(applyStyle(applyStyle("Mint", "circle"), "plain")).toBe("Mint");
  });

  it("swaps frames rather than nesting them", () => {
    const framed = applyFrame("ต้น", ["꧁", "꧂"]);
    expect(framed).toBe("꧁ต้น꧂");
    expect(applyFrame(framed, ["★彡", "彡★"])).toBe("★彡ต้น彡★");
    expect(applyFrame(framed, null)).toBe("ต้น");
  });
});

describe("isPhotoDataUrl", () => {
  it("accepts small raster data URLs only", () => {
    expect(isPhotoDataUrl("data:image/webp;base64,UklGRiIAAABXRUJQ")).toBe(true);
    expect(isPhotoDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
    expect(isPhotoDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isPhotoDataUrl("https://example.com/me.jpg")).toBe(false);
    expect(isPhotoDataUrl("data:image/png;base64," + "A".repeat(20_000))).toBe(false);
    expect(isPhotoDataUrl(undefined)).toBe(false);
  });
});
