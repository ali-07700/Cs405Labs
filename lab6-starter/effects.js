// CS405 Lab 6 (STARTER) — NPR post-processing passes in Three.js r187 (WebGPURenderer + TSL).
// Each effect is a function (c, p) → a TSL node of type vec3: the LINEAR colour of this pixel.
// The RenderPipeline in main.js runs it once per screen pixel (a full-screen pass, Week 7)
// and only afterwards converts linear → sRGB for the display.
//
//   c.color      linear RGB of the rendered scene at this pixel        (vec3)
//   c.C(i, j)    the same, i pixels to the right and j pixels down       (vec3)
//   c.N(i, j)    view-space normal at that pixel, unit length            (vec3)
//   c.Z(i, j)    distance from the camera along the view axis (linear)   (float)
//   c.Zraw(i, j) the value stored in the depth buffer, in [0, 1]          (float)
//   c.pixel      this pixel's position in pixels (x right, y down)        (vec2)
//   p.levels, p.spacing, p.threshold: uniforms from the sliders; p.radius: a JS number (Kuwahara)

import { vec2, vec3, float, screenUV, screenSize, screenCoordinate, uniform, luminance, select,
         step, sqrt, clamp,floor, min, max, unpackRGBToNormal, perspectiveDepthToViewZ } from 'three/tsl';

export function makeContext(scenePass, camera) {
  const colorTex = scenePass.getTextureNode('output');
  const normalTex = scenePass.getTextureNode('normal');
  const depthTex = scenePass.getTextureNode('depth');
  const near = uniform(camera.near), far = uniform(camera.far);
  const texel = vec2(1).div(screenSize);                     // one pixel in uv units
  const at = (i, j) => screenUV.add(texel.mul(vec2(i, j)));
  return {
    color: colorTex.rgb,
    C: (i, j) => colorTex.sample(at(i, j)).rgb,
    N: (i, j) => unpackRGBToNormal(normalTex.sample(at(i, j)).rgb),
    Zraw: (i, j) => depthTex.sample(at(i, j)).x,
    Z: (i, j) => perspectiveDepthToViewZ(depthTex.sample(at(i, j)).x, near, far).negate(),
    pixel: screenCoordinate.xy,
  };
}

// ---------------------------------------------------------------- Part 1 · point operations
// TODO 1 — grayscale: Y = 0.2126 R + 0.7152 G + 0.0722 B on LINEAR values (Week 7, slide 18)
export function grayscale(c, p) {
  // your code: use luminance(...) on c.color, return vec3(Y)
  const Y = luminance(c.color);
  return vec3(Y);
}

// TODO 2 — posterize: p.levels flat brightness levels, keeping the hue (Week 7 live code)
export function posterize(c, p) {
  // your code: Y = luminance(c.color); q = (floor(Y · levels) + 0.5) / levels; scale the colour by q / Y
  const Y = luminance(c.color);
  const q = floor(Y.mul(p.levels)).add(0.5).div(p.levels);
  return c.color.mul(q).div(max(Y, 1e-5));  
}

// ---------------------------------------------------------------- Part 2 · edges
// Sobel on any function f(i, j) (Week 7): returns the gradient length
function sobel(f) {
  const gx = f(1, -1).add(f(1, 0).mul(2)).add(f(1, 1)).sub(f(-1, -1)).sub(f(-1, 0).mul(2)).sub(f(-1, 1));
  const gy = f(-1, 1).add(f(0, 1).mul(2)).add(f(1, 1)).sub(f(-1, -1)).sub(f(0, -1).mul(2)).sub(f(1, -1));
  return sqrt(gx.mul(gx).add(gy.mul(gy)));
}

// TODO 3 — outlines from LINEAR depth: the gradient of Z, relative to Z, above p.threshold → ink
export function depthEdge(c, p) {
  // your code: e = sobel(c.Z) / c.Z(0, 0); return step(p.threshold, e)
  const e = sobel(c.Z).div(c.Z(0, 0));
  return step(p.threshold, e);
}
export function edgesDepth(c, p) {
  return vec3(depthEdge(c, p).oneMinus());
}

// TODO 4 — add creases from the normals: 1 − min(n0·n1, n0·n2) > 0.2 (Week 7 live code)
export function allEdges(c, p) {
  // your code: n0 = c.N(0, 0), n1 = c.N(1, 0), n2 = c.N(0, 1); crease = 1 − min(n0·n1, n0·n2)
  // return the larger of depthEdge(c, p) and step(0.2, crease)
  const n0 = c.N(0, 0);
  const n1 = c.N(1, 0);
  const n2 = c.N(0, 1);
  const crease = float(1).sub(min(n0.dot(n1), n0.dot(n2)));
  return max(depthEdge(c, p), step(0.2, crease));
}
export function edgesColour(c, p) {
  return c.color.mul(allEdges(c, p).oneMinus());
}

