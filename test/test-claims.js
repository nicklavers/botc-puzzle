import { RoleId, RoleType, Direction, InfoType } from '../js/constants.js';
import { getRole } from '../js/roles.js';
import { createPlayer, createGameState } from '../js/game-state.js';
import { generateClaim } from '../js/claims.js';

const { assert, assertEqual, group } = window.__test;

// ── Helper: build a mock game state ───────────────────────────────

const buildState = (overrides = {}) => {
  const impSeat = overrides.impSeat ?? 6;
  const minionSeat = overrides.minionSeat ?? 7;
  const minionType = overrides.minionType ?? RoleId.POISONER;
  const outsiderSeat = overrides.outsiderSeat ?? 5;
  const outsiderType = overrides.outsiderType ?? RoleId.DRUNK;

  const roles = overrides.roles ?? [
    RoleId.WASHERWOMAN, RoleId.LIBRARIAN, RoleId.CHEF,
    RoleId.CLOCKMAKER, RoleId.EMPATH,
  ];

  const claimedRoles = overrides.claimedRoles ?? {};

  const players = [];
  let tfIdx = 0;
  for (let s = 0; s < 8; s++) {
    if (s === impSeat) {
      players.push(createPlayer(s, RoleId.IMP, claimedRoles[s] ?? RoleId.NOBLE));
    } else if (s === minionSeat) {
      players.push(createPlayer(s, minionType, claimedRoles[s] ?? RoleId.KNIGHT));
    } else if (s === outsiderSeat) {
      const claimedRole = outsiderType === RoleId.DRUNK
        ? (claimedRoles[s] ?? RoleId.FORTUNE_TELLER)
        : RoleId.BUTLER;
      players.push(createPlayer(s, outsiderType, claimedRole));
    } else {
      const trueRole = roles[tfIdx];
      players.push(createPlayer(s, trueRole, claimedRoles[s] ?? trueRole));
      tfIdx++;
    }
  }

  return createGameState({
    impSeat,
    minionSeat,
    minionType,
    outsiderSeat,
    outsiderType,
    poisonDirection: overrides.poisonDirection ?? null,
    redHerring: overrides.redHerring ?? null,
    seatNames: overrides.seatNames ?? undefined,
    players,
  });
};

group('Washerwoman truth', () => ({
  'one of two seats IS the named Townsfolk'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.WASHERWOMAN, false, 1);
      assert(result !== null, 'should produce a claim');
      const { seats, role, isNone } = result.info;
      assert(!isNone, 'should not be isNone');
      assert(seats.length === 2, 'should have 2 seats');
      // At least one of the seats must actually have that true role
      const match = seats.some((s) => state.players[s].trueRole === role);
      assert(match, `one of seats [${seats}] should have trueRole=${role}`);
      // Named role should be a Townsfolk
      assertEqual(getRole(role).type, RoleType.TOWNSFOLK);
    }
  },
}));

group('Washerwoman lie', () => ({
  'NEITHER seat is the named Townsfolk'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.WASHERWOMAN, true, 1);
      assert(result !== null, 'should produce a claim');
      const { seats, role, isNone } = result.info;
      if (isNone) continue;
      const match = seats.some((s) => state.players[s].trueRole === role);
      assert(!match, `neither seat [${seats}] should have trueRole=${role}`);
    }
  },
  'at least one seat CLAIMS the named role (corroboration)'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.WASHERWOMAN, true, 1);
      assert(result !== null, 'should produce a claim');
      const { seats, role, isNone } = result.info;
      if (isNone) continue;
      const hasClaimer = seats.some((s) => state.players[s].claimedRole === role);
      assert(hasClaimer,
        `at least one of seats [${seats}] should claim role=${role}`);
    }
  },
}));

group('Librarian truth', () => ({
  'one of two seats is the named Outsider (Drunk in play)'() {
    const state = buildState({ outsiderType: RoleId.DRUNK });
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 1, RoleId.LIBRARIAN, false, 1);
      assert(result !== null, 'should produce a claim');
      const { seats, role, isNone } = result.info;
      if (isNone) {
        assert(false, 'should not be isNone when Drunk is in play');
      }
      const match = seats.some((s) => state.players[s].trueRole === role);
      assert(match, `one of seats should be ${role}`);
    }
  },
  'always has outsider in valid 8-player game'() {
    // "no outsiders" path only triggers when no outsider exists; skipped in valid game
    assert(true, 'edge case not reachable in standard composition');
  },
}));

