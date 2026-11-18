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
         step, sqrt, clamp, unpackRGBToNormal, perspectiveDepthToViewZ } from 'three/tsl';

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
  return c.color;                                   // TODO 1
}

// TODO 2 — posterize: p.levels flat brightness levels, keeping the hue (Week 7 live code)
export function posterize(c, p) {
  // your code: Y = luminance(c.color); q = (floor(Y · levels) + 0.5) / levels; scale the colour by q / Y
  return c.color;                                   // TODO 2
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
  return float(0);                                  // TODO 3
}
export function edgesDepth(c, p) {
  return vec3(depthEdge(c, p).oneMinus());
}

// TODO 4 — add creases from the normals: 1 − min(n0·n1, n0·n2) > 0.2 (Week 7 live code)
export function allEdges(c, p) {
  // your code: n0 = c.N(0, 0), n1 = c.N(1, 0), n2 = c.N(0, 1); crease = 1 − min(n0·n1, n0·n2)
  // return the larger of depthEdge(c, p) and step(0.2, crease)
  return depthEdge(c, p);                           // TODO 4
}
export function edgesColour(c, p) {
  return c.color.mul(allEdges(c, p).oneMinus());
}

// ---------------------------------------------------------------- Part 3 · marks (Monday, Levels 1–2)
// TODO 5 — Bayer 4 × 4 ordered dithering on the linear luminance
// M2 = [[0, 2], [3, 1]] for one bit of x and y;  M4 = 4 · M2(low bits) + M2(high bits)  (Monday, slide 7)
export function bayer(c, p) {
  // your code: x, y = floor of c.pixel; m = M4(x, y) in 0…15; t = (m + 0.5) / 16; white where luminance ≥ t
  // hint: (a − b).abs() · 2 + b gives M2 for one bit; x.mod(2) is the low bit, x.div(2).floor().mod(2) the next
  return c.color;                                   // TODO 5
}

// TODO 6 — screen-space hatching: one set of lines while ink ≤ 0.42, then two crossing sets
// one set: coverage of a pixel row = clamp(ink · s − (y mod s), 0, 1);  two sets: a = 1 − √T each
export function hatchInk(T, c, p) {
  // your code: return the INK (0 = paper, 1 = black) for linear tone T at this pixel (Monday, slide 23 presets 1 and 2)
  return T.oneMinus();                              // TODO 6 (flat grey for now — no lines)
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
  return c.color;                                   // TODO 7
}

// ---------------------------------------------------------------- Part 5 · the chain
// TODO 8 — a pen drawing: hatching from the luminance, then black outlines on top
export function chain(c, p) {
  // your code: ink = max(hatchInk(luminance(c.color), c, p), allEdges(c, p)); return vec3(1 − ink)
  return c.color;                                   // TODO 8
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
