import {
  GALAXY_CELLS,
  GRID_CELLS,
  coordToIndex1Based,
  type GameState
} from "../../src/state/gameState";
import { makeTestState } from "./testState";

export interface CombatFixture {
  state: GameState;
  quadrantIndex: number;
  shipIndex: number;
  primaryTargetIndex: number;
}

export interface TwoTargetCombatFixture extends CombatFixture {
  secondaryTargetIndex: number;
}

export function makeTwoKlingonCombatFixture(): TwoTargetCombatFixture {
  const sector = Array.from({ length: GRID_CELLS }, () => 0);
  const shipIndex = coordToIndex1Based(4, 4);
  const weakKlingonIndex = coordToIndex1Based(4, 6);
  const strongKlingonIndex = coordToIndex1Based(2, 4);

  sector[shipIndex - 1] = 1;
  sector[weakKlingonIndex - 1] = -120;
  sector[strongKlingonIndex - 1] = -3200;

  const quadrantIndex = coordToIndex1Based(4, 4);
  const galaxy = Array.from({ length: GALAXY_CELLS }, () => 0);
  galaxy[quadrantIndex - 1] = 200;

  const state = makeTestState({
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

  return {
    state,
    quadrantIndex,
    shipIndex,
    primaryTargetIndex: weakKlingonIndex,
    secondaryTargetIndex: strongKlingonIndex
  };
}

export function makeSingleKlingonCombatFixture(klingonStrength = -180): CombatFixture {
  const sector = Array.from({ length: GRID_CELLS }, () => 0);
  const shipIndex = coordToIndex1Based(4, 4);
  const klingonIndex = coordToIndex1Based(4, 6);

  sector[shipIndex - 1] = 1;
  sector[klingonIndex - 1] = klingonStrength;

  const quadrantIndex = coordToIndex1Based(4, 4);
  const galaxy = Array.from({ length: GALAXY_CELLS }, () => 0);
  galaxy[quadrantIndex - 1] = 100;

  const state = makeTestState({
    ship: {
      energy: 3000,
      energyMax: 5000,
      shieldEnergy: 1500,
      shieldsPercent: 50,
      torpedoes: 10,
      torpedoesMax: 10
    },
    counts: {
      initialKlingons: 1,
      klingonsRemaining: 1,
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

  return {
    state,
    quadrantIndex,
    shipIndex,
    primaryTargetIndex: klingonIndex
  };
}

export function makeStarbaseTorpedoFixture(): TwoTargetCombatFixture {
  const sector = Array.from({ length: GRID_CELLS }, () => 0);
  const shipIndex = coordToIndex1Based(4, 4);
  const targetedBaseIndex = coordToIndex1Based(4, 6);
  const otherBaseIndex = coordToIndex1Based(2, 2);

  sector[shipIndex - 1] = 1;
  sector[targetedBaseIndex - 1] = 2;
  sector[otherBaseIndex - 1] = 2;

  const quadrantIndex = coordToIndex1Based(4, 4);
  const galaxy = Array.from({ length: GALAXY_CELLS }, () => 0);
  galaxy[quadrantIndex - 1] = 20;

  const state = makeTestState({
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

  return {
    state,
    quadrantIndex,
    shipIndex,
    primaryTargetIndex: targetedBaseIndex,
    secondaryTargetIndex: otherBaseIndex
  };
}
