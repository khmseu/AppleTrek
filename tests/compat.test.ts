import { describe, expect, it } from "vitest";
import {
  basicAnd,
  basicNot,
  basicOr,
  boolToBasic,
  modCompat,
  SeededRng,
  truncDiv
} from "../src/compat/basicCompat";

describe("truncDiv", () => {
  it("truncates division toward zero", () => {
    expect(truncDiv(7, 3)).toBe(2);
    expect(truncDiv(-7, 3)).toBe(-2);
    expect(truncDiv(7, -3)).toBe(-2);
    expect(truncDiv(-7, -3)).toBe(2);
  });
});

describe("modCompat", () => {
  it("returns expected remainder for positive values", () => {
    expect(modCompat(8, 3)).toBe(2);
    expect(modCompat(9, 3)).toBe(0);
  });

  it("uses truncation-based remainder for negative dividends", () => {
    expect(modCompat(-8, 3)).toBe(-2);
    expect(modCompat(-8, -3)).toBe(-2);
    expect(modCompat(8, -3)).toBe(2);
  });
});

describe("boolean helpers", () => {
  it("maps booleans to BASIC-style values", () => {
    expect(boolToBasic(true)).toBe(-1);
    expect(boolToBasic(false)).toBe(0);
    expect(boolToBasic(1)).toBe(-1);
    expect(boolToBasic(0)).toBe(0);
  });

  it("handles NOT, AND, OR with BASIC-style semantics", () => {
    expect(basicNot(0)).toBe(-1);
    expect(basicNot(4)).toBe(0);
    expect(basicAnd(-1, -1)).toBe(-1);
    expect(basicAnd(-1, 0)).toBe(0);
    expect(basicOr(0, 0)).toBe(0);
    expect(basicOr(0, 3)).toBe(-1);
  });
});

describe("SeededRng", () => {
  it("reproduces the same int sequence for the same seed", () => {
    const rngA = new SeededRng(1701);
    const rngB = new SeededRng(1701);

    const seqA = Array.from({ length: 8 }, () => rngA.nextInt(1, 8));
    const seqB = Array.from({ length: 8 }, () => rngB.nextInt(1, 8));

    expect(seqA).toEqual(seqB);
  });

  it("keeps generated values in the inclusive range", () => {
    const rng = new SeededRng(42);

    for (let i = 0; i < 100; i += 1) {
      const value = rng.nextInt(2, 5);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(5);
    }
  });
});
