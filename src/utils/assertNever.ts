export function assertNever(value: never, context: string): never {
  const detail =
    value && typeof value === "object" && "kind" in (value as object)
      ? (value as { kind?: unknown }).kind
      : value;

  throw new RangeError(`Unhandled ${context}: ${String(detail)}`);
}
