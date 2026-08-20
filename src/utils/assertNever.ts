/**
 * Runtime backstop for TypeScript exhaustiveness checks in discriminated switches.
 *
 * Call this from a `default` branch with a value narrowed to `never`; if a new
 * union member reaches runtime before all switch sites are updated, the thrown
 * error includes the supplied context and, when present, the value's `kind`.
 */
export function assertNever(value: never, context: string): never {
  const detail =
    value && typeof value === "object" && "kind" in (value as object)
      ? (value as { kind?: unknown }).kind
      : value;

  throw new RangeError(`Unhandled ${context}: ${String(detail)}`);
}