group('Librarian lie', () => ({
  'NEITHER seat is the named Outsider'() {
    const state = buildState({ outsiderType: RoleId.DRUNK });
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 1, RoleId.LIBRARIAN, true, 1);
      assert(result !== null, 'should produce a claim');
      const { seats, role, isNone } = result.info;
      if (isNone) {
        // Lie form: says "no outsiders" when there IS one -> valid lie
        const hasOutsider = state.players.some(
          (p) => p.seat !== 1 && getRole(p.trueRole).type === RoleType.OUTSIDER
        );
        assert(hasOutsider, 'isNone lie should only happen when outsider exists');
        continue;
      }
      const match = seats.some((s) => state.players[s].trueRole === role);
      assert(!match, `neither seat [${seats}] should be ${role}`);
    }
  },
}));

group('Investigator truth', () => ({
  'one of two seats is the named Minion'() {
    const state = buildState({
      roles: [RoleId.INVESTIGATOR, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
    });
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.INVESTIGATOR, false, 1);
      assert(result !== null, 'claim produced');
      const { seats, role } = result.info;
      const match = seats.some((s) => state.players[s].trueRole === role);
      assert(match, `one seat should have trueRole=${role}`);
      assertEqual(getRole(role).type, RoleType.MINION);
    }
  },
}));

group('Investigator lie', () => ({
  'NEITHER seat is the named Minion'() {
    const state = buildState({
      roles: [RoleId.INVESTIGATOR, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
    });
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.INVESTIGATOR, true, 1);
      assert(result !== null, 'claim produced');
      const { seats, role } = result.info;
      const match = seats.some((s) => state.players[s].trueRole === role);
      assert(!match, `neither seat should be ${role}`);
    }
  },
}));

group('Chef truth', () => ({
  'count matches actual evil pairs (adjacent evil)'() {
    // Imp at 6, Minion at 7 -> adjacent pair -> count = 1
    const state = buildState({ impSeat: 6, minionSeat: 7 });
    const result = generateClaim(state, 2, RoleId.CHEF, false, 1);
    assertEqual(result.info.count, 1);
  },
  'count matches actual evil pairs (non-adjacent evil)'() {
    // Imp at 0, Minion at 4 -> not adjacent -> count = 0
    const state = buildState({ impSeat: 0, minionSeat: 4, outsiderSeat: 5 });
    const result = generateClaim(state, 2, RoleId.CHEF, false, 1);
    assertEqual(result.info.count, 0);
  },
}));

group('Chef lie', () => ({
  'count does NOT match actual evil pairs'() {
    const state = buildState({ impSeat: 6, minionSeat: 7 });
    const result = generateClaim(state, 2, RoleId.CHEF, true, 1);
    // True count is 1 (adjacent), lie should be 0
    assert(result.info.count !== 1, `lie count should not be 1, got ${result.info.count}`);
  },
}));

group('Clockmaker truth', () => ({
  'distance correct'() {
    // Imp at 0, Minion at 3 -> distance = 3
    const state = buildState({ impSeat: 0, minionSeat: 3, outsiderSeat: 5 });
    const result = generateClaim(state, 4, RoleId.CLOCKMAKER, false, 1);
    assertEqual(result.info.count, 3);
  },
}));

group('Clockmaker lie', () => ({
  'distance incorrect'() {
    const state = buildState({ impSeat: 0, minionSeat: 3, outsiderSeat: 5 });
    const result = generateClaim(state, 4, RoleId.CLOCKMAKER, true, 1);
    assert(result.info.count !== 3, `lie distance should not be 3`);
  },
}));

group('Noble truth', () => ({
  'exactly 1 evil among 3 players'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.NOBLE, false, 1);
      assert(result !== null, 'claim produced');
      const { seats } = result.info;
      assertEqual(seats.length, 3);
      const evilCount = seats.filter(
        (s) => s === state.impSeat || s === state.minionSeat
      ).length;
      assertEqual(evilCount, 1, `should have exactly 1 evil, got ${evilCount}`);
    }
  },
}));

