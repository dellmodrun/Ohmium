import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./anatomy/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WIDTH = 720;
const HEIGHT = 510;
const PACKAGE = { x: -126, y: -96, w: 252, d: 192, r: 7 };
const DIE = { x: -105, y: -76, w: 210, d: 152, r: 3 };
const P = k.fitProjection([...k.boxCorners(PACKAGE, -8, 36)], WIDTH, HEIGHT, {
  pad: 34,
  headroom: 24,
  azimuth: 48,
  elevation: 41,
});

const S = (paths, style = {}) => k.solidSvg(paths, style);
const L = (d, style = {}) => k.lineSvg(d, style);
const D = (points, style = {}) => k.dotsSvg(points, style);
const at = (point) => k.iso(point, P);
const slab = (plan, z, h, style = {}) => S(k.slabOf(plan, z, h, P, 4, Math.min(.8, h / 3)), style);
const cyl = (x, y, r, z, h, style = {}) => S(k.cylinder(x, y, r, z, h, P, 22, .35), style);
const line3 = (points, style = {}) => L(k.pathOf(points.map(at)), style);

const macros = [
  { id: "sensor", label: "SENSE", code: "A0", x: -90, y: -59, w: 48, d: 34, kind: "adc" },
  { id: "filter", label: "FILTER", code: "A1", x: -32, y: -59, w: 54, d: 34, kind: "comb" },
  { id: "memory", label: "MEMORY", code: "A2", x: 32, y: -59, w: 58, d: 34, kind: "memory" },
  { id: "router", label: "ROUTE", code: "A3", x: 69, y: -14, w: 31, d: 48, kind: "crossbar" },
  { id: "verify", label: "VERIFY", code: "A4", x: 31, y: 43, w: 59, d: 25, kind: "compare" },
  { id: "archive", label: "ARCHIVE", code: "A5", x: -31, y: 43, w: 52, d: 25, kind: "bank" },
  { id: "guard", label: "GUARD", code: "A6", x: -90, y: 43, w: 49, d: 25, kind: "fuse" },
  { id: "oracle", label: "ORACLE", code: "A7", x: -100, y: -13, w: 31, d: 46, kind: "ports" },
];

const CORE = { x: -31, y: -18, w: 62, d: 48, r: 3 };

function packageBase() {
  const out = [];
  for (const [x, y] of k.corners(PACKAGE, 13)) {
    out.push(cyl(x, y, 6.4, -8, 3, { tone: "lo", className: "part package-foot" }));
    out.push(cyl(x, y, 4.5, -5, 2, { tone: "lo", className: "part foot-collar" }));
  }
  out.push(S(k.slabOf(PACKAGE, -3, 8, P, 7, 1.2), { tone: "mid", crease: "lo", halo: true, className: "part package-substrate" }));
  out.push(L(k.planOutline(k.insetPlan(PACKAGE, 7), 5.1, P, 6), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(PACKAGE, 13), 5.2, P, 5), { tone: "faint" }));

  for (let index = 0; index < 12; index++) {
    const x = -104 + index * (208 / 11);
    for (const y of [-89, 85]) {
      out.push(slab({ x: x - 3.2, y, w: 6.4, d: 7, r: .8 }, 5, 1.2, { tone: "mid", className: "part io-pad" }));
    }
  }
  for (let index = 0; index < 10; index++) {
    const y = -68 + index * (136 / 9);
    for (const x of [-119, 113]) {
      out.push(slab({ x, y: y - 3.2, w: 6, d: 6.4, r: .8 }, 5, 1.2, { tone: "mid", className: "part io-pad" }));
    }
  }
  for (let index = 0; index < 9; index++) {
    const x = -88 + index * 22;
    out.push(cyl(x, 94, 3.2, -1, 4, { tone: "lo", className: "part bga-contact" }));
  }
  out.push(slab({ x: -119, y: -88, w: 20, d: 7, r: 1 }, 5, 1.1, { tone: "hi", className: "part orientation-key" }));
  return out.join("");
}

