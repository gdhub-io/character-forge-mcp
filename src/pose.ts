import { deflateSync } from "node:zlib";

/**
 * A shaded, faceless mannequin in an A-pose, built from the character's own proportions and asymmetries
 * (look.body), used as the control image for fal's pose/depth ControlNet. Drawn without dependencies:
 * per-pixel lit capsules and ellipsoids with a z-buffer, written out as PNG.
 * (Hand-drawn OpenPose skeletons were tried first: the endpoint largely ignored them.)
 */

type Pt = [number, number];
// Keypoint order (COCO-18): nose, neck, r_shoulder, r_elbow, r_wrist, l_shoulder, l_elbow, l_wrist,
// r_hip, r_knee, r_ankle, l_hip, l_knee, l_ankle, r_eye, l_eye, r_ear, l_ear

/** Proportions and asymmetries from the card's look.body; every field is relative, so no body is a template. */
export interface BodyShape {
  head_heights: number;
  shoulders: number;
  hips: number;
  legs: number;
  arms: number;
  shoulder_tilt: number;
  head_tilt: number;
  stoop: number;
  knees: "straight" | "knock" | "bow";
}

export const AVERAGE_BODY: BodyShape = { head_heights: 7.5, shoulders: 1, hips: 1, legs: 1, arms: 1, shoulder_tilt: 0, head_tilt: 0, stoop: 0, knees: "straight" };

/** Arms hang this many degrees below horizontal: a production A-pose. */
const ARM_DROP_DEG = 42;

/**
 * A-pose keypoints for a FRONT view in figure units (y: 0 top of head .. ~1 soles, x around the spine).
 * The character's right side is on screen left.
 */
export function poseKeypoints(b: BodyShape): (Pt | null)[] {
  const head = 1 / b.head_heights;
  const ankleY = 0.97;
  const neckY = head * 1.35;
  const sink = b.stoop * 0.35 * head; // a stoop drops the head toward the shoulders
  // Head cant pivots at the neck; positive turns the crown toward the character's right (screen left).
  const angle = (b.head_tilt * 15 * Math.PI) / 180;
  const facePt = (x: number, y: number): Pt => {
    const dx = x, dy = y + sink - neckY;
    return [dx * Math.cos(angle) + dy * Math.sin(angle), neckY - dx * Math.sin(angle) + dy * Math.cos(angle)];
  };
  // shoulder_tilt > 0 lowers the character's right shoulder, < 0 the left; the whole arm follows it.
  // Shoulder joints sit below the base of the neck (the trapezius slopes down to them).
  // Tilt is exaggerated slightly so it survives repainting: 0.4 ≈ a visible 2-3% of height.
  const drop = 0.13 * Math.abs(b.shoulder_tilt);
  const shoulderY = neckY + head * 0.22;
  const rY = shoulderY + (b.shoulder_tilt > 0 ? drop : 0);
  const lY = shoulderY + (b.shoulder_tilt < 0 ? drop : 0);
  const sw = 0.105 * b.shoulders;
  const arm = 0.33 * b.arms;
  const ax = Math.cos((ARM_DROP_DEG * Math.PI) / 180) * arm;
  const ay = Math.sin((ARM_DROP_DEG * Math.PI) / 180) * arm;
  const hw = 0.06 * b.hips;
  const hipY = Math.max(neckY + 0.2, ankleY - 0.47 * b.legs);
  const kneeY = hipY + 0.52 * (ankleY - hipY);
  const ankleX = hw + 0.015;
  const kneeX = (hw + ankleX) / 2 + (b.knees === "bow" ? 0.03 : b.knees === "knock" ? -0.03 : 0);
  return [
    facePt(0, head * 0.6), // nose
    [0, neckY], // neck
    [-sw, rY], [-sw - ax * 0.46, rY + ay * 0.46], [-sw - ax, rY + ay], // right arm (screen left)
    [sw, lY], [sw + ax * 0.46, lY + ay * 0.46], [sw + ax, lY + ay], // left arm (screen right)
    [-hw, hipY], [-kneeX, kneeY], [-ankleX, ankleY], // right leg
    [hw, hipY], [kneeX, kneeY], [ankleX, ankleY], // left leg
    facePt(-head * 0.17, head * 0.45), facePt(head * 0.17, head * 0.45), // eyes
    facePt(-head * 0.33, head * 0.5), facePt(head * 0.33, head * 0.5), // ears
  ];
}

