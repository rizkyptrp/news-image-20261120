// The World Today — Friday 20 November 2026
// A make.fun news-image entry: draws a 1024x1024 newspaper front page in
// code and writes it as a PNG to $MAKEFUN_OUTPUT_DIR/entry.png.
//
// Everything here is built from first principles with the Node standard
// library only: an RGB canvas, rectangle/line/circle drawing, a hand-made
// 5x7 bitmap font, and a small PNG writer (signature, IHDR, zlib IDAT,
// IEND, CRC32). No network, no files read, no clock, no randomness — two
// runs always produce the same bytes.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

// ---------------------------------------------------------------- canvas

const PAGE_W = 1024;
const PAGE_H = 1024;

// A colour is a triple of red, green and blue bytes.
type Colour = [number, number, number];

const PAPER: Colour = [246, 241, 230];
const INK: Colour = [24, 24, 24];
const NAVY: Colour = [22, 41, 77];
const NAVY_DEEP: Colour = [14, 27, 52];
const GOLD: Colour = [201, 162, 39];
const GOLD_SOFT: Colour = [232, 203, 106];
const RED: Colour = [179, 38, 30];
const RED_SOFT: Colour = [214, 96, 84];
const BLUE: Colour = [46, 95, 163];
const SKY: Colour = [178, 205, 228];
const TEAL: Colour = [31, 122, 109];
const GREY: Colour = [107, 107, 107];
const LIGHT_GREY: Colour = [216, 210, 196];
const WHITE: Colour = [255, 255, 255];
const CREAM: Colour = [253, 250, 242];
const BLACK: Colour = [10, 10, 14];
const STORM: Colour = [88, 102, 122];

// The picture lives in one flat RGB buffer, three bytes per pixel.
const canvas = new Uint8Array(PAGE_W * PAGE_H * 3);

function putPixel(x: number, y: number, colour: Colour): void {
  if (x < 0 || y < 0 || x >= PAGE_W || y >= PAGE_H) return;
  const at = (y * PAGE_W + x) * 3;
  canvas[at] = colour[0];
  canvas[at + 1] = colour[1];
  canvas[at + 2] = colour[2];
}

// Fill an axis-aligned rectangle. Coordinates are clipped to the page.
function fillRect(x: number, y: number, w: number, h: number, colour: Colour): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(PAGE_W, x + w);
  const y1 = Math.min(PAGE_H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let at = (yy * PAGE_W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      canvas[at] = colour[0];
      canvas[at + 1] = colour[1];
      canvas[at + 2] = colour[2];
      at += 3;
    }
  }
}

// A horizontal bar of a given thickness.
function hBar(x: number, y: number, w: number, thick: number, colour: Colour): void {
  fillRect(x, y, w, thick, colour);
}

// A vertical bar of a given thickness.
function vBar(x: number, y: number, h: number, thick: number, colour: Colour): void {
  fillRect(x, y, thick, h, colour);
}

// Outline a rectangle with a border of the given thickness.
function frameRect(x: number, y: number, w: number, h: number, thick: number, colour: Colour): void {
  hBar(x, y, w, thick, colour);
  hBar(x, y + h - thick, w, thick, colour);
  vBar(x, y, h, thick, colour);
  vBar(x + w - thick, y, h, thick, colour);
}

// Bresenham line, one pixel wide.
function drawLine(x0: number, y0: number, x1: number, y1: number, colour: Colour): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    putPixel(x, y, colour);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// A filled disc, drawn row by row.
function fillDisc(cx: number, cy: number, r: number, colour: Colour): void {
  for (let yy = -r; yy <= r; yy++) {
    const half = Math.floor(Math.sqrt(r * r - yy * yy));
    for (let xx = -half; xx <= half; xx++) {
      putPixel(cx + xx, cy + yy, colour);
    }
  }
}

// A ring: a disc with the middle left alone.
function ringDisc(cx: number, cy: number, rOuter: number, rInner: number, colour: Colour): void {
  for (let yy = -rOuter; yy <= rOuter; yy++) {
    const halfOuter = Math.floor(Math.sqrt(rOuter * rOuter - yy * yy));
    const halfInner =
      Math.abs(yy) <= rInner ? Math.floor(Math.sqrt(rInner * rInner - yy * yy)) : -1;
    for (let xx = -halfOuter; xx <= halfOuter; xx++) {
      if (Math.abs(xx) > halfInner) putPixel(cx + xx, cy + yy, colour);
    }
  }
}

