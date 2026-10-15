import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as k from "./anatomy/iso-kit.mjs";

const WIDTH = 320;
const HEIGHT = 210;
const PLATE = { x: -72, y: -48, w: 144, d: 96, r: 7 };
const ids = ["ohm-sense", "ohm-filter", "ohm-oracle", "ohm-guard", "ohm-router", "ohm-memory", "ohm-archive", "ohm-verify"];
const specs = {
  "ohm-sense": { type: "logic", variant: 0, label: "Sensor acquisition board" },
  "ohm-filter": { type: "logic", variant: 1, label: "Resistor filter bank" },
  "ohm-oracle": { type: "logic", variant: 2, label: "Measurement oscillator" },
  "ohm-guard": { type: "rack", variant: 0, label: "Policy fuse cabinet" },
  "ohm-router": { type: "stack", variant: 0, label: "Signal routing stack" },
  "ohm-memory": { type: "stack", variant: 1, label: "Capacitor memory stack" },
  "ohm-archive": { type: "rack", variant: 1, label: "Artifact archive rack" },
  "ohm-verify": { type: "rack", variant: 2, label: "Replay comparator rack" }
};

const byDepth = (points, P) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const S = (paths, style) => k.solidSvg(paths, style);
const L = (path, style) => k.lineSvg(path, style);
const D = (points, style) => k.dotsSvg(points, style);

function projection(top = 72) {
  return k.fitProjection([...k.boxCorners(PLATE, -8, 5), [-65, -42, top], [65, 42, top]], WIDTH, HEIGHT, { pad: 17, azimuth: 43, elevation: 31 });
}

function base(P) {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -8, 8, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 13), P)) {
    out.push(S(k.cylinder(x, y, 4.8, -8, 2, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 3.7, -6, 3, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -3, 8, P, 8, 1.2), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4), 5, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 5.1, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => k.iso([x, y, 5.2], P)), { size: 0.48, tone: "hi" }));
  out.push(D(k.dotGrid(-60, -36, 13, 8, 9, 5.15, P), { size: 0.22, tone: "faint" }));
  const label = { x: -60, y: 34, w: 35, d: 7, r: 1 };
  out.push(S(k.slabOf(label, 5, 0.7, P, 3), { tone: "lo", flat: true }));
  out.push(L(k.lineOnTop([-56, 37], [-33, 37], 5.8, P), { tone: "mid", free: "both" }));
  return out;
}

function lamp(P, x = 50, y = 30, z = 5) {
  return `<g data-part="status-lamp">${S(k.cylinder(x, y, 4.2, z, 2.2, P, 24), { tone: "mid" })}${S(k.cylinder(x, y, 2.2, z + 2.2, 3, P, 24), { tone: "hi", lit: true })}${L(k.sideArc(x, y, 2.2, z + 3.6, P, 18), { tone: "lit" })}</g>`;
}

