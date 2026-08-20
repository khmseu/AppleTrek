import { modCompat, truncDiv } from "../compat/basicCompat";
import {
  coordToIndex1Based,
  type GameState
} from "./gameState";
import {
  EMPTY_CELL,
  KLINGON_UNIT_STRENGTH,
  SHIP_CELL,
  STARBASE_CELL,
  STAR_CELL
} from "./cells";

/** Movement vector scaled so accumulated magnitudes of 1000 cross one cell. */
export interface CourseVector {
  dx: number;
  dy: number;
}

/** Parsed navigation command arguments. */
export interface NavigateInput {
  mode: "ion" | "warp";
  course: number;
  value: number;
}

function wrap1ToQuadrant(value: number, quadrantSize: number): number {
  const zeroBased = ((value - 1) % quadrantSize + quadrantSize) % quadrantSize;
  return zeroBased + 1;
}

function normalizeCourse(course: number): number {
  return modCompat(modCompat(course, 360) + 360, 360);
}

function placeDeterministically(sector: number[], count: number, cellValue: number): void {
  let remaining = count;
  for (let i = 0; i < sector.length && remaining > 0; i += 1) {
    if (sector[i] !== EMPTY_CELL) {
      continue;
    }

    sector[i] = cellValue;
    remaining -= 1;
  }
}

function buildSectorFromQuadrantEncoding(
  encodedQuadrant: number,
  shipSectorIndex: number,
  sectorSize: number
): number[] {
  const encoded = Math.abs(encodedQuadrant);
  const klingons = truncDiv(encoded, 100);
  const bases = modCompat(truncDiv(encoded, 10), 10);
  const stars = modCompat(encoded, 10);

  const sector = Array.from({ length: sectorSize * sectorSize }, () => EMPTY_CELL);
  sector[shipSectorIndex - 1] = SHIP_CELL;

  placeDeterministically(sector, bases, STARBASE_CELL);
  placeDeterministically(sector, stars, STAR_CELL);
  placeDeterministically(sector, klingons, KLINGON_UNIT_STRENGTH);

  return sector;
}

function assertGalaxySizeMatchesQuadrants(state: GameState): void {
  const expectedCellCount = state.quadrantSize * state.quadrantSize;
  if (state.galaxy.length !== expectedCellCount) {
    throw new RangeError(
      `Galaxy cell count mismatch: expected ${expectedCellCount}, got ${state.galaxy.length}`
    );
  }
}

