// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { SeededRng } from "../src/compat/basicCompat";
import { enemyTurn, firePhasers, fireTorpedo, latchMissionOutcome } from "../src/state";
import { coordToIndex1Based, type GameState } from "../src/state/gameState";
import { navigate } from "../src/state/navigation";
import {
  CONTROL_ACTIONS,
  mountBrowserTerminal,
  createCommandSession,
  controlToPrompt,
  dispatchControl,
  dispatchPrompt,
  formatParsedCommand,
  isControlAction,
  parsePrompt,
  renderOutputLog,
  renderSectorPanel,
  renderStatusPanel
} from "../src/ui";
import { makeTestState } from "./helpers/testState";
import { makeSingleKlingonCombatFixture } from "./helpers/fixtures";

describe("Phase 5 prompt parsing", () => {
  it("formats parsed commands as exact prompt/log strings", () => {
    expect(formatParsedCommand({ kind: "ion", course: 90, value: 3 })).toBe("ION 90 3");
    expect(formatParsedCommand({ kind: "warp", course: 270, value: 2 })).toBe("WARP 270 2");
    expect(formatParsedCommand({ kind: "shields", value: 35 })).toBe("SHIELDS 35");
    expect(formatParsedCommand({ kind: "phasers", value: 1200 })).toBe("PHASERS 1200");
    expect(formatParsedCommand({ kind: "torpedo", course: 180 })).toBe("TORPEDO 180");
    expect(formatParsedCommand({ kind: "damage-report" })).toBe("DAMAGE");
    expect(formatParsedCommand({ kind: "load-torpedoes", value: 2 })).toBe("LOAD 2");
    expect(formatParsedCommand({ kind: "computer" })).toBe("COMPUTER");
    expect(formatParsedCommand({ kind: "probe" })).toBe("PROBE");
    expect(formatParsedCommand({ kind: "self-destruct" })).toBe("DESTRUCT");
  });

  it("formats zero-value command arguments exactly", () => {
    expect(formatParsedCommand({ kind: "ion", course: 0, value: 0 })).toBe("ION 0 0");
    expect(formatParsedCommand({ kind: "warp", course: 0, value: 0 })).toBe("WARP 0 0");
    expect(formatParsedCommand({ kind: "shields", value: 0 })).toBe("SHIELDS 0");
    expect(formatParsedCommand({ kind: "phasers", value: 0 })).toBe("PHASERS 0");
    expect(formatParsedCommand({ kind: "torpedo", course: 0 })).toBe("TORPEDO 0");
    expect(formatParsedCommand({ kind: "load-torpedoes", value: 0 })).toBe("LOAD 0");
  });

  it("parses representative command forms", () => {
    expect(parsePrompt("ION 90 3")).toEqual({ kind: "ion", course: 90, value: 3 });
    expect(parsePrompt("warp 270 2")).toEqual({ kind: "warp", course: 270, value: 2 });
    expect(parsePrompt("SHIELDS 35")).toEqual({ kind: "shields", value: 35 });
    expect(parsePrompt("phasers 1200")).toEqual({ kind: "phasers", value: 1200 });
    expect(parsePrompt("TORP 180")).toEqual({ kind: "torpedo", course: 180 });
    expect(parsePrompt("damage")).toEqual({ kind: "damage-report" });
    expect(parsePrompt("load -1")).toEqual({ kind: "load-torpedoes", value: -1 });
    expect(parsePrompt("computer")).toEqual({ kind: "computer" });
    expect(parsePrompt("probe")).toEqual({ kind: "probe" });
  });

  it("rejects unknown commands", () => {
    expect(() => parsePrompt("JUMP 10 10")).toThrow(RangeError);
    expect(() => parsePrompt("JUMP 10 10")).toThrow(/Unknown command/);
  });

  it("rejects empty command input", () => {
    expect(() => parsePrompt("   \t\n ")).toThrow(RangeError);
    expect(() => parsePrompt("   \t\n ")).toThrow(/Empty command/);
  });

  it("rejects arity mismatch", () => {
    expect(() => parsePrompt("ION 90")).toThrow(RangeError);
    expect(() => parsePrompt("ION 90")).toThrow(/Expected 2 arguments for ION/);
  });

  it("rejects non-integer arguments", () => {
    expect(() => parsePrompt("WARP 90.5 2")).toThrow(RangeError);
    expect(() => parsePrompt("WARP 90.5 2")).toThrow(/Invalid course/);
  });

  it("rejects unknown command with deterministic message", () => {
    expect(() => parsePrompt("JUMP 4 2")).toThrow(RangeError);
    expect(() => parsePrompt("JUMP 4 2")).toThrow(/Unknown command: JUMP/);
  });
});

