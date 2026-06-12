"use client";

import { useState } from "react";

type Props = { value: string };

export default function CopyButton({ value }: Props) {
  const [done, setDone] = useState(false);

  const copy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      })
      .catch((err) => {
        console.error("[contact] clipboard write failed:", err);
      });
  };

  return (
    <button className="ct-btn ct-btn--ghost" onClick={copy} type="button">
      {done ? (
        <>
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 8l3 3 6-7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 4.5V3A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h1.5" />
          </svg>
          Copy address
        </>
      )}
    </button>
  );
}
