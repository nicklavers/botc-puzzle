import { PLAYER_COUNT, INITIAL_LIVES, RoleId } from './constants.js';
import { getRole } from './roles.js';
import { allSeats } from './seating.js';

// ── Player Creation ────────────────────────────────────────────────

/**
 * Create an immutable player.
 * @param {number} seat - Seat index (0-7)
 * @param {string} trueRole - Actual RoleId
 * @param {string} claimedRole - Role this player claims to be
 */
export const createPlayer = (seat, trueRole, claimedRole) => Object.freeze({
  seat,
  trueRole,
  claimedRole,
  alive: true,
});

const killPlayer = (player) => Object.freeze({ ...player, alive: false });

// ── Claim Record ───────────────────────────────────────────────────

/**
 * Create an immutable claim record.
 * @param {number} seat - Who made the claim
 * @param {string} roleId - Role being claimed
 * @param {number} night - Night number
 * @param {object} info - Role-specific claim data
 */
export const createClaim = (seat, roleId, night, info) => Object.freeze({
  seat,
  roleId,
  night,
  info: Object.freeze(info),
});

// ── Night Record ───────────────────────────────────────────────────

/**
 * Record of what happened during a night.
 * @param {number} nightNum
 * @param {Array} claims - Claims generated this night
 * @param {number|null} killed - Seat killed by demon (null for night 1)
 * @param {number|null} poisonTarget - Seat poisoned this night (null if no Poisoner)
 */
export const createNightRecord = (nightNum, claims, killed, poisonTarget) =>
  Object.freeze({
    nightNum,
    claims: Object.freeze(claims),
    killed,
    poisonTarget,
  });

// ── Game State ─────────────────────────────────────────────────────

/**
 * Create initial game state.
 * @param {object} config - Game configuration
 * @param {string} config.impSeat - Imp seat index
 * @param {string} config.minionSeat - Minion seat index
 * @param {string} config.minionType - RoleId of minion
 * @param {string} config.outsiderSeat - Outsider seat index
 * @param {string} config.outsiderType - RoleId of outsider
 * @param {string|null} config.poisonDirection - 'cw' or 'ccw' if Poisoner
 * @param {number|null} config.redHerring - Seat of FT red herring (if FT in play)
 * @param {Array} config.players - Array of player objects
 */
export const createGameState = (config) => Object.freeze({
  players: Object.freeze(config.players),
  nights: Object.freeze([]),
  impSeat: config.impSeat,
  minionSeat: config.minionSeat,
  minionType: config.minionType,
  outsiderSeat: config.outsiderSeat,
  outsiderType: config.outsiderType,
  poisonDirection: config.poisonDirection ?? null,
  redHerring: config.redHerring ?? null,
  seatNames: config.seatNames ?? Object.freeze(Array.from({ length: 8 }, (_, i) => `Player ${i + 1}`)),
  currentNight: 0,
});

/**
 * Add a night record to the game state, returning new state.
 */
export const addNight = (state, nightRecord) => Object.freeze({
  ...state,
  nights: Object.freeze([...state.nights, nightRecord]),
  currentNight: nightRecord.nightNum,
});

/**
 * Kill a player by seat, returning new state.
 */
export const killPlayerInState = (state, seat) => Object.freeze({
  ...state,
  players: Object.freeze(
    state.players.map((p) => (p.seat === seat ? killPlayer(p) : p))
  ),
});

// ── Query Helpers ──────────────────────────────────────────────────

export const getPlayer = (state, seat) => state.players[seat];

export const getAlivePlayers = (state) => state.players.filter((p) => p.alive);

export const getAliveSeats = (state) => new Set(
  state.players.filter((p) => p.alive).map((p) => p.seat)
);

export const getDeadSeats = (state) =>
  state.players.filter((p) => !p.alive).map((p) => p.seat);

export const getEvilSeats = (state) => [state.impSeat, state.minionSeat];

export const isEvilSeat = (state, seat) =>
  seat === state.impSeat || seat === state.minionSeat;

export const isGoodSeat = (state, seat) => !isEvilSeat(state, seat);

export const isDrunkSeat = (state, seat) =>
  state.outsiderType === RoleId.DRUNK && state.outsiderSeat === seat;

/**
 * Is a seat's info unreliable this night?
 * True if the seat is evil, drunk, or currently poisoned.
 */
export const isLyingSeat = (state, seat, poisonTarget) =>
  isEvilSeat(state, seat) ||
  isDrunkSeat(state, seat) ||
  seat === poisonTarget;

/**
 * Get all claims up to and including a given night.
 */
export const getClaimsThrough = (state, nightNum) =>
  state.nights
    .filter((n) => n.nightNum <= nightNum)
    .flatMap((n) => n.claims);

/**
 * Get all deaths up to and including a given night.
 */
export const getDeathsThrough = (state, nightNum) =>
  state.nights
    .filter((n) => n.nightNum <= nightNum && n.killed !== null)
    .map((n) => n.killed);

// ── UI State (Progressive Mode) ───────────────────────────────────

export const createUIState = (mode) => Object.freeze({
  mode,           // 'progressive' | 'all_at_once'
  lives: INITIAL_LIVES,
  currentDay: 0,  // Which day the player is viewing
  selectedCandidates: Object.freeze(new Set()),
  solved: false,
  gameOver: false,
});

export const updateUIState = (uiState, updates) => Object.freeze({
  ...uiState,
  ...updates,
  selectedCandidates: updates.selectedCandidates !== undefined
    ? Object.freeze(updates.selectedCandidates)
    : uiState.selectedCandidates,
});

export const loseLife = (uiState) => {
  const newLives = uiState.lives - 1;
  return updateUIState(uiState, {
    lives: newLives,
    gameOver: newLives <= 0,
  });
};
