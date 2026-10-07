// CS405 · Lab 1 — your first triangle in WebGPU (starter)
// Work through the TODOs in order. After each one, check the matching
// checkpoint on the lab slides. The reference solution is in ../lab1-solution/.

const canvas = document.querySelector('canvas');

// ---------------------------------------------------------------------------
// TODO 1 — get a device and configure the canvas
//   a) check navigator.gpu exists, throw a clear error if not
//   b) const adapter = await navigator.gpu.requestAdapter()
//   c) const device  = await adapter.requestDevice()
//   d) const ctx     = canvas.getContext('webgpu')
//   e) const format  = navigator.gpu.getPreferredCanvasFormat()
//   f) ctx.configure({ device, format, alphaMode: 'opaque' })
//   g) console.log('WebGPU ready:', format)
// ---------------------------------------------------------------------------
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error('No WebGPU adapter found');

const device = await adapter.requestDevice();
device.lost.then((info) => { console.error('WebGPU device lost:', info); });

const ctx = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
ctx.configure({ device, format, alphaMode: 'opaque' });

console.log('WebGPU ready:', format);

// ---------------------------------------------------------------------------
// TODO 2 — a shader module and a render pipeline
//   The vertex shader returns clip-space positions for vertex_index 0, 1, 2.
//   The fragment shader returns a solid colour.
//   Then: device.createRenderPipeline({ layout: 'auto', vertex, fragment })
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// TODO 3 — a colour per vertex
//   Return a struct from the vertex shader with @location(0) colour,
//   take it as the fragment shader's input, and watch it interpolate.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// TODO 4 — a uniform buffer with the time, and rotate the triangle
//   size 16 bytes, usage UNIFORM | COPY_DST
//   bind group from pipeline.getBindGroupLayout(0)
//   device.queue.writeBuffer(...) every frame
// ---------------------------------------------------------------------------
const module = device.createShaderModule({
  code: `
    struct Uniforms {
      mouse: vec2f,
      aspect: f32,
      time: f32,
    };

    @group(0) @binding(0) var<uniform> uniforms: Uniforms;

    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) color: vec4f,
      @location(1) uv: vec2f,
    };

    @vertex
    fn vs_main(@builtin(vertex_index) index: u32) -> VertexOutput {
      var output: VertexOutput;

      let angle = uniforms.time;
      let cosA = cos(angle);
      let sinA = sin(angle);

      if (index < 3u) {
        var triPositions = array<vec2f, 3>(
          vec2f( 0.0,  0.6),
          vec2f(-0.6, -0.6),
          vec2f( 0.6, -0.6)
        );

        let p = triPositions[index];
        let rotated = vec2f(
          p.x * cosA - p.y * sinA,
          p.x * sinA + p.y * cosA
        );

        let scaledX = rotated.x / uniforms.aspect;
        output.position = vec4f(scaledX, rotated.y, 0.0, 1.0);
        output.color = vec4f(1.0, 0.0, 0.0, 1.0);
        output.uv = vec2f(0.0, 0.0);
      } else {
        var quadPositions = array<vec2f, 6>(
          vec2f(-0.2, -0.2),
          vec2f( 0.2, -0.2),
          vec2f(-0.2,  0.2),
          vec2f(-0.2,  0.2),
          vec2f( 0.2, -0.2),
          vec2f( 0.2,  0.2)
        );

        var quadUVs = array<vec2f, 6>(
          vec2f(-1.0, -1.0),
          vec2f( 1.0, -1.0),
          vec2f(-1.0,  1.0),
          vec2f(-1.0,  1.0),
          vec2f( 1.0, -1.0),
          vec2f( 1.0,  1.0)
        );

        let i = index - 3u;
        let p = quadPositions[i];
        let scaledX = p.x / uniforms.aspect;
        let finalPos = vec2f(scaledX, p.y) + uniforms.mouse;

        output.position = vec4f(finalPos, 0.0, 1.0);
        output.color = vec4f(0.0, 0.0, 0.0, 0.0);
        output.uv = quadUVs[i];
      }

      return output;
    }

    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4f {
      if (input.color.a > 0.5) {
        return input.color;
      }

      let dist = clamp(length(input.uv), 0.0, 1.0);
      let b = dist;
      let g = 1.0 - dist;

      return vec4f(0.0, g, b, 1.0);
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
  size: 16,
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


// ---------------------------------------------------------------------------
// TODO 5 — your turn: a square (two triangles), correct aspect ratio,
//   and the shape following the mouse.
// ---------------------------------------------------------------------------

const t0 = performance.now();

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
  // TODO 1 (continued): create a command encoder, begin a render pass that
  // clears the canvas, end it, and submit it to device.queue.
  //
  // TODO 2 (continued): pass.setPipeline(pipeline); pass.draw(3);
  // TODO 4 (continued): writeBuffer + pass.setBindGroup(0, bind);
  const elapsed = (performance.now() - t0) * 0.001;
  const aspect = canvas.width / canvas.height;
  const uniformData = new Float32Array([
    mousePos[0],
    mousePos[1],
    aspect,
    elapsed
  ]);
  device.queue.writeBuffer(
    uniformBuffer,
    0,
    uniformData
  );
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({
    colorAttachments: [{
      view: ctx.getCurrentTexture().createView(),
      clearValue: { r: 0.1, g: 0.1, b: 0.1 , a: 1.0 },
      loadOp:'clear',storeOp:'store'
    }]
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, uniformBindGroup);
  pass.draw(9);
  pass.end();
  device.queue.submit([enc.finish()]);

  requestAnimationFrame(frame);
}
frame();
