/**
 * Divides two numbers using Applesoft-style integer truncation toward zero.
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
 * Computes modulo using the same truncating division basis as Applesoft BASIC.
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

/** Converts a JavaScript truthy/falsy value into BASIC boolean representation. */
export function boolToBasic(value: unknown): number {
  return value ? -1 : 0;
}

/** Implements BASIC `NOT`, returning -1 for true and 0 for false. */
export function basicNot(value: unknown): number {
  return boolToBasic(!value);
}

/** Implements BASIC truthiness for `AND`, returning -1 for true and 0 for false. */
export function basicAnd(a: unknown, b: unknown): number {
  return boolToBasic(Boolean(a) && Boolean(b));
}

/** Implements BASIC truthiness for `OR`, returning -1 for true and 0 for false. */
export function basicOr(a: unknown, b: unknown): number {
  return boolToBasic(Boolean(a) || Boolean(b));
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
