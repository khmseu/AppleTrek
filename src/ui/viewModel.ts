import { type GameState } from "../state/gameState";

/**
 * Read-only projection for optional modern overlays outside the retro terminal.
 *
 * The view model mirrors player-facing state only and intentionally omits raw
 * galaxy/sector arrays so UI layers do not mutate engine state accidentally.
 */
export interface OverlayViewModel {
  stardate: {
    major: number;
    minor: number;
  };
  position: {
    quadrant: {
      row: number;
      col: number;
    };
    sector: {
      row: number;
      col: number;
    };
  };
  resources: {
    energy: number;
    energyMax: number;
    shieldEnergy: number;
    shieldsPercent: number;
    torpedoes: number;
    torpedoesMax: number;
  };
  counts: {
    klingonsRemaining: number;
    klingonsInitial: number;
    basesRemaining: number;
    basesInitial: number;
  };
  mission: {
    startStardate: number;
    endStardate: number;
  };
  terminal: boolean;
}

function deepFreeze<T extends object>(value: T): Readonly<T> {
  Object.freeze(value);

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object" && !Object.isFrozen(nested)) {
      deepFreeze(nested as object);
    }
  }

  return value;
}

/** Builds and deeply freezes a UI-friendly projection of the current game state. */
export function createOverlayViewModel(state: GameState): Readonly<OverlayViewModel> {
  const model: OverlayViewModel = {
    stardate: {
      major: state.clock.stardate,
      minor: state.clock.ticks
    },
    position: {
      quadrant: {
        row: state.position.quadrant.row,
        col: state.position.quadrant.col
      },
      sector: {
        row: state.position.sector.row,
        col: state.position.sector.col
      }
    },
    resources: {
      energy: state.ship.energy,
      energyMax: state.ship.energyMax,
      shieldEnergy: state.ship.shieldEnergy,
      shieldsPercent: state.ship.shieldsPercent,
      torpedoes: state.ship.torpedoes,
      torpedoesMax: state.ship.torpedoesMax
    },
    counts: {
      klingonsRemaining: state.counts.klingonsRemaining,
      klingonsInitial: state.counts.initialKlingons,
      basesRemaining: state.counts.basesRemaining,
      basesInitial: state.counts.initialBases
    },
    mission: {
      startStardate: state.mission.startStardate,
      endStardate: state.mission.endStardate
    },
    terminal: state.endgame.terminal
  };

  return deepFreeze(model);
}
