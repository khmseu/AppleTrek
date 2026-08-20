import { describe, expect, it } from "vitest";
import { SeededRng } from "../src/compat/basicCompat";
import { evaluateMissionOutcome, runScriptedReplay } from "../src/state";
import { type GameState } from "../src/state/gameState";
import { createCommandSession, createOverlayViewModel, dispatchPrompt } from "../src/ui";
import { makeTestState } from "./helpers/testState";

describe("Phase 6 mission bulletin outcomes", () => {
  it("produces a successful mission bulletin when all klingons are eliminated", () => {
    const state = makeTestState({
      counts: {
        initialKlingons: 30,
        klingonsRemaining: 0,
        initialBases: 3,
        basesRemaining: 2
      },
      clock: {
        stardate: 3426,
        ticks: 10
      }
    });

    const bulletin = evaluateMissionOutcome(state);

    expect(bulletin?.outcome).toBe("success");
    expect(bulletin?.reason).toBe("klingons-eliminated");
    expect(bulletin?.klingonsRemaining).toBe(0);
  });

  it("produces a failed mission bulletin when mission deadline has passed", () => {
    const state = makeTestState({
      mission: {
        startStardate: 3424,
        endStardate: 3427
      },
      clock: {
        stardate: 3428,
        ticks: 0
      },
      counts: {
        initialKlingons: 30,
        klingonsRemaining: 5,
        initialBases: 3,
        basesRemaining: 2
      }
    });

    const bulletin = evaluateMissionOutcome(state);

    expect(bulletin?.outcome).toBe("failure");
    expect(bulletin?.reason).toBe("deadline-expired");
    expect(bulletin?.klingonsRemaining).toBe(5);
  });

  it("produces a failed mission bulletin when the ship is destroyed", () => {
    const state = makeTestState({
      ship: {
        energy: 0,
        energyMax: 5000,
        shieldEnergy: 0,
        shieldsPercent: 0,
        torpedoes: 5,
        torpedoesMax: 10
      },
      counts: {
        initialKlingons: 30,
        klingonsRemaining: 7,
        initialBases: 3,
        basesRemaining: 2
      }
    });

    const bulletin = evaluateMissionOutcome(state);

    expect(bulletin?.outcome).toBe("failure");
    expect(bulletin?.reason).toBe("ship-destroyed");
  });

  it("returns null while mission is ongoing and no terminal conditions are met", () => {
    const state = makeTestState({
      clock: {
        stardate: 3426,
        ticks: 99
      },
      mission: {
        startStardate: 3424,
        endStardate: 3427
      },
      ship: {
        energy: 1200,
        energyMax: 5000,
        shieldEnergy: 600,
        shieldsPercent: 12,
        torpedoes: 3,
        torpedoesMax: 10
      },
      counts: {
        initialKlingons: 30,
        klingonsRemaining: 4,
        initialBases: 3,
        basesRemaining: 1
      },
      endgame: {
        terminal: false,
        reason: "ongoing"
      }
    });

    expect(evaluateMissionOutcome(state)).toBeNull();
  });

  it("treats mission deadline boundary as active at exact end stardate tick 0", () => {
    const state = makeTestState({
      mission: {
        startStardate: 3424,
        endStardate: 3427
      },
      clock: {
        stardate: 3427,
        ticks: 0
      },
      counts: {
        initialKlingons: 30,
        klingonsRemaining: 6,
        initialBases: 3,
        basesRemaining: 2
      }
    });

    expect(evaluateMissionOutcome(state)).toBeNull();
  });

  it("expires mission when stardate is at deadline but ticks are greater than zero", () => {
    const state = makeTestState({
      mission: {
        startStardate: 3424,
        endStardate: 3427
      },
      clock: {
        stardate: 3427,
        ticks: 1
      },
      counts: {
        initialKlingons: 30,
        klingonsRemaining: 6,
        initialBases: 3,
        basesRemaining: 2
      }
    });

    const bulletin = evaluateMissionOutcome(state);
    expect(bulletin?.reason).toBe("deadline-expired");
  });

  it("honors explicit self-destruct reason precedence when klingons are already zero", () => {
    const state = makeTestState({
      counts: {
        initialKlingons: 30,
        klingonsRemaining: 0,
        initialBases: 3,
        basesRemaining: 2
      },
      endgame: {
        terminal: true,
        reason: "self-destruct"
      }
    });

    const bulletin = evaluateMissionOutcome(state);

    expect(bulletin?.outcome).toBe("failure");
    expect(bulletin?.reason).toBe("self-destruct");
  });
});

