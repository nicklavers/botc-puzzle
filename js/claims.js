import {
  RoleId, RoleType, InfoType, InfoTiming, Direction, PLAYER_COUNT, SCRIPT,
} from './constants.js';
import { getRole, isEvil } from './roles.js';
import {
  getNeighbors, getAliveNeighbors, countEvilPairs, stepsToNearest,
  closestEvilDirection, allSeats, otherSeats,
} from './seating.js';
import {
  getEvilSeats, isEvilSeat, getAliveSeats, getDeadSeats,
} from './game-state.js';

// ── Random Helpers ─────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const pickN = (arr, n) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

const pickExcluding = (arr, exclude) => {
  const filtered = arr.filter((x) => !exclude.includes(x));
  return pick(filtered);
};

// ── Claim Generators by InfoType ───────────────────────────────────
// Each generator returns { info, description } where info is structured
// data and description is a human-readable string.

// ── ONE_OF_TWO_IS_ROLE (Washerwoman, Librarian, Investigator) ──────

const generateOneOfTwoTruth = (state, seat, targetRoleType) => {
  const players = state.players;
  const names = state.seatNames;
  const trueTargets = players.filter(
    (p) => p.seat !== seat && getRole(p.trueRole).type === targetRoleType
  );

  if (trueTargets.length === 0) {
    // Librarian special: "You learn there are no Outsiders" when Butler not in play
    if (targetRoleType === RoleType.OUTSIDER) {
      return {
        info: { seats: [], role: null, isNone: true },
        description: `There are no ${targetRoleType}s in play.`,
      };
    }
    // Should not happen for Washerwoman/Investigator in valid game
    return null;
  }

  const target = pick(trueTargets);
  const otherCandidates = players.filter(
    (p) => p.seat !== seat && p.seat !== target.seat
  );
  const other = pick(otherCandidates);
  const pair = [target.seat, other.seat].sort((a, b) => a - b);

  return {
    info: { seats: pair, role: target.trueRole, isNone: false },
    description: `One of ${names[pair[0]]} or ${names[pair[1]]} is the ${getRole(target.trueRole).name}.`,
  };
};

/**
 * Generic lie: pick a role from targetRoleType, name 2 players who don't truly
 * have it. Used for Investigator (MINION targets) where no public cross-reference
 * is possible since nobody claims Minion.
 */
const generateOneOfTwoLie = (state, seat, targetRoleType) => {
  const players = state.players;
  const names = state.seatNames;
  const possibleRoles = SCRIPT[targetRoleType];
  const claimedRole = pick(possibleRoles);

  const validTargets = players.filter(
    (p) => p.seat !== seat && p.trueRole !== claimedRole
  );

  if (validTargets.length < 2) {
    const pair = pickN(otherSeats(seat), 2).sort((a, b) => a - b);
    return {
      info: { seats: pair, role: claimedRole, isNone: false },
      description: `One of ${names[pair[0]]} or ${names[pair[1]]} is the ${getRole(claimedRole).name}.`,
    };
  }

  const pair = pickN(validTargets, 2).map((p) => p.seat).sort((a, b) => a - b);
  return {
    info: { seats: pair, role: claimedRole, isNone: false },
    description: `One of ${names[pair[0]]} or ${names[pair[1]]} is the ${getRole(claimedRole).name}.`,
  };
};

/**
 * Smarter Washerwoman lie: names a Townsfolk role + a pair where one player
 * actually CLAIMS that role (but doesn't truly hold it), so the lie can't be
 * immediately disproven by cross-referencing public claims.
 */
const generateOneOfTwoLieWasherwoman = (state, seat) => {
  const players = state.players;
  const names = state.seatNames;

  // Find "false TF claimers": players (not self) whose claimedRole is a
  // Townsfolk but whose trueRole differs (evil players or Drunk bluffing TF).
  const falseTFClaimers = players.filter(
    (p) => p.seat !== seat &&
           p.claimedRole !== p.trueRole &&
           getRole(p.claimedRole).type === RoleType.TOWNSFOLK
  );

  if (falseTFClaimers.length > 0) {
    const claimer = pick(falseTFClaimers);
    const namedRole = claimer.claimedRole;

    // Pick a second player (not self, not the claimer) whose true role is NOT
    // the named role — ensures the claim is actually false.
    const secondCandidates = players.filter(
      (p) => p.seat !== seat &&
             p.seat !== claimer.seat &&
             p.trueRole !== namedRole
    );

    if (secondCandidates.length > 0) {
      const second = pick(secondCandidates);
      const pair = [claimer.seat, second.seat].sort((a, b) => a - b);
      return {
        info: { seats: pair, role: namedRole, isNone: false },
        description: `One of ${names[pair[0]]} or ${names[pair[1]]} is the ${getRole(namedRole).name}.`,
      };
    }
  }

  // Fallback: use generic random lie (shouldn't normally reach here)
  return generateOneOfTwoLie(state, seat, RoleType.TOWNSFOLK);
};

