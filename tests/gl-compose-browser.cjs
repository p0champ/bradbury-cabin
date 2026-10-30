const assert = require('node:assert/strict');
module.exports = async function compositionChecks(browser, { BASE_URL, passed }) {
  const page = await browser.newPage();
  try {
    await page.goto(BASE_URL);
    const result = await page.evaluate(async () => {
      WebGL2RenderingContext.prototype.makeXRCompatible = async function () {};
      const { renderer, identity } = await import('./gl.js?compose-isolation');
      const surface = document.createElement('canvas');
      const gpu = await renderer(surface), gl = gpu.gl;
      const source = document.createElement('canvas'); source.width = 8; source.height = 6;
      const ctx = source.getContext('2d');
      ctx.fillStyle = 'rgba(255,0,0,.5)'; ctx.fillRect(0, 0, 8, 2);
      ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 4, 8, 2);
      const sprite = document.createElement('canvas'); sprite.width = sprite.height = 2;
      const sc = sprite.getContext('2d'); sc.fillStyle = 'rgba(0,255,0,.5)'; sc.fillRect(0, 0, 2, 2);
      const native = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, native);
      const initial = new Uint8Array(16 * 14 * 4);
      for (let i = 0; i < initial.length; i += 4) initial.set([11, 22, 33, 44], i);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 16, 14, 0, gl.RGBA, gl.UNSIGNED_BYTE, initial);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      const sub = { colorTexture: native, viewport: { x: 3, y: 4, width: 8, height: 6 } };
      const nativeAttachments = new Set();
      const attach = gl.framebufferTexture2D.bind(gl);
      gl.framebufferTexture2D = function (...args) {
        const target = args[0] === gl.READ_FRAMEBUFFER ? gl.READ_FRAMEBUFFER_BINDING : gl.DRAW_FRAMEBUFFER_BINDING;
        const fbo = gl.getParameter(target);
        if (args[3] === native) nativeAttachments.add(fbo); else nativeAttachments.delete(fbo);
        return attach(...args);
      };
      const counters = { allocations: 0, uploads: 0, nativeAllocations: 0, nativeUploads: 0, mipmaps: 0 };
      for (const method of ['texImage2D', 'texSubImage2D', 'generateMipmap']) {
        const original = gl[method].bind(gl);
        gl[method] = function (...args) {
          const runtime = gl.getParameter(gl.TEXTURE_BINDING_2D) === native;
          if (method === 'texImage2D') { counters.allocations++; if (runtime) counters.nativeAllocations++; }
          if (method === 'texSubImage2D') { counters.uploads++; if (runtime) counters.nativeUploads++; }
          if (method === 'generateMipmap') counters.mipmaps++;
          return original(...args);
        };
      }
      // Leave a valid nondefault program/uniform, then hostile render/upload
      // state. Composition must neither depend on it nor leak changes to it.
      gpu.draw(identity);
      const drawFbo = gl.createFramebuffer(), readFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawFbo); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFbo);
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const unit0 = gl.createTexture(), unit3 = gl.createTexture(), sampler = gl.createSampler();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, unit0); gl.bindSampler(0, sampler);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, unit3);
      const unpack = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, unpack);
      gl.bufferData(gl.PIXEL_UNPACK_BUFFER, 2048, gl.STATIC_DRAW);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      for (const [key, value] of [['UNPACK_ROW_LENGTH', 17], ['UNPACK_IMAGE_HEIGHT', 19], ['UNPACK_SKIP_PIXELS', 2], ['UNPACK_SKIP_ROWS', 3], ['UNPACK_SKIP_IMAGES', 1]]) gl.pixelStorei(gl[key], value);
      gl.viewport(1, 2, 3, 4); gl.scissor(2, 1, 4, 3); gl.colorMask(true, false, true, false);
      const capNames = ['BLEND', 'DEPTH_TEST', 'STENCIL_TEST', 'CULL_FACE', 'SCISSOR_TEST', 'RASTERIZER_DISCARD', 'SAMPLE_ALPHA_TO_COVERAGE', 'SAMPLE_COVERAGE'];
      capNames.forEach(name => gl.enable(gl[name])); gl.disable(gl.DITHER);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.ZERO);
      gl.blendEquationSeparate(gl.FUNC_REVERSE_SUBTRACT, gl.FUNC_SUBTRACT);
      const parameters = ['DRAW_FRAMEBUFFER_BINDING', 'READ_FRAMEBUFFER_BINDING', 'CURRENT_PROGRAM', 'VERTEX_ARRAY_BINDING', 'ACTIVE_TEXTURE', 'VIEWPORT', 'SCISSOR_BOX', 'COLOR_WRITEMASK', 'BLEND_SRC_RGB', 'BLEND_DST_RGB', 'BLEND_SRC_ALPHA', 'BLEND_DST_ALPHA', 'BLEND_EQUATION_RGB', 'BLEND_EQUATION_ALPHA', 'UNPACK_FLIP_Y_WEBGL', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL', 'UNPACK_ROW_LENGTH', 'UNPACK_IMAGE_HEIGHT', 'UNPACK_SKIP_PIXELS', 'UNPACK_SKIP_ROWS', 'UNPACK_SKIP_IMAGES', 'PIXEL_UNPACK_BUFFER_BINDING'];
      function snapshot() {
        const state = Object.fromEntries(parameters.map(name => [name, gl.getParameter(gl[name])]));
        for (const name of [...capNames, 'DITHER']) state[name] = gl.isEnabled(gl[name]);
        state.activeTextureBinding = gl.getParameter(gl.TEXTURE_BINDING_2D);
        gl.activeTexture(gl.TEXTURE0);
        state.unit0Binding = gl.getParameter(gl.TEXTURE_BINDING_2D); state.unit0Sampler = gl.getParameter(gl.SAMPLER_BINDING);
        gl.activeTexture(state.ACTIVE_TEXTURE);
        state.matrix = gl.getUniform(state.CURRENT_PROGRAM, gl.getUniformLocation(state.CURRENT_PROGRAM, 'm'));
        return state;
      }
      const before = snapshot(), stateErrors = [];
      function assertState(label) {
        const after = snapshot();
        for (const key of Object.keys(before)) {
          const a = before[key], b = after[key];
          const equal = ArrayBuffer.isView(a) || Array.isArray(a) ? Array.from(a).every((n, i) => n === b[i]) : a === b;
          if (!equal) stateErrors.push(`${label}: ${key}`);
        }
      }
      const overlays = [{ source: sprite, x: 3, y: 2, width: 2, height: 2 }];
      gpu.composePage(sub, source, { revision: 1, sprites: overlays }); assertState('first');
      const first = { ...counters };
      // A read FBO is separate from the hostile caller's two saved bindings.
      const pixelsFbo = gl.createFramebuffer();
      function pixels() {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, pixelsFbo);
        gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, native, 0);
        const data = new Uint8Array(16 * 14 * 4); gl.readPixels(0, 0, 16, 14, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFbo); return data;
      }
      const at = (data, x, y) => Array.from(data.slice((y * 16 + x) * 4, (y * 16 + x) * 4 + 4));
      const composed = pixels();
      let outsideChanged = 0;
      for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) if (x < 3 || x >= 11 || y < 4 || y >= 10) {
        if (at(composed, x, y).some((n, i) => n !== [11, 22, 33, 44][i])) outsideChanged++;
      }
      gpu.composePage(sub, source, { revision: 1, sprites: [{ ...overlays[0], x: 0 }] }); assertState('moved');
      const movedCounters = { ...counters }, moved = pixels();
      gpu.composePage(sub, source, { revision: 1, sprites: [] }); assertState('hidden');
      const erased = pixels();
      // Same canvas, new revision must refresh the cached source.
      ctx.clearRect(0, 0, 8, 6); ctx.fillStyle = '#ffff00'; ctx.fillRect(0, 0, 8, 6);
      gpu.composePage(sub, source, { revision: 2 }); assertState('revision');
      const revised = pixels(), revisedCounters = { ...counters };
      let incompleteRejected = false;
      try { gpu.composePage({ ...sub, colorTexture: null }, source, { revision: 2 }); }
      catch (error) { incompleteRejected = /incomplete/.test(error.message); }
      assertState('incomplete output');
      const error = gl.getError();
      return { stateErrors, outsideChanged, first, movedCounters, revisedCounters, error, incompleteRejected, retainedAttachments: nativeAttachments.size,
        top: at(composed, 3, 9), bottom: at(composed, 3, 4), sprite: at(composed, 6, 7),
        movedOld: at(moved, 6, 7), hidden: at(erased, 3, 7), revised: at(revised, 3, 9) };
    });
    assert.deepEqual(result.stateErrors, [], 'composition leaked caller GL state');
    assert.equal(result.incompleteRejected, true, 'invalid output was accepted');
    assert.equal(result.retainedAttachments, 0, 'runtime texture retained after composition');
    passed('composition: restores nondefault framebuffer, render, texture, sampler and unpack state');
    assert.equal(result.outsideChanged, 0, 'padded subviewport overwrote neighboring texels');
    assert.deepEqual(result.top, [128, 0, 0, 128]);
    assert.deepEqual(result.bottom, [0, 0, 255, 255]);
    assert.deepEqual(result.sprite, [0, 128, 0, 128]);
    assert.deepEqual(result.movedOld, [0, 0, 0, 0]);
    assert.deepEqual(result.hidden, [0, 0, 0, 0]);
    passed('composition: exact padded viewport, canvas orientation, premultiplied alpha and pristine cursor erasure');
    assert.deepEqual(result.movedCounters, result.first, 'cursor movement uploaded source pixels');
    assert.equal(result.revisedCounters.allocations, result.first.allocations);
    assert.equal(result.revisedCounters.uploads, result.first.uploads + 1);
    assert.equal(result.revisedCounters.nativeAllocations, 0); assert.equal(result.revisedCounters.nativeUploads, 0);
    assert.equal(result.revisedCounters.mipmaps, 0); assert.equal(result.error, 0);
    assert.deepEqual(result.revised, [255, 255, 0, 255]);
    passed('composition: cursor-only frames reuse owned textures, revision refreshes once, native texture never uploaded or mipmapped');
  } finally { await page.close(); }
};
