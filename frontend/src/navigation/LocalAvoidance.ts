import type { GridMap } from './GridMap';
import type {
  AgentTrajectory,
  AvoidanceResolution,
  EncounterDetection,
  GridPoint,
} from './types';

/**
 * Logika penghindaran sederhana untuk dua agen yang berpapasan di koridor / jalur:
 * Agen dengan prioritas lebih rendah bergeser satu tile tegak lurus (perpendicular)
 * untuk memberi jalan bagi agen lain.
 */
export class LocalAvoidance {
  /**
   * Mendeteksi apakah dua agen sedang berpapasan atau berebut tile yang sama.
   */
  public static detectEncounter(
    a: AgentTrajectory,
    b: AgentTrajectory
  ): EncounterDetection | null {
    const nextA = a.targetPos ?? a.path?.[1] ?? a.path?.[0] ?? a.currentPos;
    const nextB = b.targetPos ?? b.path?.[1] ?? b.path?.[0] ?? b.currentPos;

    const aAtCurrB = nextA.gx === b.currentPos.gx && nextA.gy === b.currentPos.gy;
    const bAtCurrA = nextB.gx === a.currentPos.gx && nextB.gy === a.currentPos.gy;
    const bothAtSameTarget = nextA.gx === nextB.gx && nextA.gy === nextB.gy;

    // 1. Head-on: saling bertukar posisi di langkah berikutnya
    if (aAtCurrB && bAtCurrA) {
      return {
        kind: 'head_on',
        agentA: a.agentId,
        agentB: b.agentId,
        conflictPoint: { gx: nextA.gx, gy: nextA.gy },
      };
    }

    // 2. Converging: berebut tile tujuan yang sama persis
    if (
      bothAtSameTarget &&
      (nextA.gx !== a.currentPos.gx || nextA.gy !== a.currentPos.gy)
    ) {
      return {
        kind: 'converging',
        agentA: a.agentId,
        agentB: b.agentId,
        conflictPoint: { gx: nextA.gx, gy: nextA.gy },
      };
    }

    // 3. Blocked: A ingin melangkah ke tile yang sedang diduduki B
    if (aAtCurrB && (nextA.gx !== a.currentPos.gx || nextA.gy !== a.currentPos.gy)) {
      return {
        kind: 'blocked',
        agentA: a.agentId,
        agentB: b.agentId,
        conflictPoint: { gx: nextA.gx, gy: nextA.gy },
      };
    }

    return null;
  }

  /**
   * Menentukan tile geser (sidestep) 1 tile tegak lurus dari arah gerak agen.
   */
  public static findSidestepTile(
    pos: GridPoint,
    moveDir: GridPoint,
    map: GridMap,
    occupiedTiles?: Set<number>,
    forbiddenPoint?: GridPoint
  ): GridPoint | null {
    const dx = Math.sign(moveDir.gx);
    const dy = Math.sign(moveDir.gy);

    // Kandidat offset tegak lurus relatif terhadap arah gerak (aturan sisi kanan diutamakan)
    const candidates: Array<[number, number]> = [];

    if (dx !== 0 && dy === 0) {
      // Gerak horizontal -> geser vertikal (kanan = +y, kiri = -y)
      candidates.push([0, 1], [0, -1], [dx, 1], [dx, -1]);
    } else if (dx === 0 && dy !== 0) {
      // Gerak vertikal -> geser horizontal (kanan = -x, kiri = +x)
      candidates.push([-1, 0], [1, 0], [-1, dy], [1, dy]);
    } else if (dx !== 0 && dy !== 0) {
      // Gerak diagonal -> flank kardinal terdekat
      candidates.push([dx, 0], [0, dy], [-dx, dy], [dx, -dy]);
    } else {
      // Diam -> periksa 4 kardinal di sekitarnya
      candidates.push([1, 0], [0, 1], [-1, 0], [0, -1]);
    }

    // Opsi mundur jika di koridor sempit 1-tile
    if (dx !== 0 || dy !== 0) {
      candidates.push([-dx, -dy]);
    }

    for (const [ox, oy] of candidates) {
      const nx = pos.gx + ox;
      const ny = pos.gy + oy;

      if (!map.isWithinBounds(nx, ny)) continue;
      if (!map.isWalkable(nx, ny)) continue;

      const idx = map.toIndex(nx, ny);
      if (occupiedTiles && occupiedTiles.has(idx)) continue;

      if (
        forbiddenPoint &&
        forbiddenPoint.gx === nx &&
        forbiddenPoint.gy === ny
      ) {
        continue;
      }

      return { gx: nx, gy: ny };
    }

    return null;
  }