// ---------------------------------------------------------------- PNG out

// The CRC32 table is built once, at start-up, from the standard polynomial.
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// One PNG chunk: length, four-letter type, payload, CRC over type+payload.
function pngChunk(kind: string, payload: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + payload.length);
  out.writeUInt32BE(payload.length, 0);
  out.write(kind, 4, "ascii");
  Buffer.from(payload).copy(out, 8);
  const check = new Uint8Array(4 + payload.length);
  check.set(Buffer.from(kind, "ascii"), 0);
  check.set(payload, 4);
  out.writeUInt32BE(crc32(check), 8 + payload.length);
  return out;
}

// Turn the RGB canvas into a complete PNG file. Each scanline is sent
// unfiltered (filter byte 0) and the whole block is compressed with zlib.
function encodePng(): Buffer {
  const raw = Buffer.alloc(PAGE_H * (1 + PAGE_W * 3));
  for (let y = 0; y < PAGE_H; y++) {
    const rowStart = y * (1 + PAGE_W * 3);
    raw[rowStart] = 0;
    Buffer.from(canvas.buffer, y * PAGE_W * 3, PAGE_W * 3).copy(raw, rowStart + 1);
  }
  const compressed = deflateSync(raw, { level: 9 });

  const header = Buffer.alloc(13);
  header.writeUInt32BE(PAGE_W, 0);
  header.writeUInt32BE(PAGE_H, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour RGB
  header[10] = 0; // compression method
  header[11] = 0; // filter method
  header[12] = 0; // no interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}

// ------------------------------------------------------------------- font

// A 5-by-7 pixel font, drawn from scratch. Every glyph is seven rows;
// each row is a five-bit number, bit 4 being the leftmost pixel.
// All text on the page is set in capitals, so only capitals are defined.
const GLYPHS: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [31, 2, 4, 14, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [14, 16, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 1, 14],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  "-": [0, 0, 0, 14, 0, 0, 0],
  ":": [0, 12, 12, 0, 12, 12, 0],
  ";": [0, 12, 12, 0, 12, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 6, 4, 0, 4],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "/": [1, 1, 2, 4, 8, 16, 16],
  "$": [4, 15, 20, 14, 5, 30, 4],
  "%": [25, 25, 2, 4, 8, 19, 19],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "=": [0, 0, 31, 0, 31, 0, 0],
  '"': [10, 10, 10, 0, 0, 0, 0],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "’": [4, 4, 8, 0, 0, 0, 0],
  "—": [0, 0, 0, 31, 0, 0, 0],
  "·": [0, 0, 0, 12, 12, 0, 0],
};

// ------------------------------------------------------------ text tools

const GLYPH_W = 5;
const GLYPH_H = 7;

// How wide a string is at a given scale. Each glyph takes six units
// (five pixels plus one of spacing), except the last one.
function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return (text.length * (GLYPH_W + 1) - 1) * scale;
}

// Draw one glyph with its top-left corner at (x, y).
function drawGlyph(ch: string, x: number, y: number, scale: number, colour: Colour): void {
  const rows = GLYPHS[ch];
  if (!rows) return;
  for (let r = 0; r < GLYPH_H; r++) {
    const bits = rows[r];
    for (let c = 0; c < GLYPH_W; c++) {
      if (bits & (1 << (GLYPH_W - 1 - c))) {
        fillRect(x + c * scale, y + r * scale, scale, scale, colour);
      }
    }
  }
}

// Draw a string, upper-cased, left aligned. Returns the width drawn.
function drawText(x: number, y: number, text: string, scale: number, colour: Colour): number {
  const upper = text.toUpperCase();
  let cursor = x;
  for (const ch of upper) {
    drawGlyph(ch, cursor, y, scale, colour);
    cursor += (GLYPH_W + 1) * scale;
  }
  return cursor - x - scale;
}

// Draw a string centred inside a box of the given width.
function drawTextCentred(
  x: number,
  y: number,
  boxW: number,
  text: string,
  scale: number,
  colour: Colour,
): void {
  const w = textWidth(text.toUpperCase(), scale);
  drawText(x + Math.floor((boxW - w) / 2), y, text, scale, colour);
}

// Split a string into lines that fit inside maxWidth at this scale.
function wrapText(text: string, scale: number, maxWidth: number): string[] {
  const words = text.toUpperCase().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current === "" ? word : current + " " + word;
    if (textWidth(trial, scale) <= maxWidth || current === "") {
      current = trial;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

// Draw a wrapped paragraph. Returns the y just below the last line.
function drawParagraph(
  x: number,
  y: number,
  text: string,
  scale: number,
  maxWidth: number,
  colour: Colour,
  lineGap: number,
): number {
  const lines = wrapText(text, scale, maxWidth);
  let cursor = y;
  for (const line of lines) {
    drawText(x, cursor, line, scale, colour);
    cursor += GLYPH_H * scale + lineGap;
  }
  return cursor;
}

// ---------------------------------------------------------- illustrations

// A wall calendar page stamped 2027, with a clock beside it: the decision
// waits until the new year.
function drawCalendarScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, CREAM);
  frameRect(x, y, w, h, 2, INK);
  // Red binding strip along the top of the page.
  fillRect(x, y, w, 26, RED);
  fillDisc(x + 40, y + 13, 5, WHITE);
  fillDisc(x + w - 40, y + 13, 5, WHITE);
  drawTextCentred(x, y + 44, w, "2027", 5, NAVY);
  drawTextCentred(x, y + 92, w, "JAN 1", 3, RED);
  // A small clock: face, rim, and hands stopped at five past twelve.
  const cx = x + w - 62;
  const cy = y + h - 48;
  fillDisc(cx, cy, 30, WHITE);
  ringDisc(cx, cy, 30, 26, NAVY);
  drawLine(cx, cy, cx, cy - 20, NAVY);
  drawLine(cx, cy, cx + 13, cy + 6, NAVY);
  fillDisc(cx, cy, 3, RED);
  // Faint day-grid dots under the date.
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 7; col++) {
      fillDisc(x + 30 + col * 34, y + 138 + row * 18, 3, LIGHT_GREY);
    }
  }
  drawText(x + 18, y + h - 26, "THE DECISION WAITS", 1, GREY);
}

