export function checkGl(gl, stage) {
  const codes = [];
  for (let i = 0; i < 16; i++) {
    const code = gl.getError();
    if (code === gl.NO_ERROR) break;
    codes.push(code);
  }
  if (!codes.length) return;
  const names = {
    1280: "INVALID_ENUM",
    1281: "INVALID_VALUE",
    1282: "INVALID_OPERATION",
    1285: "OUT_OF_MEMORY",
    1286: "INVALID_FRAMEBUFFER_OPERATION",
    37442: "CONTEXT_LOST_WEBGL",
  };
  const error = new Error(
    `${stage}: ${codes.map((code) => `${names[code] || "GL_ERROR"} (0x${code.toString(16)})`).join(", ")}`,
  );
  error.graphics = { stage, codes };
  throw error;
}
export async function renderer(canvas) {
  const gl = canvas.getContext("webgl2", {
    xrCompatible: true,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
  });
  if (!gl) throw Error("WebGL 2 is unavailable.");
  // Compatibility can replace the context's backing graphics device. Create
  // every shader, buffer and texture only after that transition completes.
  await gl.makeXRCompatible();
  checkGl(gl, "XR context compatibility");
  const shader = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(
    program,
    shader(
      gl.VERTEX_SHADER,
      `#version 300 es\nin vec2 p;uniform mat4 m;out vec2 uv;void main(){uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);gl_Position=m*vec4(p,0.,1.);}`,
    ),
  );
  gl.attachShader(
    program,
    shader(
      gl.FRAGMENT_SHADER,
      `#version 300 es\nprecision highp float;uniform sampler2D tex;uniform float a;in vec2 uv;out vec4 c;void main(){c=texture(tex,uv)*a;}`,
    ),
  );
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw Error(gl.getProgramInfoLog(program));
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const p = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(p);
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  // Projection-mode pointer images, one texture per look, uploaded once.
  const sprites = new Map();
  const fbo = gl.createFramebuffer(),
    loc = gl.getUniformLocation(program, "m"),
    alphaLoc = gl.getUniformLocation(program, "a");
  // Every draw is opaque-as-painted unless a composition sprite says
  // otherwise; composePage restores this after its translucent sprites.
  gl.useProgram(program);
  gl.uniform1f(alphaLoc, 1);
  gl.useProgram(null);
  const resized = document.createElement("canvas");
  const compositionFbo = gl.createFramebuffer();
  const compositionPages = new Map(), compositionSprites = new Map();
  // These textures are application-owned. Runtime textures are only ever
  // attached as output, never sampled, resized, or assigned mipmaps.
  function compositionTexture(cache, source, revision) {
    let entry = cache.get(source);
    if (!entry) {
      entry = { texture: gl.createTexture(), width: 0, height: 0 };
      cache.set(source, entry);
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    const resized = entry.width !== source.width || entry.height !== source.height;
    if (resized || !Object.is(entry.revision, revision)) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      if (resized) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      checkGl(gl, "composition source upload");
      entry.width = source.width; entry.height = source.height; entry.revision = revision;
    }
    return entry.texture;
  }
  checkGl(gl, "renderer initialization");
  return {
    gl,
    fbo,
    // Call only with the subimage acquired for this XR animation frame.
    // Sprite canvases are immutable looks, cached until their size changes.
    composePage(sub, source, { revision = 0, sprites: overlays = [] } = {}) {
      const v = sub.viewport;
      if (!source?.width || !source?.height || !v || v.width <= 0 || v.height <= 0)
        throw new Error("Composition needs a nonempty source and viewport.");
      const caps = [gl.BLEND, gl.DEPTH_TEST, gl.STENCIL_TEST, gl.CULL_FACE,
        gl.SCISSOR_TEST, gl.DITHER, gl.RASTERIZER_DISCARD, gl.SAMPLE_ALPHA_TO_COVERAGE, gl.SAMPLE_COVERAGE];
      const enabled = caps.map(cap => gl.isEnabled(cap));
      const unpackLayout = [gl.UNPACK_ROW_LENGTH, gl.UNPACK_IMAGE_HEIGHT,
        gl.UNPACK_SKIP_PIXELS, gl.UNPACK_SKIP_ROWS, gl.UNPACK_SKIP_IMAGES];
      const unpackValues = unpackLayout.map(parameter => gl.getParameter(parameter));
      const saved = {
        drawFbo: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),
        readFbo: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
        viewport: gl.getParameter(gl.VIEWPORT), scissor: gl.getParameter(gl.SCISSOR_BOX),
        program: gl.getParameter(gl.CURRENT_PROGRAM), vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING),
        active: gl.getParameter(gl.ACTIVE_TEXTURE), colorMask: gl.getParameter(gl.COLOR_WRITEMASK),
        rgbSrc: gl.getParameter(gl.BLEND_SRC_RGB), rgbDst: gl.getParameter(gl.BLEND_DST_RGB),
        alphaSrc: gl.getParameter(gl.BLEND_SRC_ALPHA), alphaDst: gl.getParameter(gl.BLEND_DST_ALPHA),
        rgbEquation: gl.getParameter(gl.BLEND_EQUATION_RGB), alphaEquation: gl.getParameter(gl.BLEND_EQUATION_ALPHA),
        flip: gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), premultiply: gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL),
        unpackBuffer: gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING),
        matrix: gl.getUniform(program, loc),
      };
      gl.activeTexture(gl.TEXTURE0);
      saved.texture = gl.getParameter(gl.TEXTURE_BINDING_2D);
      saved.sampler = gl.getParameter(gl.SAMPLER_BINDING);
      try {
        checkGl(gl, "before page composition");
        gl.bindSampler(0, null);
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
        unpackLayout.forEach(parameter => gl.pixelStorei(parameter, 0));
        const pageTexture = compositionTexture(compositionPages, source, revision);
        const prepared = overlays.map(sprite => {
          if (!sprite.source?.width || !sprite.source?.height ||
              ![sprite.x, sprite.y, sprite.width, sprite.height].every(Number.isFinite) ||
              sprite.width <= 0 || sprite.height <= 0 ||
              !(sprite.alpha == null || (sprite.alpha >= 0 && sprite.alpha <= 1))) throw new Error("Invalid composition sprite.");
          return { ...sprite, texture: compositionTexture(compositionSprites, sprite.source, sprite.revision ?? 0) };
        }).filter(sprite => sprite.alpha !== 0);
        // Opaque XR texture attachment is valid only in the current frame.
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, compositionFbo);
        gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sub.colorTexture, 0);
        if (gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
          throw new Error("XR page composition framebuffer is incomplete.");
        for (const cap of caps) gl.disable(cap);
        gl.enable(gl.SCISSOR_TEST);
        gl.viewport(v.x, v.y, v.width, v.height);
        gl.scissor(v.x, v.y, v.width, v.height);
        gl.colorMask(true, true, true, true);
        gl.useProgram(program); gl.bindVertexArray(vao);
        gl.bindTexture(gl.TEXTURE_2D, pageTexture);
        gl.uniformMatrix4fv(loc, false, identity);
        // Full replacement also erases cursors from older swapchain frames.
        // The shader's inverted v maps canvas top to native texture top,
        // matching copyPage's UNPACK_FLIP_Y_WEBGL=true upload.
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.enable(gl.BLEND);
        gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        for (const sprite of prepared) {
          const matrix = new Float32Array(identity);
          matrix[0] = sprite.width / source.width;
          matrix[5] = sprite.height / source.height;
          matrix[12] = 2 * (sprite.x + sprite.width / 2) / source.width - 1;
          matrix[13] = 1 - 2 * (sprite.y + sprite.height / 2) / source.height;
          gl.bindTexture(gl.TEXTURE_2D, sprite.texture);
          gl.uniformMatrix4fv(loc, false, matrix);
          gl.uniform1f(alphaLoc, sprite.alpha ?? 1);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        checkGl(gl, "XR page composition");
      } finally {
        // Detach even on incomplete-FBO/error paths: no runtime texture is
        // retained by an application framebuffer after the frame's work.
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, compositionFbo);
        gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, saved.drawFbo);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, saved.readFbo);
        gl.viewport(...saved.viewport); gl.scissor(...saved.scissor);
        gl.colorMask(...saved.colorMask);
        gl.blendEquationSeparate(saved.rgbEquation, saved.alphaEquation);
        gl.blendFuncSeparate(saved.rgbSrc, saved.rgbDst, saved.alphaSrc, saved.alphaDst);
        caps.forEach((cap, i) => savedEnable(cap, enabled[i]));
        gl.useProgram(program); gl.uniformMatrix4fv(loc, false, saved.matrix); gl.uniform1f(alphaLoc, 1);
        gl.useProgram(saved.program); gl.bindVertexArray(saved.vao);
        gl.bindTexture(gl.TEXTURE_2D, saved.texture); gl.bindSampler(0, saved.sampler);
        gl.activeTexture(saved.active);
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, saved.unpackBuffer);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, saved.flip);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, saved.premultiply);
        unpackLayout.forEach((parameter, i) => gl.pixelStorei(parameter, unpackValues[i]));
      }
      checkGl(gl, "page composition state restoration");
      function savedEnable(cap, enabled) { if (enabled) gl.enable(cap); else gl.disable(cap); }
    },
    copyPage(sub, source, { premultiplied = false } = {}) {
      let pixels = source;
      const v = sub.viewport;
      if (v.width !== source.width || v.height !== source.height) {
        resized.width = v.width;
        resized.height = v.height;
        resized.getContext("2d").drawImage(source, 0, 0, v.width, v.height);
        pixels = resized;
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sub.colorTexture);
      try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplied);
        // Only replace pixels; opaque layer textures are runtime-owned and
        // must never be reallocated with texImage2D or given mipmaps.
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          v.x,
          v.y,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        checkGl(gl, "quad page upload");
      } finally {
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      }
    },
    // A small separate image (the projection-mode pointer), blended on top.
    drawSprite(source, matrix) {
      gl.activeTexture(gl.TEXTURE0);
      let sprite = sprites.get(source);
      if (!sprite) {
        sprite = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, sprite);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.generateMipmap(gl.TEXTURE_2D);
        sprites.set(source, sprite);
      } else gl.bindTexture(gl.TEXTURE_2D, sprite);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(loc, false, matrix);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      checkGl(gl, "projection pointer draw");
    },
    upload(source) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
    },
    draw(matrix) {
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniformMatrix4fv(loc, false, matrix);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindVertexArray(null);
    },
    // Frees cached composition textures for sources that are finished with,
    // such as the arrival's pre-drawn pieces once Today is showing.
    release(...sources) {
      for (const source of sources)
        for (const cache of [compositionPages, compositionSprites]) {
          const entry = cache.get(source);
          if (entry) { gl.deleteTexture(entry.texture); cache.delete(source); }
        }
    },
    dispose() {
      gl.deleteTexture(texture);
      for (const t of sprites.values()) gl.deleteTexture(t);
      sprites.clear();
      for (const cache of [compositionPages, compositionSprites]) {
        for (const entry of cache.values()) gl.deleteTexture(entry.texture);
        cache.clear();
      }
      gl.deleteFramebuffer(compositionFbo);
      gl.deleteFramebuffer(fbo);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
export const identity = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);
export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}
