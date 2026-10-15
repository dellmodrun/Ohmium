import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./anatomy/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WIDTH = 720;
const HEIGHT = 510;
const BOARD = { x: -120, y: -120, w: 240, d: 240, r: 120 };
const P = k.fitProjection([...k.boxCorners(BOARD, -10, 43)], WIDTH, HEIGHT, {
  pad: 35,
  headroom: 26,
  azimuth: 47,
  elevation: 29,
});

const S = (paths, style = {}) => k.solidSvg(paths, style);
const L = (d, style = {}) => k.lineSvg(d, style);
const at = (p) => k.iso(p, P);
const slab = (plan, z, h, style = {}) => S(k.slabOf(plan, z, h, P, 5, Math.min(1, h / 3)), style);
const cyl = (x, y, r, z, h, style = {}) => S(k.cylinder(x, y, r, z, h, P, 28, .5), style);
const line3 = (pts, style = {}) => L(k.pathOf(pts.map(at)), style);

const stationSpec = [
  ["sensor", "SENSE", "can"], ["filter", "FILTER", "coil"],
  ["memory", "MEMORY", "chip"], ["router", "ROUTE", "relay"],
  ["verify", "VERIFY", "can"], ["archive", "ARCHIVE", "coil"],
  ["guard", "GUARD", "chip"], ["oracle", "ORACLE", "relay"],
];
const stations = stationSpec.map(([id, label, type], index) => {
  const angle = (-112.5 + index * 45) * Math.PI / 180;
  return { id, label, type, x: Math.cos(angle) * 76, y: Math.sin(angle) * 76 };
});

function foundation() {
  const out = [];
  for (let index = 0; index < 6; index++) {
    const angle = index * Math.PI / 3;
    const x = Math.cos(angle) * 91;
    const y = Math.sin(angle) * 91;
    out.push(cyl(x, y, 7, -10, 3, { tone: "lo", className: "part foot" }));
    out.push(cyl(x, y, 5, -7, 4, { tone: "lo", className: "part isolator" }));
  }
  out.push(cyl(0, 0, 116, -3, 8, { tone: "mid", crease: "lo", halo: true, className: "part lower-deck" }));
  out.push(cyl(0, 0, 109, 5, 3, { tone: "mid", crease: "faint", className: "part pcb" }));
  out.push(L(k.ring(0, 0, 101, 8.2, P, 72), { tone: "lo" }));
  out.push(L(k.ring(0, 0, 94, 8.3, P, 72), { tone: "faint" }));
  for (let index = 0; index < 8; index++) {
    const angle = (index * Math.PI) / 4;
    const x = Math.cos(angle) * 102;
    const y = Math.sin(angle) * 102;
    out.push(cyl(x, y, 3.1, 8, 1.3, { tone: "hi", className: "part screw" }));
    out.push(line3([[x - 1.3, y, 9.35], [x + 1.3, y, 9.35]], { tone: "lo", free: true }));
  }
  const ticks = k.radialTicks(0, 0, 106, 64, 8, 8.4, [2.5, 5], P);
  out.push(L(ticks.minor, { tone: "faint" }), L(ticks.major, { tone: "lo" }));
  for (const radius of [42, 47]) {
    out.push(L(k.ring(0, 0, radius, 8.4, P, 56), { tone: "faint" }));
  }
  return out.join("");
}

function traces() {
  const out = [];
  for (const [index, station] of stations.entries()) {
    const length = Math.hypot(station.x, station.y);
    const ux = station.x / length;
    const uy = station.y / length;
    const sx = station.x - ux * 18;
    const sy = station.y - uy * 18;
    const elbowX = ux * 49;
    const elbowY = uy * 49;
    const endX = ux * 33;
    const endY = uy * 33;
    const pts = [[sx, sy, 8.7], [elbowX, elbowY, 8.7], [endX, endY, 8.7]];
    out.push(`<g class="signal-route route-${station.id}" data-route="${station.id}">${line3(pts, { tone: index === 0 ? "mid" : "lo", className: "route-line", free: true })}</g>`);
    const offset = index % 2 ? 2.8 : -2.8;
    out.push(line3(pts.map(([x, y, z]) => [x - uy * offset, y + ux * offset, z]), { tone: "faint", free: true }));
    out.push(k.dotsSvg([at([sx, sy, 9]), at([endX, endY, 9])], { size: 1, tone: "lo" }));
  }
  for (const axis of [-1, 1]) {
    out.push(line3([[axis * 18, -75, 8.8], [axis * 18, -27, 8.8]], { tone: "lo", free: true }));
    out.push(line3([[axis * 18, 75, 8.8], [axis * 18, 27, 8.8]], { tone: "lo", free: true }));
  }
  return `<g class="board-traces">${out.join("")}</g>`;
}

