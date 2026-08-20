import { describe, expect, it } from "vitest";
import {
  coordToDefaultQuadrantIndex1Based,
  coordToDefaultSectorIndex1Based,
  coordToIndex1Based,
  type GameState
} from "../src/state/gameState";
import {
  advanceTime,
  courseToVector,
  navigate,
  setShieldsPercent,
  stepMovement
} from "../src/state/navigation";
import { makeTestState } from "./helpers/testState";

describe("courseToVector", () => {
  it("matches known cardinal approximations", () => {
    expect(courseToVector(0)).toEqual({ dx: 0.5, dy: -1002.5 });
    expect(courseToVector(90)).toEqual({ dx: 1002.5, dy: 0.5 });
    expect(courseToVector(180)).toEqual({ dx: -0.5, dy: 1002.5 });
    expect(courseToVector(270)).toEqual({ dx: -1002.5, dy: -0.5 });
  });

  it("keeps quadrant sign behavior", () => {
    const q1 = courseToVector(10);
    const q2 = courseToVector(100);
    const q3 = courseToVector(190);
    const q4 = courseToVector(280);

    expect(q1.dx).toBeGreaterThan(0);
    expect(q1.dy).toBeLessThan(0);

    expect(q2.dx).toBeGreaterThan(0);
    expect(q2.dy).toBeGreaterThan(0);

    expect(q3.dx).toBeLessThan(0);
    expect(q3.dy).toBeGreaterThan(0);

    expect(q4.dx).toBeLessThan(0);
    expect(q4.dy).toBeLessThan(0);
  });

  it("normalizes negative courses with signed modulo semantics", () => {
    expect(courseToVector(-90)).toEqual(courseToVector(270));
    expect(courseToVector(-10)).toEqual(courseToVector(350));
  });
});

