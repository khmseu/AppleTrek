import { describe, expect, it } from "vitest";
import {
  APPLE_II_MEMORY,
  APPLE_II_MACHINE,
  APPLE_II_ROM_CALLS,
  basicAnd,
  basicNot,
  basicOr,
  boolToBasic,
  callNoop,
  modCompat,
  peekNoop,
  pokeNoop,
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
  it("maps booleans to Apple Integer BASIC-style values", () => {
    expect(boolToBasic(true)).toBe(1);
    expect(boolToBasic(false)).toBe(0);
    expect(boolToBasic(1)).toBe(1);
    expect(boolToBasic(0)).toBe(0);
  });

  it("handles NOT, AND, OR as signed 16-bit bitwise operators", () => {
    expect(basicNot(0)).toBe(-1);
    expect(basicNot(4)).toBe(-5);
    expect(basicAnd(6, 3)).toBe(2);
    expect(basicAnd(-1, 3)).toBe(3);
    expect(basicAnd(-1, 0)).toBe(0);
    expect(basicOr(0, 0)).toBe(0);
    expect(basicOr(0, 3)).toBe(3);
    expect(basicOr(32768, 0)).toBe(-32768);
  });
});

describe("Apple II machine interface no-ops", () => {
  it("exposes original PEEK/POKE/CALL addresses as hex constants", () => {
    expect(APPLE_II_MEMORY.WNDTOP).toBe(0x22);
    expect(APPLE_II_MEMORY.KBD).toBe(0xc000);
    expect(APPLE_II_MEMORY.KBDSTRB).toBe(0xc010);
    expect(APPLE_II_MEMORY.TXTCLR).toBe(0xc050);
    expect(APPLE_II_MEMORY.MIXCLR).toBe(0xc052);
    expect(APPLE_II_MEMORY.TXTSET).toBe(0xc051);
    expect(APPLE_II_MEMORY.HIRES_PAGE).toBe(0x4000);
    expect(APPLE_II_MEMORY.SPRITE_VECTOR).toBe(0x3fa1);
    expect(APPLE_II_MEMORY.SPRITE_COLOR).toBe(0x3fa2);
    expect(APPLE_II_MEMORY.TONE_LATCH).toBe(0x3fa7);
    expect(APPLE_II_MEMORY.SPRITE_SPEED).toBe(0x3fb0);
    expect(APPLE_II_MEMORY.COURSE_TABLE_BASE).toBe(0x3fbf);

    expect(APPLE_II_ROM_CALLS.SET_INVERSE_TEXT).toBe(0xfe80);
    expect(APPLE_II_ROM_CALLS.SET_NORMAL_TEXT).toBe(0xfe84);
    expect(APPLE_II_ROM_CALLS.CLEAR_TO_EOL).toBe(0xfc9c);
    expect(APPLE_II_ROM_CALLS.HOME).toBe(0xfc58);
  });

  it("keeps dropped PEEK/POKE/CALL hooks as deterministic no-ops", () => {
    expect(peekNoop(-0x4000)).toBe(0);
    expect(() => pokeNoop(APPLE_II_MEMORY.WNDTOP, 0x0b)).not.toThrow();
    expect(() => callNoop(-0x03a8)).not.toThrow();
  });

  it("exposes mutable machine hooks for translated invocation sites", () => {
    const originalPeek = APPLE_II_MACHINE.peek;
    let seenAddress = 0;
    APPLE_II_MACHINE.peek = (address: number) => {
      seenAddress = address;
      return originalPeek(address);
    };

    expect(peekNoop(APPLE_II_MEMORY.KBD)).toBe(0);
    expect(seenAddress).toBe(APPLE_II_MEMORY.KBD);

    APPLE_II_MACHINE.peek = originalPeek;
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
