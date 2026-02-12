import { createGameManager } from './ui-manager.js';
import { renderClockTower, clearSelections, getSelectedSeats, revealSeat, highlightClaim, clearClaimHighlight } from './ui-clocktower.js';
import { renderAllNights, clearInfoPanel } from './ui-info-panel.js';
import { initControls, setMode, renderLives, showCandidateCount, showResult, hideResult, enableSubmit } from './ui-controls.js';
import { isEvil } from './roles.js';

// ── DOM References ────────────────────────────────────────────────

const getElements = () => ({
  clocktower: document.getElementById('clocktower'),
  infoPanel: document.getElementById('info-panel'),
  livesDisplay: document.getElementById('lives-display'),
  candidateCount: document.getElementById('candidate-count'),
  phaseIndicator: document.getElementById('phase-indicator'),
  resultContent: document.getElementById('result-content'),
});

// ── App Bootstrap ─────────────────────────────────────────────────

const initApp = () => {
  const els = getElements();
  const manager = createGameManager();

  let currentMode = 'progressive';
  let seatElements = [];

  // ── Rendering ─────────────────────────────────────────────────

  const renderGame = () => {
    const puzzle = manager.getPuzzle();
    const state = manager.getState();

    if (!puzzle) {
      clearInfoPanel(els.infoPanel);
      els.clocktower.innerHTML = '';
      els.phaseIndicator.textContent = 'No puzzle generated';
      enableSubmit(false);
      return;
    }

    // Compute alive/dead state based on visible nights
    const visibleNights = manager.getVisibleNights();
    const deadSeats = new Set(
      visibleNights
        .filter((n) => n.killed !== null && n.killed !== undefined)
        .map((n) => n.killed)
    );
    const playersForRender = puzzle.players.map((p) => ({
      ...p,
      alive: !deadSeats.has(p.seat),
    }));

    // Render clocktower seats
    seatElements = renderClockTower(els.clocktower, playersForRender, onSeatClick);

    // Claim hover callback
    const onClaimHover = (data) => {
      if (!data) {
        clearClaimHighlight(els.clocktower, seatElements);
        return;
      }
      highlightClaim(els.clocktower, seatElements, data.sourceSeat, data.targetSeats);
    };

    // Render visible nights (already computed above)
    renderAllNights(els.infoPanel, visibleNights, puzzle.seatNames, onClaimHover);

    // Lives
    renderLives(els.livesDisplay, state.lives);

    // Candidate count
    const candidateCount = manager.getCandidateCount();
    showCandidateCount(els.candidateCount, candidateCount);

    // Phase indicator
    updatePhaseIndicator(state);

    // Submit button
    enableSubmit(!state.gameOver && !state.solved);
  };

  const updatePhaseIndicator = (state) => {
    if (state.mode === 'all_at_once') {
      els.phaseIndicator.textContent = 'Select the Demon';
    } else if (state.solved || state.gameOver) {
      els.phaseIndicator.textContent = '';
    } else {
      const day = state.currentDay;
      const count = manager.getCandidateCount();
      els.phaseIndicator.textContent = `Day ${day} — Select all ${count} possible Demon seat${count !== 1 ? 's' : ''}`;
    }
  };

  // ── Seat Click Handler ────────────────────────────────────────

  const onSeatClick = (seatIndex) => {
    const state = manager.getState();
    if (state.gameOver || state.solved) return;

    const seatEl = seatElements[seatIndex];
    if (!seatEl) return;

    // In all-at-once mode, only allow single selection
    if (state.mode === 'all_at_once') {
      clearSelections(els.clocktower);
      seatEl.classList.add('seat--selected');
    } else {
      seatEl.classList.toggle('seat--selected');
    }
  };

  // ── Submit Handler ────────────────────────────────────────────

  const onSubmit = () => {
    const state = manager.getState();
    if (state.gameOver || state.solved) return;

    const selected = getSelectedSeats(els.clocktower);
    if (selected.size === 0) return;

    const result = manager.submitCandidates(selected);

    // Update lives display
    renderLives(els.livesDisplay, result.lives);

    if (result.won) {
      showWinResult();
      return;
    }

    if (result.gameOver) {
      showLoseResult();
      return;
    }

    if (result.correct) {
      // Progressive mode: advance to next day
      els.phaseIndicator.textContent = 'Correct! Advancing...';
      els.phaseIndicator.classList.add('phase-indicator--correct');
      setTimeout(() => {
        els.phaseIndicator.classList.remove('phase-indicator--correct');
        manager.advanceDay();
        clearSelections(els.clocktower);
        renderGame();
      }, 800);
    } else {
      // Wrong answer, clear selections
      clearSelections(els.clocktower);
      flashIncorrect();
    }
  };

  // ── Result Display ────────────────────────────────────────────

  const showWinResult = () => {
    const puzzle = manager.getPuzzle();
    if (!puzzle) return;

    revealAllSeats(puzzle);
    showResult(els.resultContent, true, puzzle.solution, puzzle.players, puzzle.seatNames);
    enableSubmit(false);
  };

  const showLoseResult = () => {
    const puzzle = manager.getPuzzle();
    if (!puzzle) return;

    revealAllSeats(puzzle);
    showResult(els.resultContent, false, puzzle.solution, puzzle.players, puzzle.seatNames);
    enableSubmit(false);
  };

  const revealAllSeats = (puzzle) => {
    for (const player of puzzle.players) {
      const seatEl = seatElements[player.seat];
      if (!seatEl) continue;

      const trueRole = getTrueRole(player.seat, puzzle.solution, player.claimedRole);
      revealSeat(seatEl, trueRole, isEvil(trueRole));
    }
  };

  const flashIncorrect = () => {
    els.phaseIndicator.textContent = 'Incorrect! Try again.';
    els.phaseIndicator.classList.add('phase-indicator--error');
    setTimeout(() => {
      els.phaseIndicator.classList.remove('phase-indicator--error');
      const state = manager.getState();
      updatePhaseIndicator(state);
    }, 1500);
  };

  // ── Mode Change Handler ───────────────────────────────────────

  const onModeChange = (mode) => {
    currentMode = mode;
    hideResult();
    startGame(mode);
  };

  // ── New Game Handler ──────────────────────────────────────────

  const onNewGame = () => {
    hideResult();
    startGame(currentMode);
  };

  // ── Game Start ────────────────────────────────────────────────

  const startGame = (mode) => {
    const result = manager.startNewGame(mode);

    if (!result.success) {
      els.phaseIndicator.textContent = result.error;
      clearInfoPanel(els.infoPanel);
      els.clocktower.innerHTML = '';
      enableSubmit(false);
      return;
    }

    renderGame();
  };

  // ── Keyboard Navigation ──────────────────────────────────────

  const initKeyboard = () => {
    document.addEventListener('keydown', (e) => {
      const state = manager.getState();

      // Number keys 1-8: toggle seat selection
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8 && !state.gameOver && !state.solved) {
        const seatIndex = num - 1;
        onSeatClick(seatIndex);
        return;
      }

      // Enter: submit
      if (e.key === 'Enter' && !state.gameOver && !state.solved) {
        onSubmit();
        return;
      }

      // Escape: close modal
      if (e.key === 'Escape') {
        hideResult();
        return;
      }

      // N: new game
      if (e.key === 'n' || e.key === 'N') {
        if (state.gameOver || state.solved) {
          onNewGame();
        }
      }
    });
  };

  // ── Initialize ────────────────────────────────────────────────

  initControls({
    onModeChange,
    onSubmit,
    onNewGame,
  });

  initKeyboard();
  setMode('progressive');
  startGame('progressive');
};

// ── Helpers ───────────────────────────────────────────────────────

const getTrueRole = (seat, solution, claimedRole) => {
  if (seat === solution.impSeat) return 'imp';
  if (seat === solution.minionSeat) return solution.minionType;
  if (seat === solution.outsiderSeat) return solution.outsiderType;
  return claimedRole;
};

// ── Entry Point ───────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initApp);
