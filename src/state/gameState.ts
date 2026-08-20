import { modCompat, SeededRng, truncDiv } from "../compat/basicCompat";
import {
  EMPTY_CELL,
  KLINGON_UNIT_STRENGTH,
  SHIP_CELL,
  STARBASE_CELL,
  STAR_CELL
} from "./cells";

/** Default Apple Trek sector width/height. Variable-size states may override this. */
export const SECTOR_GRID_SIZE = 8;
/** Number of cells in the default Apple Trek sector grid. */
export const TOTAL_SECTOR_GRID_CELLS = SECTOR_GRID_SIZE * SECTOR_GRID_SIZE;
/** Default Apple Trek quadrant grid width/height. Variable-size states may override this. */
export const QUADRANT_GRID_SIZE = 8;
/** Number of cells in the default Apple Trek galaxy quadrant grid. */
export const TOTAL_QUADRANT_GRID_CELLS = QUADRANT_GRID_SIZE * QUADRANT_GRID_SIZE;

const START_STARDATE = 3424;
const END_STARDATE = 3427;
const MAX_ENERGY = 5000;
const START_SHIELD_PERCENT = 50;
const MAX_TORPEDOES = 10;

/** 1-based row/column coordinate used for both sectors and quadrants. */
export interface GridCoord1Based {
  /** Row in the inclusive range 1..gridSize. */
  row: number;
  /** Column in the inclusive range 1..gridSize. */
  col: number;
}

/** Mission start/end dates expressed as integer stardates. */
export interface MissionState {
  startStardate: number;
  endStardate: number;
}

/** Current stardate plus sub-day ticks. One hundred ticks advance one stardate. */
export interface ClockState {
  stardate: number;
  ticks: number;
}

/** Mutable ship resources and shield target state. */
export interface ShipState {
  energy: number;
  energyMax: number;
  shieldEnergy: number;
  shieldsPercent: number;
  torpedoes: number;
  torpedoesMax: number;
}

/** Initial and remaining mission entity counts. */
export interface EnemyAndBaseCounts {
  initialKlingons: number;
  klingonsRemaining: number;
  initialBases: number;
  basesRemaining: number;
}

/** Current ship location in both galaxy quadrant space and local sector space. */
export interface PositionState {
  /** 1-based index into `GameState.galaxy`, using `GameState.quadrantSize`. */
  quadrantIndex: number;
  quadrant: GridCoord1Based;
  /** 1-based index into `GameState.sector`, using `GameState.sectorSize`. */
  sectorIndex: number;
  sector: GridCoord1Based;
}

/** Terminal mission state reason, or `ongoing` while play may continue. */
export type EndgameReason =
  | "ongoing"
  | "klingons-eliminated"
  | "deadline-expired"
  | "ship-destroyed"
  | "self-destruct";

/** Endgame flag and reason evaluated by mission outcome logic. */
export interface EndgameState {
  terminal: boolean;
  reason: EndgameReason;
}

/**
 * Complete immutable-style game snapshot consumed by state transition functions.
 *
 * Arrays use 1-based indexes in the stored position fields but remain normal
 * zero-based JavaScript arrays at the storage level. `sectorSize` and
 * `quadrantSize` describe the active dimensions for variable-size test states;
 * callers should prefer those fields over default constants whenever a
 * `GameState` is available.
 */