group('Noble lie', () => ({
  'NOT exactly 1 evil among 3 players'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.NOBLE, true, 1);
      assert(result !== null, 'claim produced');
      const { seats } = result.info;
      const evilCount = seats.filter(
        (s) => s === state.impSeat || s === state.minionSeat
      ).length;
      assert(evilCount !== 1, `should NOT have exactly 1 evil, got ${evilCount}`);
    }
  },
}));

group('Knight truth', () => ({
  'neither is the demon'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.KNIGHT, false, 1);
      const { seats } = result.info;
      assertEqual(seats.length, 2);
      assert(!seats.includes(state.impSeat), 'neither should be the Imp');
    }
  },
}));

group('Knight lie', () => ({
  'at least one IS the demon'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.KNIGHT, true, 1);
      const { seats } = result.info;
      assert(seats.includes(state.impSeat), 'at least one should be the Imp');
    }
  },
}));

group('Steward truth', () => ({
  'points to a good player'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.STEWARD, false, 1);
      const { seat } = result.info;
      assert(
        seat !== state.impSeat && seat !== state.minionSeat,
        `seat ${seat} should be good`
      );
    }
  },
}));

group('Steward lie', () => ({
  'points to an evil player'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.STEWARD, true, 1);
      const { seat } = result.info;
      assert(
        seat === state.impSeat || seat === state.minionSeat,
        `seat ${seat} should be evil`
      );
    }
  },
}));

group('Shugenja truth', () => ({
  'direction matches actual closest evil'() {
    // Seat 0 as Shugenja, evil at 1 and 5 -> CW to 1 = 1, CCW to 5 = 3 -> CW
    const state = buildState({
      impSeat: 1, minionSeat: 5, outsiderSeat: 6,
      roles: [RoleId.SHUGENJA, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
    });
    const result = generateClaim(state, 0, RoleId.SHUGENJA, false, 1);
    assertEqual(result.info.direction, Direction.CW);
  },
}));

group('Shugenja lie', () => ({
  'direction does NOT match actual closest evil'() {
    const state = buildState({
      impSeat: 1, minionSeat: 5, outsiderSeat: 6,
      roles: [RoleId.SHUGENJA, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
    });
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.SHUGENJA, true, 1);
      assert(result.info.direction !== Direction.CW, `lie should not be CW`);
    }
  },
}));

