import { INITIAL_LIVES } from './constants.js';
import { getRole, isEvil } from './roles.js';

// ── Controls Module ───────────────────────────────────────────────

/**
 * Initialize all control event listeners.
 * @param {object} options
 * @param {function} options.onModeChange - Called with 'progressive' | 'all_at_once'
 * @param {function} options.onSubmit - Called when submit button is clicked
 * @param {function} options.onNewGame - Called when new game button is clicked
 */
export const initControls = ({ onModeChange, onSubmit, onNewGame }) => {
  const modeToggle = document.getElementById('mode-toggle');
  const submitBtn = document.getElementById('submit-btn');
  const newGameBtn = document.getElementById('new-game-btn');

  if (modeToggle) {
    modeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;

      const mode = btn.dataset.mode === 'all-at-once' ? 'all_at_once' : 'progressive';
      setMode(mode);
      onModeChange(mode);
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', () => onSubmit());
  }

  if (newGameBtn) {
    newGameBtn.addEventListener('click', () => onNewGame());
  }
};

/**
 * Update mode toggle visual state.
 * @param {'progressive' | 'all_at_once'} mode
 */
export const setMode = (mode) => {
  const modeToggle = document.getElementById('mode-toggle');
  if (!modeToggle) return;

  const buttons = modeToggle.querySelectorAll('[data-mode]');
  const activeMode = mode === 'all_at_once' ? 'all-at-once' : 'progressive';

  buttons.forEach((btn) => {
    btn.classList.toggle('mode-toggle__btn--active', btn.dataset.mode === activeMode);
  });
};

/**
 * Render heart icons for lives.
 * @param {HTMLElement} container - The lives display container
 * @param {number} lives - Current lives remaining
 */
export const renderLives = (container, lives) => {
  container.innerHTML = '';

  for (let i = 0; i < INITIAL_LIVES; i++) {
    const icon = document.createElement('span');
    icon.className = 'lives-display__icon';
    icon.textContent = '\u2764\uFE0F';

    if (i >= lives) {
      icon.classList.add('life--lost');
    }

    container.appendChild(icon);
  }
};

/**
 * Show candidate count indicator.
 * @param {HTMLElement} container - The candidate count element
 * @param {number} count - Number of possible demon candidates
 */
export const showCandidateCount = (container, count) => {
  if (count === 1) {
    container.textContent = '1 player could be the Demon';
  } else {
    container.textContent = `${count} players could be the Demon`;
  }
  container.hidden = false;
};

/**
 * Show win or lose result modal.
 * @param {HTMLElement} container - The result content element
 * @param {boolean} won - Whether the player won
 * @param {object} solution - { impSeat, minionSeat, minionType, ... }
 * @param {Array} players - Player visible data with claimedRole info
 * @param {Array} seatNames - Array mapping seat index to name
 */
export const showResult = (container, won, solution, players, seatNames) => {
  const modal = document.getElementById('result-modal');
  if (!modal) return;

  container.innerHTML = '';

  const title = document.createElement('h2');
  title.className = 'result-modal__title';
  title.textContent = won ? 'Correct!' : 'Game Over';
  title.style.color = won ? 'var(--accent-green)' : 'var(--accent-red)';

  const message = document.createElement('p');
  message.className = 'result-modal__message';
  message.textContent = won
    ? 'You identified the Demon.'
    : 'The Demon has escaped your deduction.';

  container.appendChild(title);
  container.appendChild(message);

  // Role reveal
  const reveal = document.createElement('div');
  reveal.className = 'role-reference';

  const revealHeader = document.createElement('div');
  revealHeader.className = 'night-section__header';
  revealHeader.textContent = 'True Roles';
  reveal.appendChild(revealHeader);

  const list = document.createElement('div');
  list.className = 'role-reference__list';

  for (const player of players) {
    const trueRole = getTrueRoleForSeat(player.seat, solution, player.claimedRole);
    const trueRoleName = getRole(trueRole).name;
    const evil = isEvil(trueRole);

    const item = document.createElement('div');
    item.className = 'role-reference__item';
    item.style.borderLeft = `3px solid ${evil ? 'var(--accent-red)' : 'var(--accent-blue)'}`;

    const label = seatNames ? seatNames[player.seat] : `P${player.seat + 1}`;
    const claimedName = player.claimedRoleName;
    if (trueRoleName === claimedName) {
      item.textContent = `${label}: ${trueRoleName}`;
    } else {
      item.textContent = `${label}: ${trueRoleName} (claimed ${claimedName})`;
    }

    list.appendChild(item);
  }

  reveal.appendChild(list);
  container.appendChild(reveal);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.marginTop = 'var(--space-lg)';
  btnRow.style.display = 'flex';
  btnRow.style.gap = 'var(--space-md)';
  btnRow.style.justifyContent = 'center';

  const newGameBtn = document.createElement('button');
  newGameBtn.className = 'btn btn--primary';
  newGameBtn.textContent = 'New Game';
  newGameBtn.addEventListener('click', () => {
    hideResult();
    document.getElementById('new-game-btn')?.click();
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => hideResult());

  btnRow.appendChild(newGameBtn);
  btnRow.appendChild(closeBtn);
  container.appendChild(btnRow);

  modal.hidden = false;
};

/**
 * Determine the true role for a seat given the solution.
 * @param {number} seat
 * @param {object} solution
 * @param {string} claimedRole - Fallback (townsfolk claim their true role)
 * @returns {string} RoleId
 */
const getTrueRoleForSeat = (seat, solution, claimedRole) => {
  if (seat === solution.impSeat) return 'imp';
  if (seat === solution.minionSeat) return solution.minionType;
  if (seat === solution.outsiderSeat) return solution.outsiderType;
  return claimedRole;
};

/**
 * Hide the result modal.
 */
export const hideResult = () => {
  const modal = document.getElementById('result-modal');
  if (modal) {
    modal.hidden = true;
  }
};

/**
 * Enable or disable the submit button.
 * @param {boolean} enabled
 */
export const enableSubmit = (enabled) => {
  const btn = document.getElementById('submit-btn');
  if (btn) {
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? '1' : '0.4';
    btn.style.pointerEvents = enabled ? 'auto' : 'none';
  }
};
