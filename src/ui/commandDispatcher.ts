import { SeededRng } from "../compat/basicCompat";
import { enemyTurn, firePhasers, fireTorpedo } from "../state/combat";
import { triggerSelfDestruct } from "../state/endgame";
import { createInitialGameState, type GameState } from "../state/gameState";
import { navigate, setShieldsPercent } from "../state/navigation";
import { parsePrompt, type ParsedCommand } from "./commandParser";

export interface CommandSession {
  state: GameState;
  log: string[];
}

export interface ControlCommandInput {
  action: "ion" | "warp" | "shields" | "phasers" | "torpedo" | "self-destruct";
  course?: number;
  value?: number;
}

function commandToLogText(command: ParsedCommand): string {
  if (command.kind === "ion") {
    return `ION ${command.course} ${command.value}`;
  }

  if (command.kind === "warp") {
    return `WARP ${command.course} ${command.value}`;
  }

  if (command.kind === "shields") {
    return `SHIELDS ${command.value}`;
  }

  if (command.kind === "phasers") {
    return `PHASERS ${command.value}`;
  }

  if (command.kind === "self-destruct") {
    return "DESTRUCT";
  }

  return `TORPEDO ${command.course}`;
}

function appendLog(log: string[], line: string): string[] {
  return [...log, line];
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
  const nextLog = appendLog(session.log, `> ${commandToLogText(command)}`);
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
  if (input.action === "ion") {
    return `ION ${input.course ?? 0} ${input.value ?? 0}`;
  }

  if (input.action === "warp") {
    return `WARP ${input.course ?? 0} ${input.value ?? 0}`;
  }

  if (input.action === "shields") {
    return `SHIELDS ${input.value ?? 0}`;
  }

  if (input.action === "phasers") {
    return `PHASERS ${input.value ?? 0}`;
  }

  if (input.action === "self-destruct") {
    return "DESTRUCT";
  }

  return `TORPEDO ${input.course ?? 0}`;
}

export function dispatchControl(
  session: CommandSession,
  control: ControlCommandInput,
  rng: SeededRng
): CommandSession {
  return dispatchPrompt(session, controlToPrompt(control), rng);
}
