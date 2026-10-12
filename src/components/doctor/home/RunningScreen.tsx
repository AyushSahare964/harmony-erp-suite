import { useEffect, useState, type ReactNode } from "react";

const PawDot = () => (
  <svg className="pawdot vd-pawdot" viewBox="0 0 40 40" aria-hidden="true">
    <ellipse cx="20" cy="27" rx="9" ry="7.5" />
    <ellipse cx="8" cy="17" rx="3.6" ry="4.8" transform="rotate(-20 8 17)" />
    <ellipse cx="15" cy="10" rx="3.6" ry="5" />
    <ellipse cx="25.5" cy="10" rx="3.6" ry="5" />
    <ellipse cx="32.5" cy="17" rx="3.6" ry="4.8" transform="rotate(20 32.5 17)" />
  </svg>
);

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Light blue board holding the ONLY running text.
 * Slides right to left forever and respects prefers-reduced-motion.
 */
export function RunningScreen({ messages }: { messages: ReactNode[] }) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!reduced) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % messages.length), 5000);
    return () => window.clearInterval(timer);
  }, [reduced, messages.length]);

  return (
    <div className={`screen vd-screen${reduced ? " reduced is-reduced" : ""}`}>
      <div className="track vd-track">
        <div className="marquee vd-marquee" id="marquee">
          {reduced ? (
            <div className="item vd-item">
              <span>{messages[index]}</span>
            </div>
          ) : (
            // Rendered twice so the loop has no gap (the animation slides by -50%).
            [0, 1].flatMap((copy) =>
              messages.map((m, i) => (
                <div className="item vd-item" key={`${copy}-${i}`} aria-hidden={copy === 1}>
                  <span>{m}</span>
                  <PawDot />
                </div>
              )),
            )
          )}
        </div>
      </div>
    </div>
  );
}
