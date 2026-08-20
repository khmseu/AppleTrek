import { SeededRng } from "../compat/basicCompat";
import { enemyTurn, firePhasers, fireTorpedo } from "../state/combat";
import { triggerSelfDestruct } from "../state/endgame";
import { createInitialGameState, type GameState } from "../state/gameState";
import { navigate, setShieldsPercent } from "../state/navigation";
import { assertNever } from "../utils/assertNever";
import { formatParsedCommand, parsePrompt, type ParsedCommand } from "./commandParser";

export interface CommandSession {
  state: GameState;
  log: string[];
}

export const CONTROL_ACTIONS = Object.freeze([
  "ion",
  "warp",
  "shields",
  "phasers",
  "torpedo",
  "self-destruct"
] as const);

const CONTROL_ACTION_SET: ReadonlySet<string> = new Set(CONTROL_ACTIONS);

export type ControlAction = (typeof CONTROL_ACTIONS)[number];

export function isControlAction(value: string): value is ControlAction {
  return CONTROL_ACTION_SET.has(value);
}

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

export function createCommandSession(initialState?: GameState): CommandSession {
  return {
    state: initialState ?? createInitialGameState(1701),
    log: ["WELCOME TO APPLE TREK"]
  };
}

export function dispatchParsed(session: CommandSession, command: ParsedCommand, rng: SeededRng): CommandSession {
  const nextState = executeParsed(session.state, command, rng);
  const nextLog = appendLog(session.log, `> ${formatParsedCommand(command)}`);
  return {
    state: nextState,
    log: nextLog
  };
}

export function dispatchPrompt(session: CommandSession, prompt: string, rng: SeededRng): CommandSession {
  const parsed = parsePrompt(prompt);
  return dispatchParsed(session, parsed, rng);
}

export function controlToPrompt(input: ControlCommandInput): string {
  return formatParsedCommand(controlToParsed(input));
}

export function dispatchControl(
  session: CommandSession,
  control: ControlCommandInput,
  rng: SeededRng
): CommandSession {
  return dispatchPrompt(session, controlToPrompt(control), rng);
}