function stationBody(station, index) {
  const { x, y, type, id, label } = station;
  const out = [];
  const base = { x: x - 18, y: y - 13, w: 36, d: 26, r: 3 };
  out.push(slab(base, 9, 4, { tone: "lo", className: "part station-base" }));
  out.push(L(k.planOutline(k.insetPlan(base, 3), 13.1, P, 4), { tone: "faint" }));
  for (const px of [x - 13, x + 13]) {
    out.push(cyl(px, y - 8, 1.7, 13, 1, { tone: "mid", className: "part terminal" }));
    out.push(cyl(px, y + 8, 1.7, 13, 1, { tone: "mid", className: "part terminal" }));
  }
  if (type === "can") {
    out.push(cyl(x, y, 8.8, 13, 14, { tone: "mid", crease: "lo", className: "part component-can" }));
    out.push(k.lineSvg(k.ring(x, y, 5.5, 27.2, P, 28), { tone: "lo" }));
    out.push(cyl(x, y, 2.1, 27, 1.2, { tone: "hi", className: "part cap" }));
  } else if (type === "coil") {
    out.push(slab({ x: x - 11, y: y - 7, w: 22, d: 14, r: 5 }, 13, 6, { tone: "mid", className: "part coil-bed" }));
    for (let n = -4; n <= 4; n += 2) out.push(cyl(x + n * 1.65, y, 3.1, 19, 7.5, { tone: "lo", className: "part coil-turn" }));
    out.push(line3([[x - 11, y, 22], [x - 17, y, 22]], { tone: "mid" }));
    out.push(line3([[x + 11, y, 22], [x + 17, y, 22]], { tone: "mid" }));
  } else if (type === "relay") {
    out.push(slab({ x: x - 11, y: y - 9, w: 22, d: 18, r: 2 }, 13, 14, { tone: "mid", crease: "lo", className: "part relay" }));
    out.push(L(k.planOutline({ x: x - 7, y: y - 5, w: 14, d: 10, r: 1 }, 27.1, P, 3), { tone: "faint" }));
    out.push(cyl(x + 6, y + 4, 1.4, 27, 1, { tone: "hi", className: "part relay-pin" }));
  } else {
    out.push(slab({ x: x - 12, y: y - 9, w: 24, d: 18, r: 2 }, 13, 9, { tone: "mid", crease: "lo", className: "part memory-chip" }));
    for (const py of [-7, -3.5, 0, 3.5, 7]) {
      out.push(slab({ x: x - 15, y: y + py - 1, w: 3, d: 2, r: .4 }, 14, 1.3, { tone: "lo", className: "part chip-pin" }));
      out.push(slab({ x: x + 12, y: y + py - 1, w: 3, d: 2, r: .4 }, 14, 1.3, { tone: "lo", className: "part chip-pin" }));
    }
    out.push(cyl(x - 7, y - 4, 1.2, 22, .8, { tone: "hi", className: "part index-dot" }));
  }
  out.push(cyl(x + 14, y - 9, 1.55, 14, 1, { tone: "lo", className: "part station-led" }));
  const [tx, ty] = at([x - 14, y + 17, 9]);
  out.push(`<text class="station-label" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}">0${index + 1} / ${label}</text>`);
  return `<g class="component-station" data-component="${id}" tabindex="0" role="button" aria-label="Inspect ${label.toLowerCase()} component">${out.join("")}<title>${label} component · awaiting owner deployment</title></g>`;
}

function centralCore() {
  const out = [];
  const socket = { x: -35, y: -31, w: 70, d: 62, r: 5 };
  out.push(slab(socket, 9, 6, { tone: "mid", crease: "lo", className: "part core-socket" }));
  out.push(L(k.planOutline(k.insetPlan(socket, 5), 15.1, P, 4), { tone: "lo" }));
  for (let x = -27; x <= 27; x += 9) {
    out.push(slab({ x: x - 2.7, y: -35, w: 5.4, d: 5, r: .7 }, 12, 1.4, { tone: "mid", className: "part core-pin" }));
    out.push(slab({ x: x - 2.7, y: 30, w: 5.4, d: 5, r: .7 }, 12, 1.4, { tone: "mid", className: "part core-pin" }));
  }
  for (let y = -22; y <= 22; y += 8.8) {
    out.push(slab({ x: -39, y: y - 2.4, w: 5, d: 4.8, r: .7 }, 12, 1.4, { tone: "mid", className: "part core-pin" }));
    out.push(slab({ x: 34, y: y - 2.4, w: 5, d: 4.8, r: .7 }, 12, 1.4, { tone: "mid", className: "part core-pin" }));
  }
  const pkg = { x: -27, y: -24, w: 54, d: 48, r: 4 };
  out.push(slab(pkg, 15, 15, { tone: "mid", crease: "lo", className: "part core-package" }));
  out.push(slab(k.insetPlan(pkg, 7), 30, 4, { tone: "hi", crease: "lo", className: "part core-lid" }));
  out.push(L(k.planOutline(k.insetPlan(pkg, 11), 34.1, P, 3), { tone: "faint" }));
  out.push(cyl(-18, -15, 2, 34, 1, { tone: "hi", className: "part orientation" }));
  for (const [x, y] of [[-32, -28], [32, -28], [-32, 28], [32, 28]]) {
    out.push(slab({ x: x - 5, y: y - 3, w: 10, d: 6, r: 1.2 }, 15, 7, { tone: "lo", className: "part clamp" }));
    out.push(cyl(x, y, 1.7, 22, 1, { tone: "hi", className: "part clamp-screw" }));
  }
  const [cx, cy] = at([0, 0, 34.3]);
  out.push(`<text class="core-mark" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle">OHMIUM</text>`);
  out.push(`<g class="core-lens" data-lit="">${cyl(18, -15, 2.5, 34, 1.6, { tone: "hi", lit: true, className: "part status-lens" })}</g>`);
  return `<g class="central-core" data-component="core" tabindex="0" role="button" aria-label="Inspect Ohmium conductor core">${out.join("")}<title>OHMIUM conductor · circuit coordination core</title></g>`;
}