// ---------------------------------------------------------------- Part 3 · marks (Monday, Levels 1–2)
// TODO 5 — Bayer 4 × 4 ordered dithering on the linear luminance
// M2 = [[0, 2], [3, 1]] for one bit of x and y;  M4 = 4 · M2(low bits) + M2(high bits)  (Monday, slide 7)
export function bayer(c, p) {
  const x = floor(c.pixel.x);
  const y = floor(c.pixel.y);
  const low = x.mod(2).sub(y.mod(2)).abs().mul(2).add(y.mod(2));
  const high = x.div(2).floor().mod(2).sub(y.div(2).floor().mod(2)).abs().mul(2).add(y.div(2).floor().mod(2));
  const m4 = low.mul(4).add(high);
  const t = m4.add(0.5).div(16);
  return vec3(step(t, luminance(c.color)));
}

// TODO 6 — screen-space hatching: one set of lines while ink ≤ 0.42, then two crossing sets
// one set: coverage of a pixel row = clamp(ink · s − (y mod s), 0, 1);  two sets: a = 1 − √T each
export function hatchInk(T, c, p) {
  // your code: return the INK (0 = paper, 1 = black) for linear tone T at this pixel (Monday, slide 23 presets 1 and 2)
  const pixel = floor(c.pixel);
  const ink = float(1).sub(T);

  const set1 = clamp(ink.mul(p.spacing).sub(pixel.y.mod(p.spacing)), 0, 1);

  const a = float(1).sub(sqrt(max(T, 0)));
  const hLine = clamp(a.mul(p.spacing).sub(pixel.y.mod(p.spacing)), 0, 1);
  const vLine = clamp(a.mul(p.spacing).sub(pixel.x.mod(p.spacing)), 0, 1);
  const set2 = max(hLine, vLine);

  return select(ink.lessThanEqual(0.42), set1, set2);
    // TODO 6 (flat grey for now — no lines)
}
export function hatch(c, p) {
  return vec3(hatchInk(luminance(c.color), c, p).oneMinus());
}

// ---------------------------------------------------------------- Part 4 · Kuwahara (Monday, Level 8)
// TODO 7 — four (r + 1) × (r + 1) windows with this pixel in a corner; output the mean of the one
// with the smallest variance (sum of the R, G, B variances)
export function kuwahara(c, p) {
  // your code: for each of the 4 quadrants, a JavaScript loop over i, j = 0 … r adds c.C(sx·i, sy·j) and its square;
  // mean m = sum / n, variance = sum2 / n − m² (add the 3 channels); keep the m of the smallest variance with select(...)
  const r = p.radius;
  const n = (r + 1) * (r + 1);
  const quadrants = [
    { sx: 1, sy: 1 },
    { sx: -1, sy: 1 },
    { sx: -1, sy: -1 },
    { sx: 1, sy: -1 },
  ];

  let bestMean = vec3(0);
  let minVar = float(1e9);

  for (const q of quadrants) {
    let sum = vec3(0);
    let sum2 = vec3(0);
    for (let i = 0; i <= r; i++) {
      for (let j = 0; j <= r; j++) {
        const color = c.C(q.sx * i, q.sy * j);
        sum = sum.add(color);
        sum2 = sum2.add(color.mul(color));
      }
    }
    const mean = sum.div(n);
    const v = sum2.div(n).sub(mean.mul(mean));
    const totalVar = v.x.add(v.y).add(v.z);

    const isBetter = totalVar.lessThan(minVar);
    bestMean = select(isBetter, mean, bestMean);
    minVar = select(isBetter, totalVar, minVar);
  }

  return bestMean;                                  // TODO 7
}

// ---------------------------------------------------------------- Part 5 · the chain
// TODO 8 — a pen drawing: hatching from the luminance, then black outlines on top
export function chain(c, p) {
  // your code: ink = max(hatchInk(luminance(c.color), c, p), allEdges(c, p)); return vec3(1 − ink)
  const ink = max(hatchInk(luminance(c.color), c, p), allEdges(c, p));
  return vec3(float(1).sub(ink));                            // TODO 8
}

export const EFFECTS = [
  ['plain (no effect)', (c) => c.color],
  ['1 · grayscale', grayscale],
  ['2 · posterize', posterize],
  ['3 · outlines from depth', edgesDepth],
  ['4 · depth + normal edges on colour', edgesColour],
  ['5 · Bayer 4 × 4 dither', bayer],
  ['6 · screen-space hatching', hatch],
  ['7 · Kuwahara', kuwahara],
  ['8 · hatching + outlines', chain],
];
