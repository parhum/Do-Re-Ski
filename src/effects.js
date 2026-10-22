/** Short-lived snow bursts and floating text. */
export class Effects {
  particles = [];
  labels = [];

  constructor({ reducedMotion = false } = {}) {
    this.reducedMotion = reducedMotion;
  }

  burst(x, y, color, count) {
    const total = this.reducedMotion ? Math.ceil(count / 3) : count;
    for (let i = 0; i < total; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.6 + Math.random() * 0.4,
        radius: 2 + Math.random() * 2.5,
        color,
      });
    }
  }

  text(x, y, text, color, size) {
    this.labels.push({ x, y, text, color, size, life: 1.1 });
  }

  /** @param {number} drift upward scroll speed of the slope, in px/s */
  update(seconds, drift) {
    for (const p of this.particles) {
      p.x += p.vx * seconds;
      p.y += p.vy * seconds - drift * seconds * 0.5;
      p.vy += 160 * seconds;
      p.life -= seconds;
    }
    for (const label of this.labels) {
      label.y -= 30 * seconds;
      label.life -= seconds;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.labels = this.labels.filter((label) => label.life > 0);
  }

  clear() {
    this.particles = [];
    this.labels = [];
  }
}
