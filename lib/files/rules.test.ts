import { describe, expect, it } from "vitest";
import { asFileKind, cleanName, disposition, formatBytes, sniffType, storePath } from "./rules";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)).concat(Array(16).fill(0)));

describe("file rules", () => {
  it("reads the real type from the first bytes", () => {
    expect(sniffType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(bytes([0x89], "PNG"))).toBe("image/png");
    expect(sniffType(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe("image/webp");
    expect(sniffType(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffType(bytes([0, 0, 0, 24], "ftypheic"))).toBe("image/heic");
    // An HTML page or an SVG named .jpg is not kept.
    expect(sniffType(bytes("<html><script>"))).toBeNull();
    expect(sniffType(bytes("<svg xmlns="))).toBeNull();
  });

  it("keeps names safe to show and to send in a header", () => {
    expect(cleanName("C:\\Users\\me\\ხელშეკრულება.pdf", "application/pdf")).toBe("ხელშეკრულება.pdf");
    expect(cleanName('a"<b>.jpg', "image/jpeg")).toBe("ab.jpg");
    expect(cleanName("", "image/png")).toBe("file.png");
    expect(disposition("ქვითარი.pdf", true)).toContain("filename*=UTF-8''%E1%83");
    expect(disposition("ქვითარი.pdf", false).startsWith("attachment;")).toBe(true);
  });

  it("names the stored file by account and random id", () => {
    expect(storePath("op1", "abc", "image/jpeg")).toBe("op/op1/abc.jpg");
    expect(asFileKind("receipt", "photo")).toBe("receipt");
    expect(asFileKind("exe", "photo")).toBe("photo");
    expect(formatBytes(1536 * 1024, "en")).toBe("1.5 MB");
    expect(formatBytes(800, "ka")).toBe("1 კბ");
  });
});
