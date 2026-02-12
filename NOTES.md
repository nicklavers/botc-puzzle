# BotC Logic Puzzle — Project Notes

## Overview
Browser-based logic puzzle inspired by Blood on the Clocktower. Player observes a simulated game (8 players in a circle with claimed roles and night information) and must deduce which player is the Demon. Evil/drunk/poisoned players ALWAYS lie.

## Architecture
All vanilla JS ES modules, no build step. Serve via any static server.

### File Dependency Chain
```
constants.js  (enums, composition, game types)
    ├── roles.js  (16 role definitions with metadata tags)
    ├── seating.js  (circle geometry, poison path, neighbor math)
    ├── game-state.js  (immutable state, players, nights, deaths)
    ├── claims.js  (truth/lie generators + solver verifiers for all 11 info types)
    ├── solver.js  (~2K-10K hypothesis brute force, progressive solving)
    └── generator.js  (full simulation, bluff assignment, retry on non-convergence)

UI layer (all depend on core):
    ui-clocktower.js  (CSS transform circle, seat selection)
    ui-info-panel.js  (night claims, rules summary)
    ui-controls.js  (mode toggle, lives, result modal)
    ui-manager.js  (state machine: REVEAL→SELECT→VERIFY→WIN/LOSE)
    main.js  (bootstrap, keyboard nav, wires everything)
```

### CSS Files
`reset.css → theme.css → layout.css → clocktower.css → components.css`

## V1 Script (Character Pool)
- **11 Townsfolk** on script, 5 per game: Washerwoman, Librarian, Investigator, Chef, Clockmaker, Noble, Knight, Steward, Shugenja, Empath, Fortune Teller
- **2 Outsiders** on script, 1 per game: Drunk, Butler
- **2 Minions** on script, 1 per game: Poisoner, Scarlet Woman
- **1 Demon**: Imp

## Four Game Types
| Outsider | Minion | Liars | Poison? |
|----------|--------|-------|---------|
| Drunk | Poisoner | 3 | Yes |
| Drunk | Scarlet Woman | 3 | No |
| Butler | Poisoner | 2 | Yes |
| Butler | Scarlet Woman | 2 | No |

## Key Design Decisions

### Solver
- Hypothesis = `{impSeat, minionSeat, minionType, outsiderSeat, outsiderType, poisonDirection?, redHerring?}`
- Total state space: ~2,016 without FT, ~10,080 with FT
- Constant regardless of night count (deterministic Poisoner)
- Pruning rules: structural (A), claim-role (B), claim-info (C), derived (D)

### Deterministic Poisoner (modified from base game)
- Night 1: poisons one neighbor (CW or CCW direction chosen at setup)
- Each subsequent night: advances 1 seat in that direction
- Reduces poison state to just 2 choices total

### Fortune Teller Red Herring
- One good player assigned at setup registers as Demon to this FT
- Sober FT: YES if target is Demon OR Red Herring
- Lying FT: says OPPOSITE of sober answer (not random)

### Bluff Rules
- True Townsfolk claim their real role with truthful info
- Drunk claims a Townsfolk NOT claimed by any true Townsfolk (never double-claims)
- Butler claims "Butler"
- Evil claim Townsfolk or Butler, distinct from each other, never Drunk
- Evil MAY double-claim a role held by a true Townsfolk

## Two Play Modes
1. **Progressive**: Info one day at a time, must identify ALL possible demon seats each day, 3 lives
2. **All-at-Once**: All info at once, single guess

## Bug Fix History
- Missing `InfoTiming` import in claims.js caused puzzle generation to fail silently

## Testing
- `test/test-runner.html` — in-browser, no deps
- Tests cover: seating math, all claim generators (truth+lie), solver with hand-crafted puzzles, generator convergence/bluff rules, round-trip integration
- Run via `http://localhost:<port>/test/test-runner.html`

## Future Expansion Ideas (from plan)
- More characters from Sects & Violets, Bad Moon Rising
- Ravenkeeper (death-triggered info), Sage, Oracle, Dreamer
- Imp self-kill → pass to Minion (Scarlet Woman succession)
- Difficulty levels (more/fewer info characters)
- Win/lose explanation with full logical chain
- Role icons/artwork
