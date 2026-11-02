// THE SPEECH BUBBLE — the supplied Bubble.svg, rebuilt as geometry.

export const BUBBLE = {
  fill: '#FFFFFF',        // white inside, on request
  ink: '#3FB3E8',         // a bright icy blue keyline, between CFG.colors.cyanIce and edge
  stroke: 7,              // px, at stage size
  radius: 26,             // px
  tailBase: 0.2,          // fraction of the body width
  tailBaseMax: 150,       // px
  tailLen: 0.17,          // fraction of the body height
  tailLenMin: 56, tailLenMax: 110
};

const lim = (v, a, b) => v < a ? a : v > b ? b : v;   // not `clamp`: the bundle shares one scope with engine.js
const f = n => (Math.round(n * 10) / 10).toString();

export function bubblePath(w, h, tail) {
  const s = BUBBLE.stroke, r = Math.max(22, Math.min(BUBBLE.radius, w * 0.08, h * 0.3));
  const x0 = s / 2, y0 = s / 2, x1 = w - s / 2, y1 = h - s / 2;
  let d = `M${f(x0 + r)} ${f(y0)} H${f(x1 - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)} ` +
          `V${f(y1 - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)} `;
  let tailLen = 0;
  if (tail) {
    const L = tail.len || lim(h * BUBBLE.tailLen, BUBBLE.tailLenMin, BUBBLE.tailLenMax);
    tailLen = L;
    const bw = Math.min(BUBBLE.tailBaseMax, w * BUBBLE.tailBase, L * 0.8);
    const lean = tail.lean < 0 ? -1 : 1;
    const cx = lim((tail.at === undefined ? 0.5 : tail.at) * w, r + bw / 2 + 6, w - r - bw / 2 - 6);
    const b0 = cx - bw / 2, b1 = cx + bw / 2;          // where the tail leaves the body
    const tipX = cx + lean * bw * 0.62, tipY = y1 + L;   // the tip, off to the leaning side
    if (lean < 0) {
      d += `H${f(b1)} C${f(b1 - bw * 0.08)} ${f(y1 + L * 0.62)}, ${f(tipX + bw * 0.34)} ${f(tipY - L * 0.28)}, ${f(tipX)} ${f(tipY)} ` +
           `C${f(tipX + bw * 0.06)} ${f(tipY - L * 0.5)}, ${f(b0 + bw * 0.1)} ${f(y1 + L * 0.3)}, ${f(b0)} ${f(y1)} `;
    } else {
      d += `H${f(b1)} C${f(b1 - bw * 0.1)} ${f(y1 + L * 0.3)}, ${f(tipX - bw * 0.06)} ${f(tipY - L * 0.5)}, ${f(tipX)} ${f(tipY)} ` +
           `C${f(tipX - bw * 0.34)} ${f(tipY - L * 0.28)}, ${f(b0 + bw * 0.08)} ${f(y1 + L * 0.62)}, ${f(b0)} ${f(y1)} `;
    }
  }
  d += `H${f(x0 + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)} V${f(y0 + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)} Z`;
  return { d, tailLen };
}

export function fitBubble(svg, box, tail) {
  if (!svg || !box) return 0;
  const w = Math.max(40, Math.round(box.offsetWidth)), h = Math.max(30, Math.round(box.offsetHeight));
  const { d, tailLen } = bubblePath(w, h, tail ? { at: tail.at, lean: tail.lean } : null);
  const H = h + tailLen;
  svg.setAttribute('viewBox', `0 0 ${w} ${H}`);
  svg.style.width = w + 'px';
  svg.style.height = H + 'px';
  const above = tail && tail.side === 'above';
  svg.style.top = above ? (-tailLen) + 'px' : '0px';
  svg.style.transform = above ? 'scaleY(-1)' : 'none';
  const path = svg.querySelector('path');
  if (path) path.setAttribute('d', d);
  return tailLen;
}
