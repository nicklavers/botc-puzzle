import { RoleId, RoleType } from '../js/constants.js';
import { getRole } from '../js/roles.js';
import { generatePuzzle } from '../js/generator.js';
import { solve } from '../js/solver.js';

const { assert, assertEqual, group } = window.__test;

// ── Round-trip: generate -> solve -> verify ───────────────────────

group('Integration: generate then solve (progressive)', () => ({
  'solver finds the correct demon in generated puzzles'() {
    let tested = 0;
    for (let i = 0; i < 30 && tested < 10; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      tested++;

      const { possibleDemons } = solve(
        puzzle.allClaims,
        puzzle.nights.map((n) => ({
          nightNum: n.nightNum,
          claims: n.claims,
          killed: n.killed,
          poisonTarget: null, // solver doesn't use this from nightRecord
        })),
        puzzle.playerClaims,
        puzzle.totalNights
      );

      assert(possibleDemons.has(puzzle.solution.impSeat),
        `solver should find demon at seat ${puzzle.solution.impSeat}, ` +
        `got possibilities: {${[...possibleDemons].join(',')}}`);
    }
    assert(tested >= 5, `should test at least 5 puzzles, tested ${tested}`);
  },
}));

group('Integration: generate then solve (all_at_once)', () => ({
  'solver finds correct demon in all_at_once mode'() {
    let tested = 0;
    for (let i = 0; i < 30 && tested < 5; i++) {
      const puzzle = generatePuzzle('all_at_once');
      if (!puzzle) continue;
      tested++;

      const { possibleDemons } = solve(
        puzzle.allClaims,
        puzzle.nights.map((n) => ({
          nightNum: n.nightNum,
          claims: n.claims,
          killed: n.killed,
          poisonTarget: null,
        })),
        puzzle.playerClaims,
        puzzle.totalNights
      );

      assert(possibleDemons.has(puzzle.solution.impSeat),
        `all_at_once: solver should find demon at ${puzzle.solution.impSeat}`);
      assertEqual(possibleDemons.size, 1,
        'all_at_once should converge to exactly 1 demon');
    }
    assert(tested >= 1, `should test at least 1 all_at_once puzzle`);
  },
}));

// ── Claim consistency ─────────────────────────────────────────────

group('Integration: claim consistency', () => ({
  'all claims reference valid seats (0-7)'() {
    for (let i = 0; i < 10; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      for (const claim of puzzle.allClaims) {
        assert(claim.seat >= 0 && claim.seat < 8,
          `claim seat ${claim.seat} out of range`);
        assert(claim.night >= 1, `claim night ${claim.night} should be >= 1`);

        const info = claim.info;
        if (info.seats) {
          for (const s of info.seats) {
            assert(s >= 0 && s < 8, `info seat ${s} out of range`);
          }
        }
        if (info.seat !== undefined && info.seat !== null) {
          assert(info.seat >= 0 && info.seat < 8, `info.seat ${info.seat} out of range`);
        }
      }
    }
  },
  'all claimed roles are valid role IDs'() {
    for (let i = 0; i < 10; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      for (const pc of puzzle.playerClaims) {
        // getRole throws if invalid
        const role = getRole(pc.claimedRole);
        assert(role !== null, `${pc.claimedRole} should be a valid role`);
      }
    }
  },
  'claims from true Townsfolk match their true role'() {
    for (let i = 0; i < 10; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      const sol = puzzle.solution;
      for (let s = 0; s < 8; s++) {
        if (s === sol.impSeat || s === sol.minionSeat || s === sol.outsiderSeat) continue;
        // True Townsfolk claim their true role
        const claimed = puzzle.playerClaims[s].claimedRole;
        const claimedRole = getRole(claimed);
        assertEqual(claimedRole.type, RoleType.TOWNSFOLK,
          `TF at seat ${s} should claim a Townsfolk role`);
      }
    }
  },
}));

// ── Progressive narrowing round-trip ──────────────────────────────

group('Integration: progressive narrowing', () => ({
  'each checkpoint narrows or maintains candidate count'() {
    let tested = 0;
    for (let i = 0; i < 30 && tested < 5; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle || puzzle.checkpoints.length < 2) continue;
      tested++;

      let prevCount = Infinity;
      for (const cp of puzzle.checkpoints) {
        assert(cp.candidateCount <= prevCount,
          `day ${cp.day}: ${cp.candidateCount} should be <= ${prevCount}`);
        prevCount = cp.candidateCount;
      }
    }
    assert(tested >= 1, 'should test at least 1 multi-checkpoint puzzle');
  },
}));

// ── No duplicate true Townsfolk roles ─────────────────────────────

group('Integration: role uniqueness', () => ({
  'no two true Townsfolk share the same role'() {
    for (let i = 0; i < 10; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      const sol = puzzle.solution;
      const tfRoles = [];
      for (let s = 0; s < 8; s++) {
        if (s === sol.impSeat || s === sol.minionSeat || s === sol.outsiderSeat) continue;
        tfRoles.push(puzzle.playerClaims[s].claimedRole);
      }
      const uniqueRoles = new Set(tfRoles);
      assertEqual(uniqueRoles.size, tfRoles.length,
        `TF roles should be unique: ${tfRoles.join(', ')}`);
    }
  },
}));

// ── Kill targets are not the Imp ──────────────────────────────────

group('Integration: kill validity', () => ({
  'killed players are never the Imp'() {
    for (let i = 0; i < 10; i++) {
      const puzzle = generatePuzzle('progressive');
      if (!puzzle) continue;
      for (const night of puzzle.nights) {
        if (night.killed !== null) {
          assert(night.killed !== puzzle.solution.impSeat,
            `killed seat ${night.killed} should not be the Imp`);
        }
      }
    }
  },
}));
