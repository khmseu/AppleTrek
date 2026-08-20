import { type EndgameReason, type GameState } from "./gameState";

export type MissionOutcome = "success" | "failure";

export interface MissionOutcomeBulletin {
  outcome: MissionOutcome;
  reason: Exclude<EndgameReason, "ongoing">;
  headline: string;
  summary: string;
  stardate: number;
  klingonsRemaining: number;
  basesRemaining: number;
}

function hasDeadlineExpired(state: GameState): boolean {
  return (
    state.clock.stardate > state.mission.endStardate ||
    (state.clock.stardate === state.mission.endStardate && state.clock.ticks > 0)
  );
}

function resolveReason(state: GameState): Exclude<EndgameReason, "ongoing"> | null {
  if (state.endgame.terminal && state.endgame.reason === "self-destruct") {
    return "self-destruct";
  }

  if (state.counts.klingonsRemaining <= 0) {
    return "klingons-eliminated";
  }

  if (state.ship.energy <= 0) {
    return "ship-destroyed";
  }

  if (hasDeadlineExpired(state)) {
    return "deadline-expired";
  }

  return null;
}

function reasonHeadline(reason: Exclude<EndgameReason, "ongoing">): string {
  if (reason === "klingons-eliminated") {
    return "MISSION ACCOMPLISHED";
  }

  if (reason === "deadline-expired") {
    return "MISSION FAILED";
  }

  if (reason === "ship-destroyed") {
    return "ENTERPRISE LOST";
  }

  return "SELF-DESTRUCT COMPLETE";
}

function reasonSummary(reason: Exclude<EndgameReason, "ongoing">): string {
  if (reason === "klingons-eliminated") {
    return "All enemy vessels have been neutralized within mission window.";
  }

  if (reason === "deadline-expired") {
    return "Stardate limit exceeded before all enemies were eliminated.";
  }

  if (reason === "ship-destroyed") {
    return "The ship can no longer sustain combat operations.";
  }

  return "Command sequence initiated and vessel was destroyed by crew order.";
}

export function evaluateMissionOutcome(state: GameState): MissionOutcomeBulletin | null {
  const reason = resolveReason(state);
  if (!reason) {
    return null;
  }

  const outcome: MissionOutcome = reason === "klingons-eliminated" ? "success" : "failure";

  return {
    outcome,
    reason,
    headline: reasonHeadline(reason),
    summary: reasonSummary(reason),
    stardate: state.clock.stardate,
    klingonsRemaining: state.counts.klingonsRemaining,
    basesRemaining: state.counts.basesRemaining
  };
}

export function triggerSelfDestruct(state: GameState): GameState {
  return {
    ...state,
    ship: {
      ...state.ship,
      energy: 0,
      shieldEnergy: 0
    },
    endgame: {
      terminal: true,
      reason: "self-destruct"
    }
  };
}
