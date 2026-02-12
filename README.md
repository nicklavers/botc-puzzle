# Blood on the Clocktower Logic Puzzle

A browser-based deduction puzzle inspired by [Blood on the Clocktower](https://bloodontheclocktower.com/). Each game generates a unique scenario with 8 players seated in a circle. Your goal: figure out which player is the Demon.

## How to Play

1. **Read the claims.** Each night, players with information abilities report what they learned. Good players always tell the truth. Evil players and drunk/poisoned players always lie.
2. **Cross-reference.** Look for contradictions between claims. If two players claim the same role, at least one is evil.
3. **Select suspects.** Click seats in the clocktower to mark your Demon candidate(s).
4. **Submit your guess.** You have 3 lives. Narrow it down before you run out.

### Game Modes

- **Progressive** — Claims are revealed night by night. The candidate pool narrows as new information arrives. You're prompted to guess when the puzzle becomes solvable.
- **All at Once** — All nights are shown immediately. One shot to find the Demon.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1`-`8` | Toggle seat selection |
| `Enter` | Submit guess |
| `N` | New game |
| `Esc` | Close modal |

## Puzzle Rules

Every game has **8 players**: 5 Townsfolk, 1 Outsider, 1 Minion, 1 Demon.

- Good players claim their true role and give truthful information.
- Evil players claim a Townsfolk or Butler role and always give false information.
- The **Drunk** thinks they are a Townsfolk — they don't know they're the Drunk, and all their information is wrong.
- The **Poisoner** poisons a neighbour on Night 1; the target advances one seat each night. The poisoned player's information is wrong.
- No one claims to be the Drunk. Evil players never claim Drunk.
- If two players claim the same role, at least one is evil.

### Script

**Townsfolk** (11 on script, 5 per game): Washerwoman, Librarian, Investigator, Chef, Clockmaker, Noble, Knight, Steward, Shugenja, Empath, Fortune Teller

**Outsiders** (2 on script, 1 per game): Drunk, Butler

**Minions** (2 on script, 1 per game): Poisoner, Scarlet Woman

**Demon** (1): Imp

## Running Locally

No build step required — just serve the files:

```sh
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## Running Tests

Open `test/test-runner.html` in a browser to run the test suite.

## Project Structure

```
js/
  constants.js      Enums, composition rules, script
  roles.js          Role definitions and helpers
  claims.js         Claim generation (truth + lies) and verification
  generator.js      Puzzle generation with solver validation
  game-state.js     Immutable game state
  solver.js         Constraint solver for finding Demon candidates
  seating.js        Circular seating utilities
  ui-clocktower.js  Clocktower circle rendering
  ui-info-panel.js  Claims and script reference panel
  ui-controls.js    Buttons, mode toggle, lives display
  ui-manager.js     Wires UI modules together
  main.js           App bootstrap
css/
  theme.css         CSS custom properties
  reset.css         Minimal reset
  layout.css        Page grid and responsive breakpoints
  clocktower.css    Seat circle and state styles
  components.css    Cards, buttons, modals
img/roles/          Role icon PNGs
test/               Browser-based test suite
```

## Tech Stack

Vanilla JavaScript (ES modules), no dependencies, no build system.

## Credits

Role icons from the [Blood on the Clocktower Wiki](https://wiki.bloodontheclocktower.com/). Blood on the Clocktower is designed by Steven Medway and published by [The Pandemonium Institute](https://bloodontheclocktower.com/).
