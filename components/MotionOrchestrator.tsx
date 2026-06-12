"use client";

import { useEffect } from "react";

const ENTRANCE_KEY = "vc_entrance_played";

export default function MotionOrchestrator() {
  useEffect(() => {
    const root = document.querySelector(".hp.vh");
    if (!(root instanceof HTMLElement)) {
      console.error("MotionOrchestrator: .hp.vh root not found, skipping motion");
      return;
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let played = false;
    try {
      played = sessionStorage.getItem(ENTRANCE_KEY) === "1";
    } catch (err) {
      console.error("MotionOrchestrator: sessionStorage unavailable", err);
    }

    if (prefersReduced || played) {
      root.setAttribute("data-mt", "done");
    } else {
      root.setAttribute("data-mt", "play");
      try {
        sessionStorage.setItem(ENTRANCE_KEY, "1");
      } catch (err) {
        console.error("MotionOrchestrator: could not persist entrance flag", err);
      }
    }

    const targets = Array.from(root.querySelectorAll("[data-reveal]")).filter(
      (t): t is HTMLElement => t instanceof HTMLElement
    );
    if (targets.length === 0) return;

    if (prefersReduced || !("IntersectionObserver" in window)) {
      for (const t of targets) t.setAttribute("data-reveal", "in");
      return;
    }

    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    for (const t of targets) {
      const r = t.getBoundingClientRect();
      const alreadyVisible = r.top < viewportH * 0.9 && r.bottom > 0;
      t.setAttribute("data-reveal", alreadyVisible ? "in" : "out");
    }

    const pending = targets.filter((t) => t.getAttribute("data-reveal") === "out");
    if (pending.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (!(e.target instanceof HTMLElement)) continue;
          e.target.setAttribute("data-reveal", "in");
          obs.unobserve(e.target);
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
    );
    for (const t of pending) obs.observe(t);
    return () => obs.disconnect();
  }, []);

  return null;
}
