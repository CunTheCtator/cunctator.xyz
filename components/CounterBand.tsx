"use client";

import { useEffect, useRef, useState } from "react";
import type { Counter } from "@/lib/site";

type Props = { counters: Counter[] };

function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const playedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setShown(value);
      playedRef.current = true;
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !playedRef.current) {
            playedRef.current = true;
            const start = performance.now();
            const dur = 1000;
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / dur);
              const eased = 1 - Math.pow(1 - t, 3);
              setShown(Math.round(eased * value));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [value]);

  return <span ref={ref}>{shown}</span>;
}

export default function CounterBand({ counters }: Props) {
  return (
    <>
      <div className="vc-counts">
        {counters.map((c) => (
          <div className="vc-count" key={c.label}>
            <div className="vc-count__v">
              {c.value === 0 ? (
                <span className="vc-count__v--ph">·</span>
              ) : typeof c.value === "number" ? (
                <AnimatedNumber value={c.value} />
              ) : (
                c.value
              )}
            </div>
            <div className="vc-count__l">{c.label}</div>
            <div className="vc-count__s">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="vc-countsnote">
        <span className="vc-live" />
        Live · recomputed from the library, projects &amp; game data
      </div>
    </>
  );
}
