import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./anatomy/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WIDTH = 980;
const HEIGHT = 560;
const BASE = { x: -164, y: -92, w: 328, d: 184, r: 10 };
const P = k.fitProjection([...k.boxCorners(BASE, -14, 72)], WIDTH, HEIGHT, {
  pad: 24,
  headroom: 18,
  azimuth: 43,
  elevation: 31,
});

const S = (paths, style = {}) => k.solidSvg(paths, style);
const L = (d, style = {}) => k.lineSvg(d, style);
const at = (point) => k.iso(point, P);
const slab = (plan, z, h, style = {}) => S(k.slabOf(plan, z, h, P, 5, Math.min(1.2, Math.max(.35, h / 3))), style);
const cyl = (x, y, r, z, h, style = {}) => S(k.cylinder(x, y, r, z, h, P, 36, .55), style);
const line3 = (points, style = {}) => L(k.pathOf(points.map(at)), style);
const dot3 = (points, style = {}) => k.dotsSvg(points.map(at), { size: style.size || .72, tone: style.tone || "mid" });

const modules = [
  { key: "sensor", x: -111, y: -53, slot: 1, kind: "can" },
  { key: "filter", x: -38, y: -53, slot: 2, kind: "coil" },
  { key: "oracle", x: 38, y: -53, slot: 3, kind: "dial" },
  { key: "guard", x: 111, y: -53, slot: 4, kind: "fuse" },
  { key: "router", x: -111, y: 53, slot: 5, kind: "relay" },
  { key: "memory", x: -38, y: 53, slot: 6, kind: "chip" },
  { key: "archive", x: 38, y: 53, slot: 7, kind: "drum" },
  { key: "verify", x: 111, y: 53, slot: 8, kind: "gauge" },
];

