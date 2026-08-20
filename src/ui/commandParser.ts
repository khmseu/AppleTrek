import { assertNever } from "../utils/assertNever";

/** Prompt command variants accepted by the command dispatcher. */
export type ParsedCommand =
  | { kind: "ion"; course: number; value: number }
  | { kind: "warp"; course: number; value: number }
  | { kind: "shields"; value: number }
  | { kind: "phasers"; value: number }
  | { kind: "torpedo"; course: number }
  | { kind: "damage-report" }
  | { kind: "load-torpedoes"; value: number }
  | { kind: "computer" }
  | { kind: "probe" }
  | { kind: "self-destruct" };

/** Formats a parsed command into the canonical uppercase log/prompt form. */
export function formatParsedCommand(command: ParsedCommand): string {
  switch (command.kind) {
    case "ion":
      return `ION ${command.course} ${command.value}`;
    case "warp":
      return `WARP ${command.course} ${command.value}`;
    case "shields":
      return `SHIELDS ${command.value}`;
    case "phasers":
      return `PHASERS ${command.value}`;
    case "torpedo":
      return `TORPEDO ${command.course}`;
    case "damage-report":
      return "DAMAGE";
    case "load-torpedoes":
      return `LOAD ${command.value}`;
    case "computer":
      return "COMPUTER";
    case "probe":
      return "PROBE";
    case "self-destruct":
      return "DESTRUCT";
    default:
      return assertNever(command, "parsed command kind");
  }
}

function parseInteger(input: string, label: string): number {
  const value = Number(input);
  if (!Number.isInteger(value)) {
    throw new RangeError(`Invalid ${label}: ${input}`);
  }
  return value;
}

function expectArity(parts: string[], arity: number, command: string): void {
  if (parts.length !== arity) {
    throw new RangeError(`Expected ${arity - 1} arguments for ${command}`);
  }
}

/**
 * Parses a terminal prompt command into a typed command object.
 *
 * Supported command names include short aliases such as `I`, `W`, `PH`, `T`, and
 * `SD`. Numeric arguments must be integers; range validation is performed by
 * the state transition functions that execute the command.
 *
 * @throws {RangeError} For empty input, unknown commands, arity mismatch, or non-integer arguments.
 */
export function parsePrompt(input: string): ParsedCommand {
  const parts = input
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    throw new RangeError("Empty command");
  }

  const command = parts[0].toUpperCase();

  if (command === "ION" || command === "I") {
    expectArity(parts, 3, "ION");
    return {
      kind: "ion",
      course: parseInteger(parts[1], "course"),
      value: parseInteger(parts[2], "value")
    };
  }

  if (command === "WARP" || command === "W") {
    expectArity(parts, 3, "WARP");
    return {
      kind: "warp",
      course: parseInteger(parts[1], "course"),
      value: parseInteger(parts[2], "value")
    };
  }

  if (command === "SHIELDS" || command === "SH") {
    expectArity(parts, 2, "SHIELDS");
    return {
      kind: "shields",
      value: parseInteger(parts[1], "value")
    };
  }

  if (command === "PHASERS" || command === "PH") {
    expectArity(parts, 2, "PHASERS");
    return {
      kind: "phasers",
      value: parseInteger(parts[1], "value")
    };
  }

  if (command === "TORPEDO" || command === "TORP" || command === "T") {
    expectArity(parts, 2, "TORPEDO");
    return {
      kind: "torpedo",
      course: parseInteger(parts[1], "course")
    };
  }

  if (command === "DAMAGE" || command === "DAM" || command === "REPORT" || command === "DR") {
    expectArity(parts, 1, "DAMAGE");
    return {
      kind: "damage-report"
    };
  }

  if (command === "LOAD" || command === "LOADTORP" || command === "LT") {
    expectArity(parts, 2, "LOAD");
    return {
      kind: "load-torpedoes",
      value: parseInteger(parts[1], "value")
    };
  }

  if (command === "COMPUTER" || command === "COMP" || command === "C") {
    expectArity(parts, 1, "COMPUTER");
    return {
      kind: "computer"
    };
  }

  if (command === "PROBE" || command === "PR") {
    expectArity(parts, 1, "PROBE");
    return {
      kind: "probe"
    };
  }

  if (command === "DESTRUCT" || command === "SELFDESTRUCT" || command === "SD") {
    expectArity(parts, 1, "DESTRUCT");
    return {
      kind: "self-destruct"
    };
  }

  throw new RangeError(`Unknown command: ${parts[0]}`);
}
