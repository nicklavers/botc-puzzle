import {
  cwNeighbor, ccwNeighbor, getNeighbors, getAliveNeighbors,
  getPoisonTarget, countEvilPairs, stepsToNearest,
  closestEvilDirection, allSeats, otherSeats,
} from '../js/seating.js';
import { Direction } from '../js/constants.js';

const { assert, assertEqual, assertSetEqual, group } = window.__test;

// ── cwNeighbor / ccwNeighbor ──────────────────────────────────────

group('cwNeighbor & ccwNeighbor', () => ({
  'seat 0 CW is 1'() {
    assertEqual(cwNeighbor(0), 1);
  },
  'seat 7 CW wraps to 0'() {
    assertEqual(cwNeighbor(7), 0);
  },
  'seat 0 CCW wraps to 7'() {
    assertEqual(ccwNeighbor(0), 7);
  },
  'seat 3 CCW is 2'() {
    assertEqual(ccwNeighbor(3), 2);
  },
  'seat 4 CW is 5'() {
    assertEqual(cwNeighbor(4), 5);
  },
}));

// ── getNeighbors ──────────────────────────────────────────────────

group('getNeighbors', () => ({
  'seat 0 neighbors are [7, 1]'() {
    const n = getNeighbors(0);
    assertEqual(n[0], 7);
    assertEqual(n[1], 1);
  },
  'seat 4 neighbors are [3, 5]'() {
    const n = getNeighbors(4);
    assertEqual(n[0], 3);
    assertEqual(n[1], 5);
  },
}));

// ── getAliveNeighbors ─────────────────────────────────────────────

group('getAliveNeighbors', () => ({
  'all alive: seat 3 neighbors are 2 and 4'() {
    const alive = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    const n = getAliveNeighbors(3, alive);
    assertSetEqual(new Set(n), new Set([2, 4]));
  },
  'skip dead CCW neighbor'() {
    // Seat 3, seat 2 dead -> CCW neighbor should be seat 1
    const alive = new Set([0, 1, 3, 4, 5, 6, 7]);
    const n = getAliveNeighbors(3, alive);
    assertSetEqual(new Set(n), new Set([1, 4]));
  },
  'skip dead CW neighbor'() {
    // Seat 3, seat 4 dead -> CW neighbor should be seat 5
    const alive = new Set([0, 1, 2, 3, 5, 6, 7]);
    const n = getAliveNeighbors(3, alive);
    assertSetEqual(new Set(n), new Set([2, 5]));
  },
  'wraparound: seat 0 with seat 7 dead -> CCW is seat 6'() {
    const alive = new Set([0, 1, 2, 3, 4, 5, 6]);
    const n = getAliveNeighbors(0, alive);
    assertSetEqual(new Set(n), new Set([6, 1]));
  },
  'multiple dead, wrap both directions'() {
    // Only seats 0, 4 alive
    const alive = new Set([0, 4]);
    const n = getAliveNeighbors(0, alive);
    // Both directions find seat 4
    assertEqual(n.length, 1);
    assertEqual(n[0], 4);
  },
  'only self alive: no neighbors'() {
    const alive = new Set([3]);
    const n = getAliveNeighbors(3, alive);
    assertEqual(n.length, 0);
  },
}));

// ── getPoisonTarget ───────────────────────────────────────────────

group('getPoisonTarget', () => ({
  'CW night 1: poisoner at 2 targets 3'() {
    assertEqual(getPoisonTarget(2, 'cw', 1), 3);
  },
  'CW night 2: poisoner at 2 targets 4'() {
    assertEqual(getPoisonTarget(2, 'cw', 2), 4);
  },
  'CW night 3: poisoner at 2 targets 5'() {
    assertEqual(getPoisonTarget(2, 'cw', 3), 5);
  },
  'CCW night 1: poisoner at 2 targets 1'() {
    assertEqual(getPoisonTarget(2, 'ccw', 1), 1);
  },
  'CCW night 2: poisoner at 2 targets 0'() {
    assertEqual(getPoisonTarget(2, 'ccw', 2), 0);
  },
  'CCW night 3: poisoner at 2 targets 7 (wrap)'() {
    assertEqual(getPoisonTarget(2, 'ccw', 3), 7);
  },
  'CW wrap: poisoner at 6 night 3 targets 1'() {
    assertEqual(getPoisonTarget(6, 'cw', 3), 1);
  },
}));

