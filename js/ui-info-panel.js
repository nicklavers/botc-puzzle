import { getRole, getRoleIconPath } from './roles.js';
import { RoleType, SCRIPT } from './constants.js';

// ── Info Panel Rendering ──────────────────────────────────────────

/**
 * Extract referenced seat indices from a claim's info object.
 * @param {object} info - The claim's structured info
 * @returns {Array<number>}
 */
const extractTargetSeats = (info) => {
  if (!info) return [];
  if (Array.isArray(info.seats)) return info.seats;
  if (typeof info.seat === 'number') return [info.seat];
  return [];
};

/**
 * Build a claim card element.
 * @param {object} claim - { seat, seatName, roleId, roleName, night, info, description }
 * @param {function|null} onClaimHover - Callback for hover events
 * @returns {HTMLElement}
 */
const buildClaimCard = (claim, onClaimHover) => {
  const card = document.createElement('div');
  card.className = 'claim-card';

  const roleIcon = document.createElement('img');
  roleIcon.className = 'claim-card__icon';
  roleIcon.src = getRoleIconPath(claim.roleId);
  roleIcon.alt = claim.roleName;
  roleIcon.draggable = false;

  const body = document.createElement('div');
  body.className = 'claim-card__body';

  const label = claim.seatName ?? `Player ${claim.seat + 1}`;
  const roleLabel = document.createElement('div');
  roleLabel.className = 'claim-card__role';
  roleLabel.textContent = `${label} (${claim.roleName})`;

  const text = document.createElement('div');
  text.className = 'claim-card__text';
  text.textContent = claim.description;

  body.appendChild(roleLabel);
  body.appendChild(text);
  card.appendChild(roleIcon);
  card.appendChild(body);

  if (onClaimHover) {
    const targetSeats = extractTargetSeats(claim.info);
    card.addEventListener('mouseenter', () => {
      onClaimHover({ sourceSeat: claim.seat, targetSeats });
    });
    card.addEventListener('mouseleave', () => {
      onClaimHover(null);
    });
  }

  return card;
};

/**
 * Build a death notification element.
 * @param {number} killedSeat - Seat index of killed player
 * @param {Array} seatNames - Array mapping seat index to name
 * @param {function|null} onClaimHover - Callback for hover events
 * @returns {HTMLElement}
 */
const buildDeathNotification = (killedSeat, seatNames, onClaimHover) => {
  const card = document.createElement('div');
  card.className = 'claim-card claim-card--false';

  const label = seatNames ? seatNames[killedSeat] : `Player ${killedSeat + 1}`;
  const text = document.createElement('div');
  text.className = 'claim-card__text';
  text.textContent = `${label} was killed during the night.`;

  card.appendChild(text);

  if (onClaimHover) {
    card.addEventListener('mouseenter', () => {
      onClaimHover({ sourceSeat: null, targetSeats: [killedSeat] });
    });
    card.addEventListener('mouseleave', () => {
      onClaimHover(null);
    });
  }

  return card;
};

/**
 * Render a single night's claims section.
 * @param {HTMLElement} container - The info panel container
 * @param {object} nightData - { nightNum, claims, killed }
 * @param {Array} seatNames - Array mapping seat index to name
 * @param {function|null} onClaimHover - Callback for hover events
 */
export const renderNightSection = (container, nightData, seatNames, onClaimHover) => {
  const section = document.createElement('div');
  section.className = 'night-section';

  const header = document.createElement('h3');
  header.className = 'night-section__header';
  header.textContent = `Night ${nightData.nightNum}`;
  section.appendChild(header);

  if (nightData.killed !== null && nightData.killed !== undefined) {
    section.appendChild(buildDeathNotification(nightData.killed, seatNames, onClaimHover));
  }

  for (const claim of nightData.claims) {
    section.appendChild(buildClaimCard(claim, onClaimHover));
  }

  container.appendChild(section);
};

/**
 * Build a collapsible rules summary.
 */
