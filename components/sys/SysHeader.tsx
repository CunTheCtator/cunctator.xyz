import Link from "next/link";

type Props = {
  tag: string;
  backLabel: string;
  backHref: string;
};

export default function SysHeader({ tag, backLabel, backHref }: Props) {
  return (
    <header className="sys-head">
      <div className="sys-head__brand">
        <span className="sys-head__wordmark">
          cunctator<span>.</span>
        </span>
        <span className="sys-head__tag">{tag}</span>
      </div>
      <nav className="sys-head__nav">
        <Link className="sys-back" href={backHref}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 8H4M7 4 3 8l4 4" />
          </svg>
          {backLabel}
        </Link>
      </nav>
    </header>
  );
}
