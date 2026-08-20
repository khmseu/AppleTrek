import { describe, expect, it } from "vitest";
import { SeededRng } from "../src/compat/basicCompat";
import {
  GRID_CELLS,
  coordToIndex1Based,
  createInitialGameState,
  type GameState
} from "../src/state/gameState";
import { enemyTurn, firePhasers, fireTorpedo } from "../src/state";

function makeState(overrides?: Partial<GameState>): GameState {
  const base = createInitialGameState(1701);
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
    galaxy: overrides?.galaxy ?? [...base.galaxy],
    sector: overrides?.sector ?? [...base.sector],
    damage: overrides?.damage ?? [...base.damage]
  };
}

function makeCombatFixture(): GameState {
  const sector = Array.from({ length: GRID_CELLS }, () => 0);
  const shipIndex = coordToIndex1Based(4, 4);
  const weakKlingonIndex = coordToIndex1Based(4, 6);
  const strongKlingonIndex = coordToIndex1Based(2, 4);

  sector[shipIndex - 1] = 1;
  sector[weakKlingonIndex - 1] = -120;
  sector[strongKlingonIndex - 1] = -3200;

  const quadrantIndex = coordToIndex1Based(4, 4);
  const galaxy = Array.from({ length: GRID_CELLS }, () => 0);
  galaxy[quadrantIndex - 1] = 200;

  return makeState({
    ship: {
      energy: 5000,
      energyMax: 5000,
      shieldEnergy: 2500,
      shieldsPercent: 50,
      torpedoes: 10,
      torpedoesMax: 10
    },
    counts: {
      initialKlingons: 2,
      klingonsRemaining: 2,
      initialBases: 0,
      basesRemaining: 0
    },
    galaxy,
    sector,
    position: {
      quadrantIndex,
      quadrant: { row: 4, col: 4 },
      sectorIndex: shipIndex,
      sector: { row: 4, col: 4 }
    }
  });
}

function makeStarbaseTorpedoFixture(): GameState {
  const sector = Array.from({ length: GRID_CELLS }, () => 0);
  const shipIndex = coordToIndex1Based(4, 4);
  const targetedBaseIndex = coordToIndex1Based(4, 6);
  const otherBaseIndex = coordToIndex1Based(2, 2);

  sector[shipIndex - 1] = 1;
  sector[targetedBaseIndex - 1] = 2;
  sector[otherBaseIndex - 1] = 2;

  const quadrantIndex = coordToIndex1Based(4, 4);
  const galaxy = Array.from({ length: GRID_CELLS }, () => 0);
  galaxy[quadrantIndex - 1] = 20;

  return makeState({
    ship: {
      energy: 5000,
      energyMax: 5000,
      shieldEnergy: 2500,
      shieldsPercent: 50,
      torpedoes: 10,
      torpedoesMax: 10
    },
    counts: {
      initialKlingons: 0,
      klingonsRemaining: 0,
      initialBases: 2,
      basesRemaining: 2
    },
    galaxy,
    sector,
    position: {
      quadrantIndex,
      quadrant: { row: 4, col: 4 },
      sectorIndex: shipIndex,
      sector: { row: 4, col: 4 }
    }
  });
}

describe("Phase 4 combat core", () => {
  it("phasers damage klingons and destroy weakened targets", () => {
    const state = makeCombatFixture();

    const result = firePhasers(state, 2000, new SeededRng(9));

    expect(result.kills).toBe(1);
    expect(result.state.ship.energy).toBe(3000);
    expect(result.state.counts.klingonsRemaining).toBe(1);

    const weakKlingonIndex = coordToIndex1Based(4, 6);
    const strongKlingonIndex = coordToIndex1Based(2, 4);

    expect(result.state.sector[weakKlingonIndex - 1]).toBe(0);
    expect(result.state.sector[strongKlingonIndex - 1]).toBeLessThan(-1);

    const currentQuadrantEncoded = result.state.galaxy[result.state.position.quadrantIndex - 1];
    expect(currentQuadrantEncoded).toBe(100);
  });

  it("torpedo trajectory hits klingons on course", () => {
    const state = makeCombatFixture();

    const result = fireTorpedo(state, 90);

    expect(result.hit).toBe(true);
    expect(result.reason).toBe("klingon");
    expect(result.state.ship.torpedoes).toBe(9);
    expect(result.state.counts.klingonsRemaining).toBe(1);

    const weakKlingonIndex = coordToIndex1Based(4, 6);
    expect(result.state.sector[weakKlingonIndex - 1]).toBe(0);
  });

  it("torpedo trajectory misses cleanly when no target intersects", () => {
    const state = makeCombatFixture();

    const result = fireTorpedo(state, 45);

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("miss");
    expect(result.state.ship.torpedoes).toBe(9);
    expect(result.state.counts.klingonsRemaining).toBe(2);
  });

  it("torpedoing a starbase clears sector, decrements bases, and updates current quadrant encoding", () => {
    const state = makeStarbaseTorpedoFixture();

    const result = fireTorpedo(state, 90);

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("starbase");
    expect(result.state.ship.torpedoes).toBe(9);

    const targetedBaseIndex = coordToIndex1Based(4, 6);
    expect(result.state.sector[targetedBaseIndex - 1]).toBe(0);
    expect(result.state.sector.filter((cell) => cell === 2)).toHaveLength(1);

    expect(result.state.counts.basesRemaining).toBe(1);

    const currentQuadrantEncoded = result.state.galaxy[result.state.position.quadrantIndex - 1];
    expect(currentQuadrantEncoded).toBe(10);
  });

  it("torpedoing a starbase does not underflow base counts or quadrant encoding", () => {
    const state = makeStarbaseTorpedoFixture();
    const currentQuadrantIndex = state.position.quadrantIndex - 1;

    state.counts.basesRemaining = 0;
    state.galaxy[currentQuadrantIndex] = 0;

    const result = fireTorpedo(state, 90);

    expect(result.reason).toBe("starbase");
    expect(result.state.counts.basesRemaining).toBe(0);
    expect(result.state.galaxy[currentQuadrantIndex]).toBe(0);
  });

  it("enemy fire deterministically reduces defensive resources", () => {
    const state = makeCombatFixture();

    const a = enemyTurn(state, new SeededRng(33));
    const b = enemyTurn(state, new SeededRng(33));

    expect(a).toEqual(b);
    expect(a.ship.shieldEnergy).toBeLessThan(state.ship.shieldEnergy);
    expect(a.ship.energy).toBeLessThanOrEqual(state.ship.energy);
  });

  it("enemy turn movement keeps sector valid and preserves entity counts", () => {
    const state = makeCombatFixture();

    const next = enemyTurn(state, new SeededRng(123));

    const shipCells = next.sector.filter((cell) => cell === 1).length;
    const klingonCells = next.sector.filter((cell) => cell < 0).length;

    expect(shipCells).toBe(1);
    expect(klingonCells).toBe(next.counts.klingonsRemaining);
    expect(klingonCells).toBeLessThanOrEqual(state.counts.klingonsRemaining);

    for (const cell of next.sector) {
      const allowed = cell === 0 || cell === 1 || cell === 2 || cell === 3 || cell < 0;
      expect(allowed).toBe(true);
    }
  });
});
