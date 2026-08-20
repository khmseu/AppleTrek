export function truncDiv(a: number, b: number): number {
  if (b === 0) {
    throw new RangeError("Division by zero");
  }

  return Math.trunc(a / b);
}

export function modCompat(a: number, b: number): number {
  if (b === 0) {
    throw new RangeError("Modulo by zero");
  }

  return a - truncDiv(a, b) * b;
}

export function boolToBasic(value: unknown): number {
  return value ? -1 : 0;
}

export function basicNot(value: unknown): number {
  return boolToBasic(!value);
}

export function basicAnd(a: unknown, b: unknown): number {
  return boolToBasic(Boolean(a) && Boolean(b));
}

export function basicOr(a: unknown, b: unknown): number {
  return boolToBasic(Boolean(a) || Boolean(b));
}

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextFloat(): number {
    // LCG constants chosen for simple, repeatable gameplay-style randomness.
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) {
      throw new RangeError("Invalid inclusive range");
    }

    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.nextFloat() * span);
  }
}