// A storm cloud over a churning sea: the cyclone making landfall.
function drawStormScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  frameRect(x, y, w, h, 2, INK);
  // Cloud built from overlapping discs.
  fillDisc(x + 90, y + 42, 34, STORM);
  fillDisc(x + 140, y + 30, 42, STORM);
  fillDisc(x + 195, y + 44, 36, STORM);
  fillRect(x + 58, y + 42, 168, 34, STORM);
  // Slanted rain under the cloud.
  for (let i = 0; i < 9; i++) {
    const rx = x + 66 + i * 20;
    drawLine(rx, y + 88, rx - 8, y + 112, BLUE);
    drawLine(rx + 10, y + 88, rx + 2, y + 112, BLUE);
  }
  // Three wave crests along the bottom.
  for (let i = 0; i < 3; i++) {
    const wy = y + h - 34 + i * 10;
    for (let wx = x + 8; wx < x + w - 30; wx += 26) {
      drawLine(wx, wy, wx + 12, wy - 6, BLUE);
      drawLine(wx + 12, wy - 6, wx + 24, wy, BLUE);
    }
  }
}

// Two flags facing each other with a speech bubble: talks to end the war.
function drawTalksScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, CREAM);
  frameRect(x, y, w, h, 2, INK);
  // European flag: blue field, a ring of gold dots.
  const euX = x + 24;
  const euY = y + 26;
  fillRect(euX, euY, 120, 76, BLUE);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const dx = Math.round(Math.cos(ang) * 26);
    const dy = Math.round(Math.sin(ang) * 22);
    fillDisc(euX + 60 + dx, euY + 38 + dy, 3, GOLD_SOFT);
  }
  // Russian flag: three horizontal stripes.
  const ruX = x + w - 144;
  const ruY = y + 26;
  fillRect(ruX, ruY, 120, 26, WHITE);
  fillRect(ruX, ruY + 26, 120, 25, BLUE);
  fillRect(ruX, ruY + 51, 120, 25, RED);
  frameRect(ruX, ruY, 120, 76, 1, INK);
  // A speech bubble between the flags.
  const bx = x + Math.floor(w / 2) - 62;
  const by = y + h - 62;
  fillRect(bx, by, 124, 40, WHITE);
  frameRect(bx, by, 124, 40, 2, INK);
  drawText(bx + 14, by + 13, "TALKS", 2, NAVY);
  drawLine(bx + 30, by + 40, bx + 18, by + 54, INK);
  drawLine(bx + 18, by + 54, bx + 46, by + 40, INK);
}