function dieBase() {
  const out = [];
  for (let index = 0; index < 8; index++) {
    const x = -91 + index * 26;
    out.push(cyl(x, -66, 1.8, 5, 4, { tone: "lo", className: "part die-post" }));
    out.push(cyl(x, 66, 1.8, 5, 4, { tone: "lo", className: "part die-post" }));
  }
  out.push(slab(DIE, 9, 5, { tone: "mid", crease: "lo", className: "part silicon-die" }));
  out.push(L(k.planOutline(k.insetPlan(DIE, 5), 14.2, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(DIE, 10), 14.3, P, 4), { tone: "faint" }));

  for (const x of [-96, -91, 91, 96]) out.push(line3([[x, -62, 14.4], [x, 62, 14.4]], { tone: "faint" }));
  for (const y of [-67, -62, 62, 67]) out.push(line3([[-91, y, 14.4], [91, y, 14.4]], { tone: "faint" }));

  const vias = [];
  for (let row = 0; row < 9; row++) {
    for (let column = 0; column < 13; column++) {
      const x = -78 + column * 13;
      const y = -50 + row * 12.5;
      if (x > -39 && x < 39 && y > -27 && y < 37) continue;
      vias.push(at([x, y, 14.6]));
    }
  }
  out.push(D(vias, { size: .48, tone: "faint" }));
  return out.join("");
}

function passiveFabric() {
  const out = [];
  for (let row = 0; row < 7; row++) {
    for (let column = 0; column < 10; column++) {
      const x = -81 + column * 18;
      const y = -51 + row * 17;
      const blocked = macros.some((m) => x > m.x - 4 && x < m.x + m.w + 4 && y > m.y - 4 && y < m.y + m.d + 4)
        || (x > CORE.x - 5 && x < CORE.x + CORE.w + 5 && y > CORE.y - 5 && y < CORE.y + CORE.d + 5);
      if (blocked) continue;
      out.push(slab({ x: x - 3.4, y: y - 2.2, w: 6.8, d: 4.4, r: .6 }, 14, 1.3, { tone: "lo", className: "part standard-cell" }));
    }
  }
  for (const y of [-38, -32, 38]) out.push(line3([[-91, y, 14.7], [91, y, 14.7]], { tone: "faint" }));
  for (const x of [-58, 58]) out.push(line3([[x, -62, 14.7], [x, 62, 14.7]], { tone: "faint" }));
  return out.join("");
}

function routes() {
  const out = [];
  for (const [index, macro] of macros.entries()) {
    const cx = macro.x + macro.w / 2;
    const cy = macro.y + macro.d / 2;
    const sideX = cx < 0 ? CORE.x - 5 : CORE.x + CORE.w + 5;
    const sideY = cy < CORE.y ? CORE.y + 5 : cy > CORE.y + CORE.d ? CORE.y + CORE.d - 5 : cy;
    const startX = cx < 0 ? macro.x + macro.w : macro.x;
    const startY = cy;
    const channel = index % 2 ? 3 : -3;
    const main = [[startX, startY, 15.2], [sideX, startY, 15.2], [sideX, sideY, 15.2]];
    const returnPath = main.map(([x, y, z]) => [x, y + channel, z]);
    out.push(`<g class="signal-route route-${macro.id}" data-route="${macro.id}">${line3(main, { tone: "lo", className: "route-line route-forward", free: true })}${line3(returnPath, { tone: "faint", className: "route-line route-return", free: true })}${D([at(main[0]), at(main[main.length - 1])], { size: .9, tone: "lo" })}</g>`);
  }
  return `<g class="metal-routing">${out.join("")}</g>`;
}

