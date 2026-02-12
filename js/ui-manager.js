import { createUIState, updateUIState, loseLife } from './game-state.js';
import { generatePuzzle } from './generator.js';

// ── Game Manager ──────────────────────────────────────────────────

/**
 * State machine phases for the game flow.
 */
const Phase = Object.freeze({
  IDLE: 'idle',
  REVEAL: 'reveal',
  SELECT: 'select',
  VERIFY: 'verify',
  WIN: 'win',
  LOSE: 'lose',
});

/**
 * Create the game manager that orchestrates puzzle flow.
 * @returns {object} Manager with methods for game control
 */
export const createGameManager = () => {
  let puzzle = null;
  let uiState = createUIState('progressive');
  let phase = Phase.IDLE;
  let currentCheckpointIndex = 0;

  /**
   * Start a new game with the given mode.
   * @param {'progressive' | 'all_at_once'} mode
   * @returns {{ success: boolean, puzzle: object|null, error: string|null }}
   */
  const startNewGame = (mode) => {
    puzzle = generatePuzzle(mode);
    if (!puzzle) {
      return { success: false, puzzle: null, error: 'Failed to generate puzzle. Please try again.' };
    }

    uiState = createUIState(mode);
    currentCheckpointIndex = 0;
    phase = Phase.REVEAL;

    return { success: true, puzzle, error: null };
  };

  /**
   * Get the current day number being viewed.
   * In progressive mode, this is the checkpoint day.
   * In all-at-once mode, this is the total number of nights.
   */
  const getCurrentDay = () => {
    if (!puzzle) return 0;

    if (uiState.mode === 'all_at_once') {
      return puzzle.totalNights;
    }

    if (currentCheckpointIndex >= puzzle.checkpoints.length) {
      return puzzle.totalNights;
    }

    return puzzle.checkpoints[currentCheckpointIndex].day;
  };

  /**
   * Get the nights data visible at the current state.
   * @returns {Array} Night data objects to display
   */
  const getVisibleNights = () => {
    if (!puzzle) return [];

    const throughDay = getCurrentDay();
    return puzzle.nights.filter((n) => n.nightNum <= throughDay);
  };

  /**
   * Get how many possible demons exist at the current checkpoint.
   * @returns {number}
   */
  const getCandidateCount = () => {
    if (!puzzle) return 0;

    if (uiState.mode === 'all_at_once') {
      // In all-at-once, the final checkpoint is the relevant one
      const lastCp = puzzle.checkpoints[puzzle.checkpoints.length - 1];
      return lastCp ? lastCp.candidateCount : 0;
    }

    if (currentCheckpointIndex >= puzzle.checkpoints.length) return 0;
    return puzzle.checkpoints[currentCheckpointIndex].candidateCount;
  };

  /**
   * Get the set of possible demon seats at the current checkpoint.
   * @returns {Set<number>}
   */
  const getPossibleDemons = () => {
    if (!puzzle) return new Set();

    if (uiState.mode === 'all_at_once') {
      const lastCp = puzzle.checkpoints[puzzle.checkpoints.length - 1];
      return lastCp ? lastCp.possibleDemons : new Set();
    }

    if (currentCheckpointIndex >= puzzle.checkpoints.length) return new Set();
    return puzzle.checkpoints[currentCheckpointIndex].possibleDemons;
  };

  /**
   * Submit candidate selections and check the answer.
   * @param {Set<number>} selectedSeats - Seats the player selected
   * @returns {{ correct: boolean, lives: number, gameOver: boolean, won: boolean }}
   */
  const submitCandidates = (selectedSeats) => {
    if (!puzzle || phase === Phase.WIN || phase === Phase.LOSE) {
      return { correct: false, lives: uiState.lives, gameOver: uiState.gameOver, won: false };
    }

    const possibleDemons = getPossibleDemons();

    if (uiState.mode === 'all_at_once') {
      // Player selects exactly one seat as the demon
      const selectedArr = Array.from(selectedSeats);
      if (selectedArr.length !== 1) {
        return { correct: false, lives: uiState.lives, gameOver: false, won: false };
      }

      const guessedSeat = selectedArr[0];
      const correct = guessedSeat === puzzle.solution.impSeat;

      if (correct) {
        uiState = updateUIState(uiState, { solved: true });
        phase = Phase.WIN;
        return { correct: true, lives: uiState.lives, gameOver: true, won: true };
      }

      uiState = loseLife(uiState);
      if (uiState.gameOver) {
        phase = Phase.LOSE;
      }
      return { correct: false, lives: uiState.lives, gameOver: uiState.gameOver, won: false };
    }

    // Progressive mode: player must identify ALL possible demon seats
    const selectedSet = new Set(selectedSeats);
    const correct = setsEqual(selectedSet, possibleDemons);

    if (correct) {
      // Check if this was the final checkpoint (1 possible demon = solved)
      if (possibleDemons.size === 1) {
        uiState = updateUIState(uiState, { solved: true });
        phase = Phase.WIN;
        return { correct: true, lives: uiState.lives, gameOver: true, won: true };
      }

      // Advance to next checkpoint
      phase = Phase.REVEAL;
      return { correct: true, lives: uiState.lives, gameOver: false, won: false };
    }

    uiState = loseLife(uiState);
    if (uiState.gameOver) {
      phase = Phase.LOSE;
    }
    return { correct: false, lives: uiState.lives, gameOver: uiState.gameOver, won: false };
  };

  /**
   * Move to the next checkpoint in progressive mode.
   * Called after a correct submission that isn't the final answer.
   */
  const advanceDay = () => {
    if (!puzzle || uiState.mode !== 'progressive') return;
    if (currentCheckpointIndex < puzzle.checkpoints.length - 1) {
      currentCheckpointIndex += 1;
      phase = Phase.REVEAL;
    }
  };

  /**
   * Get the current UI state.
   * @returns {{ mode, lives, currentDay, solved, gameOver, phase }}
   */
  const getState = () => ({
    mode: uiState.mode,
    lives: uiState.lives,
    currentDay: getCurrentDay(),
    solved: uiState.solved,
    gameOver: uiState.gameOver,
    phase,
  });

  /**
   * Get the puzzle data (for rendering).
   * @returns {object|null}
   */
  const getPuzzle = () => puzzle;

  return Object.freeze({
    startNewGame,
    getCurrentDay,
    getVisibleNights,
    getCandidateCount,
    getPossibleDemons,
    submitCandidates,
    advanceDay,
    getState,
    getPuzzle,
  });
};

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Check if two sets contain the same elements.
 * @param {Set} a
 * @param {Set} b
 * @returns {boolean}
 */
const setsEqual = (a, b) => {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
};
