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
export function basicAnd(a: unknown, b: unknown): number {
  return toIntegerBasicWord(
    toIntegerBasicWord(a, "left operand") & toIntegerBasicWord(b, "right operand"),
    "result"
  );
}

/** Implements Apple Integer BASIC `OR` as signed 16-bit bitwise disjunction. */
export function basicOr(a: unknown, b: unknown): number {
  return toIntegerBasicWord(
    toIntegerBasicWord(a, "left operand") | toIntegerBasicWord(b, "right operand"),
    "result"
  );
}

/** Apple II zero-page and soft-switch addresses touched by the original BASIC source. */
export const APPLE_II_MEMORY = Object.freeze({
  WNDLFT: 0x20,
  WNDWDTH: 0x21,
  WNDTOP: 0x22,
  WNDBTM: 0x23,
  TEXT_COLOR: 0x32,
  KBD: 0xc000,
  KBDSTRB: 0xc010,
  TXTCLR: 0xc050,
  MIXCLR: 0xc052,
  TXTSET: 0xc051,
  HIRES_PAGE: 0x4000,
  SPRITE_VECTOR: 0x3fa1,
  SPRITE_COLOR: 0x3fa2,
  TONE_LATCH: 0x3fa7,
  SPRITE_SPEED: 0x3fb0,
  COURSE_TABLE_BASE: 0x3fbf
} as const);

/** Apple II ROM routines called by the original BASIC source. */
export const APPLE_II_ROM_CALLS = Object.freeze({
  SET_INVERSE_TEXT: 0xfe80,
  SET_NORMAL_TEXT: 0xfe84,
  CLEAR_TO_EOL: 0xfc9c,
  HOME: 0xfc58
} as const);

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
  call: callNoopImpl
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
 * Deterministic linear-congruential random number generator for reproducible games.
 *
 * All gameplay randomness should flow through this class rather than
 * `Math.random()` so tests and scripted replays can reproduce exact outcomes.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns the next pseudo-random value in the half-open range [0, 1). */
  nextFloat(): number {
    // LCG constants chosen for simple, repeatable gameplay-style randomness.
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 0x100000000;
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
    return minInclusive + Math.floor(this.nextFloat() * span);
  }
}