/**
 * Smarter Librarian lie: names an Outsider role + pair where at least one
 * player claims that role (if Butler), or uses Drunk (which no one claims).
 */
const generateOneOfTwoLieLibrarian = (state, seat) => {
  const players = state.players;
  const names = state.seatNames;
  const hasOutsider = players.some(
    (p) => p.seat !== seat && getRole(p.trueRole).type === RoleType.OUTSIDER
  );

  // "No outsiders" lie: only when outsiders ARE in play (~30% chance)
  if (hasOutsider && Math.random() < 0.3) {
    return {
      info: { seats: [], role: null, isNone: true },
      description: 'There are no Outsiders in play.',
    };
  }

  // Try Butler first, then Drunk
  const outsiderChoices = Math.random() < 0.5
    ? [RoleId.BUTLER, RoleId.DRUNK]
    : [RoleId.DRUNK, RoleId.BUTLER];

  for (const outsiderRole of outsiderChoices) {
    if (outsiderRole === RoleId.BUTLER) {
      // Need a player who claims Butler but isn't truly Butler
      const butlerClaimers = players.filter(
        (p) => p.seat !== seat &&
               p.claimedRole === RoleId.BUTLER &&
               p.trueRole !== RoleId.BUTLER
      );
      if (butlerClaimers.length > 0) {
        const claimer = pick(butlerClaimers);
        const secondCandidates = players.filter(
          (p) => p.seat !== seat &&
                 p.seat !== claimer.seat &&
                 p.trueRole !== RoleId.BUTLER
        );
        if (secondCandidates.length > 0) {
          const second = pick(secondCandidates);
          const pair = [claimer.seat, second.seat].sort((a, b) => a - b);
          return {
            info: { seats: pair, role: RoleId.BUTLER, isNone: false },
            description: `One of ${names[pair[0]]} or ${names[pair[1]]} is the ${getRole(RoleId.BUTLER).name}.`,
          };
        }
      }
    } else {
      // Drunk: no one publicly claims Drunk, so always safe.
      // Pick any 2 players (not self) who aren't truly the Drunk.
      const validTargets = players.filter(
        (p) => p.seat !== seat && p.trueRole !== RoleId.DRUNK
      );
      if (validTargets.length >= 2) {
        const pair = pickN(validTargets, 2).map((p) => p.seat).sort((a, b) => a - b);
        return {
          info: { seats: pair, role: RoleId.DRUNK, isNone: false },
          description: `One of ${names[pair[0]]} or ${names[pair[1]]} is the ${getRole(RoleId.DRUNK).name}.`,
        };
      }
    }
  }

  // Final fallback: generic outsider lie
  return generateOneOfTwoLie(state, seat, RoleType.OUTSIDER);
};

// ── EVIL_PAIR_COUNT (Chef) ─────────────────────────────────────────

const generateEvilPairCountTruth = (state) => {
  const evilSeats = getEvilSeats(state);
  const count = countEvilPairs(evilSeats);
  return {
    info: { count },
    description: `There ${count === 1 ? 'is' : 'are'} ${count} pair${count !== 1 ? 's' : ''} of evil players sitting next to each other.`,
  };
};

const generateEvilPairCountLie = (state) => {
  const evilSeats = getEvilSeats(state);
  const trueCount = countEvilPairs(evilSeats);
  // Lie: any count that isn't the true count (0 or 1 for 2 evil players)
  const possibleCounts = [0, 1].filter((c) => c !== trueCount);
  const count = pick(possibleCounts);
  return {
    info: { count },
    description: `There ${count === 1 ? 'is' : 'are'} ${count} pair${count !== 1 ? 's' : ''} of evil players sitting next to each other.`,
  };
};

