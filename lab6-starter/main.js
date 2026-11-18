// CS405 Lab 6 — scene, render pipeline and controls. Nothing to change in this file.
import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, packNormalToRGB, screenUV, uniform, select, vec4, abs } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { makeContext, EFFECTS } from './effects.js';

const info = document.getElementById('info');
const renderer = new THREE.WebGPURenderer({ antialias: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
await renderer.init();
const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2 (fallback: this browser has no WebGPU)';

// ---------------------------------------------------------------- the scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e4d8);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 50);
camera.position.set(0.6, 1.6, 6.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.8, 0); controls.update();

scene.add(new THREE.HemisphereLight(0xfff4e0, 0x404050, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-3, 5, 4); scene.add(sun);

const mat = (color, roughness = 0.5, metalness = 0) => new THREE.MeshStandardNodeMaterial({ color, roughness, metalness });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mat(0xcfc8b8, 0.9));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), mat(0xe6e0d2, 0.95)); wall.position.set(0, 3, -2.3); scene.add(wall);
const teapot = new THREE.Mesh(new TeapotGeometry(0.55, 10), mat(0xb87333, 0.4, 0.0)); teapot.position.set(-0.2, 0.55 * 0.78, 0.3); scene.add(teapot);
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 32), mat(0xf2f2f2, 0.5)); ball.position.set(1.5, 0.5, 0.6); scene.add(ball);
const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.38, 0.13, 200, 24), mat(0x9c2a2a, 0.35)); knot.position.set(-1.8, 0.75, -0.2); scene.add(knot);
// Zonaro, Mehtap (1892), Sakıp Sabancı Museum — as a picture on the back wall
const tex = new THREE.TextureLoader().load('assets/mehtap.jpg'); tex.colorSpace = THREE.SRGBColorSpace;
const painting = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.44), new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.9 }));
painting.position.set(0, 1.9, -2.2); scene.add(painting);

// ---------------------------------------------------------------- the render pipeline (Week 7: render to texture, full-screen pass)
// Pass 1 draws the scene into textures: 'output' (linear colour), 'normal' (view-space normal as a colour), and its depth.
const scenePass = pass(scene, camera);
scenePass.setMRT(mrt({ output: output, normal: packNormalToRGB(normalView) }));
const c = makeContext(scenePass, camera);

const p = { levels: uniform(4), spacing: uniform(6), threshold: uniform(0.06), radius: 3 };
const split = uniform(0.5);                     // left of the line: plain; right: the effect
const pipeline = new THREE.RenderPipeline(renderer);
let current = 0;
function build() {
  const fx = EFFECTS[current][1](c, p);
  const both = select(screenUV.x.lessThan(split), c.color, fx);
  pipeline.outputNode = select(abs(screenUV.x.sub(split)).lessThan(0.0012), vec4(1, 0.75, 0, 1), vec4(both, 1));
  pipeline.needsUpdate = true;
  info.textContent = `${EFFECTS[current][0]} · backend: ${backend} · three.js r${THREE.REVISION}`;
}

// ---------------------------------------------------------------- the controls panel
const sel = document.getElementById('effect');
EFFECTS.forEach(([name], k) => sel.add(new Option(name, k)));
sel.addEventListener('change', () => { current = +sel.value; build(); });
const slider = (id, fn) => { const el = document.getElementById(id), out = document.getElementById(id + 'V'); const f = () => { out.textContent = el.value; fn(+el.value); }; el.addEventListener('input', f); f(); };
slider('split', v => { split.value = v; });
slider('levels', v => { p.levels.value = v; });
slider('spacing', v => { p.spacing.value = v; });
slider('threshold', v => { p.threshold.value = v; });
slider('radius', v => { if (p.radius !== v) { p.radius = v; build(); } });
window.addEventListener('keydown', e => { const n = parseInt(e.key, 10); if (n >= 0 && n < EFFECTS.length) { current = n; sel.value = n; build(); } });

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
build();
renderer.setAnimationLoop(() => { controls.update(); pipeline.render(); });
window.__lab = { renderer, scene, camera, pipeline, select: n => { current = n; sel.value = n; build(); } };   // for the TA's checks
