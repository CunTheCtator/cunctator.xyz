type Props = {
  label: string;
  href?: string;
  solid?: boolean;
};

export default function ExtLink({ label, href, solid }: Props) {
  return (
    <a
      className={"pr-link" + (solid ? " pr-link--solid" : "")}
      href={href || "#"}
      target={href && href.startsWith("http") ? "_blank" : undefined}
      rel={href && href.startsWith("http") ? "noreferrer noopener" : undefined}
    >
      {label}
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l6-6M4 3h5v5" />
      </svg>
    </a>
  );
}
