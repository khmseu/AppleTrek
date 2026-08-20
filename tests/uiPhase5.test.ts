// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { SeededRng } from "../src/compat/basicCompat";
import { enemyTurn, firePhasers, fireTorpedo } from "../src/state";
import { createInitialGameState, coordToIndex1Based, type GameState } from "../src/state/gameState";
import { navigate } from "../src/state/navigation";
import {
  mountBrowserTerminal,
  createCommandSession,
  dispatchControl,
  dispatchPrompt,
  parsePrompt,
  renderOutputLog,
  renderSectorPanel,
  renderStatusPanel
} from "../src/ui";

function makeState(overrides?: Partial<GameState>): GameState {
  const base = createInitialGameState(1701);
  return {
    ...base,
    ...overrides,
    clock: {
      ...base.clock,
      ...(overrides?.clock ?? {})
    },
    ship: {
      ...base.ship,
      ...(overrides?.ship ?? {})
    },
    position: {
      ...base.position,
      ...(overrides?.position ?? {})
    },
    mission: {
      ...base.mission,
      ...(overrides?.mission ?? {})
    },
    counts: {
      ...base.counts,
      ...(overrides?.counts ?? {})
    },
    galaxy: overrides?.galaxy ?? [...base.galaxy],
    sector: overrides?.sector ?? [...base.sector],
    damage: overrides?.damage ?? [...base.damage]
  };
}

describe("Phase 5 prompt parsing", () => {
  it("parses representative command forms", () => {
    expect(parsePrompt("ION 90 3")).toEqual({ kind: "ion", course: 90, value: 3 });
    expect(parsePrompt("warp 270 2")).toEqual({ kind: "warp", course: 270, value: 2 });
    expect(parsePrompt("SHIELDS 35")).toEqual({ kind: "shields", value: 35 });
    expect(parsePrompt("phasers 1200")).toEqual({ kind: "phasers", value: 1200 });
    expect(parsePrompt("TORP 180")).toEqual({ kind: "torpedo", course: 180 });
  });

  it("rejects unknown commands", () => {
    expect(() => parsePrompt("JUMP 10 10")).toThrow("Unknown command");
  });

  it("rejects empty command input", () => {
    expect(() => parsePrompt("   \t\n ")).toThrow("Empty command");
  });

  it("rejects arity mismatch", () => {
    expect(() => parsePrompt("ION 90")).toThrow("Expected 2 arguments for ION");
  });

  it("rejects non-integer arguments", () => {
    expect(() => parsePrompt("WARP 90.5 2")).toThrow("Invalid course: 90.5");
  });

  it("rejects unknown command with deterministic message", () => {
    expect(() => parsePrompt("JUMP 4 2")).toThrow("Unknown command: JUMP");
  });
});

describe("Phase 5 dispatcher error paths", () => {
  it("throws for empty prompt", () => {
    const session = createCommandSession(makeState());
    expect(() => dispatchPrompt(session, "   ", new SeededRng(1))).toThrow("Empty command");
  });

  it("throws for arity mismatch", () => {
    const session = createCommandSession(makeState());
    expect(() => dispatchPrompt(session, "SHIELDS 10 20", new SeededRng(1))).toThrow(
      "Expected 1 arguments for SHIELDS"
    );
  });

  it("throws for non-integer args", () => {
    const session = createCommandSession(makeState());
    expect(() => dispatchPrompt(session, "TORPEDO 3.14", new SeededRng(1))).toThrow(
      "Invalid course: 3.14"
    );
  });

  it("throws for unknown command", () => {
    const session = createCommandSession(makeState());
    expect(() => dispatchPrompt(session, "LASER 100", new SeededRng(1))).toThrow("Unknown command: LASER");
  });
});

