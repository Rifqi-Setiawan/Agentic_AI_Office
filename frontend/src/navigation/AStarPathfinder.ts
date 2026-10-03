import type { GridMap } from './GridMap';
import { IndexMinHeap } from './MinHeap';
import type {
  FacingDirection,
  GridPoint,
  PathfinderOptions,
  PathNode,
} from './types';

// Biaya pergerakan 8 arah: 4 kardinal (1.0) dan 4 diagonal (sqrt(2))
const SQRT2 = Math.SQRT2;

const DX = [1, -1, 0, 0, 1, -1, 1, -1];
const DY = [0, 0, 1, -1, 1, 1, -1, -1];
const COST = [1.0, 1.0, 1.0, 1.0, SQRT2, SQRT2, SQRT2, SQRT2];

/**
 * Mengonversi vektor gerak (dx, dy) ke salah satu dari 4 arah hadap isometrik:
 * - SE: Timur / Tenggara (+dx)
 * - SW: Selatan / Barat Daya (+dy)
 * - NE: Utara / Timur Laut (-dy)
 * - NW: Barat / Barat Laut (-dx)
 */
export function vectorToFacing(dx: number, dy: number): FacingDirection {
  if (dx > 0 && dy >= 0) return 'SE';
  if (dx <= 0 && dy > 0) return 'SW';
  if (dx >= 0 && dy < 0) return 'NE';
  return 'NW';
}

export class AStarPathfinder {
  private map: GridMap;
  private totalTiles: number;

  // Buffer state reusable untuk alokasi memori nol saat pencarian jalur
  private visitedRuns: Uint32Array;
  private closedRuns: Uint32Array;
  private gScores: Float64Array;
  private cameFrom: Int32Array;
  private minHeap: IndexMinHeap;
  private currentRun = 1;

  constructor(map: GridMap) {
    this.map = map;
    this.totalTiles = map.width * map.height;

    this.visitedRuns = new Uint32Array(this.totalTiles);
    this.closedRuns = new Uint32Array(this.totalTiles);
    this.gScores = new Float64Array(this.totalTiles);
    this.cameFrom = new Int32Array(this.totalTiles);
    this.minHeap = new IndexMinHeap(Math.max(1024, this.totalTiles));
  }

  /**
   * Heuristik jarak oktil (admissible & consistent) untuk grid 8 arah.
   */
  public heuristic(ax: number, ay: number, bx: number, by: number): number {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return (dx + dy) + (SQRT2 - 2) * Math.min(dx, dy);
  }

