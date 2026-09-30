"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

const format = (value: number): string => value.toLocaleString("en-IN");

/**
 * A count from the ledger that runs up once as it scrolls into view.
 *
 * The server renders the real number, so a reader without JavaScript, a
 * search engine and a screen reader all get it as it is. The animation only
 * replaces it with a smaller number for a number the reader cannot see yet,
 * and never when the reader has asked for reduced motion. The moving digits
 * are hidden from assistive technology, which is given the final value once.
 */
export function CountUp({ value }: { readonly value: number }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const element = ref.current;
    if (element === null || value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;
    const box = element.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;

    setShown(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 900;
        const step = (now: number): void => {
          const t = Math.min(1, (now - start) / duration);
          setShown(Math.round(value * (1 - (1 - t) ** 3)));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
