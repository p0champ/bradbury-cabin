# Build 052 — "Lamp on" arrival

Bastian found the intro empty: nothing happened after placing the window. He asked for an arrival that feels calm and premium, "like unboxing a new Apple device", 5–8 seconds long and ending on Today. The welcome screen and the cozy reading mood were to stay as they were. Three ideas went to an independent judge: Lamp on (8/10), Lifting the lid (6/10) and Three cards (5/10). The judge picked Lamp on with two refinements: fade the header in place, and make the glow rise gently with no flash. Bastian approved it before building. It was built overnight at his request and is **not published**.

## What happens

After the placing pinch (about 5 s in all):

1. **Lamp (0–2.6 s).** The window fades in over 1.4 s. A warm glow rises gently to a soft peak (no flash, no hard edge) and settles away by 2.6 s.
2. **Header (2.0–2.9 s).** "Today" and the date fade in where they belong. They do not move.
3. **Readings (2.7–4.4 s).** The poem, story and essay each rise about 1 cm while fading in, 0.38 s apart. The bottom buttons follow. Everything is still from about 4.6 s, and Today is live at 5.0 s.

- **Skip.** A fresh pinch, begun at least 0.4 s after placement, goes straight to Today. That pinch's release is consumed, so it can never select a reading. The placing pinch's own release and an early-begun press never skip.
- **Reduced motion.** A single 0.3 s fade straight into Today, with no glow or movement.
- **Head-tracking loss** pauses the arrival without showing the finished page.
- **Desktop comparison view** keeps its old 0.2 s fade.

## How

- **Drawn once, composed on the GPU.** The arrival's pieces are painted once: the bare glass, the warm glow (512 px, scaled up smoothly) and Today cut into header, reading and footer bands. Every frame, they are composed on the GPU into the native page image, reusing Build 051's composition path.
- **No per-frame page uploads.** Sprites gained a per-sprite opacity and a revision key.
- **Textures freed.** The pieces' textures are released as soon as Today shows.
- **Untouched.** Gesture recognition, placement and Today itself are unchanged.

## Verification (desktop Chromium, synthetic XR; not a Quest)

- 220 unit tests, including 4 new arrival timeline tests, plus all source checks pass.
- New native-pixel checks (`tests/lamp-arrival-browser.cjs`), upright and lying:
  - At 0.9 s the glass is visibly warmer and the window is still fading in, with no words yet.
  - At 2.5 s the header is visible and the readings are not.
  - At 3.25 s the readings are staggered.
  - The arrival ends at about 5 s on Today.
  - The fully revealed lamp image matches the real Today headset image.
  - No page uploads happen during the arrival, and more than 150 GPU compositions do.
- Skip, tracking-loss and reduced-motion checks pass.
- **Bug caught before commit.** An else-chain slip made Today paint the Notes page on top. The visual inspection caught it and it was fixed. The lamp check was strengthened so it now fails on that bug (mutation-tested).
- **Test-harness changes.** The arrival is longer, so the shared `__center` helper now lets it play out (`__finishArrival`), and a few older tests wait for it before checking Today. The projection-GL-error fixture now injects its error into projection draws only, since GPU composition has its own named stage. The FBO guard allows quad-texture attachment during the lamp only.
- **Full browser suite: 295/295** in one clean run (Build 051's 290 + 5 lamp checks).

## Not verified

No Quest result. Comfort of the 5 s length on every visit, the warmth of the glow over a real room, and GPU cost on the headset all need Bastian's check.