// A night sky, a small probe on a dashed path, and the distance it has
// covered: one light-day from Earth.
function drawVoyagerScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, BLACK);
  frameRect(x, y, w, h, 2, INK);
  // Fixed stars from a plain arithmetic pattern — no randomness.
  for (let i = 0; i < 46; i++) {
    const sx = x + 10 + ((i * 97 + 13) % (w - 20));
    const sy = y + 8 + ((i * 53 + 29) % (h - 60));
    fillDisc(sx, sy, i % 5 === 0 ? 2 : 1, WHITE);
  }
  // A dashed flight path curving up to the probe.
  for (let i = 0; i < 12; i++) {
    const px = x + 24 + i * 16;
    const py = y + h - 52 - i * 5;
    if (i % 2 === 0) fillRect(px, py, 10, 2, GOLD_SOFT);
  }
  // The probe: a gold dish, a body, and a long antenna.
  const px = x + w - 96;
  const py = y + 46;
  drawLine(px - 40, py + 34, px + 34, py + 10, GOLD);
  fillRect(px - 14, py + 6, 30, 16, GOLD_SOFT);
  fillDisc(px - 26, py + 14, 12, GOLD);
  drawLine(px + 16, py + 6, px + 44, py - 22, WHITE);
  fillDisc(px + 44, py - 22, 3, RED);
  drawText(x + 14, y + h - 30, "1 LIGHT-DAY FROM EARTH", 2, GOLD_SOFT);
}

// A city skyline at dusk under one huge number: the game's first day.
function drawSkylineScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY_DEEP);
  frameRect(x, y, w, h, 2, INK);
  // Lit windows: a fixed grid pattern, some lit, some dark.
  const tops = [46, 30, 58, 38, 50, 26, 44];
  let bx = x + 14;
  for (let b = 0; b < 7; b++) {
    const bw = 46;
    const top = y + h - 40 - tops[b];
    fillRect(bx, top, bw, y + h - top, BLACK);
    for (let wy = top + 8; wy < y + h - 46; wy += 12) {
      for (let wx = bx + 6; wx < bx + bw - 6; wx += 12) {
        if ((wx + wy) % 24 === 0) fillRect(wx, wy, 5, 6, GOLD_SOFT);
      }
    }
    bx += bw + 6;
  }
  drawTextCentred(x, y + 10, w, "$1.84BN", 4, GOLD_SOFT);
  drawText(x + 14, y + h - 26, "IN ONE DAY", 1, WHITE);
}

// ------------------------------------------------------------- the page

// The navy masthead: paper name, the date, and what the page is.
function drawMasthead(): void {
  fillRect(9, 9, 1006, 132, NAVY);
  drawTextCentred(9, 24, 1006, "THE WORLD TODAY", 5, WHITE);
  hBar(309, 70, 406, 2, GOLD);
  drawTextCentred(9, 84, 1006, "FRIDAY 20 NOVEMBER 2026", 2, GOLD_SOFT);
  drawTextCentred(9, 110, 1006, "SIX STORIES - ONE DAY - THE WORLD IN ONE PAGE", 1, WHITE);
}

// One story column: kicker, one-line headline, two-line standfirst, then
// a picture drawn by the scene function passed in.
type SceneFn = (x: number, y: number, w: number, h: number) => void;

function storyColumn(
  x: number,
  y: number,
  w: number,
  kicker: string,
  kickerColour: Colour,
  headline: string,
  standfirst: string,
  scene: SceneFn,
  artY: number,
  artH: number,
): void {
  drawText(x, y, kicker, 1, kickerColour);
  drawText(x, y + 18, headline, 2, INK);
  drawParagraph(x, y + 44, standfirst, 2, w, INK, 6);
  scene(x, artY, w, artH);
}

