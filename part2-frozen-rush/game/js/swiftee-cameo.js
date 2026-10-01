/* SWIFTEE, FLYING IN TO HELP (the user's new sequence: "add swiftee for helping dialogue delivery
 * and swiftee come by flying").
 *
 * At the broken path, the tutorial's last held moment, the lesson's bird flies into Frozen Rush:
 * in from the top right on one curve, wings going, and hovers in the open sky beside Momo while he
 * says why the lesson comes next. Then the page hands over to his lesson.
 *
 * ONE DRAWING OF HIM AT A TIME. The art is the lesson's own flight strip (four frames,
 * part1-swiftee-lesson/assets/swiftee/swiftee-inspect-flight.webp, copied here so this page needs
 * nothing from the other one), drawn one frame at a time on a canvas — never two pictures
 * cross-faded (the lesson's "two Swiftees" bug).
 *
 * It is a DOM layer over the stage, beside the tutorial's (not inside it — the tutorial hides its
 * whole layer between steps), positioned in the stage's own 1920 x 1080 as percentages, the same
 * way the tutorial places its bubble. It plays no sound of its own: the voice is the tutorial's
 * line, through the game's one voice track, so nothing of the lesson's sound is brought here.
 */
import { ASSET_V } from './asset-versions.js';

const SW = 1920, SH = 1080;
const FLIGHT = 'assets/char/swiftee-flight.webp';
const FRAMES = 4, FW = 543, FH = 724;         // the strip: 2172 x 724, four frames side by side
const STEP_MS = 110;                          // a wingbeat frame, as the lesson flies it
const BOX_W = 250;                            // his width on the stage, in stage px (Momo is ~420 wide)

const ease = (t) => 1 - Math.pow(1 - t, 3);   // in fast, settling onto the hover

export class SwifteeCameo {
  constructor(root) {
    this.root = root;
    this.el = null; this.ctx = null; this.img = null;
    this.ready = null; this.raf = 0; this.frame = -1; this.gone = false;
  }

  /** Fetch and decode the strip now, so it is in hand by the time he is needed. */
  load() {
    if (this.ready) return this.ready;
    this.ready = new Promise((res) => {
      const img = new Image();
      const v = ASSET_V && ASSET_V[FLIGHT];
      img.onload = () => {
        const p = img.decode ? img.decode() : Promise.resolve();
        p.then(() => res(true), () => res(true));
      };
      img.onerror = () => res(false);
      img.src = FLIGHT + (v ? '?v=' + v : '');
      this.img = img;
    });
    return this.ready;
  }

  _build() {
    if (this.el) return true;
    const layer = this.root.getElementById('tutorial');
    const parent = layer && layer.parentElement;
    if (!parent) return false;
    const el = this.root.createElement('div');
    el.className = 'sw-cameo';
    el.setAttribute('aria-hidden', 'true');
    const c = this.root.createElement('canvas');
    c.width = FW; c.height = FH;
    el.appendChild(c);
    parent.insertBefore(el, layer.nextSibling);
    this.el = el;
    this.ctx = c.getContext('2d');
    return true;
  }

  _draw(n) {
    if (!this.ctx || !this.img || n === this.frame) return;
    this.frame = n;
    this.ctx.clearRect(0, 0, FW, FH);
    this.ctx.drawImage(this.img, n * FW, 0, FW, FH, 0, 0, FW, FH);
  }

  /* his centre at (x, y) in stage px; facing -1 looks left (the strip is drawn facing right) */
  _place(x, y, facing, tilt) {
    const w = BOX_W, h = BOX_W * FH / FW, s = this.el.style;
    s.left = ((x - w / 2) / SW * 100).toFixed(3) + '%';
    s.top = ((y - h / 2) / SH * 100).toFixed(3) + '%';
    s.width = (w / SW * 100).toFixed(3) + '%';
    s.height = (h / SH * 100).toFixed(3) + '%';
    s.transform = 'scaleX(' + facing + ') rotate(' + tilt.toFixed(1) + 'deg)';
  }

  /** Where his head is when he hovers at (x, y): what the tutorial's bubble points at. */
  static headOf(at) { return { x: at.x, y: at.y - BOX_W * FH / FW * 0.22 }; }

  /**
   * In from `from` to `to` (stage px) over `ms`, then hovering there with a small wingbeat bob
   * until hide(). Resolves when he has arrived. With reduced motion he is simply there.
   */
  flyIn(from, to, ms = 1500, reduced = false) {
    return this.load().then((ok) => {
      if (!ok || this.gone || !this._build()) return;
      const facing = to.x < from.x ? -1 : 1;
      // the curve bows up and over: a control point above the middle of the way
      const cx = (from.x + to.x) / 2, cy = Math.min(from.y, to.y) - 160;
      const t0 = performance.now();
      return new Promise((done) => {
        let arrived = false;
        const tick = (now) => {
          if (this.gone) { done(); return; }
          const el = now - t0;
          this._draw(Math.floor(el / STEP_MS) % FRAMES);
          const u = reduced ? 1 : Math.min(1, el / ms), e = ease(u);
          let x, y, tilt;
          if (u < 1) {
            x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * cx + e * e * to.x;
            y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * cy + e * e * to.y;
            tilt = 10 * (1 - e);                  // leaning into the dive, levelling as he arrives
          } else {
            if (!arrived) { arrived = true; done(); }
            x = to.x; y = to.y + (reduced ? 0 : Math.sin((el - ms) / 340 * 2 * Math.PI) * 6);
            tilt = 0;
          }
          this._place(x, y, facing, tilt);
          this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
      });
    });
  }

  /** Off the stage, for good (the page is handing over, or the tutorial has ended). */
  hide() {
    this.gone = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
  }
}