function macroInterior(macro) {
  const { x, y, w, d, kind } = macro;
  const z = 19.5;
  const out = [];
  if (kind === "memory" || kind === "bank") {
    const columns = kind === "memory" ? 7 : 6;
    const rows = kind === "memory" ? 4 : 2;
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      out.push(slab({ x: x + 5 + col * ((w - 10) / columns), y: y + 6 + row * ((d - 10) / rows), w: 4.5, d: 3, r: .4 }, z, 1.1, { tone: "lo", className: "part memory-cell" }));
    }
  } else if (kind === "adc") {
    for (let n = 0; n < 6; n++) {
      out.push(line3([[x + 7, y + 7 + n * 3.5, z], [x + w - 8 - n * 2.2, y + 7 + n * 3.5, z]], { tone: n % 2 ? "faint" : "lo", free: true }));
      out.push(cyl(x + w - 7, y + 7 + n * 3.5, .8, z, .7, { tone: "lo", className: "part adc-node" }));
    }
  } else if (kind === "comb") {
    for (let n = 0; n < 8; n++) out.push(slab({ x: x + 5 + n * 5.4, y: y + 7, w: 2.2, d: d - 14, r: .5 }, z, 1.1, { tone: "lo", className: "part filter-tap" }));
  } else if (kind === "crossbar") {
    for (let n = 0; n < 5; n++) {
      out.push(line3([[x + 6, y + 8 + n * 6.5, z], [x + w - 6, y + 8 + n * 6.5, z]], { tone: "lo", free: true }));
      out.push(line3([[x + 6 + n * 4.6, y + 6, z], [x + 6 + n * 4.6, y + d - 6, z]], { tone: "faint", free: true }));
    }
  } else if (kind === "compare") {
    for (let n = 0; n < 5; n++) {
      out.push(slab({ x: x + 6 + n * 9.4, y: y + 6, w: 6, d: 5, r: 1 }, z, 1.2, { tone: "lo", className: "part comparator" }));
      out.push(slab({ x: x + 6 + n * 9.4, y: y + 14, w: 6, d: 5, r: 1 }, z, 1.2, { tone: "lo", className: "part comparator" }));
    }
  } else if (kind === "fuse") {
    for (let n = 0; n < 7; n++) out.push(cyl(x + 7 + n * 5.6, y + d / 2, 1.25, z, 1, { tone: "lo", className: "part guard-fuse" }));
  } else {
    for (let n = 0; n < 6; n++) out.push(slab({ x: x + 6, y: y + 5 + n * 6, w: w - 12, d: 2.3, r: .5 }, z, 1, { tone: "lo", className: "part oracle-port" }));
  }
  return out.join("");
}

function macroBlock(macro) {
  const out = [];
  out.push(slab({ x: macro.x, y: macro.y, w: macro.w, d: macro.d, r: 2 }, 15, 4, { tone: "mid", crease: "lo", className: "part macro-body" }));
  out.push(L(k.planOutline({ x: macro.x + 3, y: macro.y + 3, w: macro.w - 6, d: macro.d - 6, r: 1 }, 19.2, P, 3), { tone: "faint" }));
  out.push(macroInterior(macro));
  for (const side of [-1, 1]) {
    const px = side < 0 ? macro.x - 2 : macro.x + macro.w + 2;
    out.push(cyl(px, macro.y + macro.d / 2, 1.25, 16.2, 1, { tone: "lo", className: "part macro-terminal" }));
  }
  out.push(cyl(macro.x + macro.w - 5, macro.y + 5, 1.2, 19.5, .8, { tone: "lo", className: "part macro-led" }));
  const [tx, ty] = at([macro.x + 4, macro.y + macro.d - 4, 20.2]);
  out.push(`<text class="macro-label" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}">${macro.code} / ${macro.label}</text>`);
  return `<g class="component-station macro-${macro.id}" data-component="${macro.id}" tabindex="0" role="button" aria-label="Inspect ${macro.label.toLowerCase()} macro">${out.join("")}<title>${macro.label} agent macro · awaiting verified workload</title></g>`;
}

function conductor() {
  const out = [];
  out.push(slab(CORE, 15, 5, { tone: "mid", crease: "lo", className: "part conductor-socket" }));
  for (let x = CORE.x + 5; x <= CORE.x + CORE.w - 5; x += 7) {
    out.push(slab({ x: x - 1.8, y: CORE.y - 3, w: 3.6, d: 4, r: .4 }, 17, 1, { tone: "lo", className: "part conductor-pin" }));
    out.push(slab({ x: x - 1.8, y: CORE.y + CORE.d - 1, w: 3.6, d: 4, r: .4 }, 17, 1, { tone: "lo", className: "part conductor-pin" }));
  }
  const packagePlan = { x: -24, y: -12, w: 48, d: 36, r: 3 };
  out.push(slab(packagePlan, 20, 10, { tone: "mid", crease: "lo", className: "part conductor-package" }));
  out.push(slab(k.insetPlan(packagePlan, 6), 30, 3, { tone: "hi", crease: "lo", className: "part conductor-lid" }));
  out.push(L(k.planOutline(k.insetPlan(packagePlan, 10), 33.2, P, 3), { tone: "faint" }));
  out.push(cyl(-17, -5, 1.7, 33, .9, { tone: "hi", className: "part core-index" }));
  out.push(`<g class="core-lens" data-lit="">${cyl(16, -4, 2.2, 33, 1.2, { tone: "hi", lit: true, className: "part status-lens" })}</g>`);
  const [tx, ty] = at([0, 7, 33.4]);
  out.push(`<text class="core-mark" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle">CONDUCTOR</text>`);
  return `<g class="central-core" data-component="core" tabindex="0" role="button" aria-label="Inspect Conductor core">${out.join("")}<title>Conductor · deterministic agent scheduler</title></g>`;
}

