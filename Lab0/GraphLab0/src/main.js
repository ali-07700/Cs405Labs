import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

// Create a scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x55aaff); 

// Create a camera
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 5;

// Create a mesh
const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshNormalMaterial()
);
scene.add(cube);

// Create a renderer
const renderer = new WebGPURenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

await renderer.init();

// WebGPU check
const label = document.createElement('div');
label.textContent = renderer.backend?.isWebGPU ? 'WebGPU is available' : 'WebGPU is not available';
label.style.cssText = 'position: absolute; top: 10px; left: 10px; color: white; font-family: sans-serif; font-size: 16px;';
document.body.appendChild(label);

renderer.setAnimationLoop(() => {

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    renderer.render(scene, camera);

});