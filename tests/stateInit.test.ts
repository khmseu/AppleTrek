import { describe, expect, it } from "vitest";
import {
  createInitialGameState,
  coordToIndex1Based,
  indexToCoord1Based
} from "../src/state/gameState";

describe("1-based 8x8 index helpers", () => {
  it("maps corners correctly", () => {
    expect(coordToIndex1Based(1, 1)).toBe(1);
    expect(coordToIndex1Based(1, 8)).toBe(8);
    expect(coordToIndex1Based(8, 1)).toBe(57);
    expect(coordToIndex1Based(8, 8)).toBe(64);

    expect(indexToCoord1Based(1)).toEqual({ row: 1, col: 1 });
    expect(indexToCoord1Based(8)).toEqual({ row: 1, col: 8 });
    expect(indexToCoord1Based(57)).toEqual({ row: 8, col: 1 });
    expect(indexToCoord1Based(64)).toEqual({ row: 8, col: 8 });
  });

  it("roundtrips all indices on an 8x8 grid", () => {
    for (let index = 1; index <= 64; index += 1) {
      const coord = indexToCoord1Based(index);
      expect(coordToIndex1Based(coord.row, coord.col)).toBe(index);
    }
  });

  it("throws RangeError for invalid 1-based inputs", () => {
    expect(() => coordToIndex1Based(0, 1)).toThrow(RangeError);
    expect(() => coordToIndex1Based(1, 0)).toThrow(RangeError);
    expect(() => coordToIndex1Based(9, 1)).toThrow(RangeError);
    expect(() => coordToIndex1Based(1, 9)).toThrow(RangeError);
    expect(() => coordToIndex1Based(1.5, 1)).toThrow(RangeError);
    expect(() => indexToCoord1Based(0)).toThrow(RangeError);
    expect(() => indexToCoord1Based(65)).toThrow(RangeError);
    expect(() => indexToCoord1Based(3.2)).toThrow(RangeError);
  });
});

describe("createInitialGameState", () => {
  it("produces the same state for the same seed", () => {
    const a = createInitialGameState(1701);
    const b = createInitialGameState(1701);

    expect(a).toEqual(b);
  });

  it("keeps startup values and randomized totals in expected ranges", () => {
    const state = createInitialGameState(42);

    expect(state.mission.startStardate).toBe(3424);
    expect(state.mission.endStardate).toBe(3427);
    expect(state.clock.stardate).toBe(3424);
    expect(state.clock.ticks).toBe(0);

    expect(state.ship.energyMax).toBe(5000);
    expect(state.ship.energy).toBe(5000);
    expect(state.ship.shieldsPercent).toBe(50);
    expect(state.ship.shieldEnergy).toBe(2500);
    expect(state.ship.torpedoesMax).toBe(10);
    expect(state.ship.torpedoes).toBe(10);

    expect(state.counts.initialBases).toBeGreaterThanOrEqual(2);
    expect(state.counts.initialBases).toBeLessThanOrEqual(4);
    expect(state.counts.initialKlingons).toBeGreaterThanOrEqual(25);
    expect(state.counts.initialKlingons).toBeLessThanOrEqual(53);

    expect(state.counts.basesRemaining).toBe(state.counts.initialBases);
    expect(state.counts.klingonsRemaining).toBe(state.counts.initialKlingons);

    expect(state.galaxy.length).toBe(64);
    expect(state.sector.length).toBe(64);
    expect(state.position.quadrantIndex).toBeGreaterThanOrEqual(1);
    expect(state.position.quadrantIndex).toBeLessThanOrEqual(64);
    expect(state.position.sectorIndex).toBeGreaterThanOrEqual(1);
    expect(state.position.sectorIndex).toBeLessThanOrEqual(64);

    const quadrantEntry = state.galaxy[state.position.quadrantIndex - 1];
    expect(quadrantEntry).toBeGreaterThan(0);
  });

  it("keeps galaxy and sector distributions internally consistent", () => {
    const state = createInitialGameState(999);

    const decodedGalaxy = state.galaxy.map((entry) => {
      const encoded = Math.abs(entry);
      const klingons = Math.trunc(encoded / 100);
      const bases = Math.trunc(encoded / 10) % 10;
      const stars = encoded % 10;
      return { klingons, bases, stars };
    });

    const klingonsFromGalaxy = decodedGalaxy.reduce((sum, q) => sum + q.klingons, 0);
    const basesFromGalaxy = decodedGalaxy.reduce((sum, q) => sum + q.bases, 0);

    expect(klingonsFromGalaxy).toBe(state.counts.initialKlingons);
    expect(basesFromGalaxy).toBe(state.counts.initialBases);

    for (const q of decodedGalaxy) {
      expect(q.stars).toBeGreaterThanOrEqual(2);
      expect(q.stars).toBeLessThanOrEqual(8);
      expect(q.klingons).toBeLessThanOrEqual(8);
      expect(q.bases).toBeLessThanOrEqual(9);
    }

    const currentQuadrant = decodedGalaxy[state.position.quadrantIndex - 1];
    const klingonsInSector = state.sector.filter((cell) => cell < 0).length;
    const basesInSector = state.sector.filter((cell) => cell === 2).length;
    const starsInSector = state.sector.filter((cell) => cell === 3).length;

    expect(klingonsInSector).toBe(currentQuadrant.klingons);
    expect(basesInSector).toBe(currentQuadrant.bases);
    expect(starsInSector).toBe(currentQuadrant.stars);
  });

  it("marks the ship at startup sector index and preserves entity counts", () => {
    const state = createInitialGameState(1701);

    const shipCellValue = 1;
    expect(state.sector[state.position.sectorIndex - 1]).toBe(shipCellValue);
    expect(state.sector.filter((cell) => cell === shipCellValue)).toHaveLength(1);

    const currentQuadrantEncoded = Math.abs(state.galaxy[state.position.quadrantIndex - 1]);
    const expectedKlingons = Math.trunc(currentQuadrantEncoded / 100);
    const expectedBases = Math.trunc(currentQuadrantEncoded / 10) % 10;
    const expectedStars = currentQuadrantEncoded % 10;

    const klingonsInSector = state.sector.filter((cell) => cell < 0).length;
    const basesInSector = state.sector.filter((cell) => cell === 2).length;
    const starsInSector = state.sector.filter((cell) => cell === 3).length;
    const emptyCells = state.sector.filter((cell) => cell === 0).length;

    expect(klingonsInSector).toBe(expectedKlingons);
    expect(basesInSector).toBe(expectedBases);
    expect(starsInSector).toBe(expectedStars);
    expect(emptyCells + klingonsInSector + basesInSector + starsInSector + 1).toBe(64);
  });
});