// ── countEvilPairs ────────────────────────────────────────────────

group('countEvilPairs', () => ({
  'adjacent pair (2,3) = 1'() {
    assertEqual(countEvilPairs([2, 3]), 1);
  },
  'adjacent pair (7,0) wraps = 1'() {
    assertEqual(countEvilPairs([7, 0]), 1);
  },
  'non-adjacent (1,4) = 0'() {
    assertEqual(countEvilPairs([1, 4]), 0);
  },
  'non-adjacent (0,6) = 0'() {
    assertEqual(countEvilPairs([0, 6]), 0);
  },
  'same seat edge case = 0'() {
    // Shouldn't happen in game, but tests boundary
    assertEqual(countEvilPairs([3]), 0);
  },
}));

// ── stepsToNearest ────────────────────────────────────────────────

group('stepsToNearest', () => ({
  'adjacent: 2 to [3] = 1'() {
    assertEqual(stepsToNearest(2, [3]), 1);
  },
  'opposite: 0 to [4] = 4'() {
    assertEqual(stepsToNearest(0, [4]), 4);
  },
  'wrap shorter path: 0 to [7] = 1'() {
    assertEqual(stepsToNearest(0, [7]), 1);
  },
  'multiple targets: 0 to [3,6] = min(3,2) = 2'() {
    assertEqual(stepsToNearest(0, [3, 6]), 2);
  },
  'distance 2: 0 to [2] = 2'() {
    assertEqual(stepsToNearest(0, [2]), 2);
  },
  'wrap: 7 to [1] = 2'() {
    assertEqual(stepsToNearest(7, [1]), 2);
  },
}));

// ── closestEvilDirection ──────────────────────────────────────────

group('closestEvilDirection', () => ({
  'evil CW closer: seat 0, evil at [2,6] -> CW (2 vs 2... both 2, equidistant)'() {
    // seat 0: CW to 2 = 2 steps, CCW to 6 = 2 steps -> equidistant
    assertEqual(closestEvilDirection(0, [2, 6]), Direction.EQUIDISTANT);
  },
  'evil CW closer: seat 0, evil at [1,5]'() {
    // CW to 1 = 1, CCW to 5 = 3 -> CW
    assertEqual(closestEvilDirection(0, [1, 5]), Direction.CW);
  },
  'evil CCW closer: seat 0, evil at [3,7]'() {
    // CW to 3 = 3, CCW to 7 = 1 -> CCW
    assertEqual(closestEvilDirection(0, [3, 7]), Direction.CCW);
  },
  'equidistant: seat 0, evil at [4]'() {
    // CW to 4 = 4, CCW to 4 = 4 -> equidistant
    assertEqual(closestEvilDirection(0, [4]), Direction.EQUIDISTANT);
  },
  'single evil CW: seat 2, evil at [4]'() {
    // CW to 4 = 2, CCW to 4 = 6 -> CW
    assertEqual(closestEvilDirection(2, [4]), Direction.CW);
  },
  'single evil CCW: seat 2, evil at [0]'() {
    // CW to 0 = 6, CCW to 0 = 2 -> CCW
    assertEqual(closestEvilDirection(2, [0]), Direction.CCW);
  },
}));

// ── allSeats / otherSeats ─────────────────────────────────────────

group('allSeats & otherSeats', () => ({
  'allSeats returns 0..7'() {
    const seats = allSeats();
    assertEqual(seats.length, 8);
    for (let i = 0; i < 8; i++) {
      assertEqual(seats[i], i);
    }
  },
  'otherSeats excludes given seat'() {
    const seats = otherSeats(3);
    assertEqual(seats.length, 7);
    assert(!seats.includes(3), 'should not include seat 3');
  },
}));