// ── STEP_COUNT (Clockmaker) ────────────────────────────────────────

const generateStepCountTruth = (state) => {
  const dist = stepsToNearest(state.impSeat, [state.minionSeat]);
  return {
    info: { count: dist },
    description: `The Demon and nearest Minion are ${dist} step${dist !== 1 ? 's' : ''} apart.`,
  };
};

const generateStepCountLie = (state) => {
  const trueDist = stepsToNearest(state.impSeat, [state.minionSeat]);
  const maxDist = Math.floor(PLAYER_COUNT / 2);
  const possibleDists = [];
  for (let d = 1; d <= maxDist; d++) {
    if (d !== trueDist) possibleDists.push(d);
  }
  const count = pick(possibleDists);
  return {
    info: { count },
    description: `The Demon and nearest Minion are ${count} step${count !== 1 ? 's' : ''} apart.`,
  };
};

// ── THREE_PLAYERS_ONE_EVIL (Noble) ─────────────────────────────────

const generateNobleTruth = (state, seat) => {
  // Pick 3 players (not self) with exactly 1 evil among them
  const others = otherSeats(seat);
  const names = state.seatNames;
  const evilOthers = others.filter((s) => isEvilSeat(state, s));
  const goodOthers = others.filter((s) => !isEvilSeat(state, s));

  if (evilOthers.length === 0 || goodOthers.length < 2) return null;

  const evilPick = pick(evilOthers);
  const goodPicks = pickN(goodOthers, 2);
  const seats = [evilPick, ...goodPicks].sort((a, b) => a - b);

  return {
    info: { seats },
    description: `Among ${seats.map((s) => names[s]).join(', ')}, exactly 1 is evil.`,
  };
};

const generateNobleLie = (state, seat) => {
  // Pick 3 players with evil count ≠ 1 (either 0 or 2)
  const others = otherSeats(seat);
  const names = state.seatNames;
  const evilOthers = others.filter((s) => isEvilSeat(state, s));
  const goodOthers = others.filter((s) => !isEvilSeat(state, s));

  // Try to pick 3 with 0 evil or 2 evil
  if (evilOthers.length >= 2 && goodOthers.length >= 1) {
    // 2 evil + 1 good
    if (Math.random() < 0.5) {
      const seats = [...pickN(evilOthers, 2), pick(goodOthers)].sort((a, b) => a - b);
      return {
        info: { seats },
        description: `Among ${seats.map((s) => names[s]).join(', ')}, exactly 1 is evil.`,
      };
    }
  }

  // 0 evil (3 good)
  if (goodOthers.length >= 3) {
    const seats = pickN(goodOthers, 3).sort((a, b) => a - b);
    return {
      info: { seats },
      description: `Among ${seats.map((s) => names[s]).join(', ')}, exactly 1 is evil.`,
    };
  }

  // Fallback: 2 evil + 1 good
  const seats = [...evilOthers.slice(0, 2), pick(goodOthers)].sort((a, b) => a - b);
  return {
    info: { seats },
    description: `Among ${seats.map((s) => names[s]).join(', ')}, exactly 1 is evil.`,
  };
};

// ── TWO_NOT_DEMON (Knight) ─────────────────────────────────────────

const generateKnightTruth = (state, seat) => {
  // 2 players neither of whom is the Demon
  const names = state.seatNames;
  const nonDemon = otherSeats(seat).filter((s) => s !== state.impSeat);
  const seats = pickN(nonDemon, 2).sort((a, b) => a - b);
  return {
    info: { seats },
    description: `${names[seats[0]]} and ${names[seats[1]]} are NOT the Demon.`,
  };
};

const generateKnightLie = (state, seat) => {
  // At least 1 IS the Demon
  const names = state.seatNames;
  const others = otherSeats(seat);
  const nonDemon = others.filter((s) => s !== state.impSeat);
  const other = pick(nonDemon);
  const seats = [state.impSeat, other].sort((a, b) => a - b);
  return {
    info: { seats },
    description: `${names[seats[0]]} and ${names[seats[1]]} are NOT the Demon.`,
  };
};

// ── ONE_GOOD_PLAYER (Steward) ──────────────────────────────────────

