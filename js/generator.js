import {
  RoleId, RoleType, PLAYER_COUNT, SCRIPT, MAX_NIGHTS, GAME_TYPES,
  InfoTiming, BUFFY_NAMES,
} from './constants.js';
import { getRole, getRolesByType } from './roles.js';
import { getPoisonTarget, allSeats, otherSeats } from './seating.js';
import {
  createPlayer, createClaim, createNightRecord, createGameState,
  addNight, killPlayerInState, getAliveSeats, isLyingSeat, getEvilSeats,
} from './game-state.js';
import { generateClaim } from './claims.js';
import { solve, solveProgressive } from './solver.js';

// ── Random Helpers ─────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const pickN = (arr, n) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// ── Puzzle Generation ──────────────────────────────────────────────

const MAX_RETRIES = 50;

/**
 * Generate a complete puzzle.
 * Returns null if generation fails after MAX_RETRIES.
 * @param {string} mode - 'progressive' | 'all_at_once'
 * @returns {object|null} Generated puzzle
 */
export const generatePuzzle = (mode = 'progressive') => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const puzzle = tryGeneratePuzzle(mode);
    if (puzzle) return puzzle;
  }
  return null;
};

const tryGeneratePuzzle = (mode) => {
  // 1. Pick game type
  const gameType = pick(GAME_TYPES);
  const { outsider: outsiderType, minion: minionType } = gameType;
  const hasPoisoner = minionType === RoleId.POISONER;

  // 2. Assign seats
  const seats = shuffle(allSeats());
  const impSeat = seats[0];
  const minionSeat = seats[1];
  const outsiderSeat = seats[2];
  const townsfolkSeats = seats.slice(3); // 5 seats

  // 3. Pick townsfolk roles (5 from 11 on script)
  const townsfolkPool = shuffle([...SCRIPT[RoleType.TOWNSFOLK]]);
  const townsfolkRoles = townsfolkPool.slice(0, 5);

  // 4. Assign townsfolk to seats
  const townsfolkAssignments = townsfolkSeats.map((seat, i) => ({
    seat,
    trueRole: townsfolkRoles[i],
  }));

  // 5. Pick poison direction (if Poisoner)
  const poisonDirection = hasPoisoner ? pick(['cw', 'ccw']) : null;

  // 6. Pick red herring (if Fortune Teller in play)
  const ftInPlay = townsfolkRoles.includes(RoleId.FORTUNE_TELLER);
  const ftSeat = ftInPlay
    ? townsfolkAssignments.find((a) => a.trueRole === RoleId.FORTUNE_TELLER).seat
    : null;
  // Red herring: a good player who is not the FT
  const redHerringCandidates = ftInPlay
    ? allSeats().filter((s) => s !== impSeat && s !== minionSeat && s !== ftSeat)
    : [];
  const redHerring = ftInPlay ? pick(redHerringCandidates) : null;

  // 6b. Pick seat names
  const seatNames = Object.freeze(pickN(BUFFY_NAMES, PLAYER_COUNT).sort());

  // 7. Generate bluff claims for evil + drunk
  const bluffs = generateBluffs(
    impSeat, minionSeat, minionType,
    outsiderSeat, outsiderType,
    townsfolkAssignments
  );
  if (!bluffs) return null;

  // 8. Build player array
  const players = buildPlayers(
    impSeat, minionSeat, minionType,
    outsiderSeat, outsiderType,
    townsfolkAssignments, bluffs
  );

  // 9. Create initial game state
  let state = createGameState({
    impSeat, minionSeat, minionType,
    outsiderSeat, outsiderType,
    poisonDirection, redHerring,
    players, seatNames,
  });

  // 10. Build player claims array for solver
  const playerClaims = players.map((p) => ({
    seat: p.seat,
    claimedRole: p.claimedRole,
  }));

  // 11. Simulate nights and collect claims
  const allClaims = [];
  const allNightRecords = [];

  for (let night = 1; night <= MAX_NIGHTS; night++) {
    // Compute poison target
    let poisonTarget = null;
    if (hasPoisoner && state.players[minionSeat].alive) {
      poisonTarget = getPoisonTarget(minionSeat, poisonDirection, night);
    }

    // Generate claims for all alive players with info abilities
    const nightClaims = [];
    for (const player of state.players) {
      if (!player.alive) continue;

      const claimedRole = player.claimedRole;
      const role = getRole(claimedRole);

      // Skip non-info roles
      if (role.infoTiming === InfoTiming.NONE) continue;

      // Check timing
      if (role.infoTiming === InfoTiming.FIRST_NIGHT && night !== 1) continue;

      const shouldLie = isLyingSeat(state, player.seat, poisonTarget);
      const claim = generateClaim(state, player.seat, claimedRole, shouldLie, night);
      if (claim) {
        const claimRecord = createClaim(player.seat, claimedRole, night, claim.info);
        nightClaims.push({ ...claimRecord, description: claim.description });
        allClaims.push(claimRecord);
      }
    }

    // Demon kill (night 2+)
    let killed = null;
    if (night >= 2) {
      const aliveNonImp = state.players.filter(
        (p) => p.alive && p.seat !== impSeat
      );
      if (aliveNonImp.length > 0) {
        const victim = pick(aliveNonImp);
        killed = victim.seat;
      }
    }

    // Record night
    const nightRecord = createNightRecord(night, nightClaims, killed, poisonTarget);
    allNightRecords.push(nightRecord);

    // Update state
    state = addNight(state, nightRecord);
    if (killed !== null) {
      state = killPlayerInState(state, killed);
    }
  }

  // 12. Progressive solving to find checkpoints
  const checkpoints = solveProgressive(allClaims, allNightRecords, playerClaims);

  // 13. Validate puzzle quality
  if (checkpoints.length === 0) return null;

  // Find first checkpoint where demon is uniquely identified
  const solvedDay = checkpoints.findIndex((cp) => cp.possibleDemons.size === 1);

  if (mode === 'all_at_once') {
    if (solvedDay === -1) return null; // Never converges
    return buildPuzzleResult(state, allClaims, allNightRecords, playerClaims, checkpoints, solvedDay + 1, mode);
  }

  // Progressive mode: find checkpoints where candidates narrow
  const progressiveStops = findProgressiveStops(checkpoints);
  if (progressiveStops.length === 0) return null;

  // Last stop must have exactly 1 possible demon
  const lastStop = progressiveStops[progressiveStops.length - 1];
  if (lastStop.possibleDemons.size !== 1) return null;

  return buildPuzzleResult(state, allClaims, allNightRecords, playerClaims, checkpoints, lastStop.day, mode, progressiveStops);
};