const body = [packageBase(), dieBase(), passiveFabric(), routes(), ...macros.map(macroBlock), conductor()].join("");
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  className: "ohmium-rig-svg",
  label: "A live semiconductor floorplan. Eight specialized agent macros surround a central Conductor scheduler on a silicon die, connected by metal routing layers, via fields and package I/O pads.",
  body,
});

const style = `<style>
:root{--anatomy-bg:#000;--anatomy-top:#111612;--anatomy-fill:#0a0e0b;--anatomy-shade-0:#040604;--anatomy-shade-1:#070a08;--anatomy-shade-2:#0b100c;--anatomy-shade-3:#151c16;--anatomy-hi:#a5b0a7;--anatomy-mid:#59665c;--anatomy-lo:#334039;--anatomy-faint:#202b24;--anatomy-lit:#7fe03a;--anatomy-lit-shade:#1d371e}
svg{display:block;width:100%;height:100%;overflow:visible}.iso-fill{fill:var(--anatomy-fill)}.iso-top{fill:var(--anatomy-top)}.iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}.iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}.iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}.iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}.iso-line{fill:none;stroke:var(--anatomy-lo);stroke-width:.72;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}.iso-line[data-tone="hi"]{stroke:var(--anatomy-hi)}.iso-line[data-tone="mid"]{stroke:var(--anatomy-mid)}.iso-line[data-tone="faint"]{stroke:var(--anatomy-faint)}.iso-edge{stroke:var(--anatomy-mid)}.iso-halo{fill:#7fe03a;opacity:.025;filter:blur(9px)}.iso-dots{fill:var(--anatomy-lo)}[data-lit] .iso-top{fill:var(--anatomy-lit)}[data-lit] .iso-fill{fill:var(--anatomy-lit-shade)}.component-station,.central-core{cursor:pointer;outline:none}.component-station:hover .macro-body .iso-edge,.component-station:focus .macro-body .iso-edge,.central-core:hover .conductor-package .iso-edge,.central-core:focus .conductor-package .iso-edge{stroke:var(--anatomy-lit)}.component-station.is-active .macro-led .iso-top,.component-station.is-active .macro-led .iso-fill{fill:var(--anatomy-lit)}.signal-route.is-active .route-forward{stroke:var(--anatomy-lit);stroke-width:1.05;stroke-dasharray:2 6;animation:route 1.25s linear infinite}.signal-route.is-active .route-return{stroke:#4b6d4e;stroke-dasharray:1 8;animation:routeBack 1.8s linear infinite}.macro-label,.core-mark{fill:#748178;font:500 6.5px 'IBM Plex Mono',monospace;letter-spacing:.07em;pointer-events:none}.core-mark{fill:#d0d8d2;font-size:7.2px;letter-spacing:.12em}.core-lens{animation:corePulse 3.2s ease-in-out infinite}.part{transition:filter .2s ease}.component-station:hover .part,.component-station:focus .part,.central-core:hover .part,.central-core:focus .part{filter:brightness(1.17)}@keyframes route{to{stroke-dashoffset:-16}}@keyframes routeBack{to{stroke-dashoffset:18}}@keyframes corePulse{50%{opacity:.48}}@media(prefers-reduced-motion:reduce){.core-lens,.signal-route.is-active .route-line{animation:none}}
</style>`;

mkdirSync(join(ROOT, "assets"), { recursive: true });
writeFileSync(join(ROOT, "assets", "ohmium-circuit-core.svg"), svg.replace(/<svg /, `<svg data-figure="agent-silicon" `).replace(">", `>${style}`));
console.log("wrote assets/ohmium-circuit-core.svg · Live Agent Silicon");