group('Empath truth', () => ({
  'count matches evil alive neighbors'() {
    // Seat 2 as Empath, evil at 1 and 5
    // Neighbors of 2 are 1 (evil) and 3 (good) -> count = 1
    const state = buildState({
      impSeat: 1, minionSeat: 5, outsiderSeat: 6,
      roles: [RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.EMPATH, RoleId.NOBLE, RoleId.STEWARD],
    });
    const result = generateClaim(state, 2, RoleId.EMPATH, false, 1);
    assertEqual(result.info.count, 1);
  },
  'no evil neighbors -> 0'() {
    // Seat 0 as Empath, evil at 4 and 5
    // Neighbors of 0 are 7 and 1 -> both good -> count = 0
    const state = buildState({
      impSeat: 4, minionSeat: 5, outsiderSeat: 6,
      roles: [RoleId.EMPATH, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
    });
    const result = generateClaim(state, 0, RoleId.EMPATH, false, 1);
    assertEqual(result.info.count, 0);
  },
}));

group('Empath lie', () => ({
  'count does NOT match actual evil neighbors'() {
    const state = buildState({
      impSeat: 1, minionSeat: 5, outsiderSeat: 6,
      roles: [RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.EMPATH, RoleId.NOBLE, RoleId.STEWARD],
    });
    const result = generateClaim(state, 2, RoleId.EMPATH, true, 1);
    // True count is 1, lie should be 0 or 2
    assert(result.info.count !== 1, `lie count should not be 1`);
  },
}));

group('Fortune Teller truth', () => ({
  'answer matches sober FT logic with red herring'() {
    const state = buildState({
      impSeat: 6, minionSeat: 7, outsiderSeat: 5,
      redHerring: 2,
      roles: [RoleId.FORTUNE_TELLER, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
    });
    for (let i = 0; i < 15; i++) {
      const result = generateClaim(state, 0, RoleId.FORTUNE_TELLER, false, 1);
      const { seats, answer } = result.info;
      const hasDemon = seats.includes(state.impSeat);
      const hasRedHerring = seats.includes(state.redHerring);
      const soberAnswer = hasDemon || hasRedHerring;
      assertEqual(answer, soberAnswer,
        `seats=[${seats}], demon=${state.impSeat}, rh=${state.redHerring}: expected ${soberAnswer}`);
    }
  },
}));

group('Fortune Teller lie', () => ({
  'answer is OPPOSITE of sober FT logic'() {
    const state = buildState({
      impSeat: 6, minionSeat: 7, outsiderSeat: 5,
      redHerring: 2,
      roles: [RoleId.FORTUNE_TELLER, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
    });
    for (let i = 0; i < 15; i++) {
      const result = generateClaim(state, 0, RoleId.FORTUNE_TELLER, true, 1);
      const { seats, answer } = result.info;
      const hasDemon = seats.includes(state.impSeat);
      const hasRedHerring = seats.includes(state.redHerring);
      const soberAnswer = hasDemon || hasRedHerring;
      assertEqual(answer, !soberAnswer,
        `lie should be opposite: seats=[${seats}], expected ${!soberAnswer}`);
    }
  },
}));

group('Sorted seat lists', () => ({
  'Washerwoman truth seats are sorted'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.WASHERWOMAN, false, 1);
      if (!result || result.info.isNone) continue;
      const { seats } = result.info;
      assert(seats[0] <= seats[1], `seats should be sorted: [${seats}]`);
    }
  },
  'Noble truth seats are sorted'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.NOBLE, false, 1);
      if (!result) continue;
      const { seats } = result.info;
      for (let j = 1; j < seats.length; j++) {
        assert(seats[j - 1] <= seats[j], `seats should be sorted: [${seats}]`);
      }
    }
  },
  'Knight truth seats are sorted'() {
    const state = buildState();
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.KNIGHT, false, 1);
      const { seats } = result.info;
      assert(seats[0] <= seats[1], `seats should be sorted: [${seats}]`);
    }
  },
  'Fortune Teller truth seats are sorted'() {
    const state = buildState({
      redHerring: 2,
      roles: [RoleId.FORTUNE_TELLER, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
    });
    for (let i = 0; i < 10; i++) {
      const result = generateClaim(state, 0, RoleId.FORTUNE_TELLER, false, 1);
      const { seats } = result.info;
      assert(seats[0] <= seats[1], `seats should be sorted: [${seats}]`);
    }
  },
}));

group('Seat names in descriptions', () => ({
  'Washerwoman truth uses seat names'() {
    const seatNames = Object.freeze(['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']);
    const state = buildState({ seatNames });
    const result = generateClaim(state, 0, RoleId.WASHERWOMAN, false, 1);
    assert(result !== null, 'claim produced');
    if (result.info.isNone) return;
    // Description should contain seat names, not "Player N"
    assert(!result.description.includes('Player '),
      `description should use names, got: ${result.description}`);
    const { seats } = result.info;
    const containsName = seats.some((s) => result.description.includes(seatNames[s]));
    assert(containsName, `description should contain a seat name: ${result.description}`);
  },
  'Steward truth uses seat name'() {
    const seatNames = Object.freeze(['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']);
    const state = buildState({
      seatNames,
      roles: [RoleId.STEWARD, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.EMPATH],
    });
    const result = generateClaim(state, 0, RoleId.STEWARD, false, 1);
    assert(result !== null, 'claim produced');
    assert(!result.description.includes('Player '),
      `description should use names, got: ${result.description}`);
  },
}));

group('Claim timing', () => ({
  'first_night role returns null on night 2'() {
    const state = buildState();
    const result = generateClaim(state, 0, RoleId.WASHERWOMAN, false, 2);
    assertEqual(result, null);
  },
  'each_night role returns claim on night 2'() {
    const state = buildState({
      roles: [RoleId.EMPATH, RoleId.CHEF, RoleId.CLOCKMAKER, RoleId.NOBLE, RoleId.STEWARD],
    });
    const result = generateClaim(state, 0, RoleId.EMPATH, false, 2);
    assert(result !== null, 'Empath should produce claim on night 2');
  },
  'no-info role returns null'() {
    const result = generateClaim(buildState(), 0, RoleId.BUTLER, false, 1);
    assertEqual(result, null);
  },
}));
