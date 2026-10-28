// Static preview only. This does not connect to or start Sunnyvale’s bridge.
import http from "node:http";
import { readFile } from "node:fs/promises";
const allowed = new Set([
  "index.html",
  "style.css",
  "app.js",
  "core.js",
  "gestures.js",
  "hand-badges.js",
  "arrival.js",
  "entry-sound.js",
  "progress.js",
  "calendar.js",
  "watch.js",
  "library.js",
  "reader.js",
  "reading-flow.js",
  "study-guide.js",
  "guide-archive.js",
  "guide-data.js",
  "library-panel.js",
  "ambience.js",
  "gaze.js",
  "picks.js",
  "source-catalogue.js",
  "picker-contract.js",
  "picker-workflow.js",
  "today-panel.js",
  "daily-lines.js",
  "theme.js",
  "shelf-panel.js",
  "SOURCE_CATALOGUE.md",
  "drive.js",
  "config.js",
  "gl.js",
  "CREDITS.md",
  "QUEST_CHECK.md",
  "assets/Literata.ttf",
  "assets/Literata-OFL.txt",
]);
const types = {
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  md: "text/plain",
  ttf: "font/ttf",
  txt: "text/plain",
};
const server = http.createServer(async (req, res) => {
  const name =
    new URL(req.url, "http://localhost").pathname.slice(1) || "index.html";
  if (!allowed.has(name)) return res.writeHead(404).end();
  try {
    const data = await readFile(new URL(name, import.meta.url));
    res.writeHead(200, {
      "Content-Type": types[name.split(".").pop()],
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
server.listen(Number(process.env.PORT || 18140), "127.0.0.1", () =>
  console.log(
    "Static cabin preview: http://127.0.0.1:" + server.address().port,
  ),
);