function foundation() {
  const out = [];
  for (const [x, y] of [[-142, -70], [-48, -70], [48, -70], [142, -70], [-142, 70], [-48, 70], [48, 70], [142, 70]]) {
    out.push(cyl(x, y, 6.5, -14, 3, { tone: "lo", className: "part foot-flange" }));
    out.push(cyl(x, y, 4.8, -11, 5, { tone: "mid", className: "part isolator" }));
  }
  out.push(slab(BASE, -6, 10, { tone: "mid", crease: "lo", halo: true, className: "part foundation" }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 6), 4.1, P, 8), { tone: "lo" }));
  out.push(slab({ x: -155, y: -83, w: 310, d: 166, r: 7 }, 4, 4, { tone: "lo", crease: "faint", className: "part service-deck" }));
  out.push(L(k.planOutline({ x: -149, y: -77, w: 298, d: 154, r: 5 }, 8.1, P, 6), { tone: "faint" }));
  for (const [x, y] of k.corners(BASE, 13)) {
    out.push(cyl(x, y, 2.6, 4, 1.5, { tone: "hi", className: "part deck-screw" }));
    out.push(line3([[x - 1.1, y, 5.55], [x + 1.1, y, 5.55]], { tone: "lo", free: true }));
  }
  for (const y of [-78, 78]) {
    for (let x = -124; x <= 124; x += 16) out.push(slab({ x: x - 4, y: y - 2, w: 8, d: 4, r: 1.6 }, 8, .8, { tone: "lo", className: "part vent" }));
  }
  const ruler = { x: -143, y: 69, w: 286, d: 6, r: 1 };
  out.push(slab(ruler, 8, .7, { tone: "lo", className: "part datum-strip" }));
  const ticks = k.topTicks(-138, 138, 4, 5, 70, 8.8, [1.7, 3.2], P);
  out.push(L(ticks.minor, { tone: "faint" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function busAssembly() {
  const out = [];
  for (const y of [-13, 13]) {
    out.push(slab({ x: -133, y: y - 3.2, w: 266, d: 6.4, r: 2 }, 8, 4, { tone: "mid", crease: "faint", className: "part bus-rail" }));
    for (let x = -120; x <= 120; x += 20) out.push(cyl(x, y, 1.35, 12, .9, { tone: "hi", className: "part rail-fastener" }));
  }
  for (const x of [-137, 137]) {
    out.push(slab({ x: x - 4, y: -20, w: 8, d: 40, r: 2 }, 8, 10, { tone: "mid", className: "part end-stop" }));
    out.push(cyl(x, -13, 1.5, 18, 1, { tone: "hi", className: "part stop-screw" }));
    out.push(cyl(x, 13, 1.5, 18, 1, { tone: "hi", className: "part stop-screw" }));
  }
  out.push(slab({ x: -25, y: -23, w: 50, d: 46, r: 5 }, 12, 7, { tone: "mid", crease: "lo", className: "part conductor-carriage" }));
  for (const [x, y] of [[-18, -17], [18, -17], [-18, 17], [18, 17]]) {
    out.push(slab({ x: x - 4, y: y - 3, w: 8, d: 6, r: 1.4 }, 19, 4, { tone: "lo", className: "part carriage-bushing" }));
    out.push(cyl(x, y, 1.3, 23, .8, { tone: "hi", className: "part bushing-screw" }));
  }
  out.push(slab({ x: -18, y: -16, w: 36, d: 32, r: 4 }, 23, 13, { tone: "hi", crease: "lo", className: "part conductor-package" }));
  out.push(slab({ x: -12, y: -10, w: 24, d: 20, r: 3 }, 36, 4, { tone: "mid", crease: "lo", className: "part conductor-lid" }));
  out.push(L(k.planOutline({ x: -8, y: -6, w: 16, d: 12, r: 2 }, 40.1, P, 3), { tone: "faint" }));
  const [tx, ty] = at([0, 0, 40.4]);
  out.push(`<text class="backplane-mark" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle">OHMIUM</text>`);
  out.push(cyl(12, -10, 2.2, 40, 1.5, { tone: "hi", lit: true, className: "part core-lamp" }));
  return `<g class="backplane-core" data-component="core" tabindex="0">${out.join("")}<title>Ohmium Conductor carriage</title></g>`;
}

function traces() {
  const out = [];
  for (const module of modules) {
    const nearY = module.y < 0 ? -18 : 18;
    const socketY = module.y < 0 ? module.y + 15 : module.y - 15;
    const route = [[module.x, socketY, 9], [module.x, nearY, 9], [Math.sign(module.x || 1) * Math.min(24, Math.abs(module.x)), nearY, 9]];
    out.push(`<g class="backplane-route route-${module.key}" data-route="${module.key}">${line3(route, { tone: "lo", className: "route-line", free: true })}${dot3([route[0], route.at(-1)], { tone: "mid", size: .85 })}</g>`);
  }
  for (const x of [-82, -4, 74]) out.push(line3([[x, -18, 9], [x, 18, 9]], { tone: "faint", free: true }));
  return `<g class="backplane-traces">${out.join("")}</g>`;
}

function cartridge(module) {
  const { x, y, key, slot, kind } = module;
  const out = [];
  const front = y > 0 ? -1 : 1;
  out.push(slab({ x: x - 27, y: y - 18, w: 54, d: 36, r: 4 }, 9, 4, { tone: "lo", crease: "faint", className: "part module-socket" }));
  out.push(L(k.planOutline({ x: x - 23, y: y - 14, w: 46, d: 28, r: 3 }, 13.1, P, 4), { tone: "faint" }));
  for (const px of [-19, -11, -3, 5, 13, 21]) {
    out.push(slab({ x: x + px - 2.1, y: y + front * 18, w: 4.2, d: 5.5, r: .7 }, 11, 2, { tone: "mid", className: "part card-contact" }));
  }
  out.push(slab({ x: x - 22, y: y - 13, w: 44, d: 26, r: 3 }, 13, 8, { tone: "mid", crease: "lo", className: "part cartridge-shell" }));
  out.push(slab({ x: x - 18, y: y - 9, w: 36, d: 18, r: 2 }, 21, 2.5, { tone: "lo", crease: "faint", className: "part cartridge-panel" }));
  for (const [sx, sy] of [[-17, -8], [17, -8], [-17, 8], [17, 8]]) out.push(cyl(x + sx, y + sy, 1.25, 23.5, .7, { tone: "hi", className: "part panel-screw" }));

  if (kind === "can") {
    out.push(cyl(x, y, 6.5, 23.5, 10, { tone: "mid", crease: "lo", className: "part module-device" }));
    out.push(cyl(x, y, 2, 33.5, 1, { tone: "hi", className: "part device-cap" }));
  } else if (kind === "coil") {
    for (let n = -4; n <= 4; n += 2) out.push(cyl(x + n * 2.1, y, 3.2, 23.5, 8, { tone: "lo", className: "part module-device" }));
  } else if (kind === "dial" || kind === "gauge") {
    out.push(cyl(x, y, 8, 23.5, 4, { tone: "mid", crease: "lo", className: "part module-device" }));
    out.push(L(k.ring(x, y, 5.7, 27.6, P, 40), { tone: "hi" }));
    const ticks = k.radialTicks(x, y, 5.2, 20, 5, 27.7, [.8, 1.7], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(line3([[x, y, 27.8], [x + 3.8, y - 1.5, 27.8]], { tone: "hi", free: true }));
  } else if (kind === "fuse") {
    out.push(slab({ x: x - 13, y: y - 5, w: 26, d: 10, r: 4 }, 23.5, 6, { tone: "mid", className: "part module-device" }));
    out.push(cyl(x - 11, y, 3, 29.5, 2, { tone: "lo", className: "part fuse-cap" }));
    out.push(cyl(x + 11, y, 3, 29.5, 2, { tone: "lo", className: "part fuse-cap" }));
  } else if (kind === "relay") {
    out.push(slab({ x: x - 11, y: y - 8, w: 22, d: 16, r: 2 }, 23.5, 10, { tone: "mid", crease: "lo", className: "part module-device" }));
    out.push(L(k.planOutline({ x: x - 7, y: y - 4, w: 14, d: 8, r: 1 }, 33.6, P, 3), { tone: "faint" }));
  } else if (kind === "chip") {
    out.push(slab({ x: x - 12, y: y - 8, w: 24, d: 16, r: 2 }, 23.5, 6, { tone: "mid", crease: "lo", className: "part module-device" }));
    for (const py of [-6, -2, 2, 6]) {
      out.push(slab({ x: x - 15, y: y + py - .7, w: 3, d: 1.4, r: .3 }, 24, 1, { tone: "lo", className: "part chip-leg" }));
      out.push(slab({ x: x + 12, y: y + py - .7, w: 3, d: 1.4, r: .3 }, 24, 1, { tone: "lo", className: "part chip-leg" }));
    }
  } else if (kind === "drum") {
    out.push(cyl(x, y, 9, 23.5, 5, { tone: "mid", crease: "lo", className: "part module-device" }));
    out.push(cyl(x, y, 6, 28.5, 4, { tone: "lo", crease: "faint", className: "part archive-drum" }));
    out.push(cyl(x, y, 2, 32.5, 1, { tone: "hi", className: "part drum-hub" }));
  }
  out.push(slab({ x: x - 9, y: y + front * 13, w: 18, d: 3, r: 1 }, 24, 3.5, { tone: "lo", className: "part pull-handle" }));
  out.push(cyl(x + 17, y - 8, 1.6, 23.5, 1.2, { tone: "hi", className: "part status-lamp" }));
  const [nx, ny] = at([x - 17, y + 8, 24]);
  out.push(`<text class="slot-mark" x="${nx.toFixed(1)}" y="${ny.toFixed(1)}">${String(slot).padStart(2, "0")}</text>`);
  return `<g class="backplane-module" data-component="${key}" tabindex="0" role="button" aria-label="Inspect slot ${slot}">${out.join("")}<title>Agent component slot ${slot}</title></g>`;
}

function edgeInstruments() {
  const out = [];
  for (const x of [-150, 150]) {
    out.push(slab({ x: x - 5, y: -36, w: 10, d: 72, r: 2 }, 8, 12, { tone: "mid", className: "part side-rail" }));
    for (const y of [-28, -14, 0, 14, 28]) out.push(cyl(x, y, 1.45, 20, .8, { tone: "hi", className: "part rail-screw" }));
  }
  out.push(cyl(-148, 0, 13, 20, 6, { tone: "mid", crease: "lo", className: "part input-dial" }));
  out.push(L(k.ring(-148, 0, 9.8, 26.1, P, 48), { tone: "lo" }));
  const inputTicks = k.radialTicks(-148, 0, 9.2, 32, 4, 26.2, [1, 2.2], P);
  out.push(L(inputTicks.minor, { tone: "faint" }), L(inputTicks.major, { tone: "mid" }));
  out.push(cyl(148, 0, 12, 20, 10, { tone: "mid", crease: "lo", className: "part output-drum" }));
  out.push(cyl(148, 0, 6, 30, 3, { tone: "lo", className: "part output-hub" }));
  out.push(cyl(148, 0, 2, 33, 1, { tone: "hi", className: "part output-pin" }));
  return out.join("");
}

const body = [foundation(), traces(), busAssembly(), ...modules.map(cartridge), edgeInstruments()].join("");
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  className: "circuit-backplane-svg",
  label: "A wide isometric Agent signal backplane with eight removable component cartridges, twin conductor rails, an input dial, verification carriage and output drum.",
  body,
});

const style = `<style>
:root{--anatomy-bg:#000;--anatomy-top:#171e19;--anatomy-fill:#0e1410;--anatomy-shade-0:#070a08;--anatomy-shade-1:#0b100c;--anatomy-shade-2:#111713;--anatomy-shade-3:#1b241d;--anatomy-hi:#b0beb4;--anatomy-mid:#68766d;--anatomy-lo:#3d4c43;--anatomy-faint:#253229;--anatomy-lit:#7fe03a;--anatomy-lit-shade:#203d20}
svg{display:block;width:100%;height:100%;overflow:visible}.iso-fill{fill:var(--anatomy-fill)}.iso-top{fill:var(--anatomy-top)}.iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}.iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}.iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}.iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}.iso-line{fill:none;stroke:var(--anatomy-lo);stroke-width:.72;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}.iso-line[data-tone="hi"]{stroke:var(--anatomy-hi)}.iso-line[data-tone="mid"]{stroke:var(--anatomy-mid)}.iso-line[data-tone="faint"]{stroke:var(--anatomy-faint)}.iso-edge{stroke:var(--anatomy-mid)}.iso-halo{fill:#7fe03a;opacity:.025;filter:blur(10px)}.iso-dots{fill:var(--anatomy-lo)}[data-lit] .iso-top{fill:var(--anatomy-lit)}[data-lit] .iso-fill{fill:var(--anatomy-lit-shade)}.backplane-module,.backplane-core{cursor:pointer;outline:none;transform-box:fill-box;transform-origin:center;transition:transform .42s cubic-bezier(.2,.8,.2,1),filter .24s ease}.backplane-module.is-active{filter:brightness(1.45);transform:translateY(-8px)}.backplane-core.is-active{filter:brightness(1.28);transform:translateY(-5px)}.backplane-module.is-runtime-online .status-lamp .iso-top,.backplane-module.is-runtime-online .status-lamp .iso-fill{fill:var(--anatomy-lit)}.backplane-route.is-active .route-line{stroke:var(--anatomy-lit);stroke-dasharray:2 7;animation:signal 1.7s linear infinite}.slot-mark,.backplane-mark{fill:#819086;font:500 7px 'IBM Plex Mono',monospace;letter-spacing:.1em;pointer-events:none}.backplane-mark{fill:#d3dcd6;font-size:7px;letter-spacing:.15em}@keyframes signal{to{stroke-dashoffset:-18}}@media(prefers-reduced-motion:reduce){.backplane-route.is-active .route-line{animation:none}}
</style>`;

mkdirSync(join(ROOT, "assets"), { recursive: true });
const output = join(ROOT, "assets", "ohmium-signal-backplane.svg");
writeFileSync(output, svg.replace(/<svg /, `<svg data-figure="signal-backplane" `).replace(">", `>${style}`));
console.log(`wrote assets/ohmium-signal-backplane.svg · ${body.match(/part /g)?.length || 0} modeled parts`);