function logic(spec) {
  const P = projection(48), out = base(P);
  const chips = spec.variant === 1 ? [[-42, -19], [-7, -19], [28, -19]] : [[-40, -20], [4, -20], [-18, 12], [27, 12]];
  chips.forEach(([x, y], index) => {
    const plan = { x, y, w: spec.variant === 1 ? 27 : 29, d: 22, r: 2.5 };
    out.push(S(k.slabOf(plan, 5, 7 + (index % 2), P, 5, 0.7), { tone: index === spec.variant ? "hi" : "mid", lit: index === spec.variant }));
    out.push(L(k.planOutline(k.insetPlan(plan, 2.2), 12 + (index % 2), P, 4), { tone: "faint" }));
    for (let pin = 0; pin < 5; pin += 1) {
      const py = y + 3 + pin * 3.4;
      out.push(S(k.slabOf({ x: x - 2.3, y: py, w: 2.3, d: 1.2, r: .2 }, 5.1, 1, P, 2), { tone: "hi", crease: "none" }));
      out.push(S(k.slabOf({ x: x + plan.w, y: py, w: 2.3, d: 1.2, r: .2 }, 5.1, 1, P, 2), { tone: "hi", crease: "none" }));
    }
  });
  const buses = [[-55, -31, 44, -31], [-55, 4, 55, 4], [-52, 30, 42, 30], [-2, -38, -2, 36]];
  buses.forEach(([x1, y1, x2, y2], index) => out.push(L(k.lineOnTop([x1, y1], [x2, y2], 5.4 + index * .02, P), { tone: index === spec.variant ? "lit" : "lo" })));
  if (spec.variant === 0) {
    [-44, -17, 10].forEach((x) => { out.push(S(k.cylinder(x, 30, 4, 5, 5, P, 24), { tone: "mid" })); out.push(L(k.knurl(x, 30, 4, 6, 10, 20, P), { tone: "lo" })); });
  } else if (spec.variant === 1) {
    [-48, -28, -8, 12, 32].forEach((x, index) => { out.push(S(k.cylinder(x, 31, 3.4, 5, 10 + index % 2 * 3, P, 24), { tone: index === 2 ? "hi" : "mid", lit: index === 2 })); out.push(L(k.sideArc(x, 31, 3.4, 11, P, 16), { tone: "lo" })); });
  } else {
    out.push(S(k.cylinder(-42, 29, 13, 5, 6, P, 40, .6), { tone: "hi", lit: true }));
    const ticks = k.radialTicks(-42, 29, 10, 24, 4, 11.2, [1.2, 2.2], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "hi" }));
    out.push(L(k.lineOnTop([-42, 29], [-35, 35], 11.4, P), { tone: "lit" }));
  }
  out.push(lamp(P));
  return k.figureSvg({ width: WIDTH, height: HEIGHT, label: spec.label, className: "iso ohmium-agent-model", body: out });
}

function rack(spec) {
  const P = projection(88), out = base(P);
  const shell = { x: -47, y: -31, w: 94, d: 63, r: 5 };
  out.push(S(k.slabOf(shell, 5, 66, P, 6, 1.2), { tone: "mid" }));
  out.push(L(k.sideSeam(shell, 61, P, 6), { tone: "lo" }));
  const faceY = shell.y - .4;
  for (let row = 0; row < 5; row += 1) {
    const z = 11 + row * 10;
    const tray = { x: -40, y: faceY - 2, w: 80, d: 3, r: .7 };
    out.push(S(k.slabOf(tray, z, 7, P, 3, .3), { tone: row === spec.variant + 1 ? "hi" : "lo", lit: row === spec.variant + 1 }));
    const ports = Array.from({ length: spec.variant === 1 ? 8 : 6 }, (_, index) => k.iso([-32 + index * (spec.variant === 1 ? 8 : 10), faceY - 2.4, z + 3.5], P));
    out.push(D(ports, { size: .55, tone: row === spec.variant + 1 ? "lit" : "mid" }));
    out.push(L(k.sideTicks(-35, 35, 5, 2, faceY - 2.6, z + 6.2, [1.2, 2], P, "x"), { tone: "faint" }));
  }
  for (const x of [-31, 0, 31]) {
    out.push(S(k.cylinder(x, 1, 8.5, 71, 3.5, P, 32, .4), { tone: "lo" }));
    out.push(L(k.ring(x, 1, 5.8, 74.6, P, 24), { tone: "mid" }));
    const spokes = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => k.lineOnTop([x + Math.cos(angle) * 1.5, 1 + Math.sin(angle) * 1.5], [x + Math.cos(angle) * 5.2, 1 + Math.sin(angle) * 5.2], 74.7, P));
    out.push(L(spokes.join(""), { tone: "lo" }));
  }
  [-42, 42].forEach((x) => { out.push(S(k.slabOf({ x: x - 2, y: -35, w: 4, d: 7, r: 1 }, 7, 58, P, 3, .4), { tone: "hi" })); out.push(D([k.iso([x, -36, 15], P), k.iso([x, -36, 56], P)], { size: .55 })); });
  out.push(lamp(P, 35, -34, 58));
  return k.figureSvg({ width: WIDTH, height: HEIGHT, label: spec.label, className: "iso ohmium-agent-model", body: out });
}

