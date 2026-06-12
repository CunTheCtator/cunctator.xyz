import type { GameState, Unit } from "../engine/types";
import { getEffectiveStats, chebyshevDistance } from "../engine/combat";
import type { TerrainBitmap } from "./terrain";
import { MOTION, EASE, type RenderFx } from "./motion";

export type MovingUnit = {
  id: number;
  fromX: number;
  fromY: number;
  progress: number;
};

export type RenderOverlay = {
  buildTargets?: { x: number; y: number }[];
  demolishTargets?: { x: number; y: number }[];
  abilityTargets?: { x: number; y: number }[];
  advisoryTile?: { x: number; y: number } | null;
};

export type Camera = { x: number; y: number };

const VIEWPORT = 16;
const GRID_SIZE = 64;
const MINIMAP_SIZE = 128;
const MINIMAP_MARGIN = 8;

const COLORS = {
  plains:           "#2a2a2a",
  mountain:         "#4a4040",
  structure:        "#2a3a2a",
  objective:        "#3a3a1a",
  open:             "#252525",
  ruins:            "#3a3030",
  water:            "#1a2a3a",
  resource:         "#1a4a18",
  resourceDot:      "#4aaa30",
  fog:              "rgba(0,0,0,0.7)",
  reachable:        "rgba(60,120,255,0.35)",
  reachableBorder:  "rgba(60,120,255,0.8)",
  attackable:       "rgba(255,70,70,0.35)",
  attackableBorder: "rgba(255,70,70,0.85)",
  selected:         "rgba(255,220,60,0.25)",
  spent:            "rgba(0,0,0,0.45)",
  flash:            "rgba(255,200,50,0.55)",
  flashBorder:      "rgba(255,140,20,0.9)",
  gridLine:         "#111",
  hpBarBg:          "#111",
  hpBarFg:          "#44cc44",
  hpBarLow:         "#cc4444",
  xpBarBg:          "#111",
  xpBarFg:          "#ccaa22",
  ghost:            "rgba(255,255,255,0.18)",
  abilityFlash:      "rgba(180,80,255,0.55)",
  abilityFlashBorder:"rgba(210,100,255,0.9)",
  levelUpRing:       "#ffdd44",
  levelUpArrow:     "#ffe066",
  puzzleNode:       "#ffe066",
  buildTarget:      "rgba(80,200,80,0.35)",
  buildBorder:      "rgba(80,200,80,0.85)",
  demolishTarget:   "rgba(200,80,80,0.35)",
  demolishBorder:   "rgba(200,80,80,0.85)",
  abilityTarget:    "rgba(180,80,255,0.35)",
  abilityBorder:    "rgba(180,80,255,0.85)",
};

function getTileSize(canvas: HTMLCanvasElement): number {
  return Math.floor(Math.min(canvas.width, canvas.height) / VIEWPORT);
}

