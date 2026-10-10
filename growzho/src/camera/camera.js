import HL from './kernel.js'

/**
 * Camera: a DSLR on a tripod. The pointer is projected onto a plane just below
 * the lens, and the camera pans and tilts to look at that point, each angle on
 * its own spring. At rest it looks down and a little to the left. The lens is
 * the one bright place: it is where the camera is looking. The slider is the
 * swing: how much of the way to the pointer the camera turns.
 *
 * The pattern: aim. A hit test on a plane that never moves, two springs, and
 * a part whose paint order is sorted by depth each time it turns.
 */
const {
  Cam, circ, clamp, fillet, fit, mk, poly, pointer, proj, put, rad, register, rings, ringAt, solid,
  prism, spring, stepS, unproj, disposer,
} = HL;

const HP = 74, CS = 1.15, PZ = HP + 3, HUB = 46, RF = 44, ZA = PZ - 18, REST = [62, -7], LO = -24, HI = 0;
const LZ = 12, SPIN = [0, 45, 90, 135, 180, 225, 270, 315];
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const lens = (r) => [circ(r, 28), circ(r - 1.2, 28)];

/** The camera's parts, each a ring and its extent. ax 1 stands along the lens axis. [u, v, w] is the centre, for depth. */
const PARTS = [
  { rg: rings(-9, -6.5, 9, 6.5, 1.6, 0.7), z: [0, 2.2], c: [0, 0, 1.1] },
  { rg: rings(-8, -15, 8, 15, 3.4, 1.2), z: [2.2, 21], c: [0, 0, 11.6] },
  { rg: rings(-7, -5.5, 4, 5.5, 3, 1), z: [21, 27], c: [-1.5, 0, 24] },
  { rg: rings(1, 9, 12.5, 15.5, 3, 1), z: [3.5, 19], c: [6.8, 12.2, 11.2] },
  { ax: 1, rg: lens(7), z: [8, 14], c: [11, 0, LZ] },
  { ax: 1, rg: lens(8.4), z: [14, 28], c: [21, 0, LZ] },
  { ax: 1, rg: [circ(9.2, 28), null], z: [18, 24], c: [21, 0, LZ], bias: 0.5 },
  { ax: 1, rg: lens(9.8), z: [28, 34], c: [31, 0, LZ], glass: 5.4 },
];

