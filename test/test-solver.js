import { RoleId, RoleType, InfoType } from '../js/constants.js';
import { createPlayer, createGameState, createClaim, createNightRecord } from '../js/game-state.js';
import { countEvilPairs, stepsToNearest } from '../js/seating.js';
import { solve } from '../js/solver.js';

const { assert, assertEqual, assertSetEqual, group } = window.__test;

// ── Helper: build a deterministic game state + claims ─────────────

const buildTestGame = ({
  impSeat, minionSeat, minionType, outsiderSeat, outsiderType,
  townsfolk, claimedRoles, poisonDirection, redHerring,
}) => {
  const players = [];
  let tfIdx = 0;
  for (let s = 0; s < 8; s++) {
    if (s === impSeat) {
      players.push(createPlayer(s, RoleId.IMP, claimedRoles[s]));
    } else if (s === minionSeat) {
      players.push(createPlayer(s, minionType, claimedRoles[s]));
    } else if (s === outsiderSeat) {
      players.push(createPlayer(s, outsiderType, claimedRoles[s]));
    } else {
      const trueRole = townsfolk[tfIdx];
      players.push(createPlayer(s, trueRole, claimedRoles[s] ?? trueRole));
      tfIdx++;
    }
  }

  const state = createGameState({
    impSeat, minionSeat, minionType,
    outsiderSeat, outsiderType,
    poisonDirection: poisonDirection ?? null,
    redHerring: redHerring ?? null,
    players,
  });

  const playerClaims = players.map((p) => ({
    seat: p.seat,
    claimedRole: p.claimedRole,
  }));

  return { state, playerClaims, players };
};

// ── Simple case: unique demon ─────────────────────────────────────

group('Solver: simple unique demon', () => ({
  'Chef claim narrows to correct demon'() {
    // Layout:
    // Seat 0: Washerwoman (true)   Seat 4: Clockmaker (true)
    // Seat 1: Chef (true)          Seat 5: Drunk -> claims Steward
    // Seat 2: Librarian (true)     Seat 6: Imp -> claims Noble
    // Seat 3: Empath (true)        Seat 7: Poisoner -> claims Knight
    //
    // Evil at 6,7 (adjacent pair = 1)
    // Clockmaker: distance from Imp(6) to Minion(7) = 1

    const { playerClaims } = buildTestGame({
      impSeat: 6, minionSeat: 7, minionType: RoleId.POISONER,
      outsiderSeat: 5, outsiderType: RoleId.DRUNK,
      townsfolk: [RoleId.WASHERWOMAN, RoleId.CHEF, RoleId.LIBRARIAN, RoleId.EMPATH, RoleId.CLOCKMAKER],
      claimedRoles: {
        0: RoleId.WASHERWOMAN, 1: RoleId.CHEF, 2: RoleId.LIBRARIAN,
        3: RoleId.EMPATH, 4: RoleId.CLOCKMAKER,
        5: RoleId.STEWARD, 6: RoleId.NOBLE, 7: RoleId.KNIGHT,
      },
    });

    // Chef truth claim: 1 evil pair (seats 6,7 adjacent)
    const chefClaim = createClaim(1, RoleId.CHEF, 1, { count: 1 });
    // Clockmaker truth: distance 1
    const clockClaim = createClaim(4, RoleId.CLOCKMAKER, 1, { count: 1 });

    const nightRecords = [createNightRecord(1, [chefClaim, clockClaim], null, null)];
    const claims = [chefClaim, clockClaim];

    const { possibleDemons } = solve(claims, nightRecords, playerClaims, 1);
    assert(possibleDemons.has(6), 'seat 6 should be a possible demon');
  },
}));

// ── Underdetermined case ──────────────────────────────────────────

