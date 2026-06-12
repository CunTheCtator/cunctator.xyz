type Props = { label?: string };

export default function ArrowRight({ label }: Props) {
  return (
    <span className="vc-card__go">
      {label}
      <svg
        width="16"
        height="11"
        viewBox="0 0 16 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 5.5h13M10 1l4 4.5-4 4.5" />
      </svg>
    </span>
  );
}
