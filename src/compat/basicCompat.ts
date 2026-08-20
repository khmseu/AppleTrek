/**
 * Divides two numbers using Apple Integer BASIC-style truncation toward zero.
 *
 * JavaScript's `Math.floor` would move negative quotients away from zero, which
 * does not match the BASIC arithmetic used by the original game.
 *
 * @throws {RangeError} When `b` is zero.
 */
export function truncDiv(a: number, b: number): number {
  if (b === 0) {
    throw new RangeError("Division by zero");
  }

  return Math.trunc(a / b);
}

/**
 * Computes modulo using the same truncating division basis as Apple Integer BASIC.
 *
 * The sign follows the dividend because this is defined as
 * `a - truncDiv(a, b) * b`; use a positive-wrap helper for cyclic grid
 * coordinates that must stay in the range 1..N.
 *
 * @throws {RangeError} When `b` is zero.
 */
export function modCompat(a: number, b: number): number {
  if (b === 0) {
    throw new RangeError("Modulo by zero");
  }

  return a - truncDiv(a, b) * b;
}

const INTEGER_BASIC_WORD_MASK = 0xffff;
const INTEGER_BASIC_SIGN_BIT = 0x8000;
const INTEGER_BASIC_WORD_SIZE = 0x10000;

function toIntegerBasicWord(value: unknown, label: string): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new RangeError(`Invalid ${label}: ${String(value)}`);
  }

  const word = Math.trunc(numericValue) & INTEGER_BASIC_WORD_MASK;
  return word >= INTEGER_BASIC_SIGN_BIT ? word - INTEGER_BASIC_WORD_SIZE : word;
}

/** Converts a JavaScript truthy/falsy value into Apple Integer BASIC boolean representation. */
// Source: apple_trek.bas relational expressions at lines 310, 1047, 1180, and 1850.
export function boolToBasic(value: unknown): number {
  return value ? 1 : 0;
}

/**
 * Implements Apple Integer BASIC `NOT` as a signed 16-bit bitwise complement.
 *
 * Values are truncated to signed 16-bit words before and after the operation;
 * for example, `NOT 0` is `-1` and `NOT 4` is `-5`.
 */
export function basicNot(value: unknown): number {
  return toIntegerBasicWord(~toIntegerBasicWord(value, "value"), "value");
}

/** Implements Apple Integer BASIC `AND` as signed 16-bit bitwise conjunction. */
// Source: apple_trek.bas line 110 and compound conditions at lines 160-170 and 1180.
export function basicAnd(a: unknown, b: unknown): number {
  return toIntegerBasicWord(
    toIntegerBasicWord(a, "left operand") &
      toIntegerBasicWord(b, "right operand"),
    "result",
  );
}

/** Implements Apple Integer BASIC `OR` as signed 16-bit bitwise disjunction. */
// Source: apple_trek.bas compound conditions at lines 160-170, 1180, and 1845.
export function basicOr(a: unknown, b: unknown): number {
  return toIntegerBasicWord(
    toIntegerBasicWord(a, "left operand") |
      toIntegerBasicWord(b, "right operand"),
    "result",
  );
}

/** Apple II zero-page and soft-switch addresses touched by the original BASIC source. */
// Source: apple_trek.bas lines 600-7040, especially 600-690 and 2500-2510.
export const APPLE_II_MEMORY = Object.freeze({
  WNDLFT:              0x20, // 32
  WNDWDTH:             0x21, // 33
  WNDTOP:              0x22, // 34
  WNDBTM:              0x23, // 35
  CH:                  0x2c, // 44??
  CV:                  0x2d, // 45??
  INVERSE:             0x2e, // 46
  TEXT_COLOR:          0x32, // 50

  SPRITE_VECTOR:     0x3fa1, // 16161 R5 - 223
  SPRITE_COLOR:      0x3fa2, // 16162 R5 - 222
  TONE_LATCH:        0x3fa7, // 16167 R5 - 217
  SPRITE_SPEED:      0x3fb0, // 16176 R5 - 208
  COURSE_TABLE_BASE: 0x3fbf, // 16191 R5 - 193

  C95:               0x3fa1, // 16289 R5 - 95

  X94:               0x3fa2, // 16290 R5 - 94
  X89:               0x3fa7, // 16295 R5 - 89
  X80:               0x3fb0, // 16304 R5 - 80
  X65:               0x3fbf, // 16319 R5 - 65
  HIMEM:             0x4000, // 16384 R5

  KBD:               0xc000, // -16384
  KBDSTRB:           0xc010, // -16368
  TXTCLR:            0xc050, // -16336
  TXTSET:            0xc051, // -16335
  MIXCLR:            0xc052, // -16334
} as const);

/** Apple II ROM routines called by the original BASIC source. */
// Source: apple_trek.bas lines 600, 610, 620, 660, 690, 1000-1145, and 7030-7040.
export const APPLE_II_ROM_CALLS = Object.freeze({
  SET_INVERSE_TEXT: 0xfe80, // -128
  SET_NORMAL_TEXT: 0xfe84, // -124
  CLEAR_TO_EOL: 0xfc9c, // -900
  HOME: 0xfc58, // -936
} as const);

