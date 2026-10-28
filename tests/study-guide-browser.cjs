const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function guideChecks(browser, { mock, BASE_URL, out, passed }) {
    // Build 023: guides are a detour, never a replacement for the saved text.
    for (const lying of [false, true]) {
      const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const errors = [];
      p.on("pageerror", e => errors.push(e.message));
      await mock(p, "layer", lying);
      await p.addInitScript(() => {
        window.__pageText = [];
        const fillRect = CanvasRenderingContext2D.prototype.fillRect;
        const fillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillRect = function(x,y,w,h) {
          if (this.canvas.id === "page" && w === 2048 && h === 2560) __pageText = [];
          return fillRect.call(this,x,y,w,h);
        };
        CanvasRenderingContext2D.prototype.fillText = function(t,...args) {
          if (this.canvas.id === "page") __pageText.push(t);
          return fillText.call(this,t,...args);
        };
      });
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      const choose = async (id) => {
        await p.evaluate(async id => __aim(id), id);
        if (typeof id === "string") assert.equal(await p.locator("#page").getAttribute("data-target"), id);
        await p.evaluate(() => __pinch());
      };
      const menu = async () => {
        // Look back toward the world-still reading page before holding.
        if (await p.locator("#page").getAttribute("data-view") === "reading")
          await p.evaluate(() => { __mock.look = null; __step(600); });
        await p.evaluate(() => __hold());
      };
      const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem("cabin-reading")));
      const workId = () => p.locator("#page").getAttribute("data-work");
      await menu(); await choose("library");
      await choose({ x: 1394, y: 380, w: 380, h: 120 });
      await p.evaluate(async () => {
        await __aim("guide");
        __native("selectstart"); __step(40);
        __native("select"); __native("selectend"); __step(16);
      });
      assert.equal(await workId(), "sampler");
      assert.equal(await p.locator("#page").getAttribute("data-view"), "menu", "repeat pinch within 600ms must not open guide");
      await menu();
      await menu();
      await choose("library");
      await choose({ x: 274, y: 700 + 5 * 124, w: 1500, h: 112 });
      for (let i = 0; i < 3; i++) await p.locator("#next").click();
      const original = await saved(), place = await p.locator("#place").textContent();
      await menu(); await choose("guide");
      assert.equal(await workId(), "guide:chopin-desiree");
      assert.equal(await p.locator("#page").getAttribute("data-view"), "reading");
      assert.ok((await p.evaluate(() => __pageText)).includes("Before reading"));
      assert.ok(!(await p.evaluate(() => __pageText)).includes("After reading — spoilers"));
      await p.locator("#page").screenshot({ path: path.join(out, `guide-before${lying ? "-lying" : ""}.png`) });
      await p.evaluate(() => { __step(); __welcomeScene(); });
      await p.locator("#welcome-scene").screenshot({ path: path.join(out, `guide-native-${lying ? "lying" : "front"}.png`) });
      await p.evaluate(() => { __mock.offsetX = 0.25; __step(); __welcomeScene(); });
      await p.locator("#welcome-scene").screenshot({ path: path.join(out, `guide-native-${lying ? "lying" : "front"}-side.png`) });
      await p.evaluate(() => { __mock.offsetX = 0; __step(); });
      while (!(await p.evaluate(() => __pageText)).includes("After reading — spoilers")) {
        assert.equal(await p.locator("#next").isEnabled(), true, "spoiler heading must exist");
        await p.locator("#next").click();
      }
      await p.locator("#page").screenshot({ path: path.join(out, `guide-after${lying ? "-lying" : ""}.png`) });
      assert.deepEqual(await saved(), original, "paging a guide never writes the source place or reading.last");
      await menu();
      assert.ok((await p.evaluate(() => __pageText)).includes("Back to the text"));
      await choose("guide");
      assert.equal(await workId(), "chopin-desiree");
      assert.equal(await p.locator("#place").textContent(), place, "exact source page restored");
      passed("study guide separates spoilers, toggles its label and returns to the exact text page" + (lying ? " lying" : ""));

      await menu(); await choose("guide");
      await menu(); await choose("mood"); await choose("night"); await choose("size");
      await p.locator("#page").screenshot({ path: path.join(out, `guide-menu-modern-night${lying ? "-lying" : ""}.png`) });
      await menu();
      await p.locator("#page").screenshot({ path: path.join(out, `guide-modern-night${lying ? "-lying" : ""}.png`) });
      assert.equal((await saved()).last, "chopin-desiree");
      await menu(); await choose("guide");
      const expectedPlace = await p.evaluate(async anchor => {
        const { layoutWork, pageForAnchor } = await import("./reader.js?v=23");
        const { LIBRARY } = await import("./library.js?v=23");
        const pages = layoutWork(document.querySelector("#page").getContext("2d"), LIBRARY.find(w=>w.id === "chopin-desiree"), 2,
          { serif: "Helvetica Neue, Helvetica, Arial, sans-serif", titleStyle: "bold" });
        return `Page ${pageForAnchor(pages, anchor) + 1} of ${pages.length}`;
      }, original.places["chopin-desiree"].anchor);
      assert.equal(await p.locator("#place").textContent(), expectedPlace);
      await menu(); await choose("guide");
      await p.reload();
      await p.waitForFunction(() => document.querySelector("#page").dataset.work === "chopin-desiree");
      assert.equal(await p.locator("#place").textContent(), expectedPlace);
      passed("guide size/style changes preserve source words; reload resumes the real text" + (lying ? " lying" : ""));

      await p.locator("#enter:not([disabled])").click(); await p.evaluate(() => __center());
      await menu(); await choose("guide");
      await menu(); await choose("library");
      await choose({ x: 274, y: 700 + 1 * 124, w: 1500, h: 112 });
      assert.equal(await workId(), "blake-sick-rose");
      assert.equal((await saved()).last, "blake-sick-rose");
      await menu(); await choose("guide");
      assert.equal(await workId(), "guide:blake-sick-rose");
      await menu(); await choose("library");
      await choose({ x: 274, y: 700, w: 1500, h: 112 });
      await p.locator("#next").click();
      await menu(); await choose("guide");
      assert.ok((await p.evaluate(() => __pageText)).includes("No study guide for this text."));
      await menu(); await choose("guide");
      assert.match(await p.locator("#place").textContent(), /Page 2 of 2/);
      assert.deepEqual(errors, []);
      passed("choosing another work leaves its old guide behind; sampler fallback preserves its page" + (lying ? " lying" : ""));
      await p.close();
    }
    {
      const p = await browser.newPage(), errors = [];
      p.on("pageerror", e => errors.push(e.message));
      await p.clock.setFixedTime(new Date(2026, 9, 28, 20));
      await mock(p, "layer", false);
      await p.addInitScript(() => {
        localStorage.setItem("cabin-today", JSON.stringify({ date: "2026-10-28", picks: {
          story: { title: "A cached story", author: "Test author", text: "The source text.",
            guide: { context: "Before the story.", notice: ["Watch the words."], themes: "After the story.", questions: ["Why?"] } }
        } }));
      });
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click(); await p.evaluate(() => __center());
      await p.evaluate(() => __hold());
      await p.evaluate(async () => __aim("library")); await p.evaluate(() => __pinch());
      await p.evaluate(async () => __aim({ x:274, y:700, w:1500, h:112 })); await p.evaluate(() => __pinch());
      const sourceId = await p.locator("#page").getAttribute("data-work");
      assert.match(sourceId, /^today-2026-10-28-story-/);
      await p.evaluate(() => { __mock.look = null; __step(600); __hold(); });
      await p.evaluate(async () => __aim("guide")); await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#page").getAttribute("data-work"), `guide:${sourceId}`);
      await p.clock.setFixedTime(new Date(2026, 9, 29, 0, 0, 5));
      await p.locator("#next").click();
      assert.equal(await p.locator("#page").getAttribute("data-work"), `guide:${sourceId}`);
      await p.evaluate(() => { __mock.look = null; __step(600); __hold(); });
      await p.evaluate(async () => __aim("guide")); await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#page").getAttribute("data-work"), sourceId);
      assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem("cabin-reading")).last), sourceId);
      assert.deepEqual(errors, []);
      passed("cached Claude guide loads offline and returns to its source across midnight");
      await p.close();
    }

};
