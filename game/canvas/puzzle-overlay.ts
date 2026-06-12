import type { CipherPuzzle, GameState } from "../engine/types";

type SymbolHitArea = {
  glyph: string;
  x: number;
  y: number;
  size: number;
};

type ButtonHitArea = {
  action: "submit" | "skip" | "backspace";
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PuzzleHitAreas = {
  symbols: SymbolHitArea[];
  buttons: ButtonHitArea[];
};

export function drawPuzzleOverlay(
  canvas: HTMLCanvasElement,
  puzzle: CipherPuzzle,
  state: Pick<GameState, "puzzleDef">
): PuzzleHitAreas {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { symbols: [], buttons: [] };

  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.fillRect(0, 0, W, H);

  const boxW = Math.min(480, W - 32);
  const boxH = 320;
  const boxX = (W - boxW) / 2;
  const boxY = (H - boxH) / 2;

  ctx.fillStyle = "#111a";
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect?.(boxX, boxY, boxW, boxH, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#aaa";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("SIGNAL NODE ACTIVE — DECODE TO RECEIVE", W / 2, boxY + 14);

  const keyY = boxY + 42;
  const keySlotW = Math.floor(boxW / 5) - 6;
  const keySlotH = 48;
  const keySlotPad = (boxW - (keySlotW + 6) * 5) / 2;

  ctx.font = `${Math.floor(keySlotH * 0.48)}px monospace`;
  ctx.textBaseline = "middle";

  for (let i = 0; i < 5; i++) {
    const sx = boxX + keySlotPad + i * (keySlotW + 6);
    const sy = keyY;
    ctx.fillStyle = "#1a1a2e";
    ctx.strokeStyle = "#334";
    ctx.lineWidth = 1;
    ctx.fillRect(sx, sy, keySlotW, keySlotH);
    ctx.strokeRect(sx, sy, keySlotW, keySlotH);

    ctx.fillStyle = "#666";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(i + 1), sx + keySlotW / 2, sy + 4);

    ctx.fillStyle = "#dde";
    ctx.font = `${Math.floor(keySlotH * 0.45)}px monospace`;
    ctx.textBaseline = "middle";
    ctx.fillText(puzzle.key[i] ?? "?", sx + keySlotW / 2, sy + keySlotH * 0.62);
  }

  const encY = keyY + keySlotH + 18;
  ctx.fillStyle = "#888";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("ENCODED SEQUENCE", W / 2, encY);

  const encSlotW = 32;
  const encSlotH = 32;
  const encTotalW = puzzle.encoded.length * (encSlotW + 6) - 6;
  const encStartX = W / 2 - encTotalW / 2;

  for (let i = 0; i < puzzle.encoded.length; i++) {
    const sx = encStartX + i * (encSlotW + 6);
    const sy = encY + 16;
    ctx.fillStyle = "#0e0e1a";
    ctx.strokeStyle = "#446";
    ctx.lineWidth = 1;
    ctx.fillRect(sx, sy, encSlotW, encSlotH);
    ctx.strokeRect(sx, sy, encSlotW, encSlotH);
    ctx.fillStyle = "#88aacc";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(puzzle.encoded[i]), sx + encSlotW / 2, sy + encSlotH / 2);
  }

  const ansY = encY + 16 + encSlotH + 16;
  ctx.fillStyle = "#888";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("YOUR ANSWER", W / 2, ansY);

  const ansSlotW = 36;
  const ansSlotH = 36;
  const ansTotalW = puzzle.encoded.length * (ansSlotW + 6) - 6;
  const ansStartX = W / 2 - ansTotalW / 2;

  for (let i = 0; i < puzzle.encoded.length; i++) {
    const sx = ansStartX + i * (ansSlotW + 6);
    const sy = ansY + 14;
    const filled = i < puzzle.answer.length;
    ctx.fillStyle = filled ? "#1a2e1a" : "#0d0d0d";
    ctx.strokeStyle = filled ? "#4a8" : "#333";
    ctx.lineWidth = 1.5;
    ctx.fillRect(sx, sy, ansSlotW, ansSlotH);
    ctx.strokeRect(sx, sy, ansSlotW, ansSlotH);
    if (filled) {
      ctx.fillStyle = "#8f8";
      ctx.font = "18px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(puzzle.answer[i], sx + ansSlotW / 2, sy + ansSlotH / 2);
    }
  }

  const trayY = ansY + 14 + ansSlotH + 18;
  const traySymbols = state.puzzleDef.symbols;
  const symSize = 40;
  const symPad = 8;
  const trayTotalW = traySymbols.length * (symSize + symPad) - symPad;
  const trayStartX = W / 2 - trayTotalW / 2;

  const symbolHitAreas: SymbolHitArea[] = [];
  for (let i = 0; i < traySymbols.length; i++) {
    const sx = trayStartX + i * (symSize + symPad);
    const sy = trayY;
    ctx.fillStyle = "#1e1e2e";
    ctx.strokeStyle = "#556";
    ctx.lineWidth = 1.5;
    ctx.fillRect(sx, sy, symSize, symSize);
    ctx.strokeRect(sx, sy, symSize, symSize);
    ctx.fillStyle = "#cce";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(traySymbols[i].glyph, sx + symSize / 2, sy + symSize / 2);
    symbolHitAreas.push({ glyph: traySymbols[i].glyph, x: sx, y: sy, size: symSize });
  }

  const btnY = trayY + symSize + 14;
  const btnH = 28;
  const btnW = 90;
  const btnPad = 10;
  const totalBtnW = 3 * btnW + 2 * btnPad;
  const btnStartX = W / 2 - totalBtnW / 2;

  const buttonHitAreas: ButtonHitArea[] = [
    { action: "submit", x: btnStartX, y: btnY, w: btnW, h: btnH },
    { action: "backspace", x: btnStartX + btnW + btnPad, y: btnY, w: btnW, h: btnH },
    { action: "skip", x: btnStartX + 2 * (btnW + btnPad), y: btnY, w: btnW, h: btnH },
  ];

  const btnLabels: Record<string, string> = { submit: "SUBMIT", backspace: "⌫", skip: "SKIP" };
  const btnColors: Record<string, string> = { submit: "#1a3a1a", backspace: "#1a1a3a", skip: "#2a1a1a" };
  const btnBorders: Record<string, string> = { submit: "#4a8", backspace: "#448", skip: "#844" };

  ctx.font = "11px monospace";
  ctx.textBaseline = "middle";
  for (const btn of buttonHitAreas) {
    ctx.fillStyle = btnColors[btn.action] ?? "#111";
    ctx.strokeStyle = btnBorders[btn.action] ?? "#444";
    ctx.lineWidth = 1.5;
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.fillStyle = "#bbb";
    ctx.textAlign = "center";
    ctx.fillText(btnLabels[btn.action] ?? btn.action.toUpperCase(), btn.x + btn.w / 2, btn.y + btn.h / 2);
  }

  return { symbols: symbolHitAreas, buttons: buttonHitAreas };
}

