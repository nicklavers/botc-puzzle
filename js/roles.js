import { RoleId, RoleType, Team, InfoType, InfoTiming, ROLE_TEAM } from './constants.js';

// ── Role Definition Factory ────────────────────────────────────────

const defineRole = (overrides) => Object.freeze({
  selfDeceived: false,
  believesType: null,
  selfUnaware: false,
  aliveRequired: false,
  hiddenState: null,
  infoType: InfoType.NONE,
  infoTiming: InfoTiming.NONE,
  description: '',
  ...overrides,
  team: ROLE_TEAM[overrides.type],
});

// ── Townsfolk ──────────────────────────────────────────────────────

const WASHERWOMAN = defineRole({
  id: RoleId.WASHERWOMAN,
  name: 'Washerwoman',
  type: RoleType.TOWNSFOLK,
  description: 'You start knowing that 1 of 2 players is a particular Townsfolk.',
  infoType: InfoType.ONE_OF_TWO_IS_ROLE,
  infoTiming: InfoTiming.FIRST_NIGHT,
  targetRoleType: RoleType.TOWNSFOLK,
});

const LIBRARIAN = defineRole({
  id: RoleId.LIBRARIAN,
  name: 'Librarian',
  type: RoleType.TOWNSFOLK,
  description: 'You start knowing that 1 of 2 players is a particular Outsider. (Or that zero are in play.)',
  infoType: InfoType.ONE_OF_TWO_IS_ROLE,
  infoTiming: InfoTiming.FIRST_NIGHT,
  targetRoleType: RoleType.OUTSIDER,
});

const INVESTIGATOR = defineRole({
  id: RoleId.INVESTIGATOR,
  name: 'Investigator',
  type: RoleType.TOWNSFOLK,
  description: 'You start knowing that 1 of 2 players is a particular Minion.',
  infoType: InfoType.ONE_OF_TWO_IS_ROLE,
  infoTiming: InfoTiming.FIRST_NIGHT,
  targetRoleType: RoleType.MINION,
});

const CHEF = defineRole({
  id: RoleId.CHEF,
  name: 'Chef',
  type: RoleType.TOWNSFOLK,
  description: 'You start knowing how many pairs of adjacent evil players there are.',
  infoType: InfoType.EVIL_PAIR_COUNT,
  infoTiming: InfoTiming.FIRST_NIGHT,
});

const CLOCKMAKER = defineRole({
  id: RoleId.CLOCKMAKER,
  name: 'Clockmaker',
  type: RoleType.TOWNSFOLK,
  description: 'You start knowing how many steps from the Demon to the nearest Minion.',
  infoType: InfoType.STEP_COUNT,
  infoTiming: InfoTiming.FIRST_NIGHT,
});

const NOBLE = defineRole({
  id: RoleId.NOBLE,
  name: 'Noble',
  type: RoleType.TOWNSFOLK,
  description: 'You start knowing 3 players, 1 and only 1 of which is evil.',
  infoType: InfoType.THREE_PLAYERS_ONE_EVIL,
  infoTiming: InfoTiming.FIRST_NIGHT,
});

const KNIGHT = defineRole({
  id: RoleId.KNIGHT,
  name: 'Knight',
  type: RoleType.TOWNSFOLK,
  description: 'You start knowing 2 players that are not the Demon.',
  infoType: InfoType.TWO_NOT_DEMON,
  infoTiming: InfoTiming.FIRST_NIGHT,
});

const STEWARD = defineRole({
  id: RoleId.STEWARD,
  name: 'Steward',
  type: RoleType.TOWNSFOLK,
  description: 'You start knowing 1 good player.',
  infoType: InfoType.ONE_GOOD_PLAYER,
  infoTiming: InfoTiming.FIRST_NIGHT,
});

const SHUGENJA = defineRole({
  id: RoleId.SHUGENJA,
  name: 'Shugenja',
  type: RoleType.TOWNSFOLK,
  description: 'You start knowing if your closest evil player is clockwise, counter-clockwise, or equidistant.',
  infoType: InfoType.CLOSEST_EVIL_DIRECTION,
  infoTiming: InfoTiming.FIRST_NIGHT,
});

