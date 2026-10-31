/**
 * Firework confetti over the home page's MCP v2 banner.
 *
 * Side-effect module like `fade-in-observer`: fires once per browser
 * session (sessionStorage gate) when `#spec-confetti` is present, skipped
 * under prefers-reduced-motion. Three radial bursts across the banner,
 * evenly spaced angles with jitter, decelerating and fading in place (no
 * gravity pull); the last burst lingers ~700 ms longer. Pieces animate via
 * the Web Animations API and remove themselves. No-op on other pages.
 */
const COLORS = ["#8b5cf6", "#06b6d4", "#d97706", "#22c55e", "#fafafa"];
const BURSTS = [
  { x: 25, delay: 0, linger: 0 },
  { x: 50, delay: 140, linger: 0 },
  { x: 75, delay: 280, linger: 700 },
];
const PIECES = 42;

function specConfetti(): void {
  const layer = document.getElementById("spec-confetti");
  if (!layer || layer.dataset.done) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    if (sessionStorage.getItem("spec-confetti-shown")) return;
    sessionStorage.setItem("spec-confetti-shown", "1");
  } catch {
    // Private mode: fall back to once per page view.
  }
  layer.dataset.done = "1";

  for (const burst of BURSTS) {
    for (let i = 0; i < PIECES; i++) {
      const piece = document.createElement("span");
      const size = 4 + Math.random() * 4;
      piece.style.cssText = [
        "position:absolute",
        "top:50%",
        `left:${burst.x}%`,
        `width:${size}px`,
        `height:${size * 0.6}px`,
        `background:${COLORS[i % COLORS.length]}`,
        "border-radius:1px",
      ].join(";");
      layer.appendChild(piece);

      const angle = (i / PIECES) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 70 + Math.random() * 150;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const spin = (Math.random() - 0.5) * 720;
      piece
        .animate(
          [
            { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
            { transform: `translate(${dx * 0.85}px,${dy * 0.85}px) rotate(${spin * 0.7}deg) scale(1)`, opacity: 1, offset: 0.6 },
            { transform: `translate(${dx}px,${dy}px) rotate(${spin}deg) scale(0.6)`, opacity: 0 },
          ],
          {
            duration: 700 + Math.random() * 300 + burst.linger,
            delay: burst.delay,
            easing: "cubic-bezier(0.1, 0.8, 0.3, 1)",
            fill: "forwards",
          },
        )
        .finished.then(() => piece.remove())
        .catch(() => piece.remove());
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", specConfetti, { once: true });
} else {
  specConfetti();
}