export interface GameState {
  sectorSize: number;
  quadrantSize: number;
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

/**
 * Converts a 1-based row/column pair to a 1-based linear index for any square grid.
 *
 * @throws {RangeError} When row or column is not an integer in 1..gridSize.
 */
export function coordToIndex1Based(row: number, col: number, gridSize: number): number {
  assertGridRange(row, gridSize, "row");
  assertGridRange(col, gridSize, "col");

  return (row - 1) * gridSize + col;
}

/**
 * Converts a 1-based linear index to a 1-based row/column pair for any square grid.
 *
 * @throws {RangeError} When index is not an integer in 1..gridSize^2.
 */
export function indexToCoord1Based(index: number, gridSize: number): GridCoord1Based {
  assertGridRange(index, gridSize * gridSize, "index");

  const zeroBased = index - 1;
  const row = truncDiv(zeroBased, gridSize) + 1;
  const col = modCompat(zeroBased, gridSize) + 1;
  return { row, col };
}

/** Converts coordinates using the default 8x8 sector size, not a state's sector size. */
export function coordToDefaultSectorIndex1Based(row: number, col: number): number {
  return coordToIndex1Based(row, col, SECTOR_GRID_SIZE);
}

/** Converts coordinates using the default 8x8 quadrant size, not a state's quadrant size. */
export function coordToDefaultQuadrantIndex1Based(row: number, col: number): number {
  return coordToIndex1Based(row, col, QUADRANT_GRID_SIZE);
}

/** Converts an index using the default 8x8 sector size, not a state's sector size. */
export function indexToDefaultSectorCoord1Based(index: number): GridCoord1Based {
  return indexToCoord1Based(index, SECTOR_GRID_SIZE);
}

/** Converts an index using the default 8x8 quadrant size, not a state's quadrant size. */
export function indexToDefaultQuadrantCoord1Based(index: number): GridCoord1Based {
  return indexToCoord1Based(index, QUADRANT_GRID_SIZE);
}

/**
 * Creates a deterministic default-size Apple Trek game state from a seed.
 *
 * The returned galaxy and current sector are populated from the original BASIC
 * encoding scheme: hundreds are Klingons, tens are starbases, and ones are
 * stars. The selected starting quadrant is marked explored by storing a
 * positive encoded value.
 */
export function createInitialGameState(seed: number): GameState {
  const rng = new SeededRng(seed);

  const initialBases = 2 + rndBelow(rng, 2) + rndBelow(rng, 2);
  const initialKlingons = 25 + rndBelow(rng, 15) + rndBelow(rng, 15);

  const quadrantContents = Array.from({ length: TOTAL_QUADRANT_GRID_CELLS }, () => 0);

  // Starbases are first distributed to unique quadrants as +10 in the encoded record.
  placeRandomOnEmptyCells(quadrantContents, initialBases, 10, rng);

  let selectedQuadrant = 1;
  for (let i = 1; i <= initialKlingons; i += 1) {
    if (!(i > 1 && rndBelow(rng, 900) > quadrantContents[selectedQuadrant - 1])) {
      do {
        selectedQuadrant = rndBelow(rng, TOTAL_QUADRANT_GRID_CELLS) + 1;
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

  const quadrantIndex = rndBelow(rng, TOTAL_QUADRANT_GRID_CELLS) + 1;
  const sectorIndex = rndBelow(rng, TOTAL_SECTOR_GRID_CELLS) + 1;
  galaxy[quadrantIndex - 1] = Math.abs(galaxy[quadrantIndex - 1]);

  const currentQuadrantEncoded = galaxy[quadrantIndex - 1];
  const stars = modCompat(currentQuadrantEncoded, 10);
  const klingons = truncDiv(currentQuadrantEncoded, 100);
  const bases = truncDiv(currentQuadrantEncoded, 10) - klingons * 10;

  const sector = Array.from({ length: TOTAL_SECTOR_GRID_CELLS }, () => EMPTY_CELL);
  sector[sectorIndex - 1] = SHIP_CELL;
  placeRandomOnEmptyCells(sector, bases, STARBASE_CELL, rng);
  placeRandomOnEmptyCells(sector, stars, STAR_CELL, rng);
  placeRandomOnEmptyCells(sector, klingons, KLINGON_UNIT_STRENGTH, rng);

  return {
    sectorSize: SECTOR_GRID_SIZE,
    quadrantSize: QUADRANT_GRID_SIZE,
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
      quadrant: indexToDefaultQuadrantCoord1Based(quadrantIndex),
      sectorIndex,
      sector: indexToDefaultSectorCoord1Based(sectorIndex)
    },
    damage: Array.from({ length: 9 }, () => 0),
    endgame: {
      terminal: false,
      reason: "ongoing"
    }
  };
}