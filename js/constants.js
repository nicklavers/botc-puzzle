// ── Team & Role Enums ──────────────────────────────────────────────

export const Team = Object.freeze({
  GOOD: 'good',
  EVIL: 'evil',
});

export const RoleType = Object.freeze({
  TOWNSFOLK: 'townsfolk',
  OUTSIDER: 'outsider',
  MINION: 'minion',
  DEMON: 'demon',
});

export const RoleId = Object.freeze({
  // Townsfolk (11 on script, 5 per game)
  WASHERWOMAN: 'washerwoman',
  LIBRARIAN: 'librarian',
  INVESTIGATOR: 'investigator',
  CHEF: 'chef',
  CLOCKMAKER: 'clockmaker',
  NOBLE: 'noble',
  KNIGHT: 'knight',
  STEWARD: 'steward',
  SHUGENJA: 'shugenja',
  EMPATH: 'empath',
  FORTUNE_TELLER: 'fortune_teller',

  // Outsiders (2 on script, 1 per game)
  DRUNK: 'drunk',
  BUTLER: 'butler',

  // Minions (2 on script, 1 per game)
  POISONER: 'poisoner',
  SCARLET_WOMAN: 'scarlet_woman',

  // Demon (1)
  IMP: 'imp',
});

// ── Info Timing ────────────────────────────────────────────────────

export const InfoTiming = Object.freeze({
  FIRST_NIGHT: 'first_night',
  EACH_NIGHT: 'each_night',
  ON_DEATH: 'on_death',
  ONCE: 'once',
  NONE: 'none',
});

// ── Info Type ──────────────────────────────────────────────────────

export const InfoType = Object.freeze({
  ONE_OF_TWO_IS_ROLE: 'one_of_two_is_role',       // Washerwoman, Librarian, Investigator
  EVIL_PAIR_COUNT: 'evil_pair_count',               // Chef
  STEP_COUNT: 'step_count',                         // Clockmaker
  THREE_PLAYERS_ONE_EVIL: 'three_players_one_evil', // Noble
  TWO_NOT_DEMON: 'two_not_demon',                   // Knight
  ONE_GOOD_PLAYER: 'one_good_player',               // Steward
  CLOSEST_EVIL_DIRECTION: 'closest_evil_direction', // Shugenja
  EVIL_NEIGHBOR_COUNT: 'evil_neighbor_count',       // Empath
  IS_EITHER_DEMON: 'is_either_demon',               // Fortune Teller
  NONE: 'none',                                      // Butler, Scarlet Woman
});

// ── Direction ──────────────────────────────────────────────────────

export const Direction = Object.freeze({
  CW: 'clockwise',
  CCW: 'counter_clockwise',
  EQUIDISTANT: 'equidistant',
});

// ── Composition ────────────────────────────────────────────────────

export const PLAYER_COUNT = 8;

export const COMPOSITION = Object.freeze({
  [RoleType.TOWNSFOLK]: 5,
  [RoleType.OUTSIDER]: 1,
  [RoleType.MINION]: 1,
  [RoleType.DEMON]: 1,
});

// ── Script (character pool) ────────────────────────────────────────

export const SCRIPT = Object.freeze({
  [RoleType.TOWNSFOLK]: Object.freeze([
    RoleId.WASHERWOMAN,
    RoleId.LIBRARIAN,
    RoleId.INVESTIGATOR,
    RoleId.CHEF,
    RoleId.CLOCKMAKER,
    RoleId.NOBLE,
    RoleId.KNIGHT,
    RoleId.STEWARD,
    RoleId.SHUGENJA,
    RoleId.EMPATH,
    RoleId.FORTUNE_TELLER,
  ]),
  [RoleType.OUTSIDER]: Object.freeze([
    RoleId.DRUNK,
    RoleId.BUTLER,
  ]),
  [RoleType.MINION]: Object.freeze([
    RoleId.POISONER,
    RoleId.SCARLET_WOMAN,
  ]),
  [RoleType.DEMON]: Object.freeze([
    RoleId.IMP,
  ]),
});

// ── Game Types (4 combos) ──────────────────────────────────────────

export const GAME_TYPES = Object.freeze([
  Object.freeze({ outsider: RoleId.DRUNK, minion: RoleId.POISONER, liarCount: 3, hasPoisoning: true }),
  Object.freeze({ outsider: RoleId.DRUNK, minion: RoleId.SCARLET_WOMAN, liarCount: 3, hasPoisoning: false }),
  Object.freeze({ outsider: RoleId.BUTLER, minion: RoleId.POISONER, liarCount: 2, hasPoisoning: true }),
  Object.freeze({ outsider: RoleId.BUTLER, minion: RoleId.SCARLET_WOMAN, liarCount: 2, hasPoisoning: false }),
]);

// ── Bluff Rules ────────────────────────────────────────────────────

export const BluffRules = Object.freeze({
  // Good, non-selfDeceived players claim their true role with truthful info
  TRUTHFUL_CLAIM_TRUE_ROLE: 'truthful_claim_true_role',
  // Drunk claims a Townsfolk role NOT claimed by any true Townsfolk
  DRUNK_UNIQUE_TOWNSFOLK_CLAIM: 'drunk_unique_townsfolk_claim',
  // Butler claims "Butler" (real role, no info)
  BUTLER_CLAIMS_SELF: 'butler_claims_self',
  // Evil players claim Townsfolk OR Butler, distinct from each other, never Drunk
  EVIL_CLAIMS_TOWNSFOLK_OR_BUTLER: 'evil_claims_townsfolk_or_butler',
  // Evil MAY double-claim a role held by a real Townsfolk
  EVIL_MAY_DOUBLE_CLAIM: 'evil_may_double_claim',
  // Evil claims are distinct from each other
  EVIL_DISTINCT_CLAIMS: 'evil_distinct_claims',
  // Evil never claims Drunk
  EVIL_NEVER_CLAIMS_DRUNK: 'evil_never_claims_drunk',
});

// ── Seat Names ───────────────────────────────────────────────────

export const BUFFY_NAMES = Object.freeze([
  'Angel', 'Buffy', 'Cordelia', 'Dawn', 'Ethan',
  'Faith', 'Giles', 'Harmony', 'Illyria', 'Jenny',
  'Kendra', 'Lorne', 'Morgan', 'Nina', 'Oz',
  'Pike', 'Quinn', 'Riley', 'Spike', 'Tara',
  'Urkonn', 'Veruca', 'Wesley', 'Xander', 'Yuki', 'Zed',
]);

// ── Simulation Limits ──────────────────────────────────────────────

export const MAX_NIGHTS = 6;
export const INITIAL_LIVES = 3;

// ── Role team mapping ──────────────────────────────────────────────

export const ROLE_TEAM = Object.freeze({
  [RoleType.TOWNSFOLK]: Team.GOOD,
  [RoleType.OUTSIDER]: Team.GOOD,
  [RoleType.MINION]: Team.EVIL,
  [RoleType.DEMON]: Team.EVIL,
});
