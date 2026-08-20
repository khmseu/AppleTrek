# Apple Trek Browser — AI Coding Agent Guide

Apple Trek is a client-only TypeScript/Vite port of the Apple II Trek game. The six implementation phases are complete; preserve gameplay parity with the original BASIC while keeping the browser terminal and scripted replay paths deterministic.

## Commands

```bash
npm run dev       # Vite development server, normally http://localhost:5173
npm run test      # Vitest single run
npm run build     # Strict TypeScript check, then Vite production build
npm run preview   # Preview the production build
```

There is no separate lint script. `npm run build` is the repository's type-check gate. Tests use Vitest with the Node environment configured in [vite.config.ts](vite.config.ts).

## Architecture

- [src/main.ts](src/main.ts) mounts the browser terminal.
- [src/compat/basicCompat.ts](src/compat/basicCompat.ts) preserves Integer BASIC arithmetic, signed 16-bit bitwise behavior, Apple II machine-hook no-ops, and the deterministic 6502-compatible `SeededRng`.
- [src/state/](src/state/) owns game state and transitions: initialization and cell encoding in [gameState.ts](src/state/gameState.ts) and [cells.ts](src/state/cells.ts), navigation and time in [navigation.ts](src/state/navigation.ts), combat in [combat.ts](src/state/combat.ts), outcomes in [endgame.ts](src/state/endgame.ts), and deterministic replay checks in [replay.ts](src/state/replay.ts).
- [src/ui/](src/ui/) owns the command parser, shared dispatcher, terminal rendering, browser DOM wiring, and view-model adapter. [commandDispatcher.ts](src/ui/commandDispatcher.ts) is the common execution path for prompt input, clickable controls, and replay commands.
- [tests/](tests/) contains phase-focused coverage for compatibility, state initialization, navigation, combat, UI, and endgame/replay behavior.

## Project Rules

- Route all randomness through `SeededRng`; never use `Math.random()`.
- Preserve Apple Integer BASIC semantics: division truncates toward zero, modulo follows the dividend sign, booleans are `1` or `0`, and `NOT`/`AND`/`OR` operate as signed 16-bit bitwise operators.
- Keep Apple II `PEEK`/`POKE`/`CALL` hooks as named no-ops unless browser emulation is explicitly required.
- Game coordinates are 1-based even though JavaScript arrays are zero-based. Use the conversion helpers in [cells.ts](src/state/cells.ts).
- Use `state.sectorSize` and `state.quadrantSize` for grid dimensions. Do not replace them with hardcoded `8`; tests exercise variable-size states.
- Keep state transitions in [src/state/](src/state/) and route UI/replay actions through the shared dispatcher.
- Consult [original-sources/apple_trek.bas](original-sources/apple_trek.bas) for parity questions. The 6502 RNG reference is [original-sources/apple.intbasic.rnd.6502](original-sources/apple.intbasic.rnd.6502). If the BASIC source is ambiguous, prefer behavior that keeps existing replay checks passing; document the ambiguity in a code comment referencing the relevant BASIC line number.
- Avoid editing files under [original-sources/](original-sources/); they are historical reference artifacts.

## Workflow

1. Read the owning module and its neighboring test before changing behavior.
2. Add or update Vitest tests that cover the happy path, at least one edge case, and any deterministic-seed/replay assertion relevant to the changed behavior, then run `npm run test`.
3. Run `npm run build` before handing off or committing.
4. Use deterministic seeds and replay checks when changing state, combat, navigation, or random outcomes.
5. Use Conventional Commit messages such as `fix(state): preserve quadrant dimensions`.

## References

- [Complete implementation plan](plans/apple-trek-browser-typescript-complete.md)
- [Original BASIC source](original-sources/apple_trek.bas)
- [Original Apple II disk image](original-sources/apple_trek.dsk)
- [Application entry point](src/main.ts)
- [Public state exports](src/state/index.ts)
- [Package scripts](package.json)
