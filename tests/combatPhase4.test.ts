import { describe, expect, it } from "vitest";
import { SeededRng } from "../src/compat/basicCompat";
import { coordToIndex1Based } from "../src/state/gameState";
import { enemyTurn, firePhasers, fireTorpedo } from "../src/state";
import {
  makeStarbaseTorpedoFixture,
  makeTwoKlingonCombatFixture
} from "./helpers/fixtures";

describe("Phase 4 combat core", () => {
  it("phasers damage klingons and destroy weakened targets", () => {
    const fixture = makeTwoKlingonCombatFixture();
    const state = fixture.state;

    const result = firePhasers(state, 2000, new SeededRng(9));

    expect(result.kills).toBe(1);
    expect(result.state.ship.energy).toBe(3000);
    expect(result.state.counts.klingonsRemaining).toBe(1);

    const weakKlingonIndex = fixture.primaryTargetIndex;
    const strongKlingonIndex = fixture.secondaryTargetIndex;

    expect(result.state.sector[weakKlingonIndex - 1]).toBe(0);
    expect(result.state.sector[strongKlingonIndex - 1]).toBeLessThan(-1);

    const currentQuadrantEncoded = result.state.galaxy[result.state.position.quadrantIndex - 1];
    expect(currentQuadrantEncoded).toBe(100);
  });

  it("phaser distance uses the state's sector size", () => {
    const state = makeTwoKlingonCombatFixture().state;
    const shipIndex = coordToIndex1Based(1, 1, 3);
    const klingonIndex = coordToIndex1Based(3, 3, 3);
    const sector = Array.from({ length: 9 }, () => 0);
    sector[shipIndex - 1] = 1;
    sector[klingonIndex - 1] = -8;

    const result = firePhasers(
      {
        ...state,
        sectorSize: 3,
        sector,
        position: {
          ...state.position,
          sectorIndex: shipIndex,
          sector: { row: 1, col: 1 }
        },
        counts: {
          ...state.counts,
          initialKlingons: 1,
          klingonsRemaining: 1
        }
      },
      8,
      new SeededRng(1)
    );

    expect(result.kills).toBe(0);
    expect(result.state.sector[klingonIndex - 1]).toBeLessThan(0);
  });

  it("torpedo trajectory hits klingons on course", () => {
    const fixture = makeTwoKlingonCombatFixture();
    const state = fixture.state;

    const result = fireTorpedo(state, 90);

    expect(result.hit).toBe(true);
    expect(result.reason).toBe("klingon");
    expect(result.state.ship.torpedoes).toBe(9);
    expect(result.state.counts.klingonsRemaining).toBe(1);

    const weakKlingonIndex = fixture.primaryTargetIndex;
    expect(result.state.sector[weakKlingonIndex - 1]).toBe(0);
  });

  it("torpedo trajectory misses cleanly when no target intersects", () => {
    const { state } = makeTwoKlingonCombatFixture();

    const result = fireTorpedo(state, 45);

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("miss");
    expect(result.state.ship.torpedoes).toBe(9);
    expect(result.state.counts.klingonsRemaining).toBe(2);
  });

  it("torpedoing a starbase clears sector, decrements bases, and updates current quadrant encoding", () => {
    const fixture = makeStarbaseTorpedoFixture();
    const state = fixture.state;

    const result = fireTorpedo(state, 90);

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("starbase");
    expect(result.state.ship.torpedoes).toBe(9);

    const targetedBaseIndex = fixture.primaryTargetIndex;
    expect(result.state.sector[targetedBaseIndex - 1]).toBe(0);
    expect(result.state.sector.filter((cell) => cell === 2)).toHaveLength(1);

    expect(result.state.counts.basesRemaining).toBe(1);

    const currentQuadrantEncoded = result.state.galaxy[result.state.position.quadrantIndex - 1];
    expect(currentQuadrantEncoded).toBe(10);
  });

  it("torpedoing a starbase does not underflow base counts or quadrant encoding", () => {
    const state = makeStarbaseTorpedoFixture().state;
    const currentQuadrantIndex = state.position.quadrantIndex - 1;

    state.counts.basesRemaining = 0;
    state.galaxy[currentQuadrantIndex] = 0;

    const result = fireTorpedo(state, 90);

    expect(result.reason).toBe("starbase");
    expect(result.state.counts.basesRemaining).toBe(0);
    expect(result.state.galaxy[currentQuadrantIndex]).toBe(0);
  });

  it("enemy fire deterministically reduces defensive resources", () => {
    const state = makeTwoKlingonCombatFixture().state;

    const a = enemyTurn(state, new SeededRng(33));
    const b = enemyTurn(state, new SeededRng(33));

    expect(a).toEqual(b);
    expect(a.ship.shieldEnergy).toBeLessThan(state.ship.shieldEnergy);
    expect(a.ship.energy).toBeLessThanOrEqual(state.ship.energy);
  });

  it("enemy turn movement keeps sector valid and preserves entity counts", () => {
    const state = makeTwoKlingonCombatFixture().state;

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
