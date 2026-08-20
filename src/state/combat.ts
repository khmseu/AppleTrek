import { SeededRng, truncDiv } from "../compat/basicCompat";
import {
  coordToIndex1Based,
  indexToCoord1Based,
  type GameState
} from "./gameState";
import { EMPTY_CELL, STARBASE_CELL, STAR_CELL, isKlingonCell } from "./cells";
import { courseToVector } from "./navigation";

/** Result of a phaser volley, including the updated state and kill count. */
export interface PhaserResult {
  state: GameState;
  /** Number of Klingons destroyed by this volley. */
  kills: number;
}

/** Result of a torpedo shot and the first obstacle or target it encountered. */
export interface TorpedoResult {
  state: GameState;
  /** True only when the torpedo destroys a Klingon. */
  hit: boolean;
  /** Collision outcome, or `miss` when the torpedo leaves the sector. */
  reason: "klingon" | "star" | "starbase" | "miss";
}

function clampToGrid(value: number, gridSize: number): boolean {
  return value >= 1 && value <= gridSize;
}

function updateCurrentQuadrantEncoding(state: GameState, klingonLosses: number, baseLosses: number): GameState {
  if (klingonLosses <= 0 && baseLosses <= 0) {
    return state;
  }

  const galaxy = [...state.galaxy];
  const quadrantOffset = state.position.quadrantIndex - 1;
  const current = galaxy[quadrantOffset];
  const sign = current < 0 ? -1 : 1;
  const encoded = Math.abs(current);

  const klingons = truncDiv(encoded, 100);
  const bases = truncDiv(encoded, 10) % 10;
  const stars = encoded % 10;

  const nextKlingons = Math.max(0, klingons - Math.max(0, klingonLosses));
  const nextBases = Math.max(0, bases - Math.max(0, baseLosses));
  const nextEncoded = nextKlingons * 100 + nextBases * 10 + stars;

  galaxy[quadrantOffset] = sign * nextEncoded;
  return {
    ...state,
    galaxy
  };
}

function applyKlingonKills(state: GameState, kills: number): GameState {
  if (kills <= 0) {
    return state;
  }

  const withCounts: GameState = {
    ...state,
    counts: {
      ...state.counts,
      klingonsRemaining: Math.max(0, state.counts.klingonsRemaining - kills)
    }
  };

  return updateCurrentQuadrantEncoding(withCounts, kills, 0);
}

function findKlingonIndices(sector: number[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < sector.length; i += 1) {
    if (isKlingonCell(sector[i])) {
      indices.push(i + 1);
    }
  }
  return indices;
}

function distanceBetween(a: number, b: number, gridSize: number): number {
  const aa = indexToCoord1Based(a, gridSize);
  const bb = indexToCoord1Based(b, gridSize);
  return Math.max(1, Math.abs(aa.row - bb.row) + Math.abs(aa.col - bb.col));
}

/**
 * Fires phasers by splitting spent energy across all visible Klingons.
 *
 * Damage falls off with Manhattan distance and includes deterministic variance
 * from the supplied RNG. Destroyed Klingons are removed from the sector, global
 * counts are decremented, and the current quadrant encoding is updated.
 *
 * @throws {RangeError} When energy is invalid or exceeds current ship energy.
 */
export function firePhasers(state: GameState, energyToSpend: number, rng: SeededRng): PhaserResult {
  if (!Number.isInteger(energyToSpend) || energyToSpend <= 0) {
    throw new RangeError(`Invalid phaser energy: ${energyToSpend}`);
  }

  if (energyToSpend > state.ship.energy) {
    throw new RangeError("Not enough energy");
  }

  const klingons = findKlingonIndices(state.sector);
  const nextSector = [...state.sector];
  let kills = 0;

  if (klingons.length > 0) {
    const share = Math.max(1, truncDiv(energyToSpend, klingons.length));

    for (const index of klingons) {
      const distance = distanceBetween(state.position.sectorIndex, index, state.sectorSize);
      const variance = rng.nextInt(0, share);
      const damage = Math.max(1, truncDiv(share + variance, distance));
      const currentStrength = -nextSector[index - 1];
      const nextStrength = currentStrength - damage;

      if (nextStrength <= 0) {
        nextSector[index - 1] = EMPTY_CELL;
        kills += 1;
      } else {
        nextSector[index - 1] = -nextStrength;
      }
    }
  }

  const withSpentEnergy: GameState = {
    ...state,
    ship: {
      ...state.ship,
      energy: state.ship.energy - energyToSpend
    },
    sector: nextSector
  };

  return {
    state: applyKlingonKills(withSpentEnergy, kills),
    kills
  };
}

