// The World Today — Friday 20 November 2026.
// A make.fun news-image entry. A Node program (standard library only) that
// draws a 1024x1024 newspaper front page summing up the day's world news
// and writes it to /output/entry.png. It carries its own PNG writer and its
// own 5x7 pixel font, uses no network and no randomness, so two runs write
// byte-identical output.
//
// The six stories (each checked against reporting in the 20 Nov 2026
// morning news cycle):
//   1. Trump says he will not decide on new Iran strikes before 2027 —
//      "we'll see what happens after January 1" (Reuters, Axios, Fox).
//   2. Cyclone Akvan makes landfall on India's east coast today; about
//      300,000 people evacuated in Odisha and Andhra Pradesh (The Hindu).
//   3. Europe is ready for talks with Russia on ending the war in
//      Ukraine, leaders say (BBC).
//   4. NASA confirms Voyager 1 has crossed one light-day from Earth —
//      a radio signal now takes a full day to reach it.
//   5. GTA VI takes an estimated $1.84bn by launch day, past the whole
//      $1.80bn cinema run of The Odyssey (Sensor Tower, via Reuters).
//   6. Russian drones damage the Dutch and Austrian embassies in Kyiv;
//      one person killed, five hurt (AFP, Euronews).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// Palette: newsprint paper, black ink, one red accent, muted story colours.
// ---------------------------------------------------------------------------
type RGB = [number, number, number];
const PAPER: RGB = [247, 242, 232];
const CARD: RGB = [255, 253, 247];
const INK: RGB = [24, 24, 24];
const GREY: RGB = [96, 92, 84];
const RED: RGB = [170, 28, 48];
const BLUE: RGB = [30, 80, 140];
const TEAL: RGB = [16, 120, 112];
const GOLD: RGB = [200, 150, 44];
const NAVY: RGB = [18, 34, 66];
const CREAM: RGB = [255, 243, 196];

// ---------------------------------------------------------------------------
// PNG writer. CRC32 (IEEE), one IHDR, one IDAT (zlib level 9), IEND.
// Every scanline uses filter 0. The same pixels always give the same bytes.
// ---------------------------------------------------------------------------
const CRC: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC.push(c >>> 0);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, body, tail]);
}

function toPng(pixels: Uint8Array, width: number, height: number): Buffer {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    const at = y * (width * 3 + 1);
    raw[at] = 0;
    raw.set(pixels.subarray(y * width * 3, (y + 1) * width * 3), at + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit samples
  ihdr[9] = 2; // truecolour RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 5x7 pixel font, hand-drawn for this entry. Uppercase letters, digits and
// the punctuation the page needs. Each glyph is 7 strings of 5 bits.
// ---------------------------------------------------------------------------
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "·": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
};

// ---------------------------------------------------------------------------
// Canvas: one RGB buffer for the whole page, plus the shapes text needs.
// ---------------------------------------------------------------------------
const canvas = new Uint8Array(W * H * 3);

function paint(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    canvas[i * 3] = c[0];
    canvas[i * 3 + 1] = c[1];
    canvas[i * 3 + 2] = c[2];
  }
}

function dot(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  canvas[i] = c[0];
  canvas[i + 1] = c[1];
  canvas[i + 2] = c[2];
}

function box(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) dot(xx, yy, c);
  }
}

function barX(x0: number, x1: number, y: number, c: RGB): void {
  if (x1 < x0) [x0, x1] = [x1, x0];
  box(x0, y, x1 - x0 + 1, 1, c);
}

function barY(x: number, y0: number, y1: number, c: RGB): void {
  if (y1 < y0) [y0, y1] = [y1, y0];
  box(x, y0, 1, y1 - y0 + 1, c);
}

// Bresenham segment.
function seg(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    dot(x, y, c);
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

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) dot(cx + x, cy + y, c);
  }
}

// Deterministic stand-in for randomness: a fixed-seed LCG, so star fields
// and lit windows never change between runs.
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Text. The font has no lowercase, so everything is uppercased first and
// curly quotes and long dashes are folded to glyphs that exist.
// ---------------------------------------------------------------------------
function clean(s: string): string {
  return s
    .toUpperCase()
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"');
}

function measure(s: string, scale: number): number {
  const t = clean(s);
  return t.length === 0 ? 0 : t.length * 6 * scale - scale;
}

