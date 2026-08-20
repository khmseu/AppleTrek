# Apple Trek Browser — AI Coding Agent Guide

## Project Overview

**Apple Trek** is a browser-based TypeScript port of the classic Apple Integer BASIC game from the Apple II era. The goal is to recreate the original Trek spaceship exploration and combat game as a fully client-side web app, prioritizing gameplay parity with the original while providing a retro terminal UI and optional modern visual layer.

**Original Source:** [original-sources/apple_trek.bas](original-sources/apple_trek.bas) — Reference Apple Integer BASIC source code
**Reference Binary:** [original-sources/apple_trek.dsk](original-sources/apple_trek.dsk) — Apple II disk image of the original game

---

## Key Technical Decisions

1. **No Server:** Fully client-side; all game logic runs in the browser
2. **No Framework:** Plain Vite + TypeScript (minimal dependencies, maximum control)
3. **TDD-First:** Tests written before implementation; minimal code to pass
4. **Deterministic RNG:** Seeded LCG-based random number generator for reproducible gameplay
5. **Apple Integer BASIC Compatibility:** Preserve integer-only BASIC semantics intentionally (e.g., relational booleans: 1 = true, 0 = false; logical operators are signed 16-bit bitwise operations)
6. **Modular Phases:** 6-phase development roadmap with strict TDD boundaries

---

## Development Commands

```bash
npm run dev       # Vite dev server with HMR (http://localhost:5173)
npm run build     # TypeScript type-check + Vite bundle (production)
npm run test      # Vitest run (single execution, Node environment)
npm run preview   # Preview built output
```

---

## Project Structure

```
original-sources/       # Original Apple II source files and reference artifacts
index.html              # HTML5 entry point (loads src/main.ts)
src/
  ├── main.ts           # App entry point (currently renders scaffold)
  └── compat/
      └── basicCompat.ts    # Apple Integer BASIC compatibility layer
tests/
  └── compat.test.ts    # Vitest tests for compat functions
plans/
  └── *.md              # Phase-by-phase development roadmap
```

---

## Architecture & Code Patterns

### Phase Status
- **Phase 1:** ✅ Complete — Scaffold and compat core (APPROVED & MERGED)
- **Phases 2–6:** In progress — See [plans/apple-trek-browser-typescript-plan.md](plans/apple-trek-browser-typescript-plan.md)

### Current Implementation

#### Compat Layer (`src/compat/basicCompat.ts`)
Apple Integer BASIC compatibility primitives that preserve BASIC semantics:
- **`truncDiv(a, b)`** — Integer division toward zero (Integer BASIC-style, not floor)
- **`modCompat(a, b)`** — Modulo operation matching Integer BASIC behavior
- **`boolToBasic(b: boolean): number`** — Convert JS boolean to BASIC (1 for true, 0 for false)
- **`basicNot(n: number): number`** — BASIC NOT as signed 16-bit bitwise complement
- **`basicAnd(a, b)`**, **`basicOr(a, b)`** — BASIC AND/OR as signed 16-bit bitwise operators
- **`APPLE_II_MEMORY`**, **`APPLE_II_ROM_CALLS`** — Hex constants for original PEEK/POKE/CALL addresses
- **`peekNoop`**, **`pokeNoop`**, **`callNoop`** — Browser no-op placeholders for dropped Apple II machine-interface hooks
- **`SeededRng`** — Class with LCG-based deterministic random number generation
  - Seed with a fixed number for reproducible gameplay
  - Range queries: `rng.nextInt(1, 8)` returns integer in range [1, 8]

#### Testing Approach (`tests/compat.test.ts`)
- Uses **Vitest** (Node environment for isolation)
- Tests run independently; no browser/DOM required
- Validate determinism: same seed → same sequence
- Validate bounds and edge cases for all compat functions

### Key Conventions

1. **TDD Workflow per Phase:**
   - Write failing tests first (red)
   - Implement minimal code to pass (green)
   - Refactor if needed (blue)
   - DO NOT skip test-first step; it's the discipline here

2. **Deterministic Game State:**
   - All randomness flows through `SeededRng` with a fixed seed
   - Critical for testing, replay validation, and gameplay parity
   - Never use `Math.random()` directly

3. **BASIC Semantics:**
   - Relational booleans: 1 (true), 0 (false)
   - NOT/AND/OR are signed 16-bit bitwise operators, not JavaScript truthiness wrappers
   - Arithmetic is integer-only; truncate division toward zero where BASIC would divide
   - Preserve dropped PEEK/POKE/CALL hooks as no-op compatibility functions with hex address constants, rather than deleting their intent
   - Integer division truncates toward zero, not floor
   - Preserve these quirks intentionally for parity

4. **Type Safety:**
   - Strict TypeScript enforced at build time
   - No `any` types unless absolutely necessary and justified
   - Use Vitest globals (test, expect, describe) — already configured in tsconfig.json