  /**
   * Menyelesaikan konflik pertemuan dua agen:
   * Menentukan agen yang mengalah, mencari tile geser 1 tile, dan membentuk detour path.
   */
  public static resolveAvoidance(
    agentA: AgentTrajectory,
    agentB: AgentTrajectory,
    map: GridMap,
    occupiedTiles?: Set<number>
  ): AvoidanceResolution | null {
    const encounter = this.detectEncounter(agentA, agentB);
    if (!encounter) return null;

    // Penentuan prioritas: nilai prioritas lebih tinggi menang.
    // Jika seri: tiebreaker deterministik leksikografis agentId.
    const priorityA = agentA.priority ?? 0;
    const priorityB = agentB.priority ?? 0;

    let yieldingAgent: AgentTrajectory;
    let passingAgent: AgentTrajectory;

    if (priorityA !== priorityB) {
      yieldingAgent = priorityA < priorityB ? agentA : agentB;
      passingAgent = priorityA < priorityB ? agentB : agentA;
    } else {
      yieldingAgent = agentA.agentId > agentB.agentId ? agentA : agentB;
      passingAgent = yieldingAgent === agentA ? agentB : agentA;
    }

    // Tentukan vektor arah pergerakan agen yang mengalah
    const yNext =
      yieldingAgent.targetPos ??
      yieldingAgent.path?.[1] ??
      yieldingAgent.path?.[0] ??
      yieldingAgent.currentPos;
    const moveDir: GridPoint = {
      gx: yNext.gx - yieldingAgent.currentPos.gx,
      gy: yNext.gy - yieldingAgent.currentPos.gy,
    };

    // Filter occupiedTiles untuk menghindari posisi agen yang sedang lewat
    const occSet = new Set<number>(occupiedTiles);
    occSet.add(map.toIndex(passingAgent.currentPos.gx, passingAgent.currentPos.gy));

    const pNext =
      passingAgent.targetPos ??
      passingAgent.path?.[1] ??
      passingAgent.path?.[0] ??
      passingAgent.currentPos;
    occSet.add(map.toIndex(pNext.gx, pNext.gy));

    const sidestepTile = this.findSidestepTile(
      yieldingAgent.currentPos,
      moveDir,
      map,
      occSet,
      pNext
    );

    let detourPath: GridPoint[] | null = null;
    if (sidestepTile) {
      detourPath = this.buildDetourPath(
        yieldingAgent.currentPos,
        sidestepTile,
        yieldingAgent.path
      );
    }

    return {
      encounter,
      yieldingAgentId: yieldingAgent.agentId,
      passingAgentId: passingAgent.agentId,
      sidestepTile,
      detourPath,
    };
  }

  /**
   * Menyusun jalur memutar: [posisi-saat-ini, tile-geser, target-berikutnya, ...sisa-jalur]
   */
  public static buildDetourPath(
    currentPos: GridPoint,
    sidestepTile: GridPoint,
    originalPath?: GridPoint[]
  ): GridPoint[] {
    if (!originalPath || originalPath.length === 0) {
      return [{ gx: currentPos.gx, gy: currentPos.gy }, sidestepTile];
    }

    // Temukan titik jalur asli yang belum dilewati setelah posisi sekarang
    const remaining = originalPath.filter(
      (pt) =>
        !(pt.gx === currentPos.gx && pt.gy === currentPos.gy) &&
        !(pt.gx === sidestepTile.gx && pt.gy === sidestepTile.gy)
    );

    return [
      { gx: currentPos.gx, gy: currentPos.gy },
      sidestepTile,
      ...remaining,
    ];
  }
}
