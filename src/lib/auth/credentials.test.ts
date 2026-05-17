import { describe, expect, it } from "vitest";
import { normalizeCredential } from "./credentials";

describe("normalizeCredential", () => {
  it("accepts EasyPanel values pasted with quotes", () => {
    expect(normalizeCredential('"admin"')).toBe("admin");
    expect(normalizeCredential("'secret'")).toBe("secret");
  });

  it("removes accidental surrounding whitespace without touching the middle", () => {
    expect(normalizeCredential("  my strong password  ")).toBe("my strong password");
  });
});
