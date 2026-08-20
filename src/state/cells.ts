export const EMPTY_CELL = 0;
export const SHIP_CELL = 1;
export const STARBASE_CELL = 2;
export const STAR_CELL = 3;
export const KLINGON_UNIT_STRENGTH = -3800;

export function isKlingonCell(cell: number): boolean {
  return cell < 0;
}

export function sectorGlyph(cell: number): string {
  if (cell === EMPTY_CELL) {
    return ".";
  }

  if (cell === SHIP_CELL) {
    return "E";
  }

  if (cell === STARBASE_CELL) {
    return "B";
  }

  if (cell === STAR_CELL) {
    return "S";
  }

  if (isKlingonCell(cell)) {
    return "K";
  }

  throw new RangeError(`Unknown sector cell value: ${cell}`);
}