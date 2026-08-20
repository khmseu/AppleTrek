/** Empty navigable sector cell. */
// Source: apple_trek.bas cell encoding at lines 185-210 and 1130-1140.
export const EMPTY_CELL = 0;
/** Enterprise sector cell. */
export const SHIP_CELL = 1;
/** Starbase sector cell. */
export const STARBASE_CELL = 2;
/** Star sector cell, blocks torpedoes. */
export const STAR_CELL = 3;
/** Default Klingon combat strength; Klingon cells are stored as negative values. */
// Source: apple_trek.bas lines 185-210 and 2030-2065.
export const KLINGON_UNIT_STRENGTH = -3800;

/** Returns true when a sector cell contains a Klingon strength marker. */
export function isKlingonCell(cell: number): boolean {
  return cell < 0;
}

/**
 * Maps a numeric sector cell to the terminal glyph used by the retro renderer.
 *
 * @throws {RangeError} When a non-Klingon unknown cell value is encountered.
 * Source: apple_trek.bas display glyph selection at lines 1000-1025 and 1130-1140.
 */
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