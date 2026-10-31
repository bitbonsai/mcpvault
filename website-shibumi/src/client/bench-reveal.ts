/**
 * Grow-in animation trigger for the /benchmarks/ charts.
 *
 * Side-effect module like `fade-in-observer`: not an Alpine.data() module,
 * because it needs no state or events, only a class toggle when a chart
 * card scrolls into view (`.bench-card.in-view .bench-bar` runs the CSS
 * `bench-grow` keyframe). No-op on pages without `.bench-card`.
 */
function watchBenchCards(): void {
  const cards = document.querySelectorAll(".bench-card");
  if (cards.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    for (const card of cards) card.classList.add("in-view");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.3 },
  );
  for (const card of cards) observer.observe(card);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", watchBenchCards, { once: true });
} else {
  watchBenchCards();
}
