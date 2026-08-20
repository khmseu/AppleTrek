import { type GameState } from "../state/gameState";

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatTickClock(stardate: number, ticks: number): string {
  return `${stardate}.${pad(ticks)}`;
}

function sectorGlyph(cell: number): string {
  if (cell === 0) {
    return ".";
  }
  if (cell === 1) {
    return "E";
  }
  if (cell === 2) {
    return "B";
  }
  if (cell === 3) {
    return "S";
  }
  return "K";
}

export function renderStatusPanel(state: GameState): string {
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

export function renderSectorPanel(state: GameState): string {
  const lines: string[] = [];
  lines.push("SECTOR");
  lines.push("  1 2 3 4 5 6 7 8");

  for (let row = 1; row <= state.gridSize; row += 1) {
    const cells: string[] = [];
    for (let col = 1; col <= state.gridSize; col += 1) {
      const index = (row - 1) * state.gridSize + (col - 1);
      cells.push(sectorGlyph(state.sector[index]));
    }
    lines.push(`${row} ${cells.join(" ")}`);
  }

  return lines.join("\n");
}

export function renderOutputLog(log: string[]): string {
  return ["LOG", ...log.slice(-10)].join("\n");
}