describe("Phase 5 dispatcher error paths", () => {
  it("throws for empty prompt", () => {
    const session = createCommandSession(makeTestState());
    expect(() => dispatchPrompt(session, "   ", new SeededRng(1))).toThrow(RangeError);
    expect(() => dispatchPrompt(session, "   ", new SeededRng(1))).toThrow(/Empty command/);
  });

  it("throws for arity mismatch", () => {
    const session = createCommandSession(makeTestState());
    expect(() => dispatchPrompt(session, "SHIELDS 10 20", new SeededRng(1))).toThrow(RangeError);
    expect(() => dispatchPrompt(session, "SHIELDS 10 20", new SeededRng(1))).toThrow(
      /Expected 1 arguments for SHIELDS/
    );
  });

  it("throws for non-integer args", () => {
    const session = createCommandSession(makeTestState());
    expect(() => dispatchPrompt(session, "TORPEDO 3.14", new SeededRng(1))).toThrow(RangeError);
    expect(() => dispatchPrompt(session, "TORPEDO 3.14", new SeededRng(1))).toThrow(/Invalid course/);
  });

  it("throws for unknown command", () => {
    const session = createCommandSession(makeTestState());
    expect(() => dispatchPrompt(session, "LASER 100", new SeededRng(1))).toThrow(RangeError);
    expect(() => dispatchPrompt(session, "LASER 100", new SeededRng(1))).toThrow(/Unknown command: LASER/);
  });
});

describe("Phase 5 command routing", () => {
  it("routes ion navigation through navigation module behavior", () => {
    const state = makeSingleKlingonCombatFixture().state;

    const expectedRng = new SeededRng(7);
    const expectedAfterNavigation = navigate(state, { mode: "ion", course: 90, value: 1 });
    const expected = enemyTurn(expectedAfterNavigation, expectedRng);

    const session = createCommandSession(state);
    const routed = dispatchPrompt(session, "ION 90 1", new SeededRng(7));

    expect(routed.state).toEqual(expected);
  });

  it("routes warp navigation through post-command enemy action", () => {
    const state = makeSingleKlingonCombatFixture().state;

    const expectedRng = new SeededRng(8);
    const expectedAfterNavigation = navigate(state, { mode: "warp", course: 90, value: 1 });
    const expected = enemyTurn(expectedAfterNavigation, expectedRng);

    const session = createCommandSession(state);
    const routed = dispatchPrompt(session, "WARP 90 1", new SeededRng(8));

    expect(routed.state).toEqual(expected);
  });

  it("routes phasers through combat module behavior", () => {
    const state = makeSingleKlingonCombatFixture().state;

    const expectedRng = new SeededRng(11);
    const expectedAfterPhasers = firePhasers(state, 800, expectedRng).state;
    const expected = latchMissionOutcome(enemyTurn(expectedAfterPhasers, expectedRng));

    const session = createCommandSession(state);
    const routed = dispatchPrompt(session, "PHASERS 800", new SeededRng(11));

    expect(routed.state).toEqual(expected);
  });

  it("routes torpedo through combat module behavior including enemy turn", () => {
    const state = makeSingleKlingonCombatFixture().state;

    const expectedRng = new SeededRng(11);
    const expectedAfterTorpedo = fireTorpedo(state, 90).state;
    const expected = latchMissionOutcome(enemyTurn(expectedAfterTorpedo, expectedRng));

    const session = createCommandSession(state);
    const routed = dispatchPrompt(session, "TORPEDO 90", new SeededRng(11));

    expect(routed.state).toEqual(expected);
  });

  it("routes damage report without mutating state", () => {
    const state = makeTestState({ damage: [0, 100, 0, 250, 0, 0, 50, 0, 0] });
    const session = createCommandSession(state);

    const routed = dispatchPrompt(session, "DAMAGE", new SeededRng(1));

    expect(routed.state).toEqual(state);
    expect(routed.log).toContain("DAMAGE REPORT");
    expect(routed.log).toContain("SR SENSORS DAMAGED 1.00");
    expect(routed.log).toContain("PHASERS DAMAGED 2.50");
  });

  it("routes torpedo loading with Integer BASIC energy accounting", () => {
    const state = makeTestState({
      ship: {
        energy: 5000,
        energyMax: 5000,
        shieldEnergy: 2500,
        shieldsPercent: 50,
        torpedoes: 8,
        torpedoesMax: 10
      }
    });
    const session = createCommandSession(state);

    const loaded = dispatchPrompt(session, "LOAD 2", new SeededRng(1));

    expect(loaded.state.ship.torpedoes).toBe(10);
    expect(loaded.state.ship.energy).toBe(3800);
    expect(loaded.log).toContain("TORPEDOES 10/10");
  });

  it("rejects torpedo loading outside magazine bounds", () => {
    const session = createCommandSession(makeTestState());

    expect(() => dispatchPrompt(session, "LOAD 1", new SeededRng(1))).toThrow(/Invalid torpedo load/);
  });

  it("routes computer and probe reports without enemy action", () => {
    const state = makeSingleKlingonCombatFixture().state;
    const session = createCommandSession(state);

    const computer = dispatchPrompt(session, "COMPUTER", new SeededRng(1));
    const probe = dispatchPrompt(session, "PROBE", new SeededRng(1));

    expect(computer.state).toEqual(state);
    expect(computer.log).toContain("COMPUTER REPORT");
    expect(probe.state).toEqual(state);
    expect(probe.log).toContain("PROBE REPORT");
    expect(probe.log.some((line) => line.includes("KLINGON"))).toBe(true);
  });
});

