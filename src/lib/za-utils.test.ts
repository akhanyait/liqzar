import { describe, it, expect } from "vitest";
import {
  formatZAR,
  toZAPhone,
  safeRandomUUID,
  validateSaId,
  luhnValid,
  maskSaId,
} from "./za-utils";

// Fixed reference date so age assertions stay deterministic regardless of when
// CI runs the suite.
const ASOF = new Date("2026-05-27T00:00:00Z");

describe("formatZAR", () => {
  it("renders whole rands with no decimals by default", () => {
    expect(formatZAR(1500)).toMatch(/^R\s?1[\s ]500$/);
  });
  it("includes cents when asked", () => {
    expect(formatZAR(1500.5, true)).toMatch(/^R\s?1[\s ]500[.,]50$/);
  });
  it("formats zero", () => {
    expect(formatZAR(0)).toMatch(/^R\s?0$/);
  });
  it("never leaves the 'ZAR' prefix in the output", () => {
    expect(formatZAR(999)).not.toContain("ZAR");
  });
});

describe("toZAPhone", () => {
  it("converts a local 0XX number to E.164", () => {
    expect(toZAPhone("0790771591")).toBe("+27790771591");
  });
  it("passes through a 27-prefixed number with a plus added", () => {
    expect(toZAPhone("27790771591")).toBe("+27790771591");
  });
  it("tolerates spaces and dashes", () => {
    expect(toZAPhone("079 077 1591")).toBe("+27790771591");
    expect(toZAPhone("079-077-1591")).toBe("+27790771591");
  });
  it("handles the bare 9-digit local-without-leading-zero form", () => {
    expect(toZAPhone("790771591")).toBe("+27790771591");
  });
  it("returns the input untouched when nothing is parseable", () => {
    expect(toZAPhone("")).toBe("");
  });
});

describe("safeRandomUUID", () => {
  it("returns an RFC4122 v4-shaped string", () => {
    const id = safeRandomUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
  it("produces distinct ids on consecutive calls", () => {
    const a = safeRandomUUID();
    const b = safeRandomUUID();
    expect(a).not.toBe(b);
  });
});

describe("luhnValid", () => {
  it("accepts a number whose check digit balances the sum", () => {
    expect(luhnValid("8001015009087")).toBe(true);
  });
  it("rejects a number with a wrong check digit", () => {
    expect(luhnValid("8001015009088")).toBe(false);
  });
});

describe("validateSaId", () => {
  it("parses a valid male citizen ID", () => {
    const r = validateSaId("8001015009087", ASOF);
    expect(r).toMatchObject({
      valid: true,
      dateOfBirth: "1980-01-01",
      age: 46,
      gender: "male",
      citizenship: "citizen",
    });
  });

  it("parses a valid female citizen ID and tolerates separators", () => {
    const r = validateSaId("920220 0000 0 8 4", ASOF);
    expect(r).toMatchObject({
      valid: true,
      dateOfBirth: "1992-02-20",
      gender: "female",
      citizenship: "citizen",
      age: 34,
    });
  });

  it("reads the permanent-resident citizenship digit", () => {
    const r = validateSaId("9202200000183", ASOF);
    expect(r).toMatchObject({ valid: true, citizenship: "permanent_resident" });
  });

  it("pivots a future-looking 2-digit year into the 1900s", () => {
    // yy=92 in 2026 would be 2092 (future) → must resolve to 1992.
    const r = validateSaId("9202200000084", ASOF);
    expect(r.valid && r.dateOfBirth.startsWith("1992")).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(validateSaId("123", ASOF)).toEqual({
      valid: false,
      error: expect.any(String),
    });
  });

  it("rejects an impossible month", () => {
    const r = validateSaId("9213200000084", ASOF);
    expect(r.valid).toBe(false);
  });

  it("rejects an impossible day", () => {
    const r = validateSaId("9202310000084", ASOF);
    expect(r.valid).toBe(false);
  });

  it("rejects an invalid citizenship digit", () => {
    // citizenship digit (index 10) = 2 is not allowed
    const r = validateSaId("9202200000284", ASOF);
    expect(r.valid).toBe(false);
  });

  it("rejects a checksum failure", () => {
    const r = validateSaId("8001015009088", ASOF);
    expect(r).toMatchObject({ valid: false });
  });
});

describe("maskSaId", () => {
  it("keeps only the DOB prefix", () => {
    expect(maskSaId("8001015009087")).toBe("800101*******");
  });
  it("masks fully when malformed", () => {
    expect(maskSaId("123")).toBe("•••••••••••••");
  });
});
