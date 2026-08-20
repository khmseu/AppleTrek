import { SeededRng } from "../compat/basicCompat";
import { isKlingonCell } from "../state/cells";
import { enemyTurn, firePhasers, fireTorpedo } from "../state/combat";
import { latchMissionOutcome, triggerSelfDestruct } from "../state/endgame";
import { createInitialGameState, indexToCoord1Based, type GameState } from "../state/gameState";
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

interface CommandExecution {
  state: GameState;
  logLines: string[];
}

const DAMAGE_LABELS = [
  "WARP DRIVES",
  "SR SENSORS",
  "LR SENSORS",
  "PHASERS",
  "PH TORPS",
  "GAL RECORD",
  "COMPUTER",
  "PROBE",
  "CRYSTALS"
] as const;

function formatDamageDuration(value: number): string {
  const whole = Math.trunc(value / 100);
  const fractional = Math.abs(value % 100).toString().padStart(2, "0");
  return `${whole}.${fractional}`;
}

function damageReportLines(state: GameState): string[] {
  const damaged = state.damage
    .map((value, index) => ({ value, label: DAMAGE_LABELS[index] ?? `DEVICE ${index + 1}` }))
    .filter((device) => device.value > 0)
    .map((device) => `${device.label} DAMAGED ${formatDamageDuration(device.value)}`);

  return ["DAMAGE REPORT", ...(damaged.length > 0 ? damaged : ["ALL SYSTEMS OK"] )];
}

function computerReportLines(state: GameState): string[] {
  return [
    "COMPUTER REPORT",
    `QUADRANT ${state.position.quadrant.row}-${state.position.quadrant.col}`,
    `SECTOR ${state.position.sector.row}-${state.position.sector.col}`,
    `KLINGONS ${state.counts.klingonsRemaining}/${state.counts.initialKlingons}`,
    `BASES ${state.counts.basesRemaining}/${state.counts.initialBases}`
  ];
}

function probeReportLines(state: GameState): string[] {
  const klingons = state.sector
    .map((cell, index) => ({ cell, index: index + 1 }))
    .filter(({ cell }) => isKlingonCell(cell))
    .map(({ cell, index }) => {
      const coord = indexToCoord1Based(index, state.sectorSize);
      return `KLINGON ${coord.row}-${coord.col} ENERGY ${-cell}`;
    });

  return ["PROBE REPORT", ...(klingons.length > 0 ? klingons : ["NO KLINGONS"] )];
}

function loadTorpedoes(state: GameState, amount: number): GameState {
  const nextTorpedoes = state.ship.torpedoes + amount;
  if (nextTorpedoes < 0 || nextTorpedoes > state.ship.torpedoesMax) {
    throw new RangeError(`Invalid torpedo load: ${amount}`);
  }

  const energyCost = (500 + 100 * Math.sign(amount)) * amount;
  return {
    ...state,
    ship: {
      ...state.ship,
      energy: state.ship.energy - energyCost,
      torpedoes: nextTorpedoes
    }
  };
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

function executeParsed(state: GameState, command: ParsedCommand, rng: SeededRng): CommandExecution {
  if (state.endgame.terminal) {
    throw new RangeError("Mission already ended");
  }

  if (command.kind === "ion") {
    return {
      state: latchMissionOutcome(enemyTurn(
        navigate(state, { mode: "ion", course: command.course, value: command.value }),
        rng
      )),
      logLines: []
    };
  }

  if (command.kind === "warp") {
    return {
      state: latchMissionOutcome(enemyTurn(
        navigate(state, { mode: "warp", course: command.course, value: command.value }),
        rng
      )),
      logLines: []
    };
  }

  if (command.kind === "shields") {
    return {
      state: latchMissionOutcome(setShieldsPercent(state, command.value)),
      logLines: []
    };
  }

  if (command.kind === "phasers") {
    const result = firePhasers(state, command.value, rng);
    return {
      state: latchMissionOutcome(enemyTurn(result.state, rng)),
      logLines: []
    };
  }

  if (command.kind === "damage-report") {
    return {
      state,
      logLines: damageReportLines(state)
    };
  }

  if (command.kind === "load-torpedoes") {
    const loaded = latchMissionOutcome(loadTorpedoes(state, command.value));
    return {
      state: loaded,
      logLines: [`TORPEDOES ${loaded.ship.torpedoes}/${loaded.ship.torpedoesMax}`]
    };
  }

  if (command.kind === "computer") {
    return {
      state,
      logLines: computerReportLines(state)
    };
  }

  if (command.kind === "probe") {
    return {
      state,
      logLines: probeReportLines(state)
    };
  }

  if (command.kind === "self-destruct") {
    return {
      state: triggerSelfDestruct(state),
      logLines: []
    };
  }

  const result = fireTorpedo(state, command.course);
  return {
    state: latchMissionOutcome(enemyTurn(result.state, rng)),
    logLines: []
  };
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
  const execution = executeParsed(session.state, command, rng);
  const nextLog = [...appendLog(session.log, `> ${formatParsedCommand(command)}`), ...execution.logLines];
  return {
    state: execution.state,
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