export function drawFragmentFlash(
  canvas: HTMLCanvasElement,
  text: string,
  codexNote?: string
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "rgba(0,0,0,0.88)";
  ctx.fillRect(0, 0, W, H);

  const maxW = W - 80;
  ctx.fillStyle = "#99aacc";
  ctx.font = "14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxW && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const lineH = 22;
  const totalH = lines.length * lineH;
  const startY = H / 2 - totalH / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, startY + i * lineH);
  }

  ctx.fillStyle = "#444";
  ctx.font = "9px monospace";
  ctx.fillText("— SIGNAL NODE —", W / 2, H / 2 + totalH / 2 + 20);

  if (codexNote) {
    ctx.fillStyle = "#e8b339";
    ctx.font = "12px monospace";
    ctx.fillText(codexNote, W / 2, H / 2 + totalH / 2 + 46);
  }
  ctx.fillStyle = "#555";
  ctx.font = "10px monospace";
  ctx.fillText("click to dismiss", W / 2, H / 2 + totalH / 2 + 70);
}

export function puzzleOverlayHitTest(
  e: MouseEvent,
  canvas: HTMLCanvasElement,
  hitAreas: PuzzleHitAreas
): { type: "symbol"; glyph: string } | { type: "button"; action: "submit" | "skip" | "backspace" } | null {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;

  for (const sym of hitAreas.symbols) {
    if (px >= sym.x && px <= sym.x + sym.size && py >= sym.y && py <= sym.y + sym.size) {
      return { type: "symbol", glyph: sym.glyph };
    }
  }

  for (const btn of hitAreas.buttons) {
    if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
      return { type: "button", action: btn.action };
    }
  }

  return null;
}
