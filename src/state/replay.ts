import { SeededRng } from "../compat/basicCompat";
import { createInitialGameState, type GameState } from "./gameState";
import { createCommandSession, dispatchPrompt } from "../ui/commandDispatcher";

/** Deterministic replay output for a seed and command script. */
export interface ReplayResult {
  /** Final state after every command has been dispatched. */
  finalState: GameState;
  /** Command log collected by the command session. */
  log: string[];
  /** Stable JSON snapshot used as checksum input. */
  snapshot: string;
  /** FNV-1a checksum of the replay snapshot, formatted as eight hex characters. */
  checksum: string;
}

interface ReplaySnapshot {
  state: GameState;
  log: string[];
}

function computeChecksumFnv1a(input: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

/**
 * Runs prompt commands against a deterministic initial state and RNG stream.
 *
 * The replay uses the same dispatcher as the browser UI so prompt parsing,
 * command side effects, enemy turns, and logging are all covered by the snapshot.
 */
export function runScriptedReplay(seed: number, commands: string[]): ReplayResult {
  const rng = new SeededRng(seed);
  let session = createCommandSession(createInitialGameState(seed));

  for (const command of commands) {
    session = dispatchPrompt(session, command, rng);
  }

  const compact: ReplaySnapshot = {
    state: session.state,
    log: session.log
  };

  const snapshot = JSON.stringify(compact);

  return {
    finalState: session.state,
    log: session.log,
    snapshot,
    checksum: computeChecksumFnv1a(snapshot)
  };
}