describe("stepMovement", () => {
  it("moves within sector bounds without quadrant change", () => {
    const state = makeTestState({
      position: {
        quadrantIndex: 28,
        quadrant: { row: 4, col: 4 },
        sectorIndex: 37,
        sector: { row: 5, col: 5 }
      }
    });

    const moved = stepMovement(state, courseToVector(90), 2);

    expect(moved.position.quadrant).toEqual({ row: 4, col: 4 });
    expect(moved.position.sector).toEqual({ row: 5, col: 7 });
  });

  it("transitions and wraps quadrant coordinates on sector boundary", () => {
    const state = makeTestState({
      position: {
        quadrantIndex: 64,
        quadrant: { row: 8, col: 8 },
        sectorIndex: 61,
        sector: { row: 8, col: 5 }
      }
    });

    const moved = stepMovement(state, courseToVector(180), 1);

    expect(moved.position.quadrant).toEqual({ row: 1, col: 8 });
    expect(moved.position.sector).toEqual({ row: 1, col: 5 });
  });

  it("wraps each cardinal edge using independent sector/quadrant size semantics", () => {
    const cases = [
      {
        name: "north edge",
        startQuadrant: { row: 1, col: 4 },
        startSector: { row: 1, col: 4 },
        course: 0,
        expectedQuadrant: { row: 8, col: 4 },
        expectedSector: { row: 8, col: 4 }
      },
      {
        name: "east edge",
        startQuadrant: { row: 4, col: 8 },
        startSector: { row: 4, col: 8 },
        course: 90,
        expectedQuadrant: { row: 4, col: 1 },
        expectedSector: { row: 4, col: 1 }
      },
      {
        name: "south edge",
        startQuadrant: { row: 8, col: 4 },
        startSector: { row: 8, col: 4 },
        course: 180,
        expectedQuadrant: { row: 1, col: 4 },
        expectedSector: { row: 1, col: 4 }
      },
      {
        name: "west edge",
        startQuadrant: { row: 4, col: 1 },
        startSector: { row: 4, col: 1 },
        course: 270,
        expectedQuadrant: { row: 4, col: 8 },
        expectedSector: { row: 4, col: 8 }
      }
    ] as const;

    for (const testCase of cases) {
      const state = makeTestState({
        position: {
          quadrantIndex: coordToDefaultQuadrantIndex1Based(
            testCase.startQuadrant.row,
            testCase.startQuadrant.col
          ),
          quadrant: testCase.startQuadrant,
          sectorIndex: coordToDefaultSectorIndex1Based(
            testCase.startSector.row,
            testCase.startSector.col
          ),
          sector: testCase.startSector
        }
      });

      const moved = stepMovement(state, courseToVector(testCase.course), 1);

      expect(moved.position.quadrant, testCase.name).toEqual(testCase.expectedQuadrant);
      expect(moved.position.sector, testCase.name).toEqual(testCase.expectedSector);
      expect(moved.position.quadrantIndex, testCase.name).toBe(
        coordToDefaultQuadrantIndex1Based(testCase.expectedQuadrant.row, testCase.expectedQuadrant.col)
      );
      expect(moved.position.sectorIndex, testCase.name).toBe(
        coordToDefaultSectorIndex1Based(testCase.expectedSector.row, testCase.expectedSector.col)
      );
    }
  });

  it("wraps corners and keeps next indices aligned", () => {
    const state = makeTestState({
      position: {
        quadrantIndex: coordToDefaultQuadrantIndex1Based(8, 8),
        quadrant: { row: 8, col: 8 },
        sectorIndex: coordToDefaultSectorIndex1Based(8, 8),
        sector: { row: 8, col: 8 }
      }
    });

    const moved = stepMovement(state, courseToVector(135), 2);

    expect(moved.position.quadrant).toEqual({ row: 1, col: 1 });
    expect(moved.position.sector).toEqual({ row: 1, col: 1 });
    expect(moved.position.quadrantIndex).toBe(coordToDefaultQuadrantIndex1Based(1, 1));
    expect(moved.position.sectorIndex).toBe(coordToDefaultSectorIndex1Based(1, 1));
  });

  it("uses GameState sector and quadrant sizes for movement wrapping", () => {
    const state = makeTestState({
      sectorSize: 3,
      quadrantSize: 5,
      galaxy: Array.from({ length: 25 }, () => 0),
      sector: Array.from({ length: 9 }, () => 0),
      position: {
        quadrantIndex: coordToIndex1Based(5, 5, 5),
        quadrant: { row: 5, col: 5 },
        sectorIndex: coordToIndex1Based(3, 3, 3),
        sector: { row: 3, col: 3 }
      }
    });

    const moved = stepMovement(state, courseToVector(90), 1);

    expect(moved.position.quadrant).toEqual({ row: 5, col: 1 });
    expect(moved.position.sector).toEqual({ row: 3, col: 1 });
    expect(moved.position.quadrantIndex).toBe(coordToIndex1Based(5, 1, 5));
    expect(moved.position.sectorIndex).toBe(coordToIndex1Based(3, 1, 3));
    expect(moved.sector).toHaveLength(9);
  });

  it("throws when galaxy length does not match quadrantSize squared", () => {
    const state = makeTestState({
      quadrantSize: 9,
      position: {
        quadrantIndex: coordToIndex1Based(9, 9, 9),
        quadrant: { row: 9, col: 9 },
        sectorIndex: coordToDefaultSectorIndex1Based(4, 8),
        sector: { row: 4, col: 8 }
      }
    });

    expect(() => stepMovement(state, courseToVector(90), 1)).toThrow(RangeError);
    expect(() => stepMovement(state, courseToVector(90), 1)).toThrow(/Galaxy cell count mismatch/);
  });
});

describe("advanceTime", () => {
  it("increments stardate and rolls over ticks at 100", () => {
    const state = makeTestState({ clock: { stardate: 3424, ticks: 95 } });

    const next = advanceTime(state, 15);

    expect(next.clock.stardate).toBe(3425);
    expect(next.clock.ticks).toBe(10);
  });

  it("applies baseline recharge and shield drift toward target", () => {
    const state = makeTestState({
      ship: {
        energy: 4900,
        energyMax: 5000,
        shieldEnergy: 2000,
        shieldsPercent: 50,
        torpedoes: 10,
        torpedoesMax: 10
      }
    });

    const next = advanceTime(state, 2);

    expect(next.ship.energy).toBe(5000);
    expect(next.ship.shieldEnergy).toBe(2213);
  });
});

