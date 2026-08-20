import { modCompat, SeededRng, truncDiv } from "../compat/basicCompat";

export const GRID_SIZE = 8;
export const GRID_CELLS = GRID_SIZE * GRID_SIZE;

const START_STARDATE = 3424;
const END_STARDATE = 3427;
const MAX_ENERGY = 5000;
const START_SHIELD_PERCENT = 50;
const MAX_TORPEDOES = 10;
const KLINGON_UNIT_STRENGTH = -3800;

const EMPTY_CELL = 0;
const SHIP_CELL = 1;
const STARBASE_CELL = 2;
const STAR_CELL = 3;

export interface GridCoord1Based {
  row: number;
  col: number;
}

export interface MissionState {
  startStardate: number;
  endStardate: number;
}

export interface ClockState {
  stardate: number;
  ticks: number;
}

export interface ShipState {
  energy: number;
  energyMax: number;
  shieldEnergy: number;
  shieldsPercent: number;
  torpedoes: number;
  torpedoesMax: number;
}

export interface EnemyAndBaseCounts {
  initialKlingons: number;
  klingonsRemaining: number;
  initialBases: number;
  basesRemaining: number;
}

export interface PositionState {
  quadrantIndex: number;
  quadrant: GridCoord1Based;
  sectorIndex: number;
  sector: GridCoord1Based;
}

export type EndgameReason =
  | "ongoing"
  | "klingons-eliminated"
  | "deadline-expired"
  | "ship-destroyed"
  | "self-destruct";

export interface EndgameState {
  terminal: boolean;
  reason: EndgameReason;
}

export interface GameState {
  gridSize: number;
  mission: MissionState;
  clock: ClockState;
  ship: ShipState;
  counts: EnemyAndBaseCounts;
  galaxy: number[];
  sector: number[];
  position: PositionState;
  damage: number[];
  endgame: EndgameState;
}

function assertGridRange(value: number, maxInclusive: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > maxInclusive) {
    throw new RangeError(`${label} out of range: ${value}`);
  }
}

function rndBelow(rng: SeededRng, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(`Invalid maxExclusive: ${maxExclusive}`);
  }

  return rng.nextInt(0, maxExclusive - 1);
}

function placeRandomOnEmptyCells(cells: number[], count: number, value: number, rng: SeededRng): void {
  if (count <= 0) {
    return;
  }

  let remaining = count;
  while (remaining > 0) {
    const index = rndBelow(rng, cells.length);
    if (cells[index] !== EMPTY_CELL) {
      continue;
    }

    cells[index] = value;
    remaining -= 1;
  }
}

export function coordToIndex1Based(row: number, col: number, gridSize = GRID_SIZE): number {
  assertGridRange(row, gridSize, "row");
  assertGridRange(col, gridSize, "col");

  return (row - 1) * gridSize + col;
}

export function indexToCoord1Based(index: number, gridSize = GRID_SIZE): GridCoord1Based {
  assertGridRange(index, gridSize * gridSize, "index");

  const zeroBased = index - 1;
  const row = truncDiv(zeroBased, gridSize) + 1;
  const col = modCompat(zeroBased, gridSize) + 1;
  return { row, col };
}

export function createInitialGameState(seed: number): GameState {
  const rng = new SeededRng(seed);

  const initialBases = 2 + rndBelow(rng, 2) + rndBelow(rng, 2);
  const initialKlingons = 25 + rndBelow(rng, 15) + rndBelow(rng, 15);

  const quadrantContents = Array.from({ length: GRID_CELLS }, () => 0);

  // Starbases are first distributed to unique quadrants as +10 in the encoded record.
  placeRandomOnEmptyCells(quadrantContents, initialBases, 10, rng);

  let selectedQuadrant = 1;
  for (let i = 1; i <= initialKlingons; i += 1) {
    if (!(i > 1 && rndBelow(rng, 900) > quadrantContents[selectedQuadrant - 1])) {
      do {
        selectedQuadrant = rndBelow(rng, GRID_CELLS) + 1;
      } while (
        modCompat(quadrantContents[selectedQuadrant - 1], 100) > 9 ||
        quadrantContents[selectedQuadrant - 1] > 800
      );
    }

    quadrantContents[selectedQuadrant - 1] += 100;
  }

  const galaxy = quadrantContents.map((encoded) => {
    const stars = 2 + rndBelow(rng, 4) + rndBelow(rng, 4);
    return -encoded - stars;
  });

  const quadrantIndex = rndBelow(rng, GRID_CELLS) + 1;
  const sectorIndex = rndBelow(rng, GRID_CELLS) + 1;
  galaxy[quadrantIndex - 1] = Math.abs(galaxy[quadrantIndex - 1]);

  const currentQuadrantEncoded = galaxy[quadrantIndex - 1];
  const stars = modCompat(currentQuadrantEncoded, 10);
  const klingons = truncDiv(currentQuadrantEncoded, 100);
  const bases = truncDiv(currentQuadrantEncoded, 10) - klingons * 10;

  const sector = Array.from({ length: GRID_CELLS }, () => EMPTY_CELL);
  sector[sectorIndex - 1] = SHIP_CELL;
  placeRandomOnEmptyCells(sector, bases, STARBASE_CELL, rng);
  placeRandomOnEmptyCells(sector, stars, STAR_CELL, rng);
  placeRandomOnEmptyCells(sector, klingons, KLINGON_UNIT_STRENGTH, rng);

  return {
    gridSize: GRID_SIZE,
    mission: {
      startStardate: START_STARDATE,
      endStardate: END_STARDATE
    },
    clock: {
      stardate: START_STARDATE,
      ticks: 0
    },
    ship: {
      energy: MAX_ENERGY,
      energyMax: MAX_ENERGY,
      shieldEnergy: truncDiv(MAX_ENERGY * START_SHIELD_PERCENT, 100),
      shieldsPercent: START_SHIELD_PERCENT,
      torpedoes: MAX_TORPEDOES,
      torpedoesMax: MAX_TORPEDOES
    },
    counts: {
      initialKlingons,
      klingonsRemaining: initialKlingons,
      initialBases,
      basesRemaining: initialBases
    },
    galaxy,
    sector,
    position: {
      quadrantIndex,
      quadrant: indexToCoord1Based(quadrantIndex),
      sectorIndex,
      sector: indexToCoord1Based(sectorIndex)
    },
    damage: Array.from({ length: 9 }, () => 0),
    endgame: {
      terminal: false,
      reason: "ongoing"
    }
  };
}