const EMPATH = defineRole({
  id: RoleId.EMPATH,
  name: 'Empath',
  type: RoleType.TOWNSFOLK,
  description: 'Each night, you learn how many of your alive neighbours are evil.',
  infoType: InfoType.EVIL_NEIGHBOR_COUNT,
  infoTiming: InfoTiming.EACH_NIGHT,
  aliveRequired: true,
});

const FORTUNE_TELLER = defineRole({
  id: RoleId.FORTUNE_TELLER,
  name: 'Fortune Teller',
  type: RoleType.TOWNSFOLK,
  description: 'Each night, 2 players are chosen: you learn if either is the Demon. There is a good player who always registers as the Demon.',
  infoType: InfoType.IS_EITHER_DEMON,
  infoTiming: InfoTiming.EACH_NIGHT,
  aliveRequired: true,
  hiddenState: Object.freeze({ redHerring: 'goodPlayer' }),
});

// ── Outsiders ──────────────────────────────────────────────────────

const DRUNK = defineRole({
  id: RoleId.DRUNK,
  name: 'Drunk',
  type: RoleType.OUTSIDER,
  description: 'You think you are a Townsfolk, but you are actually the Drunk. All your information is wrong.',
  selfDeceived: true,
  believesType: RoleType.TOWNSFOLK,
  selfUnaware: true,
});

const BUTLER = defineRole({
  id: RoleId.BUTLER,
  name: 'Butler',
  type: RoleType.OUTSIDER,
  description: 'No information ability. You are good.',
});

// ── Minions ────────────────────────────────────────────────────────

const POISONER = defineRole({
  id: RoleId.POISONER,
  name: 'Poisoner',
  type: RoleType.MINION,
  description: 'On Night 1, you poison one of your neighbours. The target advances one seat each subsequent night. The poisoned player\'s information is wrong.',
  aliveRequired: true,
  hiddenState: Object.freeze({ poisonDirection: ['cw', 'ccw'] }),
});

const SCARLET_WOMAN = defineRole({
  id: RoleId.SCARLET_WOMAN,
  name: 'Scarlet Woman',
  type: RoleType.MINION,
  description: 'No special ability in this puzzle. You are evil.',
});

// ── Demon ──────────────────────────────────────────────────────────

const IMP = defineRole({
  id: RoleId.IMP,
  name: 'Imp',
  type: RoleType.DEMON,
  description: 'Starting Night 2, one player dies each night. You are evil.',
});

// ── Registry ───────────────────────────────────────────────────────

export const ROLES = Object.freeze({
  [RoleId.WASHERWOMAN]: WASHERWOMAN,
  [RoleId.LIBRARIAN]: LIBRARIAN,
  [RoleId.INVESTIGATOR]: INVESTIGATOR,
  [RoleId.CHEF]: CHEF,
  [RoleId.CLOCKMAKER]: CLOCKMAKER,
  [RoleId.NOBLE]: NOBLE,
  [RoleId.KNIGHT]: KNIGHT,
  [RoleId.STEWARD]: STEWARD,
  [RoleId.SHUGENJA]: SHUGENJA,
  [RoleId.EMPATH]: EMPATH,
  [RoleId.FORTUNE_TELLER]: FORTUNE_TELLER,
  [RoleId.DRUNK]: DRUNK,
  [RoleId.BUTLER]: BUTLER,
  [RoleId.POISONER]: POISONER,
  [RoleId.SCARLET_WOMAN]: SCARLET_WOMAN,
  [RoleId.IMP]: IMP,
});

// ── Icon Path ─────────────────────────────────────────────────────

export const getRoleIconPath = (roleId) => `img/roles/${roleId}.png`;

// ── Helpers ────────────────────────────────────────────────────────

export const getRole = (roleId) => {
  const role = ROLES[roleId];
  if (!role) throw new Error(`Unknown role: ${roleId}`);
  return role;
};

export const getRolesByType = (roleType) =>
  Object.values(ROLES).filter((r) => r.type === roleType);

export const getInfoRoles = () =>
  Object.values(ROLES).filter((r) => r.infoType !== InfoType.NONE);

export const isEvil = (roleId) => {
  const role = getRole(roleId);
  return role.team === Team.EVIL;
};

export const isGood = (roleId) => !isEvil(roleId);