describe("Phase 5 command routing", () => {
  it("routes ion navigation through navigation module behavior", () => {
    const state = makeState({
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

    const expected = navigate(state, { mode: "ion", course: 90, value: 2 });

    const session = createCommandSession(state);
    const routed = dispatchPrompt(session, "ION 90 2", new SeededRng(7));

    expect(routed.state).toEqual(expected);
  });

  it("routes phasers through combat module behavior", () => {
    const sector = Array.from({ length: 64 }, () => 0);
    const shipIndex = coordToIndex1Based(4, 4);
    const klingonIndex = coordToIndex1Based(4, 6);
    sector[shipIndex - 1] = 1;
    sector[klingonIndex - 1] = -180;

    const state = makeState({
      ship: {
        energy: 3000,
        energyMax: 5000,
        shieldEnergy: 1500,
        shieldsPercent: 50,
        torpedoes: 10,
        torpedoesMax: 10
      },
      sector,
      counts: {
        initialKlingons: 1,
        klingonsRemaining: 1,
        initialBases: 0,
        basesRemaining: 0
      },
      position: {
        quadrantIndex: coordToIndex1Based(4, 4),
        quadrant: { row: 4, col: 4 },
        sectorIndex: shipIndex,
        sector: { row: 4, col: 4 }
      }
    });

    const expectedRng = new SeededRng(11);
    const expectedAfterPhasers = firePhasers(state, 800, expectedRng).state;
    const expected = enemyTurn(expectedAfterPhasers, expectedRng);

    const session = createCommandSession(state);
    const routed = dispatchPrompt(session, "PHASERS 800", new SeededRng(11));

    expect(routed.state).toEqual(expected);
  });

  it("routes torpedo through combat module behavior including enemy turn", () => {
    const sector = Array.from({ length: 64 }, () => 0);
    const shipIndex = coordToIndex1Based(4, 4);
    const klingonIndex = coordToIndex1Based(4, 6);
    sector[shipIndex - 1] = 1;
    sector[klingonIndex - 1] = -180;

    const state = makeState({
      ship: {
        energy: 3000,
        energyMax: 5000,
        shieldEnergy: 1500,
        shieldsPercent: 50,
        torpedoes: 10,
        torpedoesMax: 10
      },
      sector,
      counts: {
        initialKlingons: 1,
        klingonsRemaining: 1,
        initialBases: 0,
        basesRemaining: 0
      },
      position: {
        quadrantIndex: coordToIndex1Based(4, 4),
        quadrant: { row: 4, col: 4 },
        sectorIndex: shipIndex,
        sector: { row: 4, col: 4 }
      }
    });

    const expectedRng = new SeededRng(11);
    const expectedAfterTorpedo = fireTorpedo(state, 90).state;
    const expected = enemyTurn(expectedAfterTorpedo, expectedRng);

    const session = createCommandSession(state);
    const routed = dispatchPrompt(session, "TORPEDO 90", new SeededRng(11));

    expect(routed.state).toEqual(expected);
  });
});

describe("Phase 5 retro panel rendering", () => {
  it("renders status panel shape with mission and ship fields", () => {
    const state = makeState();
    const status = renderStatusPanel(state);

    expect(status).toContain("STATUS");
    expect(status).toContain("STARDATE");
    expect(status).toContain("ENERGY");
    expect(status).toContain("SHIELDS");
    expect(status).toContain("TORPEDOES");
    expect(status).toContain("KLINGONS");
    expect(status).toContain("BASES");
  });

  it("renders an 8x8 textual sector grid", () => {
    const state = makeState();
    const panel = renderSectorPanel(state);

    expect(panel).toContain("SECTOR");

    const lines = panel.split("\n");
    const gridLines = lines.filter((line) => /^\d\s+[.EBSK\s]+$/.test(line));

    expect(gridLines).toHaveLength(8);
    for (const line of gridLines) {
      const cells = line.trim().split(/\s+/).slice(1);
      expect(cells).toHaveLength(8);
    }
  });

  it("renders output log with LOG header and full list when <= 10 entries", () => {
    const output = renderOutputLog(["A", "B", "C"]);
    expect(output).toBe("LOG\nA\nB\nC");
  });

  it("retains only the last 10 output entries in order", () => {
    const log = Array.from({ length: 12 }, (_, i) => `LINE ${i + 1}`);
    const output = renderOutputLog(log);
    const lines = output.split("\n");

    expect(lines[0]).toBe("LOG");
    expect(lines.slice(1)).toEqual(log.slice(-10));
    expect(lines.slice(1)).toHaveLength(10);
  });

  it("deduplicates terminal style and keeps key panels rendered across remount", () => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";

    const firstRoot = document.createElement("div");
    const secondRoot = document.createElement("div");
    document.body.append(firstRoot, secondRoot);

    mountBrowserTerminal(firstRoot);
    mountBrowserTerminal(secondRoot);

    expect(document.querySelectorAll("#apple-trek-terminal-style")).toHaveLength(1);

    for (const root of [firstRoot, secondRoot]) {
      const status = root.querySelector(".status-panel")?.textContent ?? "";
      const sector = root.querySelector(".sector-panel")?.textContent ?? "";
      const log = root.querySelector(".log-panel")?.textContent ?? "";

      expect(status).toContain("STATUS");
      expect(sector).toContain("SECTOR");
      expect(log).toContain("LOG");
    }
  });
});

describe("Phase 5 clickable control parity", () => {
  it("dispatches button controls through the same command execution path", () => {
    const start = makeState({
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
      }
    });

    const promptSession = dispatchPrompt(createCommandSession(start), "ION 90 2", new SeededRng(99));
    const controlSession = dispatchControl(
      createCommandSession(start),
      { action: "ion", course: 90, value: 2 },
      new SeededRng(99)
    );

    expect(controlSession.state).toEqual(promptSession.state);
    expect(controlSession.log).toEqual(promptSession.log);
  });
});