const generateStewardTruth = (state, seat) => {
  const names = state.seatNames;
  const goodSeats = otherSeats(seat).filter((s) => !isEvilSeat(state, s));
  const target = pick(goodSeats);
  return {
    info: { seat: target },
    description: `${names[target]} is good.`,
  };
};

const generateStewardLie = (state, seat) => {
  // Point to an evil player
  const names = state.seatNames;
  const evilSeats = getEvilSeats(state).filter((s) => s !== seat);
  const target = pick(evilSeats);
  return {
    info: { seat: target },
    description: `${names[target]} is good.`,
  };
};

// ── CLOSEST_EVIL_DIRECTION (Shugenja) ──────────────────────────────

const generateShugenjaTruth = (state, seat) => {
  const evilSeats = getEvilSeats(state);
  const direction = closestEvilDirection(seat, evilSeats);
  return {
    info: { direction },
    description: `The closest evil player is ${formatDirection(direction)}.`,
  };
};

const generateShugenjaLie = (state, seat) => {
  const evilSeats = getEvilSeats(state);
  const trueDir = closestEvilDirection(seat, evilSeats);
  const allDirs = [Direction.CW, Direction.CCW, Direction.EQUIDISTANT];
  const direction = pick(allDirs.filter((d) => d !== trueDir));
  return {
    info: { direction },
    description: `The closest evil player is ${formatDirection(direction)}.`,
  };
};

const formatDirection = (dir) => {
  if (dir === Direction.CW) return 'clockwise from you';
  if (dir === Direction.CCW) return 'counter-clockwise from you';
  return 'equidistant in both directions';
};

// ── EVIL_NEIGHBOR_COUNT (Empath) ───────────────────────────────────

const generateEmpathTruth = (state, seat) => {
  const aliveSet = getAliveSeats(state);
  const neighbors = getAliveNeighbors(seat, aliveSet);
  const count = neighbors.filter((s) => isEvilSeat(state, s)).length;
  return {
    info: { count },
    description: `${count} of your alive neighbors ${count === 1 ? 'is' : 'are'} evil.`,
  };
};

const generateEmpathLie = (state, seat) => {
  const aliveSet = getAliveSeats(state);
  const neighbors = getAliveNeighbors(seat, aliveSet);
  const trueCount = neighbors.filter((s) => isEvilSeat(state, s)).length;
  const maxCount = neighbors.length;
  const possibleCounts = [];
  for (let c = 0; c <= maxCount; c++) {
    if (c !== trueCount) possibleCounts.push(c);
  }
  const count = pick(possibleCounts);
  return {
    info: { count },
    description: `${count} of your alive neighbors ${count === 1 ? 'is' : 'are'} evil.`,
  };
};

// ── IS_EITHER_DEMON (Fortune Teller) ───────────────────────────────

/**
 * Fortune Teller special: has a Red Herring (good player who registers as Demon).
 * Sober FT: YES if one is Demon OR Red Herring. NO otherwise.
 * Lying FT: says OPPOSITE of what sober FT would say.
 */
const getSoberFTAnswer = (state, chosenSeats, redHerring) => {
  const isDemon = chosenSeats.some((s) => s === state.impSeat);
  const isRedHerring = chosenSeats.some((s) => s === redHerring);
  return isDemon || isRedHerring;
};

const generateFortuneTellerTruth = (state, seat) => {
  const names = state.seatNames;
  const others = otherSeats(seat).filter((s) => {
    const aliveSet = getAliveSeats(state);
    return aliveSet.has(s);
  });
  // FT picks 2 players (among alive players, excluding self)
  const chosenSeats = pickN(others.length >= 2 ? others : otherSeats(seat), 2).sort((a, b) => a - b);
  const answer = getSoberFTAnswer(state, chosenSeats, state.redHerring);
  return {
    info: { seats: chosenSeats, answer },
    description: `You chose ${names[chosenSeats[0]]} and ${names[chosenSeats[1]]}. ${answer ? 'Yes' : 'No'}, ${answer ? 'one of them is' : 'neither is'} the Demon.`,
  };
};