/**
 * Fires one torpedo along an approximated course vector until it hits or exits.
 *
 * The torpedo decrements ammunition before travel. Klingons are destroyed,
 * stars block the shot, starbases are removed and decremented, and misses occur
 * when the projectile leaves the current sector bounds.
 *
 * @throws {RangeError} When no torpedoes remain.
 */
export function fireTorpedo(state: GameState, course: number): TorpedoResult {
  if (state.ship.torpedoes <= 0) {
    throw new RangeError("No torpedoes remaining");
  }

  const vector = courseToVector(course);
  const xStep = Math.sign(vector.dx);
  const yStep = Math.sign(vector.dy);

  let row = state.position.sector.row;
  let col = state.position.sector.col;
  let accX = 0;
  let accY = 0;

  const nextState: GameState = {
    ...state,
    ship: {
      ...state.ship,
      torpedoes: state.ship.torpedoes - 1
    },
    sector: [...state.sector]
  };

  for (let step = 0; step < 256; step += 1) {
    accX += Math.abs(vector.dx);
    if (xStep !== 0 && accX >= 1000) {
      col += xStep;
      accX -= 1000;
    }

    accY += Math.abs(vector.dy);
    if (yStep !== 0 && accY >= 1000) {
      row += yStep;
      accY -= 1000;
    }

    if (!clampToGrid(row, state.sectorSize) || !clampToGrid(col, state.sectorSize)) {
      return { state: nextState, hit: false, reason: "miss" };
    }

    const index = coordToIndex1Based(row, col, state.sectorSize);
    const cell = nextState.sector[index - 1];

    if (isKlingonCell(cell)) {
      nextState.sector[index - 1] = EMPTY_CELL;
      return {
        state: applyKlingonKills(nextState, 1),
        hit: true,
        reason: "klingon"
      };
    }

    if (cell === STAR_CELL) {
      return { state: nextState, hit: false, reason: "star" };
    }

    if (cell === STARBASE_CELL) {
      nextState.sector[index - 1] = EMPTY_CELL;
      const withCounts: GameState = {
        ...nextState,
        counts: {
          ...nextState.counts,
          basesRemaining: Math.max(0, nextState.counts.basesRemaining - 1)
        }
      };

      return {
        state: updateCurrentQuadrantEncoding(withCounts, 0, 1),
        hit: false,
        reason: "starbase"
      };
    }
  }

  return { state: nextState, hit: false, reason: "miss" };
}

/**
 * Runs deterministic enemy movement and fire for all Klingons in the current sector.
 *
 * Each Klingon may move to an adjacent empty cell and then fires at the ship.
 * Shield damage is applied first; overflow drains ship energy.
 */
export function enemyTurn(state: GameState, rng: SeededRng): GameState {
  const sector = [...state.sector];
  const shipIndex = state.position.sectorIndex;
  const shipCoord = state.position.sector;
  const klingons = findKlingonIndices(sector);

  for (const index of klingons) {
    if (sector[index - 1] >= 0) {
      continue;
    }

    let currentIndex = index;
    const currentCoord = indexToCoord1Based(currentIndex, state.sectorSize);

    const moveRoll = rng.nextInt(0, 99);
    if (moveRoll < 40) {
      const dRow = rng.nextInt(-1, 1);
      const dCol = rng.nextInt(-1, 1);
      const targetRow = currentCoord.row + dRow;
      const targetCol = currentCoord.col + dCol;

      if (
        (dRow !== 0 || dCol !== 0) &&
        clampToGrid(targetRow, state.sectorSize) &&
        clampToGrid(targetCol, state.sectorSize)
      ) {
        const targetIndex = coordToIndex1Based(targetRow, targetCol, state.sectorSize);
        if (sector[targetIndex - 1] === EMPTY_CELL && targetIndex !== shipIndex) {
          sector[targetIndex - 1] = sector[currentIndex - 1];
          sector[currentIndex - 1] = EMPTY_CELL;
          currentIndex = targetIndex;
        }
      }
    }

    const klingonCoord = indexToCoord1Based(currentIndex, state.sectorSize);
    const distance =
      Math.max(1, Math.abs(klingonCoord.row - shipCoord.row) + Math.abs(klingonCoord.col - shipCoord.col));
    const shotPower = rng.nextInt(200, 500);
    const damage = Math.max(1, truncDiv(shotPower, distance));

    const currentShield = state.ship.shieldEnergy;
    if (currentShield >= damage) {
      state = {
        ...state,
        ship: {
          ...state.ship,
          shieldEnergy: currentShield - damage
        }
      };
    } else {
      const spill = damage - currentShield;
      state = {
        ...state,
        ship: {
          ...state.ship,
          shieldEnergy: 0,
          energy: Math.max(0, state.ship.energy - spill)
        }
      };
    }
  }

  return {
    ...state,
    sector
  };
}