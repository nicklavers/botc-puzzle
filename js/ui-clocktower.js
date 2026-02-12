import { PLAYER_COUNT } from './constants.js';
import { getRole, getRoleIconPath } from './roles.js';

// ── Clocktower Rendering ──────────────────────────────────────────

const ANGLE_STEP = 360 / PLAYER_COUNT;

/**
 * Build a single seat element.
 * @param {object} player - { seat, claimedRole, claimedRoleName, alive }
 * @returns {HTMLElement}
 */
const buildSeatElement = (player) => {
  const el = document.createElement('div');
  const aliveClass = player.alive ? 'seat--alive' : 'seat--dead';
  el.className = `seat ${aliveClass}`;
  el.dataset.seat = String(player.seat);

  const angle = player.seat * ANGLE_STEP;
  el.style.setProperty('--angle', `${angle}deg`);

  const icon = document.createElement('img');
  icon.className = 'seat__icon';
  icon.src = getRoleIconPath(player.claimedRole);
  icon.alt = player.claimedRoleName;
  icon.draggable = false;
  el.appendChild(icon);

  const nameLabel = document.createElement('div');
  nameLabel.className = 'seat__name';
  nameLabel.textContent = player.seatName ?? String(player.seat + 1);
  el.appendChild(nameLabel);

  if (!player.alive) {
    const marker = document.createElement('div');
    marker.className = 'death-marker';
    marker.textContent = '\u2620';
    el.appendChild(marker);
  }

  return el;
};

/**
 * Render 8 player seats in a circle.
 * @param {HTMLElement} container - The clocktower container
 * @param {Array} players - Player visible data array
 * @param {function} onSeatClick - Callback(seatIndex) when a seat is clicked
 */
export const renderClockTower = (container, players, onSeatClick) => {
  container.innerHTML = '';

  const seats = players.map((player) => {
    const el = buildSeatElement(player);

    el.addEventListener('click', () => {
      if (player.alive) {
        onSeatClick(player.seat);
      }
    });

    container.appendChild(el);
    return el;
  });

  return seats;
};

/**
 * Update a single seat's visual state.
 * @param {HTMLElement} seat - The seat DOM element
 * @param {{ alive?: boolean, selected?: boolean, revealed?: boolean }} state
 */
export const updateSeatState = (seat, state) => {
  if (state.alive !== undefined) {
    seat.classList.toggle('seat--alive', state.alive);
    seat.classList.toggle('seat--dead', !state.alive);
  }
  if (state.selected !== undefined) {
    seat.classList.toggle('seat--selected', state.selected);
  }
  if (state.revealed !== undefined) {
    seat.classList.toggle('seat--demon', state.revealed);
  }
};

/**
 * Toggle the selected class on a seat element.
 * @param {HTMLElement} seat - The seat DOM element
 */
export const toggleCandidateSelection = (seat) => {
  seat.classList.toggle('seat--selected');
};

/**
 * Reveal a seat's true role at game end.
 * @param {HTMLElement} seat - The seat DOM element
 * @param {string} trueRoleId - The actual role ID
 * @param {boolean} isEvil - Whether the player is evil
 */
export const revealSeat = (seat, trueRoleId, isEvil) => {
  const icon = seat.querySelector('.seat__icon');
  if (icon) {
    icon.src = getRoleIconPath(trueRoleId);
    icon.alt = getRole(trueRoleId).name;
  }

  if (isEvil) {
    seat.classList.add('seat--demon');
  }
};

/**
 * Remove all selected classes from seats in a container.
 * @param {HTMLElement} container - The clocktower container
 */
export const clearSelections = (container) => {
  const selected = container.querySelectorAll('.seat--selected');
  selected.forEach((el) => el.classList.remove('seat--selected'));
};

/**
 * Get all currently selected seat indices.
 * @param {HTMLElement} container - The clocktower container
 * @returns {Set<number>}
 */
