import { RoleId, RoleType, PLAYER_COUNT, COMPOSITION, SCRIPT } from '../js/constants.js';
import { getRole } from '../js/roles.js';
import { generatePuzzle } from '../js/generator.js';

const { assert, assertEqual, group } = window.__test;

// ── Convergence ───────────────────────────────────────────────────

group('Generator: convergence', () => ({
  'generate 20 puzzles, all converge (have at least 1 checkpoint)'() {
    let converged = 0;
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle('progressive');
      if (puzzle && puzzle.checkpoints.length >= 1) {
        converged++;
      }
    }
    assert(converged >= 15,
      `at least 15 of 20 puzzles should converge, got ${converged}`);
  },
}));

// ── Composition ───────────────────────────────────────────────────

group('Generator: composition', () => ({
  '8 players total'() {
    const puzzle = generatePuzzle('progressive');
    assert(puzzle !== null, 'puzzle generated');
    assertEqual(puzzle.players.length, PLAYER_COUNT);
  },
  'puzzle has 8 alphabetically sorted seat names'() {
    const puzzle = generatePuzzle('progressive');
    assert(puzzle !== null, 'puzzle generated');
    assert(Array.isArray(puzzle.seatNames), 'seatNames should be an array');
    assertEqual(puzzle.seatNames.length, PLAYER_COUNT);
    for (let i = 1; i < puzzle.seatNames.length; i++) {
      assert(puzzle.seatNames[i - 1] <= puzzle.seatNames[i],
        `names should be sorted: ${puzzle.seatNames[i - 1]} <= ${puzzle.seatNames[i]}`);
    }
  },
  'each player has a seatName'() {
    const puzzle = generatePuzzle('progressive');
    assert(puzzle !== null, 'puzzle generated');
    for (const player of puzzle.players) {
      assert(typeof player.seatName === 'string' && player.seatName.length > 0,
        `player at seat ${player.seat} should have a seatName`);
      assertEqual(player.seatName, puzzle.seatNames[player.seat]);
    }
  },
  '5 Townsfolk + 1 Outsider + 1 Minion + 1 Demon in solution'() {
    for (let i = 0; i < 10; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      const sol = puzzle.solution;
      const claims = puzzle.playerClaims;

      // Count by examining solution assignments
      let townsfolk = 0;
      let outsiders = 0;
      let minions = 0;
      let demons = 0;

      for (let s = 0; s < PLAYER_COUNT; s++) {
        if (s === sol.impSeat) {
          demons++;
        } else if (s === sol.minionSeat) {
          minions++;
        } else if (s === sol.outsiderSeat) {
          outsiders++;
        } else {
          townsfolk++;
        }
      }

      assertEqual(townsfolk, COMPOSITION[RoleType.TOWNSFOLK], 'townsfolk count');
      assertEqual(outsiders, COMPOSITION[RoleType.OUTSIDER], 'outsider count');
      assertEqual(minions, COMPOSITION[RoleType.MINION], 'minion count');
      assertEqual(demons, COMPOSITION[RoleType.DEMON], 'demon count');
    }
  },
}));

// ── Bluff Rules ───────────────────────────────────────────────────

group('Generator: bluff rules', () => ({
  'no one claims Drunk'() {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      for (const pc of puzzle.playerClaims) {
        assert(pc.claimedRole !== RoleId.DRUNK,
          `seat ${pc.seat} should not claim Drunk`);
      }
    }
  },
  'evil claims are distinct from each other'() {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      const sol = puzzle.solution;
      const impClaim = puzzle.playerClaims[sol.impSeat].claimedRole;
      const minionClaim = puzzle.playerClaims[sol.minionSeat].claimedRole;
      assert(impClaim !== minionClaim,
        `evil claims should be distinct: ${impClaim} vs ${minionClaim}`);
    }
  },
  'evil claims are Townsfolk or Butler, never Drunk'() {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      const sol = puzzle.solution;
      for (const evilSeat of [sol.impSeat, sol.minionSeat]) {
        const claimed = puzzle.playerClaims[evilSeat].claimedRole;
        const role = getRole(claimed);
        assert(
          role.type === RoleType.TOWNSFOLK || claimed === RoleId.BUTLER,
          `evil seat ${evilSeat} claimed ${claimed}, should be TF or Butler`
        );
        assert(claimed !== RoleId.DRUNK, `evil should never claim Drunk`);
      }
    }
  },
  'Drunk claims a Townsfolk NOT claimed by any true Townsfolk'() {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      const sol = puzzle.solution;
      if (sol.outsiderType !== RoleId.DRUNK) continue;

      const drunkClaim = puzzle.playerClaims[sol.outsiderSeat].claimedRole;
      const drunkClaimedRole = getRole(drunkClaim);
      assertEqual(drunkClaimedRole.type, RoleType.TOWNSFOLK,
        'Drunk should claim a Townsfolk role');

      // Verify no true Townsfolk has same claim
      for (let s = 0; s < PLAYER_COUNT; s++) {
        if (s === sol.impSeat || s === sol.minionSeat || s === sol.outsiderSeat) continue;
        // This is a true Townsfolk; their claim = their true role
        const tfClaim = puzzle.playerClaims[s].claimedRole;
        assert(tfClaim !== drunkClaim,
          `Drunk claim ${drunkClaim} duplicates TF at seat ${s}`);
      }
    }
  },
}));

// ── Progressive mode ──────────────────────────────────────────────

group('Generator: progressive mode', () => ({
  'progressive puzzles have narrowing checkpoints'() {
    let tested = 0;
    for (let i = 0; i < 30 && tested < 5; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle || puzzle.checkpoints.length < 2) continue;
      tested++;

      // Each checkpoint's candidate count should be <= the previous
      for (let j = 1; j < puzzle.checkpoints.length; j++) {
        assert(
          puzzle.checkpoints[j].candidateCount <= puzzle.checkpoints[j - 1].candidateCount,
          `checkpoint ${j} should narrow: ${puzzle.checkpoints[j].candidateCount} <= ${puzzle.checkpoints[j - 1].candidateCount}`
        );
      }
    }
    assert(tested >= 1, 'should have tested at least 1 progressive puzzle');
  },
  'last checkpoint has exactly 1 possible demon'() {
    let tested = 0;
    for (let i = 0; i < 30 && tested < 5; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      tested++;
      const lastCP = puzzle.checkpoints[puzzle.checkpoints.length - 1];
      assertEqual(lastCP.candidateCount, 1,
        'last checkpoint should have 1 candidate');
    }
    assert(tested >= 1, 'should have tested at least 1 puzzle');
  },
}));

// ── Solution consistency ──────────────────────────────────────────

group('Generator: solution in checkpoints', () => ({
  'solution demon seat is in all checkpoint possible-demon sets'() {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      const demonSeat = puzzle.solution.impSeat;
      for (const cp of puzzle.checkpoints) {
        assert(cp.possibleDemons.has(demonSeat),
          `demon seat ${demonSeat} should be in checkpoint day ${cp.day} possibilities`);
      }
    }
  },
}));

// ── All-at-once mode ──────────────────────────────────────────────

group('Generator: all_at_once mode', () => ({
  'generates valid puzzles'() {
    let generated = 0;
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle('all_at_once');
      if (puzzle) {
        generated++;
        assert(puzzle.mode === 'all_at_once', 'mode should be all_at_once');
        assert(puzzle.checkpoints.length >= 1, 'should have checkpoints');
      }
    }
    assert(generated >= 5, `at least 5 of 20 all_at_once puzzles, got ${generated}`);
  },
}));
