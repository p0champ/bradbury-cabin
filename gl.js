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
      `#version 300 es\nprecision highp float;uniform sampler2D tex;in vec2 uv;out vec4 c;void main(){c=texture(tex,uv);}`,
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
  const fbo = gl.createFramebuffer(),
    loc = gl.getUniformLocation(program, "m");
  const resized = document.createElement("canvas");
  checkGl(gl, "renderer initialization");
  return {
    gl,
    fbo,
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
    copyPagePatch(sub, source, rect, fullWidth, fullHeight) {
      const v = sub.viewport;
      const left = Math.round(rect.x * v.width / fullWidth);
      const right = Math.round((rect.x + rect.w) * v.width / fullWidth);
      const top = Math.round(rect.y * v.height / fullHeight);
      const bottom = Math.round((rect.y + rect.h) * v.height / fullHeight);
      if (right <= left || bottom <= top) return;
      let pixels = source;
      if (source.width !== right - left || source.height !== bottom - top) {
        resized.width = right - left; resized.height = bottom - top;
        resized.getContext("2d").drawImage(source, 0, 0, resized.width, resized.height);
        pixels = resized;
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sub.colorTexture);
      try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, v.x + left, v.y + v.height - bottom,
          gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        checkGl(gl, "page pointer patch");
      } finally {
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      }
    },
    uploadPatch(source, rect) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, rect.x, rect.y, gl.RGBA, gl.UNSIGNED_BYTE, source);
        checkGl(gl, "projection pointer patch");
      } finally { gl.bindTexture(gl.TEXTURE_2D, null); }
    },
    finishPatches() {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
      checkGl(gl, "projection pointer mipmaps");
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
    dispose() {
      gl.deleteTexture(texture);
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