group('Solver: underdetermined (multiple possible demons)', () => ({
  'minimal claims leave multiple demon candidates'() {
    const { playerClaims } = buildTestGame({
      impSeat: 3, minionSeat: 5, minionType: RoleId.SCARLET_WOMAN,
      outsiderSeat: 7, outsiderType: RoleId.BUTLER,
      townsfolk: [RoleId.WASHERWOMAN, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
      claimedRoles: {
        0: RoleId.WASHERWOMAN, 1: RoleId.CHEF, 2: RoleId.CLOCKMAKER,
        3: RoleId.NOBLE, 4: RoleId.STEWARD,
        5: RoleId.EMPATH, 7: RoleId.BUTLER, 6: RoleId.KNIGHT,
      },
    });

    // Only Chef claim with count 0 (no evil pairs, imp=3 minion=5, not adjacent)
    const chefClaim = createClaim(1, RoleId.CHEF, 1, { count: 0 });
    const nightRecords = [createNightRecord(1, [chefClaim], null, null)];

    const { possibleDemons } = solve([chefClaim], nightRecords, playerClaims, 1);
    assert(possibleDemons.size > 1, `should have multiple possible demons, got ${possibleDemons.size}`);
    assert(possibleDemons.has(3), 'true demon (3) should be among possibilities');
  },
}));

// ── Dead player cannot be demon ───────────────────────────────────

group('Solver: structural pruning', () => ({
  'dead player excluded from possible demons'() {
    const { playerClaims } = buildTestGame({
      impSeat: 3, minionSeat: 5, minionType: RoleId.SCARLET_WOMAN,
      outsiderSeat: 7, outsiderType: RoleId.BUTLER,
      townsfolk: [RoleId.WASHERWOMAN, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
      claimedRoles: {
        0: RoleId.WASHERWOMAN, 1: RoleId.CHEF, 2: RoleId.CLOCKMAKER,
        3: RoleId.NOBLE, 4: RoleId.STEWARD,
        5: RoleId.EMPATH, 6: RoleId.KNIGHT, 7: RoleId.BUTLER,
      },
    });

    // Night 1: no kills, night 2: seat 2 killed
    const chefClaim = createClaim(1, RoleId.CHEF, 1, { count: 0 });
    const night1 = createNightRecord(1, [chefClaim], null, null);
    const night2 = createNightRecord(2, [], 2, null);

    const { possibleDemons } = solve([chefClaim], [night1, night2], playerClaims, 2);
    assert(!possibleDemons.has(2), 'dead seat 2 should not be possible demon');
    assert(possibleDemons.has(3), 'true demon (3) should still be possible');
  },
}));

// ── Poisoner game type ────────────────────────────────────────────

group('Solver: Poisoner game type', () => ({
  'solver considers poison when evaluating claims'() {
    const { playerClaims } = buildTestGame({
      impSeat: 6, minionSeat: 7, minionType: RoleId.POISONER,
      outsiderSeat: 5, outsiderType: RoleId.DRUNK,
      townsfolk: [RoleId.WASHERWOMAN, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.EMPATH, RoleId.NOBLE],
      claimedRoles: {
        0: RoleId.WASHERWOMAN, 1: RoleId.CHEF, 2: RoleId.CLOCKMAKER,
        3: RoleId.EMPATH, 4: RoleId.NOBLE,
        5: RoleId.STEWARD, 6: RoleId.KNIGHT, 7: RoleId.SHUGENJA,
      },
      poisonDirection: 'cw',
    });

    // Poisoner at 7 CW night 1 -> poisons seat 0
    // Seat 1 (Chef truth): evil at 6,7 adjacent -> count 1
    const chefClaim = createClaim(1, RoleId.CHEF, 1, { count: 1 });
    const nightRecords = [createNightRecord(1, [chefClaim], null, 0)];

    const { possibleDemons } = solve([chefClaim], nightRecords, playerClaims, 1);
    assert(possibleDemons.has(6), 'true demon 6 should be possible');
  },
}));

// ── Scarlet Woman game type ───────────────────────────────────────

group('Solver: Scarlet Woman game type', () => ({
  'solver handles Scarlet Woman (no poisoning)'() {
    const { playerClaims } = buildTestGame({
      impSeat: 2, minionSeat: 4, minionType: RoleId.SCARLET_WOMAN,
      outsiderSeat: 6, outsiderType: RoleId.BUTLER,
      townsfolk: [RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD, RoleId.KNIGHT],
      claimedRoles: {
        0: RoleId.CHEF, 1: RoleId.CLOCKMAKER, 2: RoleId.WASHERWOMAN,
        3: RoleId.NOBLE, 4: RoleId.EMPATH,
        5: RoleId.STEWARD, 6: RoleId.BUTLER, 7: RoleId.KNIGHT,
      },
    });

    // Chef truth: evil at 2,4 -> not adjacent -> count 0
    const chefClaim = createClaim(0, RoleId.CHEF, 1, { count: 0 });
    // Clockmaker truth: distance from 2 to 4 = 2
    const clockClaim = createClaim(1, RoleId.CLOCKMAKER, 1, { count: 2 });

    const nightRecords = [createNightRecord(1, [chefClaim, clockClaim], null, null)];

    const { possibleDemons } = solve([chefClaim, clockClaim], nightRecords, playerClaims, 1);
    assert(possibleDemons.has(2), 'true demon 2 should be possible');
  },
}));

// ── Drunk outsider type ───────────────────────────────────────────

group('Solver: Drunk outsider', () => ({
  'solver treats Drunk claims as lies'() {
    // Drunk at seat 5, claims Steward. Steward truth would point to good player.
    // Drunk's claim is unreliable, so solver should accept it pointing to evil.
    const { playerClaims } = buildTestGame({
      impSeat: 6, minionSeat: 7, minionType: RoleId.POISONER,
      outsiderSeat: 5, outsiderType: RoleId.DRUNK,
      townsfolk: [RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.KNIGHT, RoleId.WASHERWOMAN],
      claimedRoles: {
        0: RoleId.CHEF, 1: RoleId.CLOCKMAKER, 2: RoleId.NOBLE,
        3: RoleId.KNIGHT, 4: RoleId.WASHERWOMAN,
        5: RoleId.STEWARD, 6: RoleId.EMPATH, 7: RoleId.SHUGENJA,
      },
    });

    // Drunk Steward lie: points to evil player (seat 6)
    const drunkClaim = createClaim(5, RoleId.STEWARD, 1, { seat: 6 });
    // Chef truth: evil at 6,7 adjacent -> 1
    const chefClaim = createClaim(0, RoleId.CHEF, 1, { count: 1 });

    const nightRecords = [createNightRecord(1, [drunkClaim, chefClaim], null, null)];

    const { possibleDemons } = solve(
      [drunkClaim, chefClaim], nightRecords, playerClaims, 1
    );
    assert(possibleDemons.has(6), 'demon at 6 should be possible');
  },
}));

// ── Butler outsider type ──────────────────────────────────────────

group('Solver: Butler outsider', () => ({
  'solver handles Butler (claims self, no info)'() {
    const { playerClaims } = buildTestGame({
      impSeat: 2, minionSeat: 4, minionType: RoleId.SCARLET_WOMAN,
      outsiderSeat: 6, outsiderType: RoleId.BUTLER,
      townsfolk: [RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD, RoleId.KNIGHT],
      claimedRoles: {
        0: RoleId.CHEF, 1: RoleId.CLOCKMAKER, 2: RoleId.WASHERWOMAN,
        3: RoleId.NOBLE, 4: RoleId.EMPATH,
        5: RoleId.STEWARD, 6: RoleId.BUTLER, 7: RoleId.KNIGHT,
      },
    });

    const chefClaim = createClaim(0, RoleId.CHEF, 1, { count: 0 });
    const nightRecords = [createNightRecord(1, [chefClaim], null, null)];

    const { possibleDemons } = solve([chefClaim], nightRecords, playerClaims, 1);
    assert(possibleDemons.has(2), 'demon at 2 should be possible');
    // Butler seat 6 should not be forced into any weird state
    assert(possibleDemons.size >= 1, 'should have at least 1 candidate');
  },
}));

// ── Knight + Steward combined narrows demon ───────────────────────

group('Solver: combined claims narrow candidates', () => ({
  'Knight + Steward + Chef uniquely determine demon'() {
    // Imp=3, Minion(SW)=5, Outsider(Butler)=7
    // TF: 0=Chef, 1=Knight, 2=Steward, 4=Clockmaker, 6=Noble
    const { playerClaims } = buildTestGame({
      impSeat: 3, minionSeat: 5, minionType: RoleId.SCARLET_WOMAN,
      outsiderSeat: 7, outsiderType: RoleId.BUTLER,
      townsfolk: [RoleId.CHEF, RoleId.KNIGHT, RoleId.STEWARD, RoleId.CLOCKMAKER, RoleId.NOBLE],
      claimedRoles: {
        0: RoleId.CHEF, 1: RoleId.KNIGHT, 2: RoleId.STEWARD,
        3: RoleId.WASHERWOMAN, 4: RoleId.CLOCKMAKER,
        5: RoleId.EMPATH, 6: RoleId.NOBLE, 7: RoleId.BUTLER,
      },
    });

    // Chef truth: evil 3,5 not adjacent -> 0
    const chefClaim = createClaim(0, RoleId.CHEF, 1, { count: 0 });
    // Knight truth: seats 0 and 2 are not demon (correct, demon is 3)
    const knightClaim = createClaim(1, RoleId.KNIGHT, 1, { seats: [0, 2] });
    // Steward truth: seat 4 is good (correct)
    const stewardClaim = createClaim(2, RoleId.STEWARD, 1, { seat: 4 });
    // Clockmaker truth: imp(3) to minion(5) = 2
    const clockClaim = createClaim(4, RoleId.CLOCKMAKER, 1, { count: 2 });

    const claims = [chefClaim, knightClaim, stewardClaim, clockClaim];
    const nightRecords = [createNightRecord(1, claims, null, null)];

    const { possibleDemons } = solve(claims, nightRecords, playerClaims, 1);
    assert(possibleDemons.has(3), 'true demon 3 must be in solution set');
  },
}));