function stack(spec) {
  const P = projection(76), out = base(P);
  for (let level = 0; level < 4; level += 1) {
    const inset = level * 3;
    const plan = { x: -50 + inset, y: -28 + inset, w: 100 - inset * 2, d: 56 - inset * 2, r: 5 };
    const z = 6 + level * 14;
    out.push(S(k.slabOf(plan, z, 8, P, 6, .8), { tone: level === 2 ? "hi" : "mid", lit: level === 2 }));
    out.push(L(k.sideSeam(plan, z + 4, P, 6), { tone: "faint" }));
    out.push(D(k.corners(plan, 7).map(([x, y]) => k.iso([x, y, z + 8.1], P)), { size: .45, tone: "hi" }));
  }
  for (let card = 0; card < 4; card += 1) {
    const x = -58 + card * 24;
    const plan = { x, y: 31, w: 19, d: 10, r: 1.5 };
    out.push(S(k.slabOf(plan, 5, 5 + card * 3, P, 4, .4), { tone: card === spec.variant + 1 ? "hi" : "mid", lit: card === spec.variant + 1 }));
    out.push(D([k.iso([x + 5, 35, 11 + card * 3], P), k.iso([x + 10, 35, 11 + card * 3], P), k.iso([x + 15, 35, 11 + card * 3], P)], { size: .4, tone: "lo" }));
  }
  if (spec.variant === 1) {
    [-30, -10, 10, 30].forEach((x, index) => { out.push(S(k.cylinder(x, -4, 6, 62, 10 + index % 2 * 4, P, 28), { tone: index === 2 ? "hi" : "mid", lit: index === 2 })); out.push(L(k.sideArc(x, -4, 6, 69, P, 20), { tone: "lo" })); });
  } else {
    [[-39, -18, 39, -18], [-39, 0, 39, 0], [-39, 18, 39, 18]].forEach(([x1, y1, x2, y2], index) => out.push(L(k.lineOnTop([x1, y1], [x2, y2], 62.2 + index * .03, P), { tone: index === 1 ? "lit" : "lo" })));
  }
  out.push(lamp(P, 42, 24, 62));
  return k.figureSvg({ width: WIDTH, height: HEIGHT, label: spec.label, className: "iso ohmium-agent-model", body: out });
}

const models = Object.fromEntries(ids.map((id) => {
  const spec = specs[id];
  return [id, spec.type === "logic" ? logic(spec) : spec.type === "rack" ? rack(spec) : stack(spec)];
}));

const theme = `${k.ISO_CSS}\n.ohmium-agent-model{--anatomy-paper:#010301;--anatomy-face:#071008;--anatomy-top:#08120a;--anatomy-shade-0:#020503;--anatomy-shade-1:#030804;--anatomy-shade-2:#050b06;--anatomy-shade-3:#071008;--anatomy-lit-top:#112417;--anatomy-lit-shade:#0b1a0f;--anatomy-hi:#87a88d;--anatomy-mid:#496651;--anatomy-lo:#263c2c;--anatomy-faint:#17251b;--anatomy-lit:#7fe03a;--anatomy-dot:#7fe03a;--anatomy-halo:#000;--anatomy-halo-opacity:.95}.live-agent-card.is-online [data-part=status-lamp] .iso-top{fill:#7fe03a}.live-agent-card.is-online [data-part=status-lamp]{filter:drop-shadow(0 0 5px rgba(127,224,58,.45))}`;
const output = `(() => { if (!document.getElementById("ohmium-anatomy-css")) { const style = document.createElement("style"); style.id = "ohmium-anatomy-css"; style.textContent = ${JSON.stringify(theme)}; document.head.append(style); } window.OhmiumAgentModels = Object.freeze(${JSON.stringify(models)}); })();\n`;
writeFileSync(resolve("agent-models.js"), output);
console.log(`Agent models: ${ids.length}, ${Buffer.byteLength(output)} bytes`);