// ── Bluff Generation ───────────────────────────────────────────────

const generateBluffs = (impSeat, minionSeat, minionType, outsiderSeat, outsiderType, townsfolkAssignments) => {
  const trueTFClaims = new Set(townsfolkAssignments.map((a) => a.trueRole));
  const allTFOnScript = [...SCRIPT[RoleType.TOWNSFOLK]];

  // Drunk bluff: picks a TF role NOT claimed by any true TF
  let drunkClaim = null;
  if (outsiderType === RoleId.DRUNK) {
    const availableForDrunk = allTFOnScript.filter((r) => !trueTFClaims.has(r));
    if (availableForDrunk.length === 0) return null;
    drunkClaim = pick(availableForDrunk);
  }

  // Butler claims Butler
  const butlerClaim = outsiderType === RoleId.BUTLER ? RoleId.BUTLER : null;

  // Evil bluffs: each claims a TF role or Butler
  // They can double-claim a true TF's role, but not each other's
  // They never claim Drunk
  const usedByDrunk = drunkClaim ? new Set([drunkClaim]) : new Set();
  const evilBluffPool = [
    ...allTFOnScript,
    RoleId.BUTLER,
  ].filter((r) => r !== RoleId.DRUNK);

  // Pick imp's bluff
  const impBluffOptions = evilBluffPool.filter((r) => !usedByDrunk.has(r));
  if (impBluffOptions.length === 0) return null;
  const impClaim = pick(impBluffOptions);

  // Pick minion's bluff (distinct from imp's)
  const minionBluffOptions = evilBluffPool.filter(
    (r) => r !== impClaim && !usedByDrunk.has(r)
  );
  if (minionBluffOptions.length === 0) return null;
  const minionClaim = pick(minionBluffOptions);

  return {
    [impSeat]: impClaim,
    [minionSeat]: minionClaim,
    [outsiderSeat]: outsiderType === RoleId.DRUNK ? drunkClaim : butlerClaim,
  };
};

