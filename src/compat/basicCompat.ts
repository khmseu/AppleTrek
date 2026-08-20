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
