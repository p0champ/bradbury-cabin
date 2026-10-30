// What the reader would actually see, independent of how the cursor is built.
// Each frame this reconstructs cursor ink from compositor-visible state only:
// (a) presented page-quad pixels that differ from the page canvas, and
// (b) small visible quads lying on the page plane. The mock rotates three
// swapchain images that keep their own stale pixels, as a headset may.
const assert = require('node:assert/strict');

module.exports = async function pointerTruthChecks(browser, { mock, BASE_URL, passed }) {
  const setup = async (lying, hand, scenario = 'layer') => {
    const p = await browser.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await mock(p, scenario, lying, { practised: true, headPointer: false });
    await p.goto(BASE_URL); await p.locator('#enter').click();
    await p.evaluate(() => __center());
    await p.evaluate(h => { __hold(h); __hand(.05, h); __step(600); }, hand);
    await p.evaluate(installTruth);
    return { p, errors };
  };
  function installTruth() {
    const P = WebGL2RenderingContext.prototype;
    const page = document.querySelector('#page');
    const pose = () => new DOMMatrix(JSON.parse(page.dataset.panelPose));
    // Page pixel → world, and a ray quaternion aimed at a page pixel.
    window.__truthAimAt = (x, y, hand) => {
      const t = new DOMPoint((x / 2048 - .5) * .72, (.5 - y / 2560) * .9, 0).matrixTransform(pose());
const h = new DOMMatrix(__headMatrix());
      const o = new DOMPoint(hand === 'left' ? -0.22 : 0.22, -0.25, -0.45).matrixTransform(h);
      __mock.rayOrigin ||= {}; __mock.rayOrigin[hand] = { x: o.x, y: o.y, z: o.z };
      let dx = t.x - o.x, dy = t.y - o.y, dz = t.z - o.z; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const n = Math.hypot(dy, -dx, 1 - dz);
      __mock.rayByHand ||= {}; __mock.rayByHand[hand] = { x: dy / n, y: -dx / n, z: 0, w: (1 - dz) / n };
    };
    window.__truthInk = () => {
      const gl = __mock.gl, inks = [];
      const quad = __mock.quad, data = __mock.layerData.get(quad);
      const active = __mock.session?.renderState?.layers || [];
      if (data && active.includes(quad)) {
        const { width: W, height: H } = data, fbo = gl.createFramebuffer();
        const prevRead = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        P.bindFramebuffer.call(gl, gl.READ_FRAMEBUFFER, fbo);
        P.framebufferTexture2D.call(gl, gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, data.tex, 0);
        const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        P.framebufferTexture2D.call(gl, gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        P.bindFramebuffer.call(gl, gl.READ_FRAMEBUFFER, prevRead); gl.deleteFramebuffer(fbo);
        // Compare with the page scaled to the image size, as an upload would.
        const scaled = document.createElement('canvas'); scaled.width = W; scaled.height = H;
        scaled.getContext('2d').drawImage(page, 0, 0, W, H);
        const src = scaled.getContext('2d').getImageData(0, 0, W, H).data;
        let stale = 0, compared = 0; const cells = new Map();
        // Sample every 4 page pixels whatever the image size, so a runtime-
        // resized image does not leave only a couple of samples on the dot.
        const stride = Math.max(1, Math.round(4 * W / 2048)), start = stride >> 1;
        for (let y = start; y < H; y += stride) for (let x = start; x < W; x += stride) {
          const sx = Math.floor(x * 2048 / W), sy = Math.floor(y * 2560 / H);
          const k = ((H - 1 - y) * W + x) * 4, s = (y * W + x) * 4, a = src[s + 3] / 255;
          const diff = Math.max(Math.abs(px[k] - src[s] * a), Math.abs(px[k + 1] - src[s + 1] * a),
            Math.abs(px[k + 2] - src[s + 2] * a), Math.abs(px[k + 3] - src[s + 3]));
          compared++;
          if (diff > 48) { stale++; const key = Math.floor(sx / 64) + ',' + Math.floor(sy / 64);
            const c = cells.get(key) || { x: 0, y: 0, n: 0 }; c.x += sx; c.y += sy; c.n++; cells.set(key, c); }
        }
        // Merge adjacent ink cells into spots.
        const spots = [];
        for (const c of cells.values()) {
          const at = { x: c.x / c.n, y: c.y / c.n, n: c.n };
          const near = spots.find(s => Math.hypot(s.x - at.x, s.y - at.y) < 110);
          if (near) { near.x = (near.x * near.n + at.x * at.n) / (near.n + at.n); near.y = (near.y * near.n + at.y * at.n) / (near.n + at.n); near.n += at.n; }
          else spots.push(at);
        }
        for (const s of spots) inks.push({ via: 'page', x: s.x, y: s.y, samples: s.n });
        inks.pageDifferentFraction = stale / compared;
      }
      const inv = pose().inverse();
      for (const [layer, d] of __mock.layerData) {
        if (layer === quad || d.destroyed || !active.includes(layer) || !(layer.opacity > 0) || !d.matrix) continue;
        if (!(d.metresWide <= .05)) continue;
        const at = new DOMPoint(d.matrix[12], d.matrix[13], d.matrix[14]).matrixTransform(inv);
        if (Math.abs(at.z) > .006 || Math.abs(at.x) > .4 || Math.abs(at.y) > .5) continue;
        inks.push({ via: 'quad', x: (at.x / .72 + .5) * 2048, y: (.5 - at.y / .9) * 2560 });
      }
      return inks;
    };
  }

  // 1. Sweep: exactly one cursor, no trail, page never stale, follows promptly.
  for (const [lying, scenario] of [[false, 'layer'], [true, 'layer'], [false, 'clamped-layer']]) {
    const { p, errors } = await setup(lying, 'right', scenario);
    const r = await p.evaluate(() => {
      const frames = [], hand = 'right';
      const y = 1400;
      __truthAimAt(500, y, hand); for (let i = 0; i < 10; i++) __step(14);
      const drawsBefore = __mock.draws, acqBefore = __mock.acquisitions;
      const cpuBefore = __mock.ownedCanvasUploads, pageUploadsBefore = __mock.uploads, gpuBefore = __mock.pageSurfaceDraws;
      for (let i = 0; i <= 30; i++) { __truthAimAt(500 + i * 35, y, hand); __step(14); frames.push({ want: 500 + i * 35, inks: __truthInk(), frac: __truthInk().pageDifferentFraction }); }
      // Stop; let swapchain images cycle and the filter settle.
      const settle = [];
      for (let i = 0; i < 24; i++) { __step(14); const inks = __truthInk(); settle.push({ inks, frac: inks.pageDifferentFraction }); }
      return { frames, settle, pageDraws: __mock.draws - drawsBefore, acquisitions: __mock.acquisitions - acqBefore,
        cpuUploads: __mock.ownedCanvasUploads - cpuBefore, directUploads: __mock.uploads - pageUploadsBefore,
        gpuDraws: __mock.pageSurfaceDraws - gpuBefore };
    });
    assert.ok(r.pageDraws > 0 && r.acquisitions > 0 && r.gpuDraws > 0, 'native same-surface cursor must redraw each acquired swapchain image');
    assert.equal(r.cpuUploads, 0, `cursor-only motion uploaded owned canvas pixels ${r.cpuUploads} times`);
    assert.equal(r.directUploads, 0, `cursor-only motion directly uploaded native page pixels ${r.directUploads} times`);
    const bad = r.frames.concat(r.settle).filter(f => f.inks.length !== 1);
    assert.equal(bad.length, 0, `cursor shown ${bad[0]?.inks.length} times (trail or missing): ${JSON.stringify(bad[0]?.inks)}`);
    for (const f of r.frames.concat(r.settle)) assert.ok(f.frac < .01, `presented page differs from its content by ${(f.frac * 100).toFixed(1)}% (stale swapchain image)`);
    // Moving at ~0.9 m/s across the page: displayed dot may trail its live
    // hit by at most 40 mm while moving and must reach it within 2 mm once still.
    const lag = r.frames.slice(5).map(f => Math.abs(f.inks[0].x - f.want) / 2.844);
    assert.ok(Math.max(...lag) < 40, `cursor lagged ${Math.max(...lag).toFixed(1)} mm behind the hand`);
    const end = r.settle.at(-1).inks[0], final = r.frames.at(-1).want;
    assert.ok(Math.hypot(end.x - final, end.y - 1400) / 2.844 < 2, `still cursor ${(Math.hypot(end.x - final, end.y - 1400) / 2.844).toFixed(1)} mm from the pointed spot`);
    assert.deepEqual(errors, []);
    passed(`pointer truth: one clean cursor follows a sweep across rotating swapchain images ${lying ? 'lying' : 'upright'}${scenario === 'layer' ? '' : ' (runtime-resized page image)'}`);
    await p.close();
  }

  // 2. Hover agreement: the item under the displayed cursor is the hovered item.
  {
    const { p } = await setup(false, 'right');
    const r = await p.evaluate(async () => {
      const page = document.querySelector('#page'), out = [];
      for (const b of JSON.parse(page.dataset.buttons)) {
        __truthAimAt(b.x + b.w / 2, b.y + b.h / 2, 'right');
        for (let i = 0; i < 20; i++) __step(14);
        const ink = __truthInk()[0];
        const under = JSON.parse(page.dataset.buttons).find(c => ink && ink.x >= c.x && ink.x <= c.x + c.w && ink.y >= c.y && ink.y <= c.y + c.h);
        out.push({ id: b.id, target: page.dataset.target, under: under?.id, ink });
      }
      return out;
    });
    for (const row of r) assert.equal(row.target, row.under, `hover ${row.target} but cursor drawn over ${row.under}`);
    passed('pointer truth: every Home choice is hovered exactly where its cursor is drawn');
    await p.close();
  }
};
