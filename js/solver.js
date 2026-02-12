import {
  RoleId, RoleType, PLAYER_COUNT, SCRIPT, COMPOSITION, GAME_TYPES,
  InfoType, InfoTiming,
} from './constants.js';
import { getRole, getRolesByType, isEvil } from './roles.js';
import {
  getPoisonTarget, countEvilPairs, stepsToNearest,
  closestEvilDirection, getAliveNeighbors, allSeats,
} from './seating.js';
import { verifyClaim, verifyClaimWithContext } from './claims.js';

// ── Hypothesis Structure ───────────────────────────────────────────
// { impSeat, minionSeat, minionType, outsiderSeat, outsiderType,
//   poisonDirection (if Poisoner), redHerring (if FT claim exists),
//   players: [{seat, trueRole}...], evilSeats: [impSeat, minionSeat] }

/**
 * Enumerate all valid hypotheses and filter against observed claims.
 * Returns the set of possible demon seats.
 *
 * @param {Array} observedClaims - All claims through the current day
 * @param {Array} nightRecords - Night records through current day
 * @param {Array} playerClaims - What each seat claims to be [{seat, claimedRole}]
 * @param {number} throughNight - Verify claims up to this night
 * @returns {{ possibleDemons: Set<number>, validHypotheses: Array }}
 */
export const solve = (observedClaims, nightRecords, playerClaims, throughNight) => {
  const validHypotheses = [];
  const possibleDemons = new Set();

  // Determine if any player claims Fortune Teller (affects red herring enumeration)
  const hasFTClaim = playerClaims.some((pc) => pc.claimedRole === RoleId.FORTUNE_TELLER);

  // Deaths observed so far
  const deaths = nightRecords
    .filter((n) => n.nightNum <= throughNight && n.killed !== null)
    .map((n) => n.killed);
  const deadSet = new Set(deaths);

  // Pre-compute claims indexed by seat and night
  const claimsBySeatNight = indexClaims(observedClaims, throughNight);

  // Enumerate all combinations
  for (const gameType of GAME_TYPES) {
    const { outsider: outsiderType, minion: minionType } = gameType;
    const hasPoisoner = minionType === RoleId.POISONER;
    const poisonDirs = hasPoisoner ? ['cw', 'ccw'] : [null];

    for (let impSeat = 0; impSeat < PLAYER_COUNT; impSeat++) {
      // D5: Imp can't be someone killed by demon
      if (deadSet.has(impSeat)) continue;

      for (let minionSeat = 0; minionSeat < PLAYER_COUNT; minionSeat++) {
        if (minionSeat === impSeat) continue;

        for (let outsiderSeat = 0; outsiderSeat < PLAYER_COUNT; outsiderSeat++) {
          if (outsiderSeat === impSeat || outsiderSeat === minionSeat) continue;

          for (const poisonDir of poisonDirs) {
            // Build hypothesis player assignments
            const hypPlayers = buildHypPlayers(
              impSeat, minionSeat, minionType,
              outsiderSeat, outsiderType,
              playerClaims
            );

            if (!hypPlayers) continue; // Invalid assignment

            const evilSeats = [impSeat, minionSeat];

            // Quick structural checks (Category A + B)
            if (!checkStructural(hypPlayers, playerClaims, evilSeats, outsiderSeat, outsiderType)) {
              continue;
            }

            // Red herring enumeration (only if FT claim exists)
            const redHerringCandidates = hasFTClaim
              ? getRedHerringCandidates(hypPlayers, impSeat, minionSeat)
              : [null];

            for (const redHerring of redHerringCandidates) {
              const hypothesis = {
                impSeat, minionSeat, minionType,
                outsiderSeat, outsiderType,
                poisonDirection: poisonDir,
                redHerring,
                players: hypPlayers,
                evilSeats,
              };

              if (verifyAllClaims(hypothesis, claimsBySeatNight, nightRecords, throughNight, deadSet)) {
                validHypotheses.push(hypothesis);
                possibleDemons.add(impSeat);
              }
            }
          }
        }
      }
    }
  }

  return { possibleDemons, validHypotheses };
};

// ── Build Hypothesis Players ───────────────────────────────────────

const buildHypPlayers = (impSeat, minionSeat, minionType, outsiderSeat, outsiderType, playerClaims) => {
  const players = new Array(PLAYER_COUNT);

  // Assign known evil + outsider
  players[impSeat] = { seat: impSeat, trueRole: RoleId.IMP };
  players[minionSeat] = { seat: minionSeat, trueRole: minionType };
  players[outsiderSeat] = { seat: outsiderSeat, trueRole: outsiderType };

  // Remaining seats are Townsfolk — their true role must match their claimed role
  // (if they're good and not drunk)
  const townsfolkRoles = new Set();
  for (let s = 0; s < PLAYER_COUNT; s++) {
    if (s === impSeat || s === minionSeat || s === outsiderSeat) continue;
    const claimed = playerClaims[s].claimedRole;
    const role = getRole(claimed);

    // Good Townsfolk claim their true role (B1)
    if (role.type !== RoleType.TOWNSFOLK) {
      // A good non-outsider seat claiming a non-TF role is invalid
      // (they could claim Butler if Butler is the outsider, but that seat is outsiderSeat)
      return null;
    }

    if (townsfolkRoles.has(claimed)) {
      // Two true Townsfolk can't have the same role (A3)
      return null;
    }
    townsfolkRoles.add(claimed);
    players[s] = { seat: s, trueRole: claimed };
  }

  return players;
};

// ── Structural Checks ──────────────────────────────────────────────