/** Light from the upper left, toward the viewer. */
const LIGHT = (() => {
  const v = [-0.45, -0.55, 0.7];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();

class Canvas {
  readonly px: Buffer;
  private readonly z: Float32Array;
  /** flat: a solid fill colour instead of lighting (silhouette / mask). */
  constructor(readonly w: number, readonly h: number, bg: number, private readonly flat: number | null = null) {
    this.px = Buffer.alloc(w * h * 3, bg);
    this.z = new Float32Array(w * h).fill(-Infinity);
  }
  /** Colour for the parts drawn next (colour blocking); null = neutral grey. */
  paint: number[] | null = null;
  /** With paint: true = lit colour, false = flat 2D colour patches. */
  litPaint = true;
  private shade(i: number, j: number, depth: number, nx: number, ny: number, nz: number) {
    const k = j * this.w + i;
    if (depth <= this.z[k]) return;
    this.z[k] = depth;
    const lambert = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    if (this.paint) {
      const f = this.litPaint ? 0.45 + 0.75 * lambert : 1;
      for (let c = 0; c < 3; c++) this.px[k * 3 + c] = Math.max(0, Math.min(255, Math.round(this.paint[c] * f)));
      return;
    }
    const v = this.flat ?? Math.round(70 + 165 * lambert);
    this.px[k * 3] = this.px[k * 3 + 1] = this.px[k * 3 + 2] = v;
  }
  /** A tapered capsule from a (radius ra) to b (radius rb), lit as a cylinder with spherical caps. */
  capsule(a: Pt, b: Pt, ra: number, rb: number, zBase = 0) {
    const r = Math.max(ra, rb);
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const len2 = dx * dx + dy * dy || 1;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r)), x1 = Math.min(this.w - 1, Math.ceil(Math.max(a[0], b[0]) + r));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r)), y1 = Math.min(this.h - 1, Math.ceil(Math.max(a[1], b[1]) + r));
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        const t = Math.max(0, Math.min(1, ((i - a[0]) * dx + (j - a[1]) * dy) / len2));
        const cx = a[0] + t * dx, cy = a[1] + t * dy;
        const rr = ra + (rb - ra) * t;
        const ox = i - cx, oy = j - cy;
        const d2 = ox * ox + oy * oy;
        if (d2 > rr * rr) continue;
        const nz = Math.sqrt(1 - d2 / (rr * rr));
        this.shade(i, j, zBase + nz * rr, ox / rr, oy / rr, nz);
      }
  }
  /** An axis-aligned ellipsoid seen from the front. */
  ellipsoid(c: Pt, rx: number, ry: number, zBase = 0) {
    for (let j = Math.max(0, Math.floor(c[1] - ry)); j <= Math.min(this.h - 1, Math.ceil(c[1] + ry)); j++)
      for (let i = Math.max(0, Math.floor(c[0] - rx)); i <= Math.min(this.w - 1, Math.ceil(c[0] + rx)); i++) {
        const ux = (i - c[0]) / rx, uy = (j - c[1]) / ry;
        const q = ux * ux + uy * uy;
        if (q > 1) continue;
        const nz = Math.sqrt(1 - q);
        this.shade(i, j, zBase + nz * Math.min(rx, ry), ux, uy, nz);
      }
  }
  /** A flat-coloured thick line (OpenPose limbs). */
  stroke(a: Pt, b: Pt, r: number, rgb: number[]) {
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1;
    for (let s = 0; s <= steps; s++) {
      const x = a[0] + ((b[0] - a[0]) * s) / steps, y = a[1] + ((b[1] - a[1]) * s) / steps;
      for (let j = Math.max(0, Math.floor(y - r)); j <= Math.min(this.h - 1, Math.ceil(y + r)); j++)
        for (let i = Math.max(0, Math.floor(x - r)); i <= Math.min(this.w - 1, Math.ceil(x + r)); i++)
          if ((i - x) ** 2 + (j - y) ** 2 <= r * r) this.px.set(rgb, (j * this.w + i) * 3);
    }
  }
  png(): Buffer {
    const raw = Buffer.alloc((this.w * 3 + 1) * this.h);
    for (let y = 0; y < this.h; y++) this.px.copy(raw, y * (this.w * 3 + 1) + 1, y * this.w * 3, (y + 1) * this.w * 3);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type: string, data: Buffer): Buffer {
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let crc = 0xffffffff;
  for (const byte of td) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  td.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
  return out;
}