function tileToPixel(tx: number, ty: number, tileSize: number, camera: Camera): { px: number; py: number } {
  return {
    px: (tx - camera.x) * tileSize,
    py: (ty - camera.y) * tileSize,
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function getAnimatedPos(unit: Unit, movingUnits: MovingUnit[]): { drawX: number; drawY: number } {
  const moving = movingUnits.find((m) => m.id === unit.id);
  if (!moving) return { drawX: unit.x, drawY: unit.y };
  const t = easeInOut(moving.progress);
  return {
    drawX: moving.fromX + (unit.x - moving.fromX) * t,
    drawY: moving.fromY + (unit.y - moving.fromY) * t,
  };
}

function isInViewport(tx: number, ty: number, camera: Camera): boolean {
  return tx >= camera.x && tx < camera.x + VIEWPORT && ty >= camera.y && ty < camera.y + VIEWPORT;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  tileSize: number,
  camera: Camera,
  terrainBitmap: TerrainBitmap | null
) {
  if (terrainBitmap) {
    const pxPerCell = terrainBitmap.pxPerCell;
    const sx = camera.x * pxPerCell;
    const sy = camera.y * pxPerCell;
    const sw = VIEWPORT * pxPerCell;
    const sh = VIEWPORT * pxPerCell;
    const dw = VIEWPORT * tileSize;
    const dh = VIEWPORT * tileSize;
    const prevSmoothing = ctx.imageSmoothingEnabled;
    const prevQuality = ctx.imageSmoothingQuality;
    const needsSmoothing = pxPerCell < tileSize;
    ctx.imageSmoothingEnabled = needsSmoothing;
    if (needsSmoothing) ctx.imageSmoothingQuality = "high";
    ctx.drawImage(terrainBitmap.canvas, sx, sy, sw, sh, 0, 0, dw, dh);
    ctx.imageSmoothingEnabled = prevSmoothing;
    ctx.imageSmoothingQuality = prevQuality;

    for (let ty = camera.y; ty < camera.y + VIEWPORT; ty++) {
      for (let tx = camera.x; tx < camera.x + VIEWPORT; tx++) {
        const tile = state.grid[ty]?.[tx];
        if (!tile) continue;
        const { px, py } = tileToPixel(tx, ty, tileSize, camera);

        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, tileSize, tileSize);

        if (!state.fog[ty]?.[tx]) {
          ctx.fillStyle = COLORS.fog;
          ctx.fillRect(px, py, tileSize, tileSize);
        }
      }
    }
    return;
  }

  for (let ty = camera.y; ty < camera.y + VIEWPORT; ty++) {
    for (let tx = camera.x; tx < camera.x + VIEWPORT; tx++) {
      const tile = state.grid[ty]?.[tx];
      if (!tile) continue;
      const { px, py } = tileToPixel(tx, ty, tileSize, camera);

      ctx.fillStyle = COLORS[tile.type as keyof typeof COLORS] ?? COLORS.plains;
      ctx.fillRect(px, py, tileSize, tileSize);

      if (tile.type === "resource" && state.fog[ty]?.[tx]) {
        ctx.fillStyle = COLORS.resourceDot;
        ctx.beginPath();
        ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px, py, tileSize, tileSize);

      if (!state.fog[ty]?.[tx]) {
        ctx.fillStyle = COLORS.fog;
        ctx.fillRect(px, py, tileSize, tileSize);
      }
    }
  }
}

function drawReachable(ctx: CanvasRenderingContext2D, state: GameState, tileSize: number, camera: Camera) {
  if (!state.reachableTiles) return;
  for (const { x, y } of state.reachableTiles) {
    if (!isInViewport(x, y, camera)) continue;
    const { px, py } = tileToPixel(x, y, tileSize, camera);
    ctx.fillStyle = COLORS.reachable;
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.strokeStyle = COLORS.reachableBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
  }
}

function drawAttackableEnemies(ctx: CanvasRenderingContext2D, state: GameState, tileSize: number, camera: Camera) {
  if (state.selectedUnitId === null) return;
  const selected = state.units.find((u) => u.id === state.selectedUnitId);
  if (!selected || selected.hasActed) return;

  const ctx2 = { armyEffects: state.armyEffects, allUnits: state.units, structures: state.structures };
  const attackRange = getEffectiveStats(selected, ctx2).attackRange;

  for (const unit of state.units) {
    if (unit.faction !== state.enemyFaction) continue;
    if (!state.fog[unit.y]?.[unit.x]) continue;
    if (chebyshevDistance(unit, selected) > attackRange) continue;
    if (!isInViewport(unit.x, unit.y, camera)) continue;

    const { px, py } = tileToPixel(unit.x, unit.y, tileSize, camera);
    ctx.fillStyle = COLORS.attackable;
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.strokeStyle = COLORS.attackableBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
  }
}

function drawFlash(ctx: CanvasRenderingContext2D, tiles: { x: number; y: number }[], tileSize: number, camera: Camera) {
  for (const { x, y } of tiles) {
    if (!isInViewport(x, y, camera)) continue;
    const { px, py } = tileToPixel(x, y, tileSize, camera);
    ctx.fillStyle = COLORS.flash;
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.strokeStyle = COLORS.flashBorder;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
  }
}

function drawAbilityFlash(ctx: CanvasRenderingContext2D, tiles: { x: number; y: number }[], tileSize: number, camera: Camera) {
  for (const { x, y } of tiles) {
    if (!isInViewport(x, y, camera)) continue;
    const { px, py } = tileToPixel(x, y, tileSize, camera);
    ctx.fillStyle = COLORS.abilityFlash;
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.strokeStyle = COLORS.abilityFlashBorder;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
  }
}

function drawPuzzleNodes(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  tileSize: number,
  camera: Camera,
  hasTerrainBitmap: boolean
) {
  for (const node of state.puzzleNodes) {
    if (!state.fog[node.y]?.[node.x]) continue;
    if (!isInViewport(node.x, node.y, camera)) continue;
    const { px, py } = tileToPixel(node.x, node.y, tileSize, camera);
    if (hasTerrainBitmap) {
      if (!node.activated) continue;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(px, py, tileSize, tileSize);
      continue;
    }
    const cx = px + tileSize / 2;
    const cy = py + tileSize / 2;
    ctx.fillStyle = node.activated ? "rgba(100,100,100,0.4)" : COLORS.puzzleNode;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStructures(ctx: CanvasRenderingContext2D, state: GameState, tileSize: number, camera: Camera) {
  for (const struct of state.structures) {
    if (!state.fog[struct.y]?.[struct.x]) continue;
    if (!isInViewport(struct.x, struct.y, camera)) continue;
    const { px, py } = tileToPixel(struct.x, struct.y, tileSize, camera);
    const isEnemy = struct.factionId !== state.playerFaction;

    ctx.fillStyle = isEnemy ? "#3a2020" : "#1e3020";
    ctx.strokeStyle = isEnemy ? "#774444" : "#447744";
    ctx.lineWidth = 2;
    ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
    ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);

    if (struct.maxHp > 1) {
      ctx.fillStyle = "#bbb";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`${struct.hp}/${struct.maxHp}`, px + tileSize / 2, py + 3);
    }
  }
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  tiles: { x: number; y: number }[],
  fillColor: string,
  borderColor: string,
  tileSize: number,
  camera: Camera
) {
  for (const { x, y } of tiles) {
    if (!isInViewport(x, y, camera)) continue;
    const { px, py } = tileToPixel(x, y, tileSize, camera);
    ctx.fillStyle = fillColor;
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
  }
}

function drawClassMark(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  cx: number,
  cy: number,
  tileSize: number
) {
  const s = tileSize * 0.13;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1.5, tileSize * 0.035);
  ctx.lineCap = "round";

  if (unit.isCommander) {
    ctx.font = `bold ${Math.floor(tileSize * 0.26)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", cx, cy);
    ctx.restore();
    return;
  }

  if (unit.isExtractor) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  switch (unit.role) {
    case "heavy":
      ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
      break;
    case "mobile":
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 1.15);
      ctx.lineTo(cx + s * 1.1, cy + s * 0.85);
      ctx.lineTo(cx - s * 1.1, cy + s * 0.85);
      ctx.closePath();
      ctx.fill();
      break;
    case "ranged":
      ctx.beginPath();
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "disrupt":
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.stroke();
      break;
    case "support":
      ctx.beginPath();
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "builder":
      ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
      break;
    case "wildcard":
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  drawX: number,
  drawY: number,
  isSelected: boolean,
  isGhost: boolean,
  factionColor: string,
  tileSize: number,
  camera: Camera,
  xpThresholds?: number[],
  fx?: RenderFx
) {
  if (isSelected) {
    const { px: tilePx, py: tilePy } = tileToPixel(unit.x, unit.y, tileSize, camera);
    ctx.fillStyle = COLORS.selected;
    ctx.fillRect(tilePx, tilePy, tileSize, tileSize);
  }

  const px = (drawX - camera.x) * tileSize;
  const py = (drawY - camera.y) * tileSize;
  const cx = px + tileSize / 2;
  const cy = py + tileSize / 2;
  const r = tileSize * 0.32;

  ctx.globalAlpha = isGhost ? 0.3 : 1;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = factionColor;
  ctx.fill();

  if (unit.isCommander) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (unit.isExtractor) {
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawClassMark(ctx, unit, cx, cy, tileSize);

  if (!isGhost) {
    const barW = tileSize * 0.7;
    const barX = px + (tileSize - barW) / 2;

    if (!unit.unkillable) {
      const barH = 3;
      const barY = py + tileSize - 7;
      const hpRatio = unit.hp / unit.maxHp;

      ctx.fillStyle = COLORS.hpBarBg;
      ctx.fillRect(barX, barY, barW, barH);

      const ghost = fx?.hpGhosts[unit.id];
      if (ghost && fx) {
        const elapsed = fx.nowMs - ghost.t0;
        let ghostRatio = ghost.fromRatio;
        if (fx.reducedMotion) {
          ghostRatio = ghost.toRatio;
        } else if (elapsed > MOTION.drainHold) {
          const t = Math.min(1, (elapsed - MOTION.drainHold) / MOTION.drain);
          ghostRatio = ghost.fromRatio + (ghost.toRatio - ghost.fromRatio) * EASE.linear(t);
        }
        if (ghostRatio > hpRatio) {
          ctx.fillStyle = "rgba(220,60,60,0.85)";
          ctx.fillRect(barX, barY, barW * ghostRatio, barH);
        }
      }

      ctx.fillStyle = hpRatio > 0.4 ? COLORS.hpBarFg : COLORS.hpBarLow;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }

    if (!unit.isExtractor) {
      const XP_THRESHOLDS = xpThresholds ?? [2, 4, 6, 7];
      const nextMilestone = XP_THRESHOLDS.find((t) => unit.xp < t);
      let xpRatio: number;
      if (nextMilestone === undefined) {
        xpRatio = 1;
      } else {
        const idx = XP_THRESHOLDS.indexOf(nextMilestone);
        const prevMilestone = idx > 0 ? XP_THRESHOLDS[idx - 1] : 0;
        xpRatio = Math.min(1, (unit.xp - prevMilestone) / (nextMilestone - prevMilestone));
      }

      const xpBarH = 2;
      const xpBarY = py + tileSize - 12;

      ctx.fillStyle = COLORS.xpBarBg;
      ctx.fillRect(barX, xpBarY, barW, xpBarH);
      ctx.fillStyle = COLORS.xpBarFg;
      ctx.fillRect(barX, xpBarY, barW * xpRatio, xpBarH);
    }

    if (unit.hasMoved && unit.hasActed) {
      ctx.fillStyle = COLORS.spent;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (unit.statusEffects?.length > 0) {
      const hasNegative = unit.statusEffects.some((e) => {
        const m = e.modifier;
        return (
          (m.attack      !== undefined && m.attack      < 0) ||
          (m.defense     !== undefined && m.defense     < 0) ||
          (m.moveRange   !== undefined && m.moveRange   < 0) ||
          (m.attackRange !== undefined && m.attackRange < 0) ||
          (m.visionRange !== undefined && m.visionRange < 0)
        );
      });
      ctx.fillStyle = hasNegative ? "#cc44cc" : "#44ccaa";
      ctx.beginPath();
      ctx.arc(px + tileSize - 5, py + 5, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (unit.repositionMoves > 0) {
      ctx.fillStyle = "#66ccff";
      ctx.beginPath();
      ctx.arc(px + 5, py + 5, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

function getFactionColor(factionId: string, factionColors: Record<string, string>): string {
  return factionColors[factionId] ?? "#888";
}

function drawUnits(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  factionColors: Record<string, string>,
  tileSize: number,
  movingUnits: MovingUnit[],
  camera: Camera,
  levelUpUnitIds?: Set<number>,
  fx?: RenderFx
) {
  const ms = state.xpMilestones;
  const xpThresholds = ms ? [ms.statIncrease, ms.secondTrait, ms.ability1Unlock, ms.ability2Unlock] : undefined;

  for (const unit of state.units) {
    if (!state.fog[unit.y]?.[unit.x]) continue;
    if (!isInViewport(unit.x, unit.y, camera)) continue;
    const isSelected = unit.id === state.selectedUnitId;
    const color = getFactionColor(unit.faction, factionColors);
    const { drawX, drawY } = getAnimatedPos(unit, movingUnits);
    drawUnit(ctx, unit, drawX, drawY, isSelected, false, color, tileSize, camera, xpThresholds, fx);
  }

  for (const [idStr, pos] of Object.entries(state.lastKnownPositions)) {
    const id = Number(idStr);
    const unit = state.units.find((u) => u.id === id);
    if (unit) continue;
    if (!isInViewport(pos.x, pos.y, camera)) continue;
    const enemyColor = factionColors[state.enemyFaction] ?? "#888";
    const ghostUnit: Unit = {
      x: pos.x, y: pos.y, hp: 0, maxHp: 1, attack: 0, defense: 0,
      moveRange: 0, attackRange: 1, visionRange: 0,
      id: -1, unitDataId: "", faction: state.enemyFaction, type: "", name: "",
      role: "", isBuilder: false, isCommander: false,
      isExtractor: false, unkillable: false, extractorLevel: 1, xp: 0, kills: 0,
      aiMode: "attack",
      hasMoved: false, hasActed: false, movedTiles: 0, repositionMoves: 0,
      usedTraits: [], statusEffects: [], traits: [],
    };
    drawUnit(ctx, ghostUnit, pos.x, pos.y, false, true, enemyColor, tileSize, camera);
  }

  const foggedEnemies = state.units.filter(
    (u) =>
      u.faction === state.enemyFaction &&
      !state.fog[u.y]?.[u.x] &&
      state.lastKnownPositions[u.id]
  );
  for (const unit of foggedEnemies) {
    const pos = state.lastKnownPositions[unit.id]!;
    if (!isInViewport(pos.x, pos.y, camera)) continue;
    const enemyColor = factionColors[state.enemyFaction] ?? "#888";
    drawUnit(ctx, { ...unit, x: pos.x, y: pos.y }, pos.x, pos.y, false, true, enemyColor, tileSize, camera);
  }

  if (levelUpUnitIds && levelUpUnitIds.size > 0) {
    for (const unit of state.units) {
      if (!levelUpUnitIds.has(unit.id)) continue;
      if (!isInViewport(unit.x, unit.y, camera)) continue;
      const { px, py } = tileToPixel(unit.x, unit.y, tileSize, camera);
      const cx = px + tileSize / 2;
      const cy = py + tileSize / 2;
      ctx.strokeStyle = COLORS.levelUpRing;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, tileSize * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.levelUpArrow;
      ctx.font = `bold ${Math.floor(tileSize * 0.32)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("↑", cx, py + 3);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }
}

function drawObjectiveTiles(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  tileSize: number,
  camera: Camera
) {
  for (const obj of state.objectiveTiles ?? []) {
    if (!isInViewport(obj.x, obj.y, camera)) continue;
    const { px, py } = tileToPixel(obj.x, obj.y, tileSize, camera);
    const cx = px + tileSize / 2;
    const cy = py + tileSize / 2;
    const r = tileSize * 0.22;

    ctx.save();
    ctx.strokeStyle = COLORS.puzzleNode;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,224,102,0.16)";
    ctx.fill();

    ctx.fillStyle = COLORS.puzzleNode;
    ctx.font = `bold ${Math.max(8, Math.floor(tileSize * 0.16))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const label = obj.label.length > 16 ? `${obj.label.slice(0, 15)}…` : obj.label;
    ctx.fillText(label, cx, py + tileSize - Math.floor(tileSize * 0.18));
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }
}

function drawDyingEchoes(ctx: CanvasRenderingContext2D, fx: RenderFx, tileSize: number, camera: Camera) {
  for (const d of fx.dying) {
    if (!isInViewport(d.x, d.y, camera)) continue;
    const elapsed = fx.nowMs - d.t0;
    const t = Math.min(1, elapsed / MOTION.fall);
    const { px, py } = tileToPixel(d.x, d.y, tileSize, camera);
    const cx = px + tileSize / 2;
    const cy = py + tileSize / 2;

    ctx.save();
    if (fx.reducedMotion) {
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 200);
    } else {
      ctx.globalAlpha = Math.max(0, 1 - EASE.fall(t));
    }
    if (d.isStructure) {
      const size = tileSize * 0.62;
      const drop = fx.reducedMotion ? 0 : 4 * EASE.fall(t);
      ctx.fillStyle = d.color;
      ctx.fillRect(cx - size / 2, cy - size / 2 + drop, size, size);
    } else {
      const scale = fx.reducedMotion ? 1 : 1 - 0.15 * EASE.fall(t);
      ctx.beginPath();
      ctx.arc(cx, cy, tileSize * 0.32 * scale, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawFloaters(ctx: CanvasRenderingContext2D, fx: RenderFx, tileSize: number, camera: Camera) {
  for (const f of fx.floaters) {
    if (!isInViewport(f.x, f.y, camera)) continue;
    const elapsed = fx.nowMs - f.t0;
    const t = Math.min(1, elapsed / MOTION.rise);
    const { px, py } = tileToPixel(f.x, f.y, tileSize, camera);
    const cx = px + tileSize / 2;
    const baseY = py + tileSize / 2 - tileSize * 0.42;

    let alpha: number;
    if (t < 0.12) alpha = t / 0.12;
    else if (t < 0.72) alpha = 1;
    else alpha = Math.max(0, 1 - (t - 0.72) / 0.28);

    const rise = fx.reducedMotion ? 0 : 18 * EASE.out(t);
    const y = baseY - rise;

    const isCrit = f.kind === "crit" || f.kind === "down";
    const size = isCrit ? Math.floor(tileSize * 0.3) : Math.floor(tileSize * 0.24);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${size}px Oxanium, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(5,8,11,0.9)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle =
      f.kind === "crit" || f.kind === "down" ? "#e8b339" :
      f.kind === "label" ? "#ffe066" :
      f.kind === "heal" ? "#5fd07a" :
      "#e6edf3";
    ctx.fillText(f.text, cx, y);
    ctx.restore();
  }
}

function drawPendingMoveGhost(ctx: CanvasRenderingContext2D, fx: RenderFx, tileSize: number, camera: Camera) {
  const ghost = fx.pendingMoveGhost;
  if (!ghost) return;
  if (!isInViewport(ghost.x, ghost.y, camera)) return;
  const { px, py } = tileToPixel(ghost.x, ghost.y, tileSize, camera);
  const cx = px + tileSize / 2;
  const cy = py + tileSize / 2;

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = ghost.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  factionColors: Record<string, string>,
  camera: Camera,
  canvasSize: number,
  terrainBitmap: TerrainBitmap | null
) {
  const tileW = MINIMAP_SIZE / GRID_SIZE;
  const ox = canvasSize - MINIMAP_SIZE - MINIMAP_MARGIN;
  const oy = MINIMAP_MARGIN;

  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(ox - 1, oy - 1, MINIMAP_SIZE + 2, MINIMAP_SIZE + 2);

  if (terrainBitmap) {
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrainBitmap.canvas, 0, 0, terrainBitmap.width, terrainBitmap.height, ox, oy, MINIMAP_SIZE, MINIMAP_SIZE);
    ctx.imageSmoothingEnabled = prevSmoothing;
    for (let ty = 0; ty < GRID_SIZE; ty++) {
      for (let tx = 0; tx < GRID_SIZE; tx++) {
        if (state.fog[ty]?.[tx]) continue;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(ox + tx * tileW, oy + ty * tileW, Math.max(1, tileW), Math.max(1, tileW));
      }
    }
  } else {
    for (let ty = 0; ty < GRID_SIZE; ty++) {
      for (let tx = 0; tx < GRID_SIZE; tx++) {
        const visible = state.fog[ty]?.[tx];
        if (!visible) {
          ctx.fillStyle = "rgba(0,0,0,0.6)";
        } else {
          const tile = state.grid[ty]?.[tx];
          ctx.fillStyle = tile ? (COLORS[tile.type as keyof typeof COLORS] ?? COLORS.plains) : COLORS.plains;
        }
        ctx.fillRect(ox + tx * tileW, oy + ty * tileW, Math.max(1, tileW), Math.max(1, tileW));
      }
    }
  }

  for (const struct of state.structures) {
    if (!state.fog[struct.y]?.[struct.x]) continue;
    ctx.fillStyle = struct.factionId === state.playerFaction ? "#447744" : "#774444";
    ctx.fillRect(ox + struct.x * tileW, oy + struct.y * tileW, Math.max(1, tileW), Math.max(1, tileW));
  }

  for (const unit of state.units) {
    if (!state.fog[unit.y]?.[unit.x]) continue;
    ctx.fillStyle = getFactionColor(unit.faction, factionColors);
    const ux = ox + unit.x * tileW;
    const uy = oy + unit.y * tileW;
    ctx.fillRect(ux, uy, Math.max(2, tileW * 1.5), Math.max(2, tileW * 1.5));
  }

  for (const node of state.puzzleNodes) {
    if (node.activated) continue;
    ctx.fillStyle = COLORS.puzzleNode;
    ctx.fillRect(ox + node.x * tileW, oy + node.y * tileW, Math.max(2, tileW), Math.max(2, tileW));
  }

  for (const obj of state.objectiveTiles ?? []) {
    ctx.strokeStyle = COLORS.puzzleNode;
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + obj.x * tileW - 1, oy + obj.y * tileW - 1, Math.max(3, tileW + 2), Math.max(3, tileW + 2));
  }

  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    ox + camera.x * tileW,
    oy + camera.y * tileW,
    VIEWPORT * tileW,
    VIEWPORT * tileW
  );
}

export function renderGame(
  canvas: HTMLCanvasElement,
  state: GameState,
  factionColors: Record<string, string>,
  camera: Camera,
  flashTiles?: { x: number; y: number }[],
  movingUnits?: MovingUnit[],
  overlay?: RenderOverlay,
  vfxTiles?: { x: number; y: number }[],
  levelUpUnitIds?: Set<number>,
  terrainBitmap?: TerrainBitmap | null,
  fx?: RenderFx
): void {
  const tileSize = getTileSize(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const canvasSize = tileSize * VIEWPORT;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bitmap = terrainBitmap ?? null;

  drawGrid(ctx, state, tileSize, camera, bitmap);
  drawStructures(ctx, state, tileSize, camera);
  drawReachable(ctx, state, tileSize, camera);
  drawAttackableEnemies(ctx, state, tileSize, camera);
  if (flashTiles && flashTiles.length > 0) drawFlash(ctx, flashTiles, tileSize, camera);
  drawPuzzleNodes(ctx, state, tileSize, camera, bitmap !== null);
  drawObjectiveTiles(ctx, state, tileSize, camera);

  if (overlay?.buildTargets?.length) {
    drawOverlay(ctx, overlay.buildTargets, COLORS.buildTarget, COLORS.buildBorder, tileSize, camera);
  }
  if (overlay?.demolishTargets?.length) {
    drawOverlay(ctx, overlay.demolishTargets, COLORS.demolishTarget, COLORS.demolishBorder, tileSize, camera);
  }
  if (overlay?.abilityTargets?.length) {
    drawOverlay(ctx, overlay.abilityTargets, COLORS.abilityTarget, COLORS.abilityBorder, tileSize, camera);
  }
  if (overlay?.advisoryTile && isInViewport(overlay.advisoryTile.x, overlay.advisoryTile.y, camera)) {
    const { px, py } = tileToPixel(overlay.advisoryTile.x, overlay.advisoryTile.y, tileSize, camera);
    ctx.save();
    ctx.strokeStyle = COLORS.puzzleNode;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
    ctx.restore();
  }

  drawUnits(ctx, state, factionColors, tileSize, movingUnits ?? [], camera, levelUpUnitIds, fx);
  if (vfxTiles && vfxTiles.length > 0) drawAbilityFlash(ctx, vfxTiles, tileSize, camera);
  if (fx) {
    drawPendingMoveGhost(ctx, fx, tileSize, camera);
    drawDyingEchoes(ctx, fx, tileSize, camera);
    drawFloaters(ctx, fx, tileSize, camera);
  }
  drawMinimap(ctx, state, factionColors, camera, canvasSize, bitmap);
}
