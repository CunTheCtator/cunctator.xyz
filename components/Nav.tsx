"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, STATUS } from "@/lib/site";

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isCurrent = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <nav className="hp-nav">
      <Link href="/" className="hp-nav__brand">
        cunctator<span>.</span>
      </Link>
      <div className="hp-nav__links">
        {NAV.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            {...(isCurrent(l.href) ? { "data-current": "" } : {})}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <button
        className="hp-nav__menu"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <div className="mnav-overlay">
          <div className="mnav__sysbar">
            <span>
              CUNCTATOR <b>//</b> SYSTEM
            </span>
            <span>
              STATUS: <b>ONLINE</b>
            </span>
          </div>
          <div className="mnav__top">
            <Link href="/" className="mnav__brand" onClick={() => setOpen(false)}>
              cunctator<span>.</span>
            </Link>
            <button
              className="mnav__close"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          <div className="mnav__panel">
            <div className="mnav__panel-grid" />
            <nav className="mnav__links">
              {NAV.map((l, i) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="mnav__link"
                  onClick={() => setOpen(false)}
                  {...(isCurrent(l.href) ? { "data-current": "" } : {})}
                >
                  {l.label}
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                </Link>
              ))}
            </nav>
            <div className="mnav__foot">
              <span className="ok">
                <span className="d" />
                {STATUS.toUpperCase()}
              </span>
              <span>{String(NAV.length).padStart(2, "0")} SECTIONS</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
