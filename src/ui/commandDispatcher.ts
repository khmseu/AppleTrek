import { SeededRng } from "../compat/basicCompat";
import { enemyTurn, firePhasers, fireTorpedo } from "../state/combat";
import { triggerSelfDestruct } from "../state/endgame";
import { createInitialGameState, type GameState } from "../state/gameState";
import { navigate, setShieldsPercent } from "../state/navigation";
import { assertNever } from "../utils/assertNever";
import { formatParsedCommand, parsePrompt, type ParsedCommand } from "./commandParser";

/** Mutable command-session wrapper used by prompt and clickable controls. */
export interface CommandSession {
  state: GameState;
  log: string[];
}

/** Stable list of supported clickable control actions. */
export const CONTROL_ACTIONS = Object.freeze([
  "ion",
  "warp",
  "shields",
  "phasers",
  "torpedo",
  "self-destruct"
] as const);

const CONTROL_ACTION_SET: ReadonlySet<string> = new Set(CONTROL_ACTIONS);

/** Union of action names accepted by clickable control dispatch. */
export type ControlAction = (typeof CONTROL_ACTIONS)[number];

/** Runtime guard for validating string values before treating them as control actions. */
export function isControlAction(value: string): value is ControlAction {
  return CONTROL_ACTION_SET.has(value);
}

/** Discriminated input accepted by clickable controls before conversion to prompt text. */
export type ControlCommandInput =
  | { action: "ion"; course: number; value: number }
  | { action: "warp"; course: number; value: number }
  | { action: "shields"; value: number }
  | { action: "phasers"; value: number }
  | { action: "torpedo"; course: number }
  | { action: "self-destruct" };

function requireIntegerField(value: number | undefined, label: string): number {
  if (value === undefined) {
    throw new RangeError(`Missing ${label}`);
  }

  if (!Number.isInteger(value)) {
    throw new RangeError(`Invalid ${label}: ${String(value)}`);
  }

  return value;
}

function appendLog(log: string[], line: string): string[] {
  return [...log, line];
}

function controlToParsed(input: ControlCommandInput): ParsedCommand {
  switch (input.action) {
    case "ion":
      return {
        kind: "ion",
        course: requireIntegerField(input.course, "course"),
        value: requireIntegerField(input.value, "value")
      };
    case "warp":
      return {
        kind: "warp",
        course: requireIntegerField(input.course, "course"),
        value: requireIntegerField(input.value, "value")
      };
    case "shields":
      return {
        kind: "shields",
        value: requireIntegerField(input.value, "value")
      };
    case "phasers":
      return {
        kind: "phasers",
        value: requireIntegerField(input.value, "value")
      };
    case "torpedo":
      return {
        kind: "torpedo",
        course: requireIntegerField(input.course, "course")
      };
    case "self-destruct":
      return {
        kind: "self-destruct"
      };
    default:
      return assertNever(input, "control action input");
  }
}

function executeParsed(state: GameState, command: ParsedCommand, rng: SeededRng): GameState {
  if (state.endgame.terminal) {
    throw new RangeError("Mission already ended");
  }

  if (command.kind === "ion") {
    return navigate(state, { mode: "ion", course: command.course, value: command.value });
  }

  if (command.kind === "warp") {
    return navigate(state, { mode: "warp", course: command.course, value: command.value });
  }

  if (command.kind === "shields") {
    return setShieldsPercent(state, command.value);
  }

  if (command.kind === "phasers") {
    const result = firePhasers(state, command.value, rng);
    return enemyTurn(result.state, rng);
  }

  if (command.kind === "self-destruct") {
    return triggerSelfDestruct(state);
  }

  const result = fireTorpedo(state, command.course);
  return enemyTurn(result.state, rng);
}

/** Creates a new command session with an optional starting state and welcome log. */
export function createCommandSession(initialState?: GameState): CommandSession {
  return {
    state: initialState ?? createInitialGameState(1701),
    log: ["WELCOME TO APPLE TREK"]
  };
}

/** Executes an already parsed command and appends its canonical form to the log. */
export function dispatchParsed(session: CommandSession, command: ParsedCommand, rng: SeededRng): CommandSession {
  const nextState = executeParsed(session.state, command, rng);
  const nextLog = appendLog(session.log, `> ${formatParsedCommand(command)}`);
  return {
    state: nextState,
    log: nextLog
  };
}

/** Parses and executes a prompt command through the shared command path. */
export function dispatchPrompt(session: CommandSession, prompt: string, rng: SeededRng): CommandSession {
  const parsed = parsePrompt(prompt);
  return dispatchParsed(session, parsed, rng);
}

/** Converts clickable control input to the exact prompt text used by command logs. */
export function controlToPrompt(input: ControlCommandInput): string {
  return formatParsedCommand(controlToParsed(input));
}

/** Executes clickable control input by routing through the same prompt dispatcher path. */
export function dispatchControl(
  session: CommandSession,
  control: ControlCommandInput,
  rng: SeededRng
): CommandSession {
  return dispatchPrompt(session, controlToPrompt(control), rng);
}
