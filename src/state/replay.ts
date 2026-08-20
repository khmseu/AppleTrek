import { SeededRng } from "../compat/basicCompat";
import { createInitialGameState, type GameState } from "./gameState";
import { createCommandSession, dispatchPrompt } from "../ui/commandDispatcher";

export interface ReplayResult {
  finalState: GameState;
  log: string[];
  snapshot: string;
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
