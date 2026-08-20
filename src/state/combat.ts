import { SeededRng, truncDiv } from "../compat/basicCompat";
import { GRID_SIZE, coordToIndex1Based, indexToCoord1Based, type GameState } from "./gameState";
import { EMPTY_CELL, STARBASE_CELL, STAR_CELL, isKlingonCell } from "./cells";
import { courseToVector } from "./navigation";

export interface PhaserResult {
  state: GameState;
  kills: number;
}

export interface TorpedoResult {
  state: GameState;
  hit: boolean;
  reason: "klingon" | "star" | "starbase" | "miss";
}

function clampToGrid(value: number): boolean {
  return value >= 1 && value <= GRID_SIZE;
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

function distanceBetween(a: number, b: number): number {
  const aa = indexToCoord1Based(a);
  const bb = indexToCoord1Based(b);
  return Math.max(1, Math.abs(aa.row - bb.row) + Math.abs(aa.col - bb.col));
}

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
      const distance = distanceBetween(state.position.sectorIndex, index);
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

    if (!clampToGrid(row) || !clampToGrid(col)) {
      return { state: nextState, hit: false, reason: "miss" };
    }

    const index = coordToIndex1Based(row, col);
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
    const currentCoord = indexToCoord1Based(currentIndex);

    const moveRoll = rng.nextInt(0, 99);
    if (moveRoll < 40) {
      const dRow = rng.nextInt(-1, 1);
      const dCol = rng.nextInt(-1, 1);
      const targetRow = currentCoord.row + dRow;
      const targetCol = currentCoord.col + dCol;

      if ((dRow !== 0 || dCol !== 0) && clampToGrid(targetRow) && clampToGrid(targetCol)) {
        const targetIndex = coordToIndex1Based(targetRow, targetCol);
        if (sector[targetIndex - 1] === EMPTY_CELL && targetIndex !== shipIndex) {
          sector[targetIndex - 1] = sector[currentIndex - 1];
          sector[currentIndex - 1] = EMPTY_CELL;
          currentIndex = targetIndex;
        }
      }
    }

    const klingonCoord = indexToCoord1Based(currentIndex);
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