// The lead story: Trump and the Iran decision, full width.
function drawLead(): void {
  drawText(28, 156, "LEAD STORY", 1, RED);
  drawParagraph(
    28,
    176,
    "TRUMP PUTS IRAN DECISION OFF TO 2027",
    3,
    612,
    INK,
    6,
  );
  drawParagraph(
    28,
    240,
    "THE PRESIDENT SAYS HE WILL DECIDE AFTER JAN 1, DESPITE PRESSURE FROM ISRAEL TO ACT SOONER.",
    2,
    612,
    INK,
    6,
  );
  drawText(28, 300, "REPORTED BY REUTERS, AXIOS AND FOX", 1, GREY);
  // A pull-quote in the empty space below the standfirst.
  vBar(28, 340, 42, 4, GOLD);
  drawText(48, 348, '"WE\'LL SEE WHAT HAPPENS AFTER JAN 1,"', 2, NAVY);
  drawText(48, 372, "SAYS TRUMP", 2, NAVY);
  vBar(648, 156, 252, 2, LIGHT_GREY);
  drawCalendarScene(660, 156, 336, 252);
}

// The bottom strip: the Kyiv embassy attack, in one line.
function drawKyivStrip(): void {
  fillRect(28, 966, 64, 20, RED);
  drawText(38, 971, "KYIV", 1, WHITE);
  drawText(
    104,
    968,
    "DRONES HIT DUTCH AND AUSTRIAN EMBASSIES IN KYIV - ONE KILLED, FIVE HURT",
    2,
    INK,
  );
}

// The source line along the foot of the page.
function drawSources(): void {
  drawTextCentred(
    9,
    992,
    1006,
    "SOURCES: REUTERS - AXIOS - FOX - THE HINDU - IMD - BBC - NASA - AFP - EURONEWS - SENSOR TOWER",
    1,
    GREY,
  );
}

// Assemble the whole front page and return the PNG bytes.
function buildPage(): Buffer {
  fillRect(0, 0, PAGE_W, PAGE_H, PAPER);
  frameRect(6, 6, 1012, 1012, 3, INK);
  drawMasthead();
  drawLead();
  hBar(28, 424, 968, 3, INK);

  storyColumn(
    28,
    440,
    468,
    "INDIA - CYCLONE",
    TEAL,
    "CYCLONE AKVAN HITS INDIA'S EAST COAST",
    "LANDFALL TODAY AS ABOUT 300,000 PEOPLE ARE MOVED TO SAFETY.",
    drawStormScene,
    528,
    132,
  );
  vBar(512, 440, 232, 2, LIGHT_GREY);
  storyColumn(
    528,
    440,
    468,
    "UKRAINE - DIPLOMACY",
    BLUE,
    "EUROPE READY FOR TALKS WITH RUSSIA",
    "LEADERS BACK NEGOTIATIONS TO END THE WAR IN UKRAINE.",
    drawTalksScene,
    528,
    132,
  );
  hBar(28, 688, 968, 3, INK);

  storyColumn(
    28,
    704,
    468,
    "SPACE - NASA",
    NAVY,
    "VOYAGER 1 CROSSES ONE LIGHT-DAY",
    "NASA CONFIRMS THE FARTHEST SPACECRAFT IS NOW A LIGHT-DAY FROM EARTH.",
    drawVoyagerScene,
    792,
    136,
  );
  vBar(512, 704, 232, 2, LIGHT_GREY);
  storyColumn(
    528,
    704,
    468,
    "GAMES - LAUNCH",
    RED,
    "GTA VI MAKES $1.84BN IN A DAY",
    "LAUNCH SALES PASS THE ODYSSEY'S WHOLE CINEMA RUN, ESTIMATES SAY.",
    drawSkylineScene,
    792,
    136,
  );
  hBar(28, 952, 968, 3, INK);

  drawKyivStrip();
  drawSources();
  return encodePng();
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const png = buildPage();
  writeFileSync(join(outDir, "entry.png"), png);
  console.log(`wrote entry.png (${png.length} bytes, ${PAGE_W}x${PAGE_H})`);
}

main();