function putText(
  s: string,
  x: number,
  y: number,
  scale: number,
  c: RGB,
  align: "l" | "c" | "r" = "l",
): void {
  const t = clean(s);
  let start = x;
  if (align === "c") start = x - Math.floor(measure(t, scale) / 2);
  if (align === "r") start = x - measure(t, scale);
  let cx = start;
  for (const ch of t) {
    const glyph = GLYPHS[ch] ?? GLYPHS[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "1") box(cx + col * scale, y + row * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

// Greedy wrap: as many whole words per line as fit in maxWidth pixels.
function wrap(s: string, maxWidth: number, scale: number): string[] {
  const words = clean(s).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (measure(trial, scale) <= maxWidth || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function putPara(
  s: string,
  x: number,
  y: number,
  maxWidth: number,
  scale: number,
  c: RGB,
  pitch: number,
): number {
  const lines = wrap(s, maxWidth, scale);
  lines.forEach((ln, i) => putText(ln, x, y + i * pitch, scale, c));
  return y + lines.length * pitch;
}

// ---------------------------------------------------------------------------
// Story illustrations. Each draws inside its own box (x, y, w, h).
// ---------------------------------------------------------------------------

function drawUsFlag(x: number, y: number, w: number, h: number): void {
  const stripeH = Math.floor(h / 7);
  for (let i = 0; i < 7; i++) {
    box(x, y + i * stripeH, w, stripeH, i % 2 === 0 ? RED : CARD);
  }
  box(x, y, Math.floor(w * 0.42), stripeH * 4, BLUE);
  const rnd = seeded(1776);
  for (let i = 0; i < 9; i++) {
    const sx = x + 4 + Math.floor(rnd() * (Math.floor(w * 0.42) - 8));
    const sy = y + 3 + Math.floor(rnd() * (stripeH * 4 - 6));
    box(sx, sy, 2, 2, [255, 255, 255]);
  }
}

// Lead picture: a US flag, a clock whose hands point at the new year, and
// the year the decision is pushed to.
function drawClock(x: number, y: number, w: number, h: number): void {
  box(x, y, w, h, NAVY);
  const rnd = seeded(20270101);
  for (let i = 0; i < 18; i++) {
    box(x + Math.floor(rnd() * w), y + Math.floor(rnd() * h), 2, 2, [200, 210, 230]);
  }
  // Flag on a pole at the left.
  barY(x + 52, y + 18, y + h - 16, CARD);
  drawUsFlag(x + 54, y + 22, 96, 56);
  // Clock face in the middle.
  const cx = x + Math.floor(w * 0.48);
  const cy = y + Math.floor(h / 2);
  disc(cx, cy, 54, CARD);
  disc(cx, cy, 48, [240, 236, 224]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const px = Math.floor(cx + 42 * Math.sin(a));
    const py = Math.floor(cy - 42 * Math.cos(a));
    box(px - 2, py - 2, 4, 4, INK);
  }
  // Hands: just past midnight, pointing at the new year.
  seg(cx, cy, cx + 18, cy - 26, INK);
  seg(cx, cy, cx - 2, cy + 32, INK);
  disc(cx, cy, 4, RED);
  // The year, in gold, at the right.
  putText("2027", x + w - 36, y + 42, 6, GOLD, "r");
  putText("AFTER JAN 1", x + w - 36, y + 96, 2, CARD, "r");
}

// Cyclone: a teal spiral over a coastline, with rain slashes.
function drawStorm(x: number, y: number, w: number, h: number): void {
  const cx = x + Math.floor(w * 0.42);
  const cy = y + Math.floor(h * 0.44);
  for (let a = 0; a < Math.PI * 5; a += 0.12) {
    const r = 3 + a * 3.4;
    const px = Math.floor(cx + r * Math.cos(a));
    const py = Math.floor(cy + r * Math.sin(a) * 0.8);
    box(px - 1, py - 1, 3, 3, TEAL);
  }
  disc(cx, cy, 5, CARD);
  box(x, y + h - 16, w, 16, [216, 201, 163]);
  barX(x, x + w - 1, y + h - 16, INK);
  for (let i = 0; i < 6; i++) {
    const rx = x + w - 36 + i * 6;
    seg(rx, y + 14 + (i % 3) * 8, rx - 4, y + 26 + (i % 3) * 8, BLUE);
  }
}

// Europe talks: a ring of gold stars on blue, a white flag of truce inside.
function drawStars(x: number, y: number, w: number, h: number): void {
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2) + 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const sx = Math.floor(cx + 34 * Math.cos(a));
    const sy = Math.floor(cy + 34 * Math.sin(a));
    disc(sx, sy, 3, GOLD);
  }
  barY(cx - 2, cy - 18, cy + 16, CARD);
  box(cx, cy - 18, 22, 13, CARD);
  barX(cx - 2, cx + 22, cy - 18, INK);
  barX(cx - 2, cx + 22, cy - 5, INK);
}

// Voyager 1: starfield, Earth at bottom left, a dashed gold path to the
// probe at top right.
function drawProbe(x: number, y: number, w: number, h: number): void {
  box(x, y, w, h, NAVY);
  const rnd = seeded(19770905);
  for (let i = 0; i < 24; i++) {
    box(x + Math.floor(rnd() * w), y + Math.floor(rnd() * h), 2, 2, [255, 255, 255]);
  }
  const ex = x + 18;
  const ey = y + h - 16;
  const tx = x + w - 32;
  const ty = y + 18;
  for (let t = 0; t <= 20; t++) {
    if (t % 2 === 0) {
      const px = Math.floor(ex + ((tx - ex) * t) / 20);
      const py = Math.floor(ey + ((ty - ey) * t) / 20);
      box(px, py, 3, 3, GOLD);
    }
  }
  disc(ex, ey, 8, [90, 160, 220]);
  disc(tx, ty, 12, GOLD);
  disc(tx, ty, 5, [120, 80, 10]);
  seg(tx - 10, ty + 10, tx - 22, ty + 20, [255, 255, 255]);
  seg(tx - 22, ty + 20, tx - 14, ty + 22, [255, 255, 255]);
}

// GTA VI sales: a big gold VI and three rising bars.
function drawChart(x: number, y: number, w: number, h: number): void {
  box(x, y, w, h, [52, 28, 84]);
  putText("VI", x + 22, y + 16, 8, GOLD);
  const base = y + h - 14;
  const bars = [30, 52, 76];
  bars.forEach((bh, i) => {
    const bx = x + w - 150 + i * 46;
    box(bx, base - bh, 34, bh, i === 2 ? GOLD : [150, 110, 200]);
  });
  barX(x + w - 164, x + w - 12, base, CARD);
  putText("$", x + w - 158, y + 12, 3, CARD);
}

// Kyiv embassies: the Dutch and Austrian flags, a cracked building and smoke.
function drawEmbassies(x: number, y: number, w: number, h: number): void {
  // Cracked building block behind the flags.
  box(x + 18, y + h - 46, w - 36, 46, [196, 188, 172]);
  seg(x + 60, y + h - 46, x + 72, y + h - 28, INK);
  seg(x + 72, y + h - 28, x + 58, y + h - 12, INK);
  seg(x + 58, y + h - 12, x + 70, y + h, INK);
  // Smoke puffs.
  disc(x + Math.floor(w * 0.3), y + 18, 9, GREY);
  disc(x + Math.floor(w * 0.68), y + 12, 11, GREY);
  disc(x + Math.floor(w * 0.68) + 10, y + 20, 7, GREY);
  // Two flags on poles.
  const flagW = 58;
  const flagH = 36;
  const fy = y + 26;
  const left = x + 26;
  const right = x + w - 26 - flagW;
  barY(left - 3, fy - 8, fy + flagH + 6, INK);
  barY(right - 3, fy - 8, fy + flagH + 6, INK);
  // Netherlands: red, white, blue bands.
  box(left, fy, flagW, 12, RED);
  box(left, fy + 12, flagW, 12, CARD);
  box(left, fy + 24, flagW, 12, BLUE);
  // Austria: red, white, red bands.
  box(right, fy, flagW, 12, RED);
  box(right, fy + 12, flagW, 12, CARD);
  box(right, fy + 24, flagW, 12, RED);
  for (const fx of [left, right]) {
    barX(fx, fx + flagW - 1, fy, INK);
    barX(fx, fx + flagW - 1, fy + flagH - 1, INK);
    barY(fx, fy, fy + flagH - 1, INK);
    barY(fx + flagW - 1, fy, fy + flagH - 1, INK);
  }
}

// ---------------------------------------------------------------------------
// Page layout: masthead, lead story, five story cards, footer.
// ---------------------------------------------------------------------------
const MARGIN = 28;
const PAGE_W = W - MARGIN * 2;

function rule(x0: number, x1: number, y: number, thick: number): void {
  box(x0, y, x1 - x0 + 1, thick, INK);
}

interface Story {
  kicker: string;
  headline: string;
  caption: string;
  tint: RGB;
  icon: (x: number, y: number, w: number, h: number) => void;
}

function drawCard(s: Story, x: number, y: number, w: number, h: number): void {
  box(x, y, w, h, CARD);
  barX(x, x + w - 1, y, INK);
  barX(x, x + w - 1, y + h - 1, INK);
  barY(x, y, y + h - 1, INK);
  barY(x + w - 1, y, y + h - 1, INK);
  const pad = 14;
  const innerW = w - pad * 2;
  const iconH = 92;
  box(x + 1, y + 1, w - 2, iconH, s.tint);
  s.icon(x + 1, y + 1, w - 2, iconH);
  barX(x + 1, x + w - 2, y + iconH + 1, INK);
  let cy = y + iconH + 14;
  putText(s.kicker, x + pad, cy, 2, RED);
  cy += 20;
  const headScale = w > 400 ? 3 : 2;
  const headPitch = headScale === 3 ? 24 : 18;
  cy = putPara(s.headline, x + pad, cy, innerW, headScale, INK, headPitch);
  cy += 6;
  putPara(s.caption, x + pad, cy, innerW, 2, GREY, 17);
}

function drawPage(): void {
  paint(PAPER);

  // ---- Masthead -----------------------------------------------------------
  putText("THE WORLD TODAY", Math.floor(W / 2), 24, 6, INK, "c");
  box(MARGIN, 94, PAGE_W, 4, RED);
  putText(
    "FRIDAY 20 NOVEMBER 2026 · WORLD CHILDREN'S DAY",
    Math.floor(W / 2),
    108,
    3,
    INK,
    "c",
  );
  rule(MARGIN, MARGIN + PAGE_W - 1, 138, 2);

  // ---- Lead story: Trump puts the Iran decision off to 2027 --------------
  let ly = 152;
  putText("WASHINGTON · THE IRAN DECISION", MARGIN, ly, 2, RED);
  ly += 24;
  putText("TRUMP PUTS IRAN DECISION OFF TO 2027", MARGIN, ly, 4, INK);
  ly += 40;
  drawClock(MARGIN, ly, PAGE_W, 140);
  ly += 152;
  putText(
    "TRUMP TELLS FOX AND AXIOS HE IS 'NOT RUSHING' AND WILL 'SEE WHAT HAPPENS'",
    MARGIN,
    ly,
    2,
    GREY,
  );
  ly += 17;
  putText(
    "AFTER JAN 1, DESPITE ISRAELI PRESSURE FOR NEW STRIKES ON TEHRAN.",
    MARGIN,
    ly,
    2,
    GREY,
  );
  ly += 24;
  rule(MARGIN, MARGIN + PAGE_W - 1, ly, 2);

  // ---- Five story cards ----------------------------------------------------
  const stories: Story[] = [
    {
      kicker: "BAY OF BENGAL",
      headline: "CYCLONE AKVAN HITS INDIA'S EAST COAST",
      caption:
        "Landfall today. About 300,000 evacuated; schools shut, red alert on the coast.",
      tint: [206, 228, 228],
      icon: drawStorm,
    },
    {
      kicker: "EUROPE",
      headline: "EUROPE READY FOR TALKS TO END UKRAINE WAR",
      caption:
        "Leaders say Europe is ready to talk to Russia about ending the war in Ukraine. No date set yet.",
      tint: [214, 226, 238],
      icon: drawStars,
    },
    {
      kicker: "DEEP SPACE",
      headline: "VOYAGER 1 CROSSES ONE LIGHT-DAY",
      caption:
        "NASA confirms the probe has crossed one light-day. A radio signal now takes a full day to reach it.",
      tint: [16, 32, 64],
      icon: drawProbe,
    },
    {
      kicker: "HOLLYWOOD VS GAMING",
      headline: "GTA VI MAKES $1.84BN IN A DAY",
      caption:
        "Sensor Tower estimate: 19 million copies by launch day, more than Nolan's The Odyssey made in cinemas.",
      tint: [52, 28, 84],
      icon: drawChart,
    },
    {
      kicker: "KYIV",
      headline: "DRONES DAMAGE TWO EMBASSIES IN KYIV",
      caption:
        "Russian drones hit Kyiv in daylight. One person killed, five hurt; windows blown out at both missions.",
      tint: [226, 224, 214],
      icon: drawEmbassies,
    },
  ];

  const cardTop = ly + 14;
  const cardH = 256;
  const gap = 16;
  const narrowW = Math.floor((PAGE_W - gap * 2) / 3);
  const wideW = Math.floor((PAGE_W - gap) / 2);
  stories.slice(0, 3).forEach((s, i) => {
    drawCard(s, MARGIN + i * (narrowW + gap), cardTop, narrowW, cardH);
  });
  const row2 = cardTop + cardH + gap;
  stories.slice(3).forEach((s, i) => {
    drawCard(s, MARGIN + i * (wideW + gap), row2, wideW, cardH);
  });

  // ---- Footer ---------------------------------------------------------------
  putText(
    "SOURCES: REUTERS, BBC, NASA, IMD, AFP, SENSOR TOWER",
    Math.floor(W / 2),
    row2 + cardH + 12,
    2,
    GREY,
    "c",
  );
}

// ---------------------------------------------------------------------------
// Entry point: draw the page and write entry.png to the output directory.
// ---------------------------------------------------------------------------
function main(): void {
  drawPage();
  const png = toPng(canvas, W, H);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
