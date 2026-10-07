const canvas = document.querySelector('canvas');

const slider = document.createElement('input');
slider.type = 'range';
slider.min = '3';
slider.max = '64';
slider.value = '5';
slider.style.position = 'fixed';
slider.style.top = '16px';
slider.style.left = '16px';
slider.style.zIndex = '10';
document.body.appendChild(slider);

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error('No WebGPU adapter found');

const device = await adapter.requestDevice();
device.lost.then((info) => { console.error('WebGPU device lost:', info); });

const ctx = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
ctx.configure({ device, format, alphaMode: 'opaque' });

console.log('WebGPU ready:', format);

const module = device.createShaderModule({
  code: `
    struct Uniforms {
      mouse: vec2f,
      aspect: f32,
      triAngle: f32,
      squareAngle: f32,
      polyN: f32,
      pad0: f32,
      pad1: f32,
    };

    @group(0) @binding(0) var<uniform> uniforms: Uniforms;

    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) color: vec4f,
    };

    @vertex
    fn vs_main(@builtin(vertex_index) index: u32) -> VertexOutput {
      var output: VertexOutput;

      if (index < 3u) {
        let angle = uniforms.triAngle;
        let cosA = cos(angle);
        let sinA = sin(angle);
        let rotMat = mat2x2f(
          vec2f( cosA, sinA),
          vec2f(-sinA, cosA)
        );

        var triPositions = array<vec2f, 3>(
          vec2f( 0.0,  0.4),
          vec2f(-0.4, -0.4),
          vec2f( 0.4, -0.4)
        );

        let p = triPositions[index];
        let rotated = rotMat * p;
        let scaledX = rotated.x / uniforms.aspect;

        output.position = vec4f(scaledX, rotated.y, 0.0, 1.0);
        output.color = vec4f(1.0, 0.0, 0.0, 1.0);
      } else if (index < 9u) {
        let angle = uniforms.squareAngle;
        let cosA = cos(angle);
        let sinA = sin(angle);
        let rotMat = mat2x2f(
          vec2f( cosA, sinA),
          vec2f(-sinA, cosA)
        );

        var quadPositions = array<vec2f, 6>(
          vec2f(-0.15, -0.15),
          vec2f( 0.15, -0.15),
          vec2f(-0.15,  0.15),
          vec2f(-0.15,  0.15),
          vec2f( 0.15, -0.15),
          vec2f( 0.15,  0.15)
        );

        var cBL = vec4f(1.0, 0.0, 0.0, 1.0);
        var cBR = vec4f(0.0, 1.0, 0.0, 1.0);
        var cTL = vec4f(0.0, 0.0, 1.0, 1.0);
        var cTR = vec4f(1.0, 1.0, 0.0, 1.0);

        var quadColors = array<vec4f, 6>(
          cBL,
          cBR,
          cTL,
          cTL,
          cBR,
          cTR
        );

        let i = index - 3u;
        let p = quadPositions[i];
        let rotated = rotMat * p;
        let scaledX = rotated.x / uniforms.aspect;
        let finalPos = vec2f(scaledX, rotated.y) + uniforms.mouse;

        output.position = vec4f(finalPos, 0.0, 1.0);
        output.color = quadColors[i];
      } else {
        let polyIdx = index - 9u;
        let triIdx = polyIdx / 3u;
        let cornerIdx = polyIdx % 3u;
        let twoPi = 6.28318530718;
        let n = uniforms.polyN;
        let r = 0.25;

        var localPos = vec2f(0.0, 0.0);
        if (cornerIdx == 1u) {
          let a = f32(triIdx) * twoPi / n;
          localPos = vec2f(cos(a), sin(a)) * r;
        } else if (cornerIdx == 2u) {
          let a = f32(triIdx + 1u) * twoPi / n;
          localPos = vec2f(cos(a), sin(a)) * r;
        }

        let polyCenter = vec2f(0.0, -0.6);
        let scaledX = localPos.x / uniforms.aspect;
        let finalPos = vec2f(scaledX, localPos.y) + polyCenter;

        output.position = vec4f(finalPos, 0.0, 1.0);
        output.color = vec4f(0.2, 0.7, 1.0, 1.0);
      }

      return output;
    }

    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4f {
      return input.color;
    }
  `
});

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module,
    entryPoint: 'vs_main'
  },
  fragment: {
    module,
    entryPoint: 'fs_main',
    targets: [{ format }]
  },
  primitive: {
    topology: 'triangle-list'
  }
});

const uniformBuffer = device.createBuffer({
  size: 32,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

const uniformBindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    {
      binding: 0,
      resource: { buffer: uniformBuffer }
    }
  ]
});

const t0 = performance.now();
let lastTime = performance.now();
let triAngle = 0;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
window.addEventListener('resize', resize);
resize();

let mousePos = [0, 0];

window.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 2 - 1;
  const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  mousePos = [x, y];
});

function frame() {
  const now = performance.now();
  const dt = (now - lastTime) * 0.001;
  lastTime = now;

  const mouseDist = Math.hypot(mousePos[0], mousePos[1]);
  triAngle += dt * (0.5 + Math.min(mouseDist, 1.5) * 1.5);

  const squareAngle = (now - t0) * 0.001;
  const n = parseInt(slider.value, 10);
  const aspect = canvas.width / canvas.height;

  const uniformData = new Float32Array([
    mousePos[0],
    mousePos[1],
    aspect,
    triAngle,
    squareAngle,
    n,
    0,
    0
  ]);

  device.queue.writeBuffer(
    uniformBuffer,
    0,
    uniformData
  );

  const totalVertices = 9 + n * 3;

  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({
    colorAttachments: [{
      view: ctx.getCurrentTexture().createView(),
      clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, uniformBindGroup);
  pass.draw(totalVertices);
  pass.end();
  device.queue.submit([enc.finish()]);

  requestAnimationFrame(frame);
}
frame();