export const getSelectedSeats = (container) => {
  const selected = container.querySelectorAll('.seat--selected');
  return new Set(Array.from(selected).map((el) => Number(el.dataset.seat)));
};

// ── Claim Highlight + Arrows ─────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
const ARROW_ID = 'claim-arrowhead';

/**
 * Get or create the SVG overlay inside the clocktower container.
 * @param {HTMLElement} container
 * @returns {SVGSVGElement}
 */
const getArrowOverlay = (container) => {
  let svg = container.querySelector('.claim-arrow-overlay');
  if (svg) return svg;

  svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'claim-arrow-overlay');
  svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;width:100%;height:100%;';

  const defs = document.createElementNS(SVG_NS, 'defs');
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.setAttribute('id', ARROW_ID);
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '10');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('orient', 'auto-start-reverse');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  path.setAttribute('fill', 'rgba(212, 160, 23, 0.7)');

  marker.appendChild(path);
  defs.appendChild(marker);
  svg.appendChild(defs);
  container.appendChild(svg);

  return svg;
};

/**
 * Draw an SVG arrow between two seat elements.
 * Shortens arrow by half the seat size on each end so it points to the edge.
 * @param {SVGSVGElement} svg
 * @param {HTMLElement} fromEl
 * @param {HTMLElement} toEl
 * @param {DOMRect} containerRect
 */
const drawArrow = (svg, fromEl, toEl, containerRect) => {
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();

  const fromCx = fromRect.left + fromRect.width / 2 - containerRect.left;
  const fromCy = fromRect.top + fromRect.height / 2 - containerRect.top;
  const toCx = toRect.left + toRect.width / 2 - containerRect.left;
  const toCy = toRect.top + toRect.height / 2 - containerRect.top;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;

  const seatRadius = fromRect.width / 2;
  const ux = dx / dist;
  const uy = dy / dist;

  const x1 = fromCx + ux * (seatRadius + 4);
  const y1 = fromCy + uy * (seatRadius + 4);
  const x2 = toCx - ux * (seatRadius + 4);
  const y2 = toCy - uy * (seatRadius + 4);

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', 'rgba(212, 160, 23, 0.7)');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('marker-end', `url(#${ARROW_ID})`);

  svg.appendChild(line);
};

/**
 * Highlight a claim's source and target seats, draw arrows from source to targets.
 * @param {HTMLElement} container - The clocktower container
 * @param {Array<HTMLElement>} seatElements - Array of seat DOM elements
 * @param {number|null} sourceSeat - Claimer's seat index (null for death notifications)
 * @param {Array<number>} targetSeats - Referenced seat indices
 */
export const highlightClaim = (container, seatElements, sourceSeat, targetSeats) => {
  if (sourceSeat !== null && seatElements[sourceSeat]) {
    seatElements[sourceSeat].classList.add('seat--claim-source');
  }

  for (const t of targetSeats) {
    if (seatElements[t]) {
      seatElements[t].classList.add('seat--claim-target');
    }
  }

  if (sourceSeat !== null && targetSeats.length > 0) {
    const svg = getArrowOverlay(container);
    const containerRect = container.getBoundingClientRect();
    for (const t of targetSeats) {
      if (seatElements[sourceSeat] && seatElements[t]) {
        drawArrow(svg, seatElements[sourceSeat], seatElements[t], containerRect);
      }
    }
  }
};

/**
 * Remove all claim highlights and arrows.
 * @param {HTMLElement} container - The clocktower container
 * @param {Array<HTMLElement>} seatElements - Array of seat DOM elements
 */
export const clearClaimHighlight = (container, seatElements) => {
  for (const el of seatElements) {
    if (el) {
      el.classList.remove('seat--claim-source', 'seat--claim-target');
    }
  }

  const svg = container.querySelector('.claim-arrow-overlay');
  if (svg) {
    const lines = svg.querySelectorAll('line');
    for (const line of lines) {
      line.remove();
    }
  }
};
