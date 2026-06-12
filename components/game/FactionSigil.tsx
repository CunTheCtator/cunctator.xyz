type Props = {
  id: string;
  style?: React.CSSProperties;
};

export default function FactionSigil({ id, style }: Props) {
  const s: React.CSSProperties = { width: "100%", height: "100%", display: "block", ...style };
  if (id === "covenant") {
    return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "syndicate") {
    return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z" />
        <path d="M12 8.5l3.5 2v3L12 15.5l-3.5-2v-3z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "vrath") {
    return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M12 3l9 16H3z" />
        <path d="M12 10l3.5 6h-7z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "pirates") {
    return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M12 3l2.4 5.6 6 .5-4.6 4 1.4 5.9L12 17l-5.6 3 1.4-5.9-4.6-4 6-.5z" />
      </svg>
    );
  }
  if (id === "locked") {
    return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="5" y="10.5" width="14" height="9" rx="1.5" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l9 9-9 9-9-9z" />
    </svg>
  );
}
