import { APPLE_II_MACHINE, APPLE_II_ROM_CALLS } from "../compat/basicCompat";
import { type GameState } from "../state/gameState";
import { sectorGlyph } from "../state/cells";

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatTickClock(stardate: number, ticks: number): string {
  return `${stardate}.${pad(ticks)}`;
}

/** Renders the compact status panel shown beside the sector grid. */
export function renderStatusPanel(state: GameState): string {
  APPLE_II_MACHINE.call(APPLE_II_ROM_CALLS.SET_INVERSE_TEXT);
  APPLE_II_MACHINE.call(APPLE_II_ROM_CALLS.SET_NORMAL_TEXT);

  const lines = [
    "STATUS",
    `STARDATE ${formatTickClock(state.clock.stardate, state.clock.ticks)}`,
    `ENERGY   ${state.ship.energy}/${state.ship.energyMax}`,
    `SHIELDS  ${state.ship.shieldEnergy} (${state.ship.shieldsPercent}%)`,
    `TORPEDOES ${state.ship.torpedoes}/${state.ship.torpedoesMax}`,
    `KLINGONS ${state.counts.klingonsRemaining}/${state.counts.initialKlingons}`,
    `BASES    ${state.counts.basesRemaining}/${state.counts.initialBases}`,
    `QUADRANT ${state.position.quadrant.row},${state.position.quadrant.col}`,
    `SECTOR   ${state.position.sector.row},${state.position.sector.col}`
  ];

  return lines.join("\n");
}

/**
 * Renders the current sector as a text grid with dynamic column headers.
 *
 * The renderer uses `state.sectorSize` rather than default constants and checks
 * that the backing sector array has exactly `sectorSize^2` cells before reading
 * it, preventing misleading output for malformed variable-size states.
 *
 * @throws {RangeError} When sector length does not match `sectorSize^2`.
 */
export function renderSectorPanel(state: GameState): string {
  APPLE_II_MACHINE.call(APPLE_II_ROM_CALLS.SET_INVERSE_TEXT);
  APPLE_II_MACHINE.call(APPLE_II_ROM_CALLS.SET_NORMAL_TEXT);

  const expectedCellCount = state.sectorSize * state.sectorSize;
  if (state.sector.length !== expectedCellCount) {
    throw new RangeError(
      `Sector cell count mismatch: expected ${expectedCellCount}, got ${state.sector.length}`
    );
  }

  const lines: string[] = [];
  lines.push("SECTOR");
  lines.push(`  ${Array.from({ length: state.sectorSize }, (_, index) => index + 1).join(" ")}`);

  for (let row = 1; row <= state.sectorSize; row += 1) {
    const cells: string[] = [];
    for (let col = 1; col <= state.sectorSize; col += 1) {
      const index = (row - 1) * state.sectorSize + (col - 1);
      cells.push(sectorGlyph(state.sector[index]));
    }
    lines.push(`${row} ${cells.join(" ")}`);
  }

  return lines.join("\n");
}

/** Renders the command log header plus the last ten log lines. */
export function renderOutputLog(log: string[]): string {
  return ["LOG", ...log.slice(-10)].join("\n");
}
