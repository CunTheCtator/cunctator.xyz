"use client";

import { useEffect, useRef } from "react";
import type { GameEvent } from "@/game/engine/types";

type Props = { events: GameEvent[] };

function renderRich(text: string): React.ReactNode[] {
  return text.split(/(\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <b key={i}>{part.slice(1, -1)}</b>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function EventLog({ events }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="rm-log" ref={ref}>
      {events.map((e) => (
        <div key={e.id} className="rm-logitem" data-k={e.kind}>
          <span className="rm-logitem__t">T{e.turn}</span>
          <span className="rm-logitem__x">{renderRich(e.text)}</span>
        </div>
      ))}
    </div>
  );
}
