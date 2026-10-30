import { SEASON_COLOURS } from './comfort.js?v=55';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const CARD = Object.freeze({ width: 800, height: 900, metresWide: .29, metresHigh: .32625 });
export function paintWordCard(canvas, result) {
  const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  c.clearRect(0, 0, W, H); c.save();
  function wrap(text, size) {
    c.font = `400 ${size}px ${FONT}`;
    const lines=[]; let line='';
    for (const word of String(text || '').split(/\s+/)) {
      const next=line?`${line} ${word}`:word;
      if(line && c.measureText(next).width>W-88){lines.push(line);line=word;}else line=next;
    }
    if(line)lines.push(line);return lines;
  }
  const meaningLines=Math.min(result.background?5:10,wrap(result.meaning,34).length);
  const backgroundLines=result.background?Math.min(6,wrap(result.background,31).length):0;
  const height=Math.min(H,Math.max(360,204+meaningLines*48.28+(backgroundLines?22+backgroundLines*44.02:0)+130));
  c.translate(0,(H-height)/2);
  c.fillStyle = 'rgba(37,43,44,.96)'; c.beginPath(); c.roundRect(2, 2, W - 4, height - 4, 38); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#d0d4d0'; c.font = `500 26px ${FONT}`; c.fillText('WORD NOTE', 44, 66);
  c.fillStyle = '#f5f2e9'; c.font = `550 46px ${FONT}`;
  let title = result.word;
  while (title.length > 1 && c.measureText(title).width > W - 88) title = title.slice(0, -2) + '…';
  c.fillText(title, 44, 132);
  let y = 204;
  function paragraph(text, colour = '#f0eee7', size = 34, end = 720) {
    c.fillStyle = colour; c.font = `400 ${size}px ${FONT}`;
    const lines = []; let line = '';
    for (const word of String(text || '').split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && c.measureText(next).width > W - 88) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    for (let i = 0; i < lines.length && y <= end; i++) {
      let t = lines[i];
      if (y + size * 1.42 > end && i < lines.length - 1) t = t.replace(/\s+\S*$/, '') + '…';
      c.fillText(t, 44, y); y += size * 1.42;
    }
  }
  paragraph(result.meaning, '#f0eee7', 34, result.background ? Math.min(405,height-130) : height-130);
  if (result.background) { y += 22; paragraph(result.background, '#cdd2cd', 31, height-130); }
  y = height-92; paragraph(result.source, '#aebbb6', 22, height-65);
  c.fillStyle = '#cbd2cf'; c.font = `400 25px ${FONT}`;
  c.fillText('Pinch the word again to close', 44, height-42); c.restore();
}

export class ComfortLayers {
  constructor(binding, space, onError = () => {}) {
    Object.assign(this, { binding, space, onError, visible: [], failed: false, card: null, detail: null });
  }
  entry(width, height, metresWide, metresHigh) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const layer = this.binding.createQuadLayer({ space: this.space, layout: 'mono', textureType: 'texture',
      viewPixelWidth: width, viewPixelHeight: height, width: metresWide, height: metresHigh,
      isStatic: false, clearOnAccess: false });
    layer.blendTextureSourceAlpha = true;
    return { canvas, layer, key: '', dirty: true };
  }
  clearVisible() {
    const changed = this.visible.length > 0;
    for (const layer of this.visible) layer.opacity = 0;
    this.visible = []; return changed;
  }
  update(display, note, detail) {
    const previous = this.visible;
    if (this.failed || !display) return this.clearVisible();
    const visible = [];
    const place = (e, x, y, alpha) => {
      // Same reading plane: the card never covers or sits in front of a word.
      const p = new DOMPoint(x, y, 0).matrixTransform(new DOMMatrix(display.matrix));
      e.layer.transform = new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, display.orientation);
      e.layer.opacity = alpha; visible.push(e.layer);
    };
    try {
      if (note) {
        this.card ||= this.entry(CARD.width, CARD.height, CARD.metresWide, CARD.metresHigh);
        const key = JSON.stringify(note.result);
        if (key !== this.card.key) { paintWordCard(this.card.canvas, note.result); this.card.key = key; this.card.dirty = true; }
        place(this.card, note.word.x < 1024 ? -.53 : .53, Math.max(-.24, Math.min(.24, (.5 - note.word.y / 2560) * .9)), 1);
      }
      if (detail) {
        this.detail ||= this.entry(96, 96, .018, .018);
        if (this.detail.key !== detail.season) {
          const c = this.detail.canvas.getContext('2d'); c.clearRect(0, 0, 96, 96);
          c.strokeStyle = SEASON_COLOURS[detail.season]; c.fillStyle = c.strokeStyle; c.lineWidth = 4;
          if (detail.season === 'winter') {
            for (let i = 0; i < 3; i++) { c.save(); c.translate(48,48); c.rotate(i * Math.PI / 3); c.beginPath(); c.moveTo(0,-27); c.lineTo(0,27); c.stroke(); c.restore(); }
          } else if (detail.season === 'autumn' || detail.season === 'spring') {
            c.beginPath(); c.ellipse(48,48,14,27,.5,0,Math.PI*2); c.fill();
          } else { c.beginPath(); c.arc(48,48,12,0,Math.PI*2); c.fill(); }
          this.detail.key = detail.season; this.detail.dirty = true;
        }
        place(this.detail, detail.x, detail.y, detail.alpha);
      }
    } catch (e) { this.failed = true; this.clearVisible(); this.onError(e); return true; }
    for (const layer of previous) if (!visible.includes(layer)) layer.opacity = 0;
    this.visible = visible;
    return previous.length !== visible.length || previous.some((l, i) => l !== visible[i]);
  }
  draw(frame, gpu, activeLayers) {
    try {
      for (const e of [this.card, this.detail]) if (e && this.visible.includes(e.layer) && activeLayers.includes(e.layer) && (e.dirty || e.layer.needsRedraw)) {
        gpu.copyPage(this.binding.getSubImage(e.layer, frame), e.canvas, { premultiplied: true }); e.dirty = false;
      }
    } catch (e) { this.failed = true; this.clearVisible(); this.onError(e); return true; }
    return false;
  }
  dispose() { this.clearVisible(); this.card?.layer.destroy(); this.detail?.layer.destroy(); this.card = this.detail = null; }
}