/**
 * Sets the position and size of the Apple II text window.
 *
 * @param left The left coordinate of the window.
 * @param width The width of the window.
 * @param top The top coordinate of the window.
 * @param bottom The height of the window.
 */
export function setWindow(
  left: number,
  width: number,
  top: number,
  bottom: number,
): void {
  APPLE_II_MACHINE.poke(APPLE_II_MEMORY.WNDLFT, left);
  APPLE_II_MACHINE.poke(APPLE_II_MEMORY.WNDWDTH, width);
  APPLE_II_MACHINE.poke(APPLE_II_MEMORY.WNDTOP, top);
  APPLE_II_MACHINE.poke(APPLE_II_MEMORY.WNDBTM, bottom);
} 

export function tabHV(horizontal: number, vertical: number): void {
  APPLE_II_MACHINE.poke(APPLE_II_MEMORY.CH, horizontal);
  APPLE_II_MACHINE.poke(APPLE_II_MEMORY.CV, vertical);
}

/**
 * Converts a potentially negative 16-bit Integer BASIC address to its unsigned equivalent.
 *
 * @param address The address to convert to an unsigned 16-bit value.
 * @returns The unsigned 16-bit representation of the address.
 */
function toUnsigned16BitAddress(address: number): number {
  return address & INTEGER_BASIC_WORD_MASK;
}

/**
 * Placeholder for Apple II `PEEK` reads dropped from the browser port.
 *
 * The current game logic does not emulate Apple II memory-mapped I/O, so this
 * function returns `0` for every address while keeping original address values
 * visible at call sites and tests. Negative Integer BASIC addresses are treated
 * as signed 16-bit addresses; e.g. `-16384` maps to `$C000`.
 */
function peekNoopImpl(address: number): number {
  toUnsigned16BitAddress(address);
  return 0;
}

/**
 * Placeholder for Apple II `POKE` writes dropped from the browser port.
 *
 * Parameters are accepted for documentation/parity only. The function performs
 * no mutation because the browser renderer owns display state instead of Apple
 * II text windows, soft switches, or sound/sprite memory.
 */
function pokeNoopImpl(address: number, value: number): void {
  toUnsigned16BitAddress(address);
  Math.trunc(value);
}

/**
 * Placeholder for Apple II `CALL` routines dropped from the browser port.
 *
 * The original program used ROM calls such as `$FC58` HOME and `$FC9C` clear to
 * end-of-line, plus high-memory animation/sound hooks. They intentionally do
 * nothing in the web port but remain named through `APPLE_II_ROM_CALLS`.
 */
function callNoopImpl(address: number): void {
  toUnsigned16BitAddress(address);
}

/** Mutable no-op machine interface used by translated call sites and tests. */
export const APPLE_II_MACHINE = {
  peek: peekNoopImpl,
  poke: pokeNoopImpl,
  call: callNoopImpl,
};

export function peekNoop(address: number): number {
  return APPLE_II_MACHINE.peek(address);
}

export function pokeNoop(address: number, value: number): void {
  APPLE_II_MACHINE.poke(address, value);
}

export function callNoop(address: number): void {
  APPLE_II_MACHINE.call(address);
}

/**
 * Deterministic Apple Integer BASIC random number generator.
 *
 * The 6502 RND routine at `original-sources/apple.intbasic.rnd.6502:$EF4E` updates a 16-bit
 * state with 17 byte-level rotate/shift rounds, then reduces that state by
 * the requested range. All gameplay randomness flows through this class so
 * tests and scripted replays remain reproducible.
 */
export class SeededRng {
  private state: number;

  /**
   * Creates a new seeded random number generator.
   *
   * @param seed The initial seed value.
   */
  constructor(seed: number) {
    this.state = Math.trunc(seed) & INTEGER_BASIC_WORD_MASK;
  }

  /**
   * Generates the next 16-bit pseudo-random value.
   *
   * @returns The next pseudo-random 16-bit integer.
   */
  private nextWord(): number {
    let low = this.state & 0xff;
    let high = (this.state >>> 8) & 0xff;

    // The ROM routine turns an all-zero state into 1 before masking to 7 bits.
    if (high === 0) {
      high = low === 0 ? 1 : 0;
    }
    high &= 0x7f;

    for (let round = 0; round < 0x11; round += 1) {
      const shiftedHigh = ((high << 1) + 0x40) & 0xff;
      const carryIntoLow = shiftedHigh >>> 7;
      const nextLow = ((low << 1) & 0xff) | carryIntoLow;
      const carryIntoHigh = low >>> 7;
      const nextHigh = ((high << 1) & 0xff) | carryIntoHigh;

      low = nextLow;
      high = nextHigh;
    }

    this.state = (high << 8) | low;
    return this.state;
  }

  /**
   * Returns an integer in the inclusive range `[minInclusive, maxInclusive]`.
   *
   * @throws {RangeError} When the inclusive range is empty.
   */
  nextInt(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) {
      throw new RangeError("Invalid inclusive range");
    }

    const span = maxInclusive - minInclusive + 1;
    return minInclusive + (this.nextWord() % span);
  }
}