/** Places unit keypoints on the sheet; the back view mirrors left and right. */
function place(unit: (Pt | null)[], view: "front" | "back", cx: number, top: number, height: number): Pt[] {
  return unit.map((p) => {
    const q = p ?? [0, 0];
    const x = view === "front" ? q[0] : -q[0];
    return [cx + x * height, top + q[1] * height] as Pt;
  });
}

/** Zone colours for a concept-artist style colour block-in (#RRGGBB). Left/right are the character's own. */
export interface Blocking {
  hair: string;
  skin: string;
  top: string;
  bottom: string;
  footwear_left: string;
  footwear_right: string;
  /** Things worn on the body that must appear in both views, on the right side. */
  accessories?: { where: AccessorySpot; color: string; size?: "small" | "medium" | "large"; item?: string }[];
}

export const ACCESSORY_SPOTS = ["left_shoulder", "right_shoulder", "chest", "waist", "left_hip", "right_hip", "back", "head"] as const;
export type AccessorySpot = (typeof ACCESSORY_SPOTS)[number];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Draws one mannequin with readable anatomy: skull and jaw, neck, trapezius, ribcage, waist, pelvis, deltoids, tapering limbs with muscle bulges, hands with thumbs, feet. */
function drawMannequin(cv: Canvas, k: Pt[], body: BodyShape, height: number, view: "front" | "back", blocking?: Blocking) {
  const paint = (hex: Exclude<keyof Blocking, "accessories">) => {
    cv.paint = blocking ? rgb(blocking[hex]) : null;
  };
  const H = height / body.head_heights; // one head height in pixels
  const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const add = (p: Pt, dx: number, dy: number): Pt => [p[0] + dx, p[1] + dy];
  const [neck, rS, rE, rW, lS, lE, lW, rH, rK, rA, lH, lK, lA] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => k[i]);
  const earMid = lerp(k[16], k[17], 0.5);
  const tiltX = (k[17][0] - k[16][0]) === 0 ? 0 : (k[17][1] - k[16][1]) / (k[17][0] - k[16][0]); // head cant from the ear line
  const pelvis = lerp(rH, lH, 0.5);
  const sh = body.shoulders, hp = body.hips;

  // Head: cranium plus a narrower jaw, both following the head cant.
  paint("skin");
  cv.ellipsoid(add(earMid, 0, -0.1 * H), 0.38 * H, 0.46 * H, 0.32 * H);
  cv.ellipsoid(add(earMid, -tiltX * 0.2 * H, 0.14 * H), 0.31 * H, 0.33 * H, 0.26 * H);
  if (blocking) {
    // Hair mass: a cap and side falls from the front; from the back it covers the whole head.
    paint("hair");
    if (view === "front") {
      cv.ellipsoid(add(earMid, 0, -0.32 * H), 0.43 * H, 0.3 * H, 0.42 * H);
      for (const sx of [-1, 1]) cv.capsule(add(earMid, sx * 0.36 * H, -0.2 * H), add(earMid, sx * 0.36 * H, 0.3 * H), 0.12 * H, 0.1 * H, 0.3 * H);
    } else {
      cv.ellipsoid(add(earMid, 0, -0.02 * H), 0.44 * H, 0.52 * H, 0.6 * H);
    }
  }
  // Neck and the trapezius slope down to each shoulder.
  cv.capsule(neck, add(earMid, -tiltX * 0.3 * H, 0.3 * H), 0.24 * H, 0.2 * H, 0.12 * H);
  paint("top");
  cv.capsule(add(neck, -0.1 * H, -0.05 * H), rS, 0.28 * H, 0.27 * H, 0.2 * H);
  // The shoulder girdle follows any tilt, so a lowered shoulder reads in the silhouette, not just at the joint.
  cv.capsule(rS, lS, 0.3 * H, 0.3 * H, 0.22 * H);
  cv.capsule(add(neck, 0.1 * H, -0.05 * H), lS, 0.28 * H, 0.27 * H, 0.2 * H);
  // Ribcage (egg), waist, pelvis.
  // Proportions in head heights (8-head canon): chest ~1.6 wide, waist ~1.2, pelvis ~1.5.
  // Ribcage as a tapering block (wide at the armpits, narrowing to the waist), then belly into the pelvis.
  cv.capsule(add(neck, 0, 0.62 * H), add(neck, 0, 1.75 * H), 0.74 * H * sh ** 0.5, 0.56 * H * sh ** 0.3, 0.3 * H);
  paint("bottom");
  cv.capsule(add(neck, 0, 1.75 * H), add(pelvis, 0, -0.35 * H), 0.56 * H * sh ** 0.3, 0.62 * H * hp, 0.27 * H);
  cv.ellipsoid(add(pelvis, 0, -0.1 * H), 0.78 * H * hp, 0.5 * H, 0.25 * H); // pelvis

  for (const [s, e, w, side] of [[rS, rE, rW, -1], [lS, lE, lW, 1]] as [Pt, Pt, Pt, number][]) {
    paint("top");
    cv.ellipsoid(s, 0.33 * H, 0.33 * H, 0.38 * H); // deltoid
    cv.capsule(s, lerp(s, e, 0.45), 0.3 * H, 0.26 * H, 0.36 * H); // biceps bulge
    cv.capsule(lerp(s, e, 0.45), e, 0.26 * H, 0.19 * H, 0.36 * H);
    cv.capsule(e, lerp(e, w, 0.3), 0.2 * H, 0.23 * H, 0.36 * H); // forearm swell
    cv.capsule(lerp(e, w, 0.3), w, 0.23 * H, 0.14 * H, 0.36 * H);
    const dx = w[0] - e[0], dy = w[1] - e[1];
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n, uy = dy / n;
    paint("skin");
    cv.capsule(w, add(w, ux * 0.7 * H, uy * 0.7 * H), 0.17 * H, 0.13 * H, 0.38 * H); // palm and fingers
    cv.capsule(add(w, ux * 0.12 * H, uy * 0.12 * H), add(w, ux * 0.36 * H - side * uy * 0.2 * H, uy * 0.36 * H + side * ux * 0.2 * H), 0.075 * H, 0.065 * H, 0.42 * H); // thumb
  }
  for (const [hip, kn, an, side] of [[rH, rK, rA, -1], [lH, lK, lA, 1]] as [Pt, Pt, Pt, number][]) {
    paint("bottom");
    cv.capsule(hip, lerp(hip, kn, 0.35), 0.46 * H * hp ** 0.5, 0.4 * H, 0.3 * H); // upper thigh
    cv.capsule(lerp(hip, kn, 0.35), kn, 0.4 * H, 0.25 * H, 0.3 * H);
    cv.ellipsoid(kn, 0.25 * H, 0.26 * H, 0.33 * H);
    cv.capsule(kn, lerp(kn, an, 0.35), 0.25 * H, 0.29 * H, 0.3 * H); // calf bulge
    cv.capsule(lerp(kn, an, 0.35), an, 0.29 * H, 0.14 * H, 0.3 * H);
    // Footwear: the character's right leg is side -1 (screen left in the front view, screen right from the back).
    paint(side < 0 ? "footwear_right" : "footwear_left");
    if (blocking) cv.capsule(lerp(kn, an, 0.5), an, 0.31 * H, 0.17 * H, 0.34 * H); // boot shaft
    cv.ellipsoid(add(an, side * 0.1 * H, 0.16 * H), 0.26 * H, 0.17 * H, 0.42 * H); // foot, toes slightly out
  }
  if (view === "front") {
    // Eye marks: tell the model the face looks straight at the camera.
    cv.paint = [40, 34, 32];
    for (const sx of [-1, 1]) cv.ellipsoid(add(earMid, sx * 0.14 * H - tiltX * 0.05 * H, 0.02 * H + sx * tiltX * 0.14 * H), 0.05 * H, 0.035 * H, 0.75 * H);
  }
  for (const a of blocking?.accessories ?? []) {
    cv.paint = rgb(a.color);
    const r = (a.size === "small" ? 0.16 : a.size === "large" ? 0.45 : 0.3) * H;
    // Front-only and back-only items sit behind the body in the other view (the z-buffer hides them).
    const shown = a.where === "chest" ? view === "front" : a.where === "back" ? view === "back" : true;
    const z = shown ? 1.8 * H : -2 * H; // in front of the torso's surface (~1.1 H deep)
    if (a.where === "left_shoulder" || a.where === "right_shoulder") {
      const sp = a.where === "left_shoulder" ? lS : rS;
      cv.ellipsoid(add(sp, 0, -0.18 * H), r * 1.1, r * 0.85, z);
    } else if (a.where === "chest") cv.ellipsoid(add(neck, 0, 0.75 * H), r, r, z);
    else if (a.where === "back") cv.ellipsoid(add(neck, 0, 1.1 * H), r * 1.4, r * 1.8, z);
    else if (a.where === "head") cv.ellipsoid(add(earMid, 0, -0.55 * H), r * 1.3, r * 0.7, z);
    else if (a.where === "waist") cv.capsule(add(pelvis, -0.62 * H * hp, -0.55 * H), add(pelvis, 0.62 * H * hp, -0.55 * H), r * 0.4, r * 0.4, 1.2 * H);
    else {
      const hipPt = a.where === "left_hip" ? lH : rH;
      cv.ellipsoid(add(hipPt, (a.where === "left_hip" ? lH[0] - rH[0] : rH[0] - lH[0]) > 0 ? 0.35 * H : -0.35 * H, 0.1 * H), r * 0.7, r, z);
    }
  }
  cv.paint = null;
}