function edgeHardware() {
  const out = [];
  for (let index = 0; index < 12; index++) {
    const angle = index * Math.PI / 6;
    const x = Math.cos(angle) * 104;
    const y = Math.sin(angle) * 104;
    out.push(cyl(x, y, 3.4, 8, 4, { tone: "lo", className: "part edge-port" }));
    out.push(cyl(x, y, 1.3, 12, .8, { tone: "mid", className: "part contact" }));
  }
  for (const angle of [-22, 22, 158, 202]) {
    const rad = angle * Math.PI / 180;
    out.push(cyl(Math.cos(rad) * 88, Math.sin(rad) * 88, 2.4, 8, 4, { tone: "mid", className: "part fuse" }));
  }
  return out.join("");
}

const body = [foundation(), traces(), edgeHardware(), ...stations.map(stationBody), centralCore()].join("");
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  className: "ohmium-rig-svg",
  label: "An isometric precision circuit test bench. A central OHMIUM conductor package is wired to eight autonomous component stations for sensing, filtering, memory, routing, oracle input, guarding, archiving, and verification.",
  body,
});

const style = `<style>
:root{--anatomy-bg:#000;--anatomy-top:#111612;--anatomy-fill:#0b0f0c;--anatomy-shade-0:#050705;--anatomy-shade-1:#080b09;--anatomy-shade-2:#0c110d;--anatomy-shade-3:#151b16;--anatomy-hi:#9aa89d;--anatomy-mid:#59665c;--anatomy-lo:#334039;--anatomy-faint:#202b24;--anatomy-lit:#7fe03a;--anatomy-lit-shade:#203d20}
svg{display:block;width:100%;height:100%;overflow:visible}.iso-fill{fill:var(--anatomy-fill)}.iso-top{fill:var(--anatomy-top)}.iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}.iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}.iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}.iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}.iso-line{fill:none;stroke:var(--anatomy-lo);stroke-width:.75;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}.iso-line[data-tone="hi"]{stroke:var(--anatomy-hi)}.iso-line[data-tone="mid"]{stroke:var(--anatomy-mid)}.iso-line[data-tone="faint"]{stroke:var(--anatomy-faint)}.iso-edge{stroke:var(--anatomy-mid)}.iso-halo{fill:#7fe03a;opacity:.025;filter:blur(9px)}.iso-dots{fill:var(--anatomy-lo)}[data-lit] .iso-top{fill:var(--anatomy-lit)}[data-lit] .iso-fill{fill:var(--anatomy-lit-shade)}.component-station,.central-core{cursor:pointer;outline:none;transition:opacity .2s ease}.component-station:hover .station-base .iso-edge,.component-station:focus .station-base .iso-edge,.central-core:hover .core-package .iso-edge,.central-core:focus .core-package .iso-edge{stroke:var(--anatomy-lit)}.component-station.is-active .station-led .iso-top,.component-station.is-active .station-led .iso-fill{fill:var(--anatomy-lit)}.signal-route.is-active .route-line{stroke:var(--anatomy-lit);stroke-dasharray:2 7;animation:route 1.8s linear infinite}.station-label,.core-mark{fill:#6b786e;font:500 7px 'IBM Plex Mono',monospace;letter-spacing:.09em;pointer-events:none}.core-mark{fill:#cad3cc;font-size:8px;letter-spacing:.15em}.core-lens{animation:corePulse 3.2s ease-in-out infinite}.part{transition:filter .2s ease}.component-station:hover .part,.component-station:focus .part,.central-core:hover .part,.central-core:focus .part{filter:brightness(1.18)}@keyframes route{to{stroke-dashoffset:-18}}@keyframes corePulse{50%{opacity:.5}}@media(prefers-reduced-motion:reduce){.core-lens,.signal-route.is-active .route-line{animation:none}}
</style>`;

mkdirSync(join(ROOT, "assets"), { recursive: true });
writeFileSync(join(ROOT, "assets", "ohmium-circuit-core.svg"), svg.replace(/<svg /, `<svg data-parts="179" `).replace(">", `>${style}`));
console.log("wrote assets/ohmium-circuit-core.svg · 179 modeled parts");