5. **Module Organization:**
   - Compat layer isolated in `src/compat/`
   - Game state, UI, and AI in separate modules (phases 2–6)
   - Clear separation of concerns

---

## Development Workflow

### When Starting a Phase
1. Read the corresponding phase section in [plans/apple-trek-browser-typescript-plan.md](plans/apple-trek-browser-typescript-plan.md)
2. Review the "Tests to Write" and "Steps" for that phase
3. Write failing tests FIRST (run `npm run test` to verify they fail)
4. Implement minimal code to pass the tests
5. Run `npm run test` again to confirm all tests pass
6. Use `npm run build` to validate TypeScript type-checking

### When Debugging
- Run `npm run test` to catch test failures immediately
- Check [tests/compat.test.ts](tests/compat.test.ts) for test patterns
- Use deterministic seeds to reproduce issues: `new SeededRng(12345)`

### When Ready to Commit
- All tests must pass: `npm run test`
- TypeScript must compile: `npm run build`
- Use Conventional Commits format (e.g., `feat: add game state model`)
- Reference the phase number in the commit body if helpful

---

## Important Patterns & Pitfalls

### ✅ DO
- Write tests before implementing
- Use `SeededRng` for all randomness
- Preserve Apple Integer BASIC semantics (1/0 relational booleans, signed 16-bit bitwise logic, integer-only arithmetic)
- Check against `original-sources/apple_trek.bas` for original logic
- Validate determinism with fixed seeds in tests
- Run full test suite before committing

### ❌ DON'T
- Use `Math.random()` directly (use `SeededRng` instead)
- Change BASIC semantics unless explicitly required
- Skip TDD discipline for the sake of speed
- Assume JS number semantics match Apple Integer BASIC (they don't)
- Modify game state outside of dedicated state module (coming in Phase 2)

---

## File Reference

| File | Purpose | Key Notes |
|------|---------|-----------|
| [index.html](index.html) | HTML entry point | #app div, loads src/main.ts |
| [original-sources/apple_trek.bas](original-sources/apple_trek.bas) | BASIC source reference | Consult for game logic, commands, AI |
| [original-sources/apple_trek.dsk](original-sources/apple_trek.dsk) | Original binary | Run on Apple II emulator to validate parity |
| [package.json](package.json) | Project metadata & scripts | Defines build/test/dev/preview tasks |
| [plans/*.md](plans/) | Development roadmap | Phase objectives, test requirements, steps |
| [src/compat/basicCompat.ts](src/compat/basicCompat.ts) | BASIC compatibility | Phase 1: compat primitives + SeededRng |
| [src/main.ts](src/main.ts) | App entry | Currently renders scaffold; will wire game loop |
| [tests/compat.test.ts](tests/compat.test.ts) | Compat layer tests | Determinism, bounds, edge cases |
| [tsconfig.json](tsconfig.json) | TypeScript config | Strict mode, ES2020 target, Vitest globals |
| [vite.config.ts](vite.config.ts) | Vite & Vitest config | Node environment for tests |

---

## Next Steps for AI Agents

### Phase 2 (Game State Model and Initialization)
- Read [original-sources/apple_trek.bas](original-sources/apple_trek.bas) to extract game state fields (ship, crew, energy, quadrant layout, etc.)
- Create typed `GameState` interface in `src/state/` (new folder)
- Implement deterministic initialization with fixed seed
- Write failing tests for state invariants and startup parity
- Validate with reference [original-sources/apple_trek.dsk](original-sources/apple_trek.dsk)

### For Feature Implementation
1. Check [plans/apple-trek-browser-typescript-plan.md](plans/apple-trek-browser-typescript-plan.md) for the current phase
2. Review test requirements for that phase
3. Follow TDD: write failing tests → minimal implementation → green
4. Run `npm run test` and `npm run build` before committing

### For Questions or Ambiguities
- Refer to [original-sources/apple_trek.bas](original-sources/apple_trek.bas) as the source of truth for game logic
- Check the phase plan for explicit test and step guidance
- Preserve Apple Integer BASIC semantics unless the plan explicitly says otherwise

---

## Useful References

- **Master Plan:** [plans/apple-trek-browser-typescript-plan.md](plans/apple-trek-browser-typescript-plan.md) — Full 6-phase roadmap with objectives and test requirements
- **Phase 1 Completion:** [plans/apple-trek-browser-typescript-phase-1-complete.md](plans/apple-trek-browser-typescript-phase-1-complete.md) — What was delivered and approved
- **Original Game:** [original-sources/apple_trek.bas](original-sources/apple_trek.bas) — Reference for commands, game state, and logic
- **Vitest Docs:** https://vitest.dev/ — Test framework and API
- **Vite Docs:** https://vitejs.dev/ — Build tool configuration

---

## Configuration Notes

- **TypeScript:** Strict mode enabled; ES2020 target; Vitest type globals active
- **Testing:** Node environment (no browser by default); single-run mode
- **Build:** Type-check before bundling; ensures type safety in production
- **Dev:** HMR enabled for instant feedback during development