export type PoseLayout = "front" | "front-back";
/**
 * "shaded": a lit grey 3D mannequin; "flat": a solid dark silhouette on light grey; "mask": a white silhouette on black;
 * "blocking": flat 2D colour patches per zone, like a concept artist's block-in; "blocking-lit": the same colours with volume.
 * "skeleton": an OpenPose (COCO-18) stick figure on black, for editors that take a pose reference.
 * The blocking styles need look.blocking and fall back to "shaded" without it.
 */
export type FigureStyle = "shaded" | "flat" | "mask" | "blocking" | "blocking-lit" | "skeleton";

/** PNG of a mannequin sheet in an A-pose for this body: one front figure (2:3) or front + back side by side (3:2). */
export function mannequinPng(layout: PoseLayout, body: BodyShape = AVERAGE_BODY, style: FigureStyle = "shaded", blocking?: Blocking): { png: Buffer; width: number; height: number } {
  const colour = style.startsWith("blocking") && blocking ? blocking : undefined;
  const [w, h] = layout === "front" ? [1024, 1536] : [1536, 1024];
  const cv = style === "mask" || style === "skeleton" ? new Canvas(w, h, 0, 255) : new Canvas(w, h, 238, style === "flat" ? 40 : null);
  cv.litPaint = !(style === "blocking" && colour); // without zone colours "blocking" is exactly the grey mannequin
  const n = layout === "front" ? 1 : 2;
  const unit = poseKeypoints(body);
  const span = 2 * Math.max(...unit.filter((p): p is Pt => p !== null).map((p) => Math.abs(p[0]))) + 0.1;
  const figH = Math.min(h * 0.84, ((w / n) * 0.8) / span);
  const top = (h - figH) / 2;
  const views: ["front" | "back", number][] = n === 1 ? [["front", w / 2]] : [["front", w * 0.27], ["back", w * 0.73]];
  for (const [view, cx] of views) {
    const pts = place(unit, view, cx, top, figH);
    if (style === "skeleton") drawSkeleton(cv, pts, view, h);
    else drawMannequin(cv, pts, body, figH, view, colour);
  }
  return { png: cv.png(), width: w, height: h };
}


// OpenPose (COCO-18) limbs and their standard colours.
const LIMBS: [number, number][] = [
  [1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10],
  [1, 11], [11, 12], [12, 13], [1, 0], [0, 14], [14, 16], [0, 15], [15, 17],
];
const LIMB_RGB: number[][] = [
  [255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0], [85, 255, 0], [0, 255, 0],
  [0, 255, 85], [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255],
  [170, 0, 255], [255, 0, 255], [255, 0, 170], [255, 0, 85],
];

/** An OpenPose stick figure; the back view hides the face points so it reads as facing away. */
function drawSkeleton(cv: Canvas, pts: Pt[], view: "front" | "back", h: number) {
  const hidden = view === "back" ? new Set([0, 14, 15]) : new Set<number>();
  const r = Math.max(3, Math.round(h / 170));
  LIMBS.forEach(([a, b], i) => {
    if (!hidden.has(a) && !hidden.has(b)) cv.stroke(pts[a], pts[b], r, LIMB_RGB[i].map((v) => Math.round(v * 0.6)));
  });
  pts.forEach((p, i) => !hidden.has(i) && cv.stroke(p, p, r + 1, LIMB_RGB[i]));
}