  /**
   * Menemukan jalur terpendek dari start ke goal menggunakan A* 8 arah.
   * Mengembalikan array PathNode lengkap dengan koordinat dan arah hadap tiap langkah.
   */
  public findPath(
    start: GridPoint,
    goal: GridPoint,
    options: PathfinderOptions = {}
  ): PathNode[] | null {
    const { width, height } = this.map;
    const collision = this.map.collision;

    if (
      !this.map.isWithinBounds(start.gx, start.gy) ||
      !this.map.isWithinBounds(goal.gx, goal.gy)
    ) {
      return null;
    }

    if (start.gx === goal.gx && start.gy === goal.gy) {
      return [{ gx: start.gx, gy: start.gy }];
    }

    const startIdx = this.map.toIndex(start.gx, start.gy);
    const goalIdx = this.map.toIndex(goal.gx, goal.gy);

    // Normalisasi set blocked & ignored
    const extraBlocked = this.buildIndexSet(options.extraBlocked);
    const ignoredTiles = this.buildIndexSet(options.ignoredTiles);
    const hasExtra = extraBlocked.size > 0;
    const hasIgnored = ignoredTiles.size > 0;

    // Validasi walkability start & goal
    if (
      (!hasIgnored || !ignoredTiles.has(startIdx)) &&
      (collision[startIdx] !== 0 || (hasExtra && extraBlocked.has(startIdx)))
    ) {
      return null;
    }
    if (
      (!hasIgnored || !ignoredTiles.has(goalIdx)) &&
      (collision[goalIdx] !== 0 || (hasExtra && extraBlocked.has(goalIdx)))
    ) {
      return null;
    }

    // Manajemen run-id untuk O(1) state reset
    this.currentRun++;
    if (this.currentRun >= 4294967290) {
      this.visitedRuns.fill(0);
      this.closedRuns.fill(0);
      this.currentRun = 1;
    }

    const run = this.currentRun;
    const heap = this.minHeap;
    heap.clear();

    const allowCornerCutting = options.allowCornerCutting ?? false;

    // Inisialisasi start node
    this.visitedRuns[startIdx] = run;
    this.gScores[startIdx] = 0.0;
    this.cameFrom[startIdx] = -1;

    const initialF = this.heuristic(start.gx, start.gy, goal.gx, goal.gy) * 1.0001;
    heap.push(startIdx, initialF);

    let reachedGoal = false;

    while (!heap.isEmpty()) {
      const currIdx = heap.pop();

      // Lewati node yang sudah ditutup
      if (this.closedRuns[currIdx] === run) {
        continue;
      }
      this.closedRuns[currIdx] = run;

      if (currIdx === goalIdx) {
        reachedGoal = true;
        break;
      }

      const currGx = currIdx % width;
      const currGy = Math.floor(currIdx / width);
      const currG = this.gScores[currIdx];

      for (let i = 0; i < 8; i++) {
        const dx = DX[i];
        const dy = DY[i];
        const cost = COST[i];
        const nx = currGx + dx;
        const ny = currGy + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          continue;
        }

        const nextIdx = ny * width + nx;

        // Jika sudah ditutup, lewati
        if (this.closedRuns[nextIdx] === run) {
          continue;
        }

        // Cek tile walkability (jalur cepat jika tidak ada rintangan khusus)
        if (hasIgnored && ignoredTiles.has(nextIdx)) {
          // Khusus diabaikan
        } else {
          if (collision[nextIdx] !== 0) {
            continue;
          }
          if (hasExtra && extraBlocked.has(nextIdx)) {
            continue;
          }
        }

        // Cek aturan diagonal corner cutting
        if (dx !== 0 && dy !== 0) {
          const c1Idx = currGy * width + nx; // kardinal horizontal
          const c2Idx = ny * width + currGx; // kardinal vertikal

          const c1Blocked =
            (!hasIgnored || !ignoredTiles.has(c1Idx)) &&
            (collision[c1Idx] !== 0 || (hasExtra && extraBlocked.has(c1Idx)));
          const c2Blocked =
            (!hasIgnored || !ignoredTiles.has(c2Idx)) &&
            (collision[c2Idx] !== 0 || (hasExtra && extraBlocked.has(c2Idx)));

          if (allowCornerCutting) {
            // Squeezing: terhalang hanya jika KEDUA dinding membentang
            if (c1Blocked && c2Blocked) {
              continue;
            }
          } else {
            // Strict: tidak boleh memotong sudut dinding mana pun
            if (c1Blocked || c2Blocked) {
              continue;
            }
          }
        }

        const tentG = currG + cost;

        if (this.visitedRuns[nextIdx] !== run || tentG < this.gScores[nextIdx]) {
          this.visitedRuns[nextIdx] = run;
          this.gScores[nextIdx] = tentG;
          this.cameFrom[nextIdx] = currIdx;

          // Tie-breaker 1.0001 untuk preferensi eksplorasi garis lurus
          const h = this.heuristic(nx, ny, goal.gx, goal.gy) * 1.0001;
          heap.push(nextIdx, tentG + h);
        }
      }
    }

    if (!reachedGoal) {
      return null;
    }

    // Rekonstruksi path dari goal ke start
    const path: PathNode[] = [];
    let cur = goalIdx;

    while (cur !== -1) {
      const gx = cur % width;
      const gy = Math.floor(cur / width);
      path.push({ gx, gy });
      cur = this.cameFrom[cur];
    }

    path.reverse();

    // Hitung arah hadap untuk setiap langkah
    for (let i = 0; i < path.length; i++) {
      if (i < path.length - 1) {
        const next = path[i + 1];
        path[i].direction = vectorToFacing(next.gx - path[i].gx, next.gy - path[i].gy);
      } else if (i > 0) {
        path[i].direction = path[i - 1].direction;
      } else {
        path[i].direction = 'SE';
      }
    }

    return path;
  }

  private buildIndexSet(items?: Set<number> | GridPoint[]): Set<number> {
    if (!items) return new Set<number>();
    if (items instanceof Set) return items;
    const set = new Set<number>();
    for (const pt of items) {
      set.add(this.map.toIndex(pt.gx, pt.gy));
    }
    return set;
  }
}
