// CS405 · Lab 2 — 3×3 matrices for 2D transforms (starter)
// Fill in the TODOs. main.js runs selfTest() on load: make all seven lines print ✓.
// Column-major: m[3*col + row], the same layout WGSL expects.

export const identity = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function multiply(a, b) {
  // TODO 1: out[3*c + r] = Σ_k  a[3*k + r] · b[3*c + k]
  //         (column-major, so the loops look "transposed" — write them carefully)
  const out = new Array(9);
  out.fill(0);
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 3; k++) {
        out[3 * c + r] += a[3 * k + r] * b[3 * c + k];
      }
    }
  }
  return out;
}

export const mulAll = (...ms) => ms.reduce(multiply);

// TODO 2: the third column holds the translation
export const translate = (x, y) => {
  const out = identity();
  out[6] = x;
  out[7] = y;
  return out;
};

// TODO 3
export const scale = (x, y = x) => {
  const out = identity();
  out[0] = x;
  out[4] = y;
  return out;
};

export function rotate(radians) {
  const out = identity();
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  out[0] = c;
  out[1] = s;
  out[3] = -s;
  out[4] = c;
  return out;
};

export function apply(m, x, y) {           // transform the point (x, y)
  return [m[0] * x + m[3] * y + m[6], m[1] * x + m[4] * y + m[7]];
}

// TODO 6: the inverse, by the adjugate: M⁻¹ = adj(M) / det(M)   (Week 2, Monday)
//         Cofactors, transpose, divide by det. Return null when det is (almost) 0.
//         For the matrices in this lab, (T·R·S)⁻¹ = S⁻¹·R⁻¹·T⁻¹ also works — but
//         picking below needs the inverse of whole world matrices, so write the general one.
export function invert(m) {
  const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[3] * (m[1] * m[8] - m[2] * m[7]) +
              m[6] * (m[1] * m[5] - m[2] * m[4]);
  const out = new Array(9);
  const invDet = 1 / det;
  out[0] = (m[4] * m[8] - m[5] * m[7]) * invDet;
  out[1] = (m[2] * m[7] - m[1] * m[8]) * invDet;
  out[2] = (m[1] * m[5] - m[2] * m[4]) * invDet;
  out[3] = (m[5] * m[6] - m[3] * m[8]) * invDet;
  out[4] = (m[0] * m[8] - m[2] * m[6]) * invDet;
  out[5] = (m[2] * m[3] - m[0] * m[5]) * invDet;
  out[6] = (m[3] * m[7] - m[4] * m[6]) * invDet;
  out[7] = (m[1] * m[6] - m[0] * m[7]) * invDet;
  out[8] = (m[0] * m[4] - m[1] * m[3]) * invDet;
  return out;
}

// a mat3x3f in a uniform buffer is three vec4 columns: 48 bytes
export function pad3x3(m) {
  return new Float32Array([m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0]);
}

export function selfTest() {
  const near = (a, b, msg) => {
    const ok = a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
    console.log(ok ? '✓' : '✗', msg, ok ? '' : `\n  got      ${a.map(v => v.toFixed(2))}\n  expected ${b.map(v => v.toFixed(2))}`);
    return ok;
  };
  let ok = true;
  const M = translate(3, -2);
  ok &= near(multiply(identity(), M), M, 'I · M = M');
  ok &= near(multiply(translate(2, 0), translate(3, 0)), translate(5, 0), 'translations add');
  ok &= near(apply(rotate(Math.PI / 2), 1, 0), [0, 1], 'rotate(90°) sends (1,0) to (0,1)');
  ok &= near(apply(multiply(translate(2, 0), scale(3)), 1, 1), [5, 3], 'T·S sends (1,1) to (5,3)');
  ok &= near(apply(multiply(scale(3), translate(2, 0)), 1, 1), [9, 3], 'S·T sends (1,1) to (9,3)');
  const W = [1.2, 0.5, 0, -0.3, 0.9, 0, 0.4, -0.2, 1];      // det = 1.23
  const Wi = invert(W) || identity();
  ok &= near(Wi, [0.9, -0.5, 0, 0.3, 1.2, 0, -0.3, 0.44, 1.23].map(v => v / 1.23), 'invert matches adj / det');
  ok &= near(apply(Wi, ...apply(W, 0.3, 0.8)), [0.3, 0.8], 'M⁻¹ undoes M on a point');
  console.log(ok ? 'mat3: all tests pass' : 'mat3: fix the failures above');
  return !!ok;
}