const generateFortuneTellerLie = (state, seat) => {
  const names = state.seatNames;
  const others = otherSeats(seat).filter((s) => {
    const aliveSet = getAliveSeats(state);
    return aliveSet.has(s);
  });
  const chosenSeats = pickN(others.length >= 2 ? others : otherSeats(seat), 2).sort((a, b) => a - b);
  const soberAnswer = getSoberFTAnswer(state, chosenSeats, state.redHerring);
  const answer = !soberAnswer; // Opposite
  return {
    info: { seats: chosenSeats, answer },
    description: `You chose ${names[chosenSeats[0]]} and ${names[chosenSeats[1]]}. ${answer ? 'Yes' : 'No'}, ${answer ? 'one of them is' : 'neither is'} the Demon.`,
  };
};

// ── Dispatcher ─────────────────────────────────────────────────────

/**
 * Generate a claim for a player based on their claimed role.
 * @param {object} state - Full game state
 * @param {number} seat - The claiming player's seat
 * @param {string} claimedRoleId - The role they claim (may differ from true role)
 * @param {boolean} shouldLie - Whether this claim should be false
 * @param {number} night - Night number
 * @returns {object|null} Claim info + description, or null if no claim this night
 */
export const generateClaim = (state, seat, claimedRoleId, shouldLie, night) => {
  const role = getRole(claimedRoleId);

  // No info roles produce no claims
  if (role.infoType === InfoType.NONE) return null;

  // Check timing
  if (role.infoTiming === InfoTiming.FIRST_NIGHT && night !== 1) return null;
  if (role.infoTiming === InfoTiming.EACH_NIGHT && night < 1) return null;

  // Dead players with aliveRequired don't get info
  if (role.aliveRequired && !state.players[seat].alive) return null;

  const gen = shouldLie ? LIE_GENERATORS : TRUTH_GENERATORS;
  const generator = gen[role.infoType];
  if (!generator) return null;

  return generator(state, seat, role, night);
};

// ── Truth Generator Map ────────────────────────────────────────────

const TRUTH_GENERATORS = {
  [InfoType.ONE_OF_TWO_IS_ROLE]: (state, seat, role) =>
    generateOneOfTwoTruth(state, seat, role.targetRoleType),

  [InfoType.EVIL_PAIR_COUNT]: (state) =>
    generateEvilPairCountTruth(state),

  [InfoType.STEP_COUNT]: (state) =>
    generateStepCountTruth(state),

  [InfoType.THREE_PLAYERS_ONE_EVIL]: (state, seat) =>
    generateNobleTruth(state, seat),

  [InfoType.TWO_NOT_DEMON]: (state, seat) =>
    generateKnightTruth(state, seat),

  [InfoType.ONE_GOOD_PLAYER]: (state, seat) =>
    generateStewardTruth(state, seat),

  [InfoType.CLOSEST_EVIL_DIRECTION]: (state, seat) =>
    generateShugenjaTruth(state, seat),

  [InfoType.EVIL_NEIGHBOR_COUNT]: (state, seat) =>
    generateEmpathTruth(state, seat),

  [InfoType.IS_EITHER_DEMON]: (state, seat) =>
    generateFortuneTellerTruth(state, seat),
};

// ── Lie Generator Map ──────────────────────────────────────────────

const LIE_GENERATORS = {
  [InfoType.ONE_OF_TWO_IS_ROLE]: (state, seat, role) => {
    if (role.targetRoleType === RoleType.OUTSIDER) {
      return generateOneOfTwoLieLibrarian(state, seat);
    }
    if (role.targetRoleType === RoleType.TOWNSFOLK) {
      return generateOneOfTwoLieWasherwoman(state, seat);
    }
    // MINION (Investigator): no public cross-reference possible
    return generateOneOfTwoLie(state, seat, role.targetRoleType);
  },

  [InfoType.EVIL_PAIR_COUNT]: (state) =>
    generateEvilPairCountLie(state),

  [InfoType.STEP_COUNT]: (state) =>
    generateStepCountLie(state),

  [InfoType.THREE_PLAYERS_ONE_EVIL]: (state, seat) =>
    generateNobleLie(state, seat),

  [InfoType.TWO_NOT_DEMON]: (state, seat) =>
    generateKnightLie(state, seat),

  [InfoType.ONE_GOOD_PLAYER]: (state, seat) =>
    generateStewardLie(state, seat),

  [InfoType.CLOSEST_EVIL_DIRECTION]: (state, seat) =>
    generateShugenjaLie(state, seat),

  [InfoType.EVIL_NEIGHBOR_COUNT]: (state, seat) =>
    generateEmpathLie(state, seat),

  [InfoType.IS_EITHER_DEMON]: (state, seat) =>
    generateFortuneTellerLie(state, seat),
};