describe("phase 3 command handlers", () => {
  it("setShieldsPercent updates shield target energy deterministically", () => {
    const state = makeTestState({
      ship: {
        energy: 5000,
        energyMax: 5000,
        shieldEnergy: 2500,
        shieldsPercent: 50,
        torpedoes: 10,
        torpedoesMax: 10
      }
    });

    const next = setShieldsPercent(state, 30);

    expect(next.ship.shieldsPercent).toBe(30);
    expect(next.ship.shieldEnergy).toBe(1500);
  });

  it("navigate applies ion energy cost, movement, and time progression", () => {
    const state = makeTestState({
      ship: {
        energy: 4000,
        energyMax: 5000,
        shieldEnergy: 2000,
        shieldsPercent: 50,
        torpedoes: 10,
        torpedoesMax: 10
      },
      position: {
        quadrantIndex: 28,
        quadrant: { row: 4, col: 4 },
        sectorIndex: 37,
        sector: { row: 5, col: 5 }
      },
      clock: {
        stardate: 3424,
        ticks: 0
      }
    });

    const next = navigate(state, { mode: "ion", course: 90, value: 3 });

    expect(next.ship.energy).toBe(4070);
    expect(next.position.sector).toEqual({ row: 5, col: 8 });
    expect(next.clock.stardate).toBe(3424);
    expect(next.clock.ticks).toBe(3);
  });

  it("navigate applies warp cubic energy cost deterministically", () => {
    const state = makeTestState({
      ship: {
        energy: 3000,
        energyMax: 5000,
        shieldEnergy: 1500,
        shieldsPercent: 50,
        torpedoes: 10,
        torpedoesMax: 10
      },
      position: {
        quadrantIndex: 28,
        quadrant: { row: 4, col: 4 },
        sectorIndex: 37,
        sector: { row: 5, col: 5 }
      },
      clock: {
        stardate: 3424,
        ticks: 0
      }
    });

    const next = navigate(state, { mode: "warp", course: 90, value: 2 });

    expect(next.ship.energy).toBe(3404);
    expect(next.clock.stardate).toBe(3424);
    expect(next.clock.ticks).toBe(10);
  });

  it("rejects invalid course inputs in navigate", () => {
    const state = makeTestState();

    expect(() => navigate(state, { mode: "ion", course: Number.NaN, value: 1 })).toThrow(
      "Invalid navigation course"
    );
    expect(() => navigate(state, { mode: "ion", course: Number.POSITIVE_INFINITY, value: 1 })).toThrow(
      "Invalid navigation course"
    );
    expect(() => navigate(state, { mode: "ion", course: Number.NEGATIVE_INFINITY, value: 1 })).toThrow(
      "Invalid navigation course"
    );
  });

  it("throws for invalid value and insufficient energy", () => {
    const state = makeTestState({
      ship: {
        energy: 10,
        energyMax: 5000,
        shieldEnergy: 5,
        shieldsPercent: 50,
        torpedoes: 10,
        torpedoesMax: 10
      }
    });

    expect(() => navigate(state, { mode: "ion", course: 90, value: 0 })).toThrow(
      "Invalid navigation value"
    );
    expect(() => navigate(state, { mode: "warp", course: 90, value: 2 })).toThrow(
      "Not enough energy"
    );
  });

  it("rebuilds destination sector coherently on quadrant transitions", () => {
    const start = makeTestState();
    const destinationQuadrantIndex = coordToDefaultQuadrantIndex1Based(4, 1);
    const destinationEncoded = 312;
    const galaxy = [...start.galaxy];
    galaxy[destinationQuadrantIndex - 1] = destinationEncoded;

    const state = makeTestState({
      galaxy,
      position: {
        quadrantIndex: coordToDefaultQuadrantIndex1Based(4, 8),
        quadrant: { row: 4, col: 8 },
        sectorIndex: coordToDefaultSectorIndex1Based(4, 8),
        sector: { row: 4, col: 8 }
      }
    });

    const moved = stepMovement(state, courseToVector(90), 1);

    expect(moved.position.quadrant).toEqual({ row: 4, col: 1 });
    expect(moved.position.sector).toEqual({ row: 4, col: 1 });

    const shipCells = moved.sector.filter((cell) => cell === 1).length;
    const baseCells = moved.sector.filter((cell) => cell === 2).length;
    const starCells = moved.sector.filter((cell) => cell === 3).length;
    const klingonCells = moved.sector.filter((cell) => cell < 0).length;

    expect(shipCells).toBe(1);
    expect(moved.sector[moved.position.sectorIndex - 1]).toBe(1);
    expect(baseCells).toBe(1);
    expect(starCells).toBe(2);
    expect(klingonCells).toBe(3);
    expect(shipCells + baseCells + starCells + klingonCells).toBe(7);
  });
});