// ── Player Building ────────────────────────────────────────────────

const buildPlayers = (impSeat, minionSeat, minionType, outsiderSeat, outsiderType, townsfolkAssignments, bluffs) => {
  const players = new Array(PLAYER_COUNT);

  // Imp
  players[impSeat] = createPlayer(impSeat, RoleId.IMP, bluffs[impSeat]);

  // Minion
  players[minionSeat] = createPlayer(minionSeat, minionType, bluffs[minionSeat]);

  // Outsider
  players[outsiderSeat] = createPlayer(
    outsiderSeat, outsiderType, bluffs[outsiderSeat]
  );

  // Townsfolk (claim their true role)
  for (const { seat, trueRole } of townsfolkAssignments) {
    players[seat] = createPlayer(seat, trueRole, trueRole);
  }

  return players;
};

// ── Progressive Stops ──────────────────────────────────────────────

const findProgressiveStops = (checkpoints) => {
  const stops = [];
  let prevCount = Infinity;

  for (const cp of checkpoints) {
    const count = cp.possibleDemons.size;
    if (count < prevCount) {
      stops.push(cp);
      prevCount = count;
    }
    if (count === 1) break;
  }

  return stops;
};

// ── Puzzle Result ──────────────────────────────────────────────────

const buildPuzzleResult = (state, allClaims, nightRecords, playerClaims, checkpoints, totalNights, mode, progressiveStops = null) => {
  // Collect claims with descriptions, grouped by night
  const nightsData = nightRecords
    .filter((nr) => nr.nightNum <= totalNights)
    .map((nr) => ({
      nightNum: nr.nightNum,
      claims: nr.claims.map((c) => ({
        seat: c.seat,
        seatName: state.seatNames[c.seat],
        roleId: c.roleId,
        roleName: getRole(c.roleId).name,
        night: c.night,
        info: c.info,
        description: c.description,
      })),
      killed: nr.killed,
    }));

  // Solution
  const solution = {
    impSeat: state.impSeat,
    minionSeat: state.minionSeat,
    minionType: state.minionType,
    outsiderSeat: state.outsiderSeat,
    outsiderType: state.outsiderType,
    poisonDirection: state.poisonDirection,
    redHerring: state.redHerring,
  };

  // Player info (what the player sees)
  const playersVisible = state.players.map((p) => ({
    seat: p.seat,
    seatName: state.seatNames[p.seat],
    claimedRole: p.claimedRole,
    claimedRoleName: getRole(p.claimedRole).name,
    alive: p.alive,
  }));

  return Object.freeze({
    mode,
    totalNights,
    seatNames: state.seatNames,
    players: Object.freeze(playersVisible),
    playerClaims: Object.freeze(playerClaims),
    nights: Object.freeze(nightsData),
    checkpoints: Object.freeze(
      (progressiveStops || checkpoints)
        .filter((cp) => cp.day <= totalNights)
        .map((cp) => ({
          day: cp.day,
          possibleDemons: Object.freeze(new Set(cp.possibleDemons)),
          candidateCount: cp.possibleDemons.size,
        }))
    ),
    solution: Object.freeze(solution),
    allClaims: Object.freeze(allClaims.filter((c) => c.night <= totalNights)),
  });
};