const buildRulesSummary = () => {
  const section = document.createElement('details');
  section.className = 'night-section';

  const summary = document.createElement('summary');
  summary.className = 'night-section__header';
  summary.textContent = 'Rules';
  summary.style.cursor = 'pointer';
  section.appendChild(summary);

  const rules = [
    'Good players always tell the truth.',
    'Evil and drunk/poisoned players always lie.',
    'The Drunk thinks they are a Townsfolk and gets false info.',
    'The Poisoner poisons a neighbor on Night 1, advancing each night.',
    'If two players claim the same role, at least one is evil.',
    'No one claims to be the Drunk. Evil never claims Drunk.',
    'Composition: 5 Townsfolk, 1 Outsider, 1 Minion, 1 Demon.',
  ];

  for (const rule of rules) {
    const card = document.createElement('div');
    card.className = 'claim-card';
    const text = document.createElement('div');
    text.className = 'claim-card__text';
    text.textContent = rule;
    card.appendChild(text);
    section.appendChild(card);
  }

  return section;
};

/**
 * Build a collapsible script reference listing all roles and descriptions.
 */
const buildScriptReference = () => {
  const section = document.createElement('details');
  section.className = 'night-section';

  const summary = document.createElement('summary');
  summary.className = 'night-section__header';
  summary.textContent = 'Script';
  summary.style.cursor = 'pointer';
  section.appendChild(summary);

  const groups = [
    { label: 'Townsfolk', type: RoleType.TOWNSFOLK },
    { label: 'Outsiders', type: RoleType.OUTSIDER },
    { label: 'Minions', type: RoleType.MINION },
    { label: 'Demon', type: RoleType.DEMON },
  ];

  for (const group of groups) {
    const roleIds = SCRIPT[group.type];
    if (!roleIds || roleIds.length === 0) continue;

    const groupHeader = document.createElement('div');
    groupHeader.className = 'claim-card__role';
    groupHeader.textContent = group.label;
    groupHeader.style.marginTop = 'var(--space-sm, 4px)';
    section.appendChild(groupHeader);

    for (const roleId of roleIds) {
      const role = getRole(roleId);
      const card = document.createElement('div');
      card.className = 'claim-card';

      const scriptIcon = document.createElement('img');
      scriptIcon.className = 'claim-card__icon';
      scriptIcon.src = getRoleIconPath(roleId);
      scriptIcon.alt = role.name;
      scriptIcon.draggable = false;

      const body = document.createElement('div');
      body.className = 'claim-card__body';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'claim-card__role';
      nameDiv.textContent = role.name;

      const descDiv = document.createElement('div');
      descDiv.className = 'claim-card__text';
      descDiv.textContent = role.description || 'No ability.';

      body.appendChild(nameDiv);
      body.appendChild(descDiv);
      card.appendChild(scriptIcon);
      card.appendChild(body);
      section.appendChild(card);
    }
  }

  return section;
};

/**
 * Render all nights up to the current night.
 * @param {HTMLElement} container - The info panel container
 * @param {Array} nightsData - Array of night data objects
 * @param {Array} seatNames - Array mapping seat index to name
 * @param {function|null} onClaimHover - Callback for hover events
 */
export const renderAllNights = (container, nightsData, seatNames, onClaimHover) => {
  container.innerHTML = '';
  container.appendChild(buildRulesSummary());
  container.appendChild(buildScriptReference());
  for (const nightData of nightsData) {
    renderNightSection(container, nightData, seatNames, onClaimHover);
  }
};

/**
 * Show detailed claims for a specific player.
 * @param {HTMLElement} container - The info panel container
 * @param {object} player - Player visible data
 * @param {Array} claims - All claims made by this player
 */
export const showPlayerDetail = (container, player, claims) => {
  const detail = document.createElement('div');
  detail.className = 'night-section';

  const label = player.seatName ?? `Player ${player.seat + 1}`;
  const header = document.createElement('h3');
  header.className = 'night-section__header';
  header.textContent = `${label} — ${player.claimedRoleName}`;
  detail.appendChild(header);

  if (claims.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'claim-card__text';
    empty.textContent = 'No claims from this player.';
    detail.appendChild(empty);
  } else {
    for (const claim of claims) {
      detail.appendChild(buildClaimCard(claim));
    }
  }

  container.appendChild(detail);
};

/**
 * Clear the info panel.
 * @param {HTMLElement} container - The info panel container
 */
export const clearInfoPanel = (container) => {
  container.innerHTML = '';
};
