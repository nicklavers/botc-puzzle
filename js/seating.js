import { PLAYER_COUNT, Direction } from './constants.js';

// ── Seat Math (8-seat circle, indices 0-7) ─────────────────────────

const mod = (n) => ((n % PLAYER_COUNT) + PLAYER_COUNT) % PLAYER_COUNT;

/** Clockwise neighbor (seat + 1) */
export const cwNeighbor = (seat) => mod(seat + 1);

/** Counter-clockwise neighbor (seat - 1) */
export const ccwNeighbor = (seat) => mod(seat - 1);

/** Both immediate neighbors [ccw, cw] */
export const getNeighbors = (seat) => [ccwNeighbor(seat), cwNeighbor(seat)];

/**
 * Alive neighbors of a seat.
 * Skips dead players and finds next alive in each direction.
 */
export const getAliveNeighbors = (seat, aliveSet) => {
  const neighbors = [];

  // Search CCW for first alive
  for (let i = 1; i < PLAYER_COUNT; i++) {
    const candidate = mod(seat - i);
    if (candidate === seat) break;
    if (aliveSet.has(candidate)) {
      neighbors.push(candidate);
      break;
    }
  }

  // Search CW for first alive
  for (let i = 1; i < PLAYER_COUNT; i++) {
    const candidate = mod(seat + i);
    if (candidate === seat) break;
    if (aliveSet.has(candidate)) {
      // Avoid duplicates when only 1 other alive player
      if (!neighbors.includes(candidate)) {
        neighbors.push(candidate);
      }
      break;
    }
  }

  return neighbors;
};

/**
 * Deterministic poison target for a given night.
 * Night 1: Poisoner picks a neighbor (CW or CCW).
 * Night N: Poison advances N-1 steps from Poisoner in that direction.
 */
export const getPoisonTarget = (poisonerSeat, direction, nightNum) => {
  const step = direction === 'cw' ? 1 : -1;
  return mod(poisonerSeat + step * nightNum);
};

/**
 * Count adjacent pairs of evil players in the seating circle.
 * Used by Chef ability.
 */
export const countEvilPairs = (evilSeats) => {
  const evilSet = new Set(evilSeats);
  let count = 0;
  for (const seat of evilSeats) {
    if (evilSet.has(cwNeighbor(seat))) {
      count++;
    }
  }
  // Each pair counted once: A→B counts when we check A's CW neighbor is B.
  // We only check CW direction so each pair is counted exactly once.
  return count;
};

/**
 * Shortest distance (in seats) from source to the nearest target.
 * Used by Clockmaker (Demon → nearest Minion).
 * Distance wraps around the circle.
 */
export const stepsToNearest = (sourceSeat, targetSeats) => {
  let minDist = PLAYER_COUNT; // max possible
  for (const target of targetSeats) {
    const cwDist = mod(target - sourceSeat);
    const ccwDist = mod(sourceSeat - target);
    const dist = Math.min(cwDist, ccwDist);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
};

/**
 * Direction from a seat to the closest evil player.
 * Used by Shugenja ability.
 * Returns Direction.CW, Direction.CCW, or Direction.EQUIDISTANT.
 */
export const closestEvilDirection = (seat, evilSeats) => {
  let minCW = PLAYER_COUNT;
  let minCCW = PLAYER_COUNT;

  for (const evil of evilSeats) {
    if (evil === seat) continue;
    const cwDist = mod(evil - seat);
    const ccwDist = mod(seat - evil);
    if (cwDist < minCW) minCW = cwDist;
    if (ccwDist < minCCW) minCCW = ccwDist;
  }

  if (minCW < minCCW) return Direction.CW;
  if (minCCW < minCW) return Direction.CCW;
  return Direction.EQUIDISTANT;
};

/**
 * All seats in the circle (0 to PLAYER_COUNT - 1).
 */
export const allSeats = () => Array.from({ length: PLAYER_COUNT }, (_, i) => i);

/**
 * Seats other than the given one.
 */
export const otherSeats = (seat) => allSeats().filter((s) => s !== seat);