function courseComponent(c2: number): number {
  const c3 =
    167 * c2 -
    26 * (c2 - 30) * (c2 > 30 ? 1 : 0) -
    38 * (c2 - 45) * (c2 > 45 ? 1 : 0) -
    58 * (c2 - 60) * (c2 > 60 ? 1 : 0);

  return truncDiv(c3 + 5, 10);
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

/**
 * Converts a compass course in degrees into the original game's movement vector.
 *
 * Courses are normalized into 0..359, including negative inputs. The resulting
 * vector intentionally preserves the Apple Integer BASIC approximation rather
 * than using trigonometric unit vectors, including integer-only component math.
 */
export function courseToVector(course: number): CourseVector {
  const normalized = normalizeCourse(course);
  const c1 = truncDiv(normalized, 90);
  let c2 = modCompat(normalized, 90);

  if (modCompat(c1, 2) !== 0) {
    c2 = 90 - c2;
  }

  let dx = courseComponent(c2);
  c2 = 90 - c2;
  let dy = courseComponent(c2);

  if (modCompat(c1, 3) === 0) {
    dy = -dy;
  }

  if (c1 > 1) {
    dx = -dx;
  }

  return {
    dx: normalizeSignedZero(dx),
    dy: normalizeSignedZero(dy)
  };
}

/**
 * Moves the ship through sector space and wraps through quadrants as needed.
 *
 * This function uses `state.sectorSize` and `state.quadrantSize`, validates that
 * the galaxy backing array matches `quadrantSize^2`, and rebuilds the local
 * sector when movement crosses into a different quadrant.
 *
 * @throws {RangeError} When `steps` is invalid or the galaxy shape is inconsistent.
 */
export function stepMovement(state: GameState, vector: CourseVector, steps: number): GameState {
  if (!Number.isInteger(steps) || steps < 0) {
    throw new RangeError(`Invalid movement steps: ${steps}`);
  }

  assertGalaxySizeMatchesQuadrants(state);

  if (steps === 0) {
    return state;
  }

  let quadrantRow = state.position.quadrant.row;
  let quadrantCol = state.position.quadrant.col;
  let sectorRow = state.position.sector.row;
  let sectorCol = state.position.sector.col;

  let accX = 0;
  let accY = 0;

  const xStep = Math.sign(vector.dx);
  const yStep = Math.sign(vector.dy);

  for (let i = 0; i < steps; i += 1) {
    accX += Math.abs(vector.dx);
    if (xStep !== 0 && accX >= 1000) {
      sectorCol += xStep;
      accX -= 1000;
    }

    accY += Math.abs(vector.dy);
    if (yStep !== 0 && accY >= 1000) {
      sectorRow += yStep;
      accY -= 1000;
    }

    if (sectorRow < 1) {
      sectorRow = state.sectorSize;
      quadrantRow = wrap1ToQuadrant(quadrantRow - 1, state.quadrantSize);
    } else if (sectorRow > state.sectorSize) {
      sectorRow = 1;
      quadrantRow = wrap1ToQuadrant(quadrantRow + 1, state.quadrantSize);
    }

    if (sectorCol < 1) {
      sectorCol = state.sectorSize;
      quadrantCol = wrap1ToQuadrant(quadrantCol - 1, state.quadrantSize);
    } else if (sectorCol > state.sectorSize) {
      sectorCol = 1;
      quadrantCol = wrap1ToQuadrant(quadrantCol + 1, state.quadrantSize);
    }
  }

  const oldQuadrantIndex = state.position.quadrantIndex;
  const oldSectorIndex = state.position.sectorIndex;
  const nextQuadrantIndex = coordToIndex1Based(quadrantRow, quadrantCol, state.quadrantSize);
  const nextSectorIndex = coordToIndex1Based(sectorRow, sectorCol, state.sectorSize);

  let nextSector = state.sector;
  if (nextQuadrantIndex !== oldQuadrantIndex) {
    nextSector = buildSectorFromQuadrantEncoding(
      state.galaxy[nextQuadrantIndex - 1],
      nextSectorIndex,
      state.sectorSize
    );
  } else {
    nextSector = [...state.sector];
    if (oldSectorIndex !== nextSectorIndex) {
      nextSector[oldSectorIndex - 1] = EMPTY_CELL;
    }
    nextSector[nextSectorIndex - 1] = SHIP_CELL;
  }

  return {
    ...state,
    sector: nextSector,
    position: {
      quadrantIndex: nextQuadrantIndex,
      quadrant: { row: quadrantRow, col: quadrantCol },
      sectorIndex: nextSectorIndex,
      sector: { row: sectorRow, col: sectorCol }
    }
  };
}

/**
 * Advances mission time and applies per-tick ship energy recharge and shield drift.
 *
 * Shield energy gradually approaches the configured shield percentage target and
 * is clamped to the current available ship energy.
 *
 * @throws {RangeError} When `ticks` is negative or not an integer.
 */
export function advanceTime(state: GameState, ticks: number): GameState {
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new RangeError(`Invalid ticks: ${ticks}`);
  }

  if (ticks === 0) {
    return state;
  }

  let energy = state.ship.energy;
  let shieldEnergy = state.ship.shieldEnergy;

  for (let i = 0; i < ticks; i += 1) {
    energy = Math.min(energy + 50, state.ship.energyMax);

    const shieldTarget = truncDiv(energy * state.ship.shieldsPercent, 100);
    shieldEnergy += truncDiv(shieldTarget - shieldEnergy, 4);
    shieldEnergy = Math.max(0, Math.min(shieldEnergy, energy));
  }

  const totalTicks = state.clock.ticks + ticks;
  const stardateDelta = truncDiv(totalTicks, 100);
  const nextTicks = modCompat(totalTicks, 100);

  return {
    ...state,
    clock: {
      stardate: state.clock.stardate + stardateDelta,
      ticks: nextTicks
    },
    ship: {
      ...state.ship,
      energy,
      shieldEnergy
    }
  };
}

/**
 * Sets the target shield percentage and immediately recalculates shield energy.
 *
 * @throws {RangeError} When `targetPercent` is outside the inclusive range 0..100.
 */
export function setShieldsPercent(state: GameState, targetPercent: number): GameState {
  if (!Number.isInteger(targetPercent) || targetPercent < 0 || targetPercent > 100) {
    throw new RangeError(`Invalid shield percent: ${targetPercent}`);
  }

  const shieldEnergy = Math.min(
    state.ship.energy,
    truncDiv(state.ship.energy * targetPercent, 100)
  );

  return {
    ...state,
    ship: {
      ...state.ship,
      shieldsPercent: targetPercent,
      shieldEnergy
    }
  };
}

/**
 * Applies a complete ion or warp navigation command.
 *
 * The command validates inputs, charges the mode-specific energy cost, moves the
 * ship, and advances time. Warp currently moves the requested distance but costs
 * cubic energy and advances a fixed ten ticks.
 *
 * @throws {RangeError} When inputs are invalid or energy is insufficient.
 */
export function navigate(state: GameState, input: NavigateInput): GameState {
  if (!Number.isFinite(input.course)) {
    throw new RangeError(`Invalid navigation course: ${input.course}`);
  }

  if (!Number.isInteger(input.value) || input.value < 1) {
    throw new RangeError(`Invalid navigation value: ${input.value}`);
  }

  const vector = courseToVector(input.course);

  const energyCost =
    input.mode === "ion" ? 20 * (1 + input.value) : 12 * input.value * input.value * input.value;

  if (state.ship.energy < energyCost) {
    throw new RangeError("Not enough energy");
  }

  const withEnergyCost: GameState = {
    ...state,
    ship: {
      ...state.ship,
      energy: state.ship.energy - energyCost
    }
  };

  const movementSteps = input.mode === "ion" ? input.value : input.value;
  const moved = stepMovement(withEnergyCost, vector, movementSteps);

  const timeTicks = input.mode === "ion" ? input.value : 10;
  return advanceTime(moved, timeTicks);
}
