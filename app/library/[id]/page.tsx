import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllDocuments, getDocument } from "@/lib/db";
import type { Document } from "@/lib/db";
import DocumentViewer from "@/components/DocumentViewer";
import SysBar from "@/components/sys/SysBar";
import SysHeader from "@/components/sys/SysHeader";
import SysFooter from "@/components/sys/SysFooter";

const BUILD_TAG = "BUILD 2026.06";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const doc = getDocument(parseInt(id, 10));
  if (!doc) return { title: "Not Found" };
  return {
    title: `${doc.title} | The Alder World`,
    description: doc.description || undefined,
  };
}

function docKind(doc: Document): string {
  const first = doc.tags[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Document";
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(n: number): string {
  let out = "";
  let rem = n;
  for (const [value, numeral] of ROMAN) {
    while (rem >= value) {
      out += numeral;
      rem -= value;
    }
  }
  return out || "I";
}

const ArrowL = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8H4M7 4 3 8l4 4" />
  </svg>
);
const ArrowR = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h8M9 4l4 4-4 4" />
  </svg>
);

export default async function DocumentPage({ params }: Props) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  const all = getAllDocuments();
  const idx = all.findIndex((d) => d.id === numId);
  if (idx === -1) notFound();

  const doc = all[idx];
  const prev = all[idx - 1];
  const next = all[idx + 1];
  const total = all.length;
  const entryNum = total - idx;
  const date = new Date(doc.uploaded_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="sys">
      <SysBar status="THE LIBRARY">
        <span className="ok">RENDERING: SANDBOXED</span>
        <span className="hide-sm">
          DOC {String(entryNum).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <span className="hide-sm">{BUILD_TAG}</span>
      </SysBar>

      <SysHeader tag="The Alder World" backLabel="The Library" backHref="/library" />

      <div className="sys-wrap">
        <div className="rd-head">
          <Link className="rd-crumb" href="/library">
            {ArrowL} The Library · Archive
          </Link>
          <div className="rd-meta-top">
            <span className="rd-kind">{docKind(doc)}</span>
            <span className="rd-sep" />
            <span className="rd-dot-date">
              Entry {toRoman(entryNum)} · {date}
            </span>
            {doc.featured && <span className="rd-star">★ Featured</span>}
          </div>
          <h1 className="rd-title">{doc.title}</h1>
          {doc.description && <p className="rd-desc">{doc.description}</p>}
          {doc.tags.length > 0 && (
            <div className="rd-tagrow">
              {doc.tags.map((t) => (
                <span className="rd-tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rd-stagewrap">
          <div className="rd-stagebar">
            <span>document.html · rendered exactly as written</span>
            <span className="live">
              <span className="d" />
              SANDBOXED IFRAME
            </span>
          </div>
          <div className="rd-stage">
            <span className="rd-bracket tr" />
            <span className="rd-bracket bl" />
            <DocumentViewer uuid={doc.uuid} title={doc.title} />
          </div>
        </div>

        {(prev || next) && (
          <div className="rd-nav">
            {prev ? (
              <Link className="rd-nav__card prev" href={`/library/${prev.id}`}>
                <div className="rd-nav__dir">{ArrowL} Previous</div>
                <div className="rd-nav__t">{prev.title}</div>
                <div className="rd-nav__kind">{docKind(prev)}</div>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link className="rd-nav__card next" href={`/library/${next.id}`}>
                <div className="rd-nav__dir">Next {ArrowR}</div>
                <div className="rd-nav__t">{next.title}</div>
                <div className="rd-nav__kind">{docKind(next)}</div>
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>

      <SysFooter />
    </div>
  );
}