// ── Verification (for solver) ──────────────────────────────────────
// Given a hypothesis, verify whether a claim is consistent.

/**
 * Verify a claim against a hypothetical game state.
 * @param {object} claim - The claim to verify
 * @param {object} hypothesis - Hypothetical assignments
 * @param {boolean} shouldBeTrue - Whether the claim should be truthful
 * @returns {boolean} Whether the claim is consistent
 */
export const verifyClaim = (claim, hypothesis, shouldBeTrue) => {
  const role = getRole(claim.roleId);
  const verifier = VERIFIERS[role.infoType];
  if (!verifier) return true; // No info = no verification needed
  const isFactuallyTrue = verifier(claim.info, hypothesis);
  return shouldBeTrue ? isFactuallyTrue : !isFactuallyTrue;
};

// ── Verifier Map ───────────────────────────────────────────────────
// Each verifier checks: is the claim factually correct given the hypothesis?

const VERIFIERS = {
  [InfoType.ONE_OF_TWO_IS_ROLE]: (info, hyp) => {
    if (info.isNone) {
      // "No outsiders" — true iff no player has that outsider type
      return !hyp.players.some(
        (p) => getRole(p.trueRole).type === RoleType.OUTSIDER
      );
    }
    // "1 of seats is role" — true iff at least one seat's true role matches
    return info.seats.some((s) => hyp.players[s].trueRole === info.role);
  },

  [InfoType.EVIL_PAIR_COUNT]: (info, hyp) => {
    const trueCount = countEvilPairs(hyp.evilSeats);
    return info.count === trueCount;
  },

  [InfoType.STEP_COUNT]: (info, hyp) => {
    const trueDist = stepsToNearest(hyp.impSeat, [hyp.minionSeat]);
    return info.count === trueDist;
  },

  [InfoType.THREE_PLAYERS_ONE_EVIL]: (info, hyp) => {
    const evilCount = info.seats.filter((s) => hyp.evilSeats.includes(s)).length;
    return evilCount === 1;
  },

  [InfoType.TWO_NOT_DEMON]: (info, hyp) => {
    return info.seats.every((s) => s !== hyp.impSeat);
  },

  [InfoType.ONE_GOOD_PLAYER]: (info, hyp) => {
    return !hyp.evilSeats.includes(info.seat);
  },

  // CLOSEST_EVIL_DIRECTION and EVIL_NEIGHBOR_COUNT require context
  // (claimer seat, alive set) not available here. Handled by verifyClaimWithContext.

  [InfoType.IS_EITHER_DEMON]: (info, hyp) => {
    // Sober FT answer: YES if one is Demon OR Red Herring
    const isDemon = info.seats.some((s) => s === hyp.impSeat);
    const isRedHerring = info.seats.some((s) => s === hyp.redHerring);
    const soberAnswer = isDemon || isRedHerring;
    return info.answer === soberAnswer;
  },
};

/**
 * Verify a context-dependent claim (Empath, Shugenja) that needs
 * extra state beyond what's in the claim info.
 */
export const verifyClaimWithContext = (claim, hypothesis, shouldBeTrue, context) => {
  const role = getRole(claim.roleId);

  if (role.infoType === InfoType.EVIL_NEIGHBOR_COUNT) {
    const neighbors = getAliveNeighbors(context.claimerSeat, context.aliveSet);
    const trueCount = neighbors.filter((s) => hypothesis.evilSeats.includes(s)).length;
    const isFactuallyTrue = claim.info.count === trueCount;
    return shouldBeTrue ? isFactuallyTrue : !isFactuallyTrue;
  }

  if (role.infoType === InfoType.CLOSEST_EVIL_DIRECTION) {
    const trueDir = closestEvilDirection(context.claimerSeat, hypothesis.evilSeats);
    const isFactuallyTrue = claim.info.direction === trueDir;
    return shouldBeTrue ? isFactuallyTrue : !isFactuallyTrue;
  }

  // Fall through to standard verification
  return verifyClaim(claim, hypothesis, shouldBeTrue);
};