describe("Phase 6 self-destruct path", () => {
  it("transitions session state to terminal mission state via self-destruct command", () => {
    const session = createCommandSession(makeTestState());
    const afterDestruct = dispatchPrompt(session, "DESTRUCT", new SeededRng(99));

    expect(afterDestruct.state.endgame.terminal).toBe(true);
    expect(afterDestruct.state.endgame.reason).toBe("self-destruct");

    const bulletin = evaluateMissionOutcome(afterDestruct.state);
    expect(bulletin?.outcome).toBe("failure");
    expect(bulletin?.reason).toBe("self-destruct");

    expect(() => dispatchPrompt(afterDestruct, "ION 90 1", new SeededRng(99))).toThrow("Mission already ended");
    expect(() => dispatchPrompt(afterDestruct, "DESTRUCT", new SeededRng(99))).toThrow("Mission already ended");
  });

  it("latches terminal mission state after ordinary commands", () => {
    const session = createCommandSession(
      makeTestState({
        counts: {
          initialKlingons: 1,
          klingonsRemaining: 0,
          initialBases: 1,
          basesRemaining: 1
        }
      })
    );

    const afterCommand = dispatchPrompt(session, "SHIELDS 50", new SeededRng(99));

    expect(afterCommand.state.endgame.terminal).toBe(true);
    expect(afterCommand.state.endgame.reason).toBe("klingons-eliminated");
    expect(() => dispatchPrompt(afterCommand, "ION 90 1", new SeededRng(99))).toThrow(
      "Mission already ended"
    );
  });
});

describe("Phase 6 deterministic replay harness", () => {
  it("produces equal checksums for identical seed and command script", () => {
    const commands = ["ION 90 2", "SHIELDS 40", "PHASERS 500", "TORPEDO 90", "DESTRUCT"];

    const a = runScriptedReplay(1701, commands);
    const b = runScriptedReplay(1701, commands);

    expect(a.checksum).toBe(b.checksum);
    expect(a.snapshot).toBe(b.snapshot);
    expect(a.finalState).toEqual(b.finalState);
  });

  it("produces different checksums for different seeds with same script", () => {
    const commands = ["ION 90 2", "SHIELDS 40", "PHASERS 500", "TORPEDO 90", "DESTRUCT"];

    const a = runScriptedReplay(1701, commands);
    const b = runScriptedReplay(1702, commands);

    expect(a.checksum).not.toBe(b.checksum);
    expect(a.snapshot).not.toBe(b.snapshot);
  });

  it("produces different checksums for different scripts with same seed", () => {
    const scriptA = ["ION 90 2", "SHIELDS 40", "PHASERS 500", "TORPEDO 90", "DESTRUCT"];
    const scriptB = ["ION 90 2", "SHIELDS 41", "PHASERS 500", "TORPEDO 90", "DESTRUCT"];

    const a = runScriptedReplay(1701, scriptA);
    const b = runScriptedReplay(1701, scriptB);

    expect(a.checksum).not.toBe(b.checksum);
    expect(a.snapshot).not.toBe(b.snapshot);
  });
});

describe("Phase 6 overlay view-model hooks", () => {
  it("provides a stable view-model shape for key UI fields", () => {
    const state = makeTestState({
      ship: {
        energy: 4321,
        energyMax: 5000,
        shieldEnergy: 2100,
        shieldsPercent: 42,
        torpedoes: 7,
        torpedoesMax: 10
      },
      counts: {
        initialKlingons: 30,
        klingonsRemaining: 9,
        initialBases: 3,
        basesRemaining: 2
      },
      clock: {
        stardate: 3425,
        ticks: 67
      }
    });

    const vm = createOverlayViewModel(state);

    expect(Object.keys(vm)).toEqual([
      "stardate",
      "position",
      "resources",
      "counts",
      "mission",
      "terminal"
    ]);
    expect(Object.keys(vm.position)).toEqual(["quadrant", "sector"]);
    expect(Object.keys(vm.resources)).toEqual(["energy", "energyMax", "shieldEnergy", "shieldsPercent", "torpedoes", "torpedoesMax"]);
    expect(Object.keys(vm.counts)).toEqual(["klingonsRemaining", "klingonsInitial", "basesRemaining", "basesInitial"]);
    expect(Object.keys(vm.mission)).toEqual(["startStardate", "endStardate"]);

    expect(vm.resources.energy).toBe(4321);
    expect(vm.resources.shieldsPercent).toBe(42);
    expect(vm.counts.klingonsRemaining).toBe(9);
    expect(vm.terminal).toBe(false);
    expect(Object.isFrozen(vm)).toBe(true);
  });
});