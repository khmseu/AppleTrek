import { createInitialGameState, type GameState } from "../../src/state/gameState";

export function makeTestState(overrides?: Partial<GameState>, seed = 1701): GameState {
  const base = createInitialGameState(seed);
  return {
    ...base,
    ...overrides,
    clock: {
      ...base.clock,
      ...(overrides?.clock ?? {})
    },
    ship: {
      ...base.ship,
      ...(overrides?.ship ?? {})
    },
    position: {
      ...base.position,
      ...(overrides?.position ?? {})
    },
    mission: {
      ...base.mission,
      ...(overrides?.mission ?? {})
    },
    counts: {
      ...base.counts,
      ...(overrides?.counts ?? {})
    },
    endgame: {
      ...base.endgame,
      ...(overrides?.endgame ?? {})
    },
    galaxy: overrides?.galaxy ? [...overrides.galaxy] : [...base.galaxy],
    sector: overrides?.sector ? [...overrides.sector] : [...base.sector],
    damage: overrides?.damage ? [...overrides.damage] : [...base.damage]
  };
}