/** Turns a point of the camera's own frame (u forward, v across, w up) about the head: tilt, then pan. */
function turn(pan, tilt) {
  const cp = Math.cos(rad(pan)), sp = Math.sin(rad(pan)), ct = Math.cos(rad(tilt)), st = Math.sin(rad(tilt));
  return (u, v, w) => { const a = u * ct - w * st; return [CS * (a * cp - v * sp), CS * (a * sp + v * cp), CS * (u * st + w * ct)]; };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2.1);
  const feet = [225, 105, 345].map((a) => [RF * Math.cos(rad(a)), RF * Math.sin(rad(a)), 0]);
  const reach = [[...feet[0]], [...feet[1]], [...feet[2]], [0, 0, PZ]];
  for (const p of SPIN) for (const t of [LO, HI]) for (const u of [-9, 35]) for (const v of [-16, 16]) for (const w of [-2, 28]) {
    const q = turn(p, t)(u, v, w); reach.push([q[0], q[1], PZ + q[2]]);
  }
  fit(C, reach, 200, 166);
  const P = proj(C), S = Math.sin(C.az), K = Math.cos(C.az);

  // The tripod never moves: the far leg, the column, the near legs, the collar and the ball head.
  const g = mk("g", {}, svg);
  const column = prism, tube = (a, b, w0, w1) => {
    const A = P(...a), B = P(...b), l = Math.hypot(B[0] - A[0], B[1] - A[1]), nx = -(B[1] - A[1]) / l, ny = (B[0] - A[0]) / l;
    const q = [[A[0] + nx * w0, A[1] + ny * w0], [B[0] + nx * w1, B[1] + ny * w1], [B[0] - nx * w1, B[1] - ny * w1], [A[0] - nx * w0, A[1] - ny * w0]];
    const f = P(...b);
    mk("ellipse", { cx: f[0], cy: f[1], rx: 3.4, ry: 1.7 }, g);
    mk("path", { d: poly(fillet(q, [0.9, 0.9, 0.9, 0.9], 3)), class: "sil" }, g);
  };
  const front = (q) => q.nu * S + q.nv * K >= -1e-6;
  const leg = (f) => tube([f[0] * 0.08, f[1] * 0.08, HUB + 4], f, 1.5, 1);
  leg(feet[0]);
  put(solid(g), column(P, front, circ(2.2, 12), circ(1.2, 12), HUB - 2, HP - 2));
  leg(feet[1]); leg(feet[2]);
  put(solid(g), column(P, front, circ(4.6, 14), circ(3.4, 14), HUB - 4, HUB + 3));
  const hb = P(0, 0, HP - 0.5);
  mk("ellipse", { cx: hb[0], cy: hb[1], rx: 3.6 * C.S * 0.8, ry: 3.6 * C.S * 0.8 }, g);

  const cam = mk("g", {}, g);
  const parts = PARTS.map((p) => ({ ...p, el: solid(cam) }));
  const yaw = spring(REST[0], { eps: 0.05 }), pit = spring(REST[1], { eps: 0.05 });
  let swing = value, over = null, ly = NaN, lp = NaN, order = "";

  function draw(pan, tilt) {
    if (pan === ly && tilt === lp) return;
    ly = pan; lp = tilt;
    const R = turn(pan, tilt), at = (u, v, w) => { const q = R(u, v, w); return P(q[0], q[1], PZ + q[2]); };
    const dir = (u, v, w) => { const q = R(u, v, w); return q[0] * 0.612 + q[1] * 0.612 + q[2] * 0.5 > 0; };
    for (const p of parts) {
      const m = p.ax ? (a, b, c) => at(c, a, LZ + b) : at;
      const fr = (q) => { const n = p.ax ? R(0, q.nu, q.nv) : R(q.nu, q.nv, 0); return n[0] * S + n[1] * K >= -1e-6; };
      const [ring, inner] = p.rg, [z0, z1] = p.z;
      const d = prism(m, fr, ring, p.ax ? null : inner, z0, z1);
      if (p.ax && inner && dir(1, 0, 0)) {
        d.crease = poly(ringAt(m, inner, z1)) + (p.glass ? poly(ringAt(m, circ(p.glass, 28), z1 - 0.6)) : "");
      }
      put(p.el, d);
      p.el.sil.classList.toggle("hi", !!p.ax);
      const q = R(...p.c);
      p.key = q[0] + q[1] + 0.8165 * q[2] + (p.bias || 0);
    }
    const sorted = parts.slice().sort((a, b) => a.key - b.key), sig = sorted.map((p) => parts.indexOf(p)).join();
    if (sig !== order) { order = sig; for (const p of sorted) cam.appendChild(p.el.g); }
  }

  const B = register(stage, (dt) => {
    const a = stepS(yaw, dt), b = stepS(pit, dt);
    draw(yaw.x, pit.x);
    return a || b;
  });
  bag.add(B.unregister);

  function retarget() {
    if (!over) { yaw.t = REST[0]; pit.t = REST[1]; read.textContent = "rest"; B.wake(); return; }
    const [x, y] = over, d = Math.max(Math.hypot(x, y), 20);
    const pan = REST[0] + swing * wrap((Math.atan2(y, x) * 180) / Math.PI - REST[0]);
    const tilt = REST[1] + swing * (clamp((-Math.atan2(PZ - ZA, d) * 180) / Math.PI, LO, HI) - REST[1]);
    yaw.t = pan; pit.t = tilt;
    read.textContent = `pan ${Math.round(wrap(pan))} tilt ${Math.round(-tilt)}`;
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => { over = unproj(C, p[0], p[1], ZA); retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { swing = v; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

export default {
  name: "camera",
  means: "A camera on a tripod turns its lens to look at the pointer, and settles back when it leaves.",
  range: [0.5, 0.8, 1],
  tour: [[96, 190], [310, 120], [220, 250], null],
  mount,
}