const checkStructural = (hypPlayers, playerClaims, evilSeats, outsiderSeat, outsiderType) => {
  const evilSet = new Set(evilSeats);

  // B2: Drunk claims a Townsfolk role
  if (outsiderType === RoleId.DRUNK) {
    const drunkClaimed = playerClaims[outsiderSeat].claimedRole;
    const drunkClaimedRole = getRole(drunkClaimed);
    if (drunkClaimedRole.type !== RoleType.TOWNSFOLK) return false;

    // B3: Drunk's claim must not duplicate any true Townsfolk's claim
    for (let s = 0; s < PLAYER_COUNT; s++) {
      if (s === outsiderSeat || evilSet.has(s)) continue;
      if (playerClaims[s].claimedRole === drunkClaimed) return false;
    }
  }

  // Butler claims Butler (B1 for Butler)
  if (outsiderType === RoleId.BUTLER) {
    const butlerClaimed = playerClaims[outsiderSeat].claimedRole;
    if (butlerClaimed !== RoleId.BUTLER) return false;
  }

  // B4: Evil claims are distinct from each other
  const evilClaims = evilSeats.map((s) => playerClaims[s].claimedRole);
  if (evilClaims[0] === evilClaims[1]) return false;

  // B5: Evil never claims Drunk
  if (evilClaims.some((c) => c === RoleId.DRUNK)) return false;

  // Evil can claim Townsfolk or Butler
  for (const claim of evilClaims) {
    const role = getRole(claim);
    if (role.type !== RoleType.TOWNSFOLK && claim !== RoleId.BUTLER) return false;
  }

  return true;
};

// ── Red Herring Candidates ─────────────────────────────────────────

const getRedHerringCandidates = (hypPlayers, impSeat, minionSeat) => {
  // Red herring must be a good player who is not the FT
  const candidates = [];
  for (let s = 0; s < PLAYER_COUNT; s++) {
    if (s === impSeat || s === minionSeat) continue;
    // Red herring can be any good player (including the FT claimer?
    // No — the red herring should not be the FT themselves)
    const role = getRole(hypPlayers[s].trueRole);
    if (role.id !== RoleId.FORTUNE_TELLER) {
      candidates.push(s);
    }
  }
  return candidates;
};

// ── Claim Indexing ─────────────────────────────────────────────────

const indexClaims = (claims, throughNight) => {
  const index = {};
  for (const claim of claims) {
    if (claim.night > throughNight) continue;
    const key = `${claim.seat}_${claim.night}`;
    if (!index[key]) index[key] = [];
    index[key].push(claim);
  }
  return index;
};

// ── Claim Verification ─────────────────────────────────────────────

const verifyAllClaims = (hypothesis, claimsBySeatNight, nightRecords, throughNight, deadSet) => {
  const { impSeat, minionSeat, minionType, outsiderSeat, outsiderType, poisonDirection, evilSeats } = hypothesis;
  const hasPoisoner = minionType === RoleId.POISONER;

  // Track alive state progressively
  const alive = new Set(allSeats());

  for (const nightRec of nightRecords) {
    if (nightRec.nightNum > throughNight) break;

    // Compute poison target this night
    let poisonTarget = null;
    if (hasPoisoner && alive.has(minionSeat)) {
      poisonTarget = getPoisonTarget(minionSeat, poisonDirection, nightRec.nightNum);
    }

    // Build alive set for this night (before kill)
    const aliveSet = new Set(alive);

    // Verify each claim for this night
    for (let seat = 0; seat < PLAYER_COUNT; seat++) {
      const key = `${seat}_${nightRec.nightNum}`;
      const claims = claimsBySeatNight[key];
      if (!claims) continue;

      // Determine if this seat should be lying
      const isEvil = evilSeats.includes(seat);
      const isDrunk = outsiderType === RoleId.DRUNK && outsiderSeat === seat;
      const isPoisoned = poisonTarget === seat;
      const shouldBeTrue = !isEvil && !isDrunk && !isPoisoned;

      for (const claim of claims) {
        const role = getRole(claim.roleId);

        // Context-dependent claims (Empath, Shugenja)
        if (role.infoType === InfoType.EVIL_NEIGHBOR_COUNT ||
            role.infoType === InfoType.CLOSEST_EVIL_DIRECTION) {
          const context = { claimerSeat: seat, aliveSet };
          if (!verifyClaimWithContext(claim, hypothesis, shouldBeTrue, context)) {
            return false;
          }
          continue;
        }

        // Standard claims
        if (!verifyClaim(claim, hypothesis, shouldBeTrue)) {
          return false;
        }
      }
    }

    // Apply kill after verifying claims
    if (nightRec.killed !== null) {
      alive.delete(nightRec.killed);
    }
  }

  return true;
};

// ── Progressive Solver ─────────────────────────────────────────────

/**
 * Solve progressively: returns possible demons at each day checkpoint.
 * @param {Array} observedClaims - All claims across all nights
 * @param {Array} nightRecords - All night records
 * @param {Array} playerClaims - What each seat claims
 * @returns {Array<{day: number, possibleDemons: Set<number>}>}
 */
export const solveProgressive = (observedClaims, nightRecords, playerClaims) => {
  const checkpoints = [];

  for (let night = 1; night <= nightRecords.length; night++) {
    const { possibleDemons, validHypotheses } = solve(
      observedClaims, nightRecords, playerClaims, night
    );
    checkpoints.push({
      day: night,
      possibleDemons,
      hypothesisCount: validHypotheses.length,
    });
  }

  return checkpoints;
};