describe("Phase 5 retro panel rendering", () => {
  it("renders status panel shape with mission and ship fields", () => {
    const state = makeTestState();
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
    const state = makeTestState();
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

  it("renders sector column headers from sectorSize", () => {
    const state = makeTestState({
      sectorSize: 3,
      sector: [1, 0, 0, 0, 2, 0, 0, 0, 3]
    });

    const panel = renderSectorPanel(state);
    const lines = panel.split("\n");

    expect(lines[1]).toBe("  1 2 3");
    expect(lines.filter((line) => /^\d\s+/.test(line))).toHaveLength(3);
  });

  it("throws when sector length does not match sectorSize squared", () => {
    const state = makeTestState({
      sectorSize: 3,
      sector: [1, 0, 0]
    });

    expect(() => renderSectorPanel(state)).toThrow(RangeError);
    expect(() => renderSectorPanel(state)).toThrow(/Sector cell count mismatch/);
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
  it("exports stable control actions and validates them via helper", () => {
    expect(CONTROL_ACTIONS).toHaveLength(6);
    expect(CONTROL_ACTIONS).toEqual(
      expect.arrayContaining(["ion", "warp", "shields", "phasers", "torpedo", "self-destruct"])
    );
    expect(Object.isFrozen(CONTROL_ACTIONS)).toBe(true);

    for (const action of CONTROL_ACTIONS) {
      expect(isControlAction(action)).toBe(true);
    }

    expect(isControlAction("ION")).toBe(false);
    expect(isControlAction("laser")).toBe(false);
    expect(isControlAction("")).toBe(false);
  });

  it("throws when required control fields are missing", () => {
    expect(() =>
      controlToPrompt({ action: "ion", value: 2 } as unknown as Parameters<typeof controlToPrompt>[0])
    ).toThrow(/Missing course/);
    expect(() =>
      controlToPrompt({ action: "warp", course: 90 } as unknown as Parameters<typeof controlToPrompt>[0])
    ).toThrow(/Missing value/);
    expect(() =>
      controlToPrompt({ action: "torpedo" } as unknown as Parameters<typeof controlToPrompt>[0])
    ).toThrow(/Missing course/);
    expect(() =>
      controlToPrompt({ action: "shields" } as unknown as Parameters<typeof controlToPrompt>[0])
    ).toThrow(/Missing value/);
    expect(() =>
      controlToPrompt({ action: "phasers" } as unknown as Parameters<typeof controlToPrompt>[0])
    ).toThrow(/Missing value/);
  });

  it("throws when control fields are invalid", () => {
    expect(() => controlToPrompt({ action: "ion", course: 90.5, value: 2 })).toThrow(/Invalid course/);
    expect(() => controlToPrompt({ action: "warp", course: 90, value: 2.1 })).toThrow(/Invalid value/);
    expect(() => controlToPrompt({ action: "torpedo", course: 3.14 })).toThrow(/Invalid course/);
  });

  it("dispatches button controls through the same command execution path", () => {
    const start = makeTestState({
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
