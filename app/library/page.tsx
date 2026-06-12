import Link from "next/link";
import SystemBar from "@/components/SystemBar";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import LibraryArchive, { type ArchiveDoc } from "@/components/LibraryArchive";
import CodexStripCard from "@/components/CodexStripCard";
import { getAllDocuments } from "@/lib/db";
import type { Document } from "@/lib/db";

export const metadata = {
  title: "The Library | cunctator",
  description: "The writing archive: worldbuilding, lore, and chronicles of the Alder World, each document rendered exactly as written.",
};

function ArrowSvg() {
  return (
    <svg
      width="16"
      height="11"
      viewBox="0 0 16 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 5.5h13M10 1l4 4.5-4 4.5" />
    </svg>
  );
}

function adaptDocument(doc: Document): ArchiveDoc {
  return {
    id: doc.id,
    kind: doc.tags[0] ? doc.tags[0].replace(/^./, (c) => c.toUpperCase()) : "Document",
    title: doc.title,
    desc: doc.description,
    tags: doc.tags,
    star: doc.featured,
    uploadedAt: doc.uploaded_at,
  };
}

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  const docs = getAllDocuments().map(adaptDocument);
  const hasDocs = docs.length > 0;
  const total = docs.length;
  const categoryCount = new Set(docs.map((d) => d.kind)).size;
  const devlogDocs = docs.filter((d) => d.tags.some((t) => t.toLowerCase() === "devlog"));
  const showcaseDoc = docs.find((d) => d.star) ?? docs[0] ?? null;
  const earliest = [...docs].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))[0] ?? null;
  const firstEntry = earliest
    ? new Date(earliest.uploadedAt).toLocaleDateString("en-US", { month: "short" })
    : null;
  const sinceLabel = earliest
    ? new Date(earliest.uploadedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()
    : null;

  return (
    <div className="hp vh">
      <SystemBar />
      <Nav />

      <header className="vc-hero">
        <div className="vc-hero__grid" />
        <div className="vc-hero__in">
          <div className="vb-kicker vb-mono">THE LIBRARY</div>
          <h1 className="lb-h1">
            Written, and
            <br />
            <span className="dot">kept.</span>
          </h1>
          <p className="vc-lead">
            Worldbuilding, lore, and the occasional essay. Each piece written as a
            self-contained document and rendered here exactly as it was made.
          </p>
          <p className="vc-sub">
            The Alder World is the centerpiece. It isn&apos;t the only thing on the shelves.
          </p>
        </div>
      </header>

      {hasDocs && (
        <>
          <div className="lb-shead">
            <div>
              <div className="lb-shead__k">SHOWCASE</div>
              <h2 className="lb-shead__t">The featured collection</h2>
            </div>
          </div>
          <section className="lb-showcase">
            <div className="lb-showcase__card">
              <div className="lb-showcase__body">
                <div className="lb-showcase__eyebrow">
                  <span className="vc-live" />
                  {sinceLabel ? `ARCHIVE LIVE SINCE ${sinceLabel}` : "ARCHIVE LIVE"}
                </div>
                <h3 className="lb-showcase__title">The Alder World</h3>
                <p className="lb-showcase__desc">
                  An ongoing fantasy setting: its calendars, houses, histories, and the
                  small true details that make a world feel lived-in. Each entry stands on
                  its own.
                </p>
                <div className="lb-showcase__stats">
                  <div>
                    <div className="lb-stat__v">{total}</div>
                    <div className="lb-stat__l">Documents</div>
                  </div>
                  <div>
                    <div className="lb-stat__v">{categoryCount}</div>
                    <div className="lb-stat__l">Categories</div>
                  </div>
                  {firstEntry && (
                    <div>
                      <div className="lb-stat__v">{firstEntry}</div>
                      <div className="lb-stat__l">First entry</div>
                    </div>
                  )}
                </div>
                <div className="lb-showcase__foot">
                  <Link className="lb-enter" href="#archive">
                    Enter the collection
                    <ArrowSvg />
                  </Link>
                </div>
              </div>
              {showcaseDoc && (
                <Link className="lb-doc" href={`/library/${showcaseDoc.id}`}>
                  <div className="lb-doc__kicker">
                    {showcaseDoc.kind}
                    {showcaseDoc.star ? " · Featured" : ""}
                  </div>
                  <div className="lb-doc__title">{showcaseDoc.title}</div>
                  <div className="lb-doc__rule" />
                  {showcaseDoc.desc ? (
                    <p>{showcaseDoc.desc}</p>
                  ) : (
                    <p>Open the document to read it as it was written.</p>
                  )}
                </Link>
              )}
            </div>
          </section>
        </>
      )}

      <div className="lb-shead" id="archive">
        <div>
          <div className="lb-shead__k">ARCHIVE</div>
          <h2 className="lb-shead__t">Everything on the shelves</h2>
        </div>
        <div className="lb-shead__count">
          {hasDocs ? `${total} documents · newest first` : "0 documents"}
        </div>
      </div>

      {hasDocs ? (
        <LibraryArchive docs={docs} />
      ) : (
        <section className="lb-empty">
          <div className="st-empty st-empty--archive">
            <div className="st-empty__ico">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5V5.5Z" />
                <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5V5.5Z" />
              </svg>
            </div>
            <div className="st-empty__k">Shelves empty</div>
            <h3 className="st-empty__t">The first pages are being written</h3>
            <p className="st-empty__s">
              The Alder World is brand new; nothing has been published to the archive yet.
              Check back soon, or follow along while it grows.
            </p>
            <Link className="sys-btn sys-btn--ghost st-empty__cta" href="/">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8H4M7 4 3 8l4 4" />
              </svg>
              Back to the site
            </Link>
          </div>
        </section>
      )}

      {devlogDocs.length > 0 && (
        <>
          <div className="lb-shead">
            <div>
              <div className="lb-shead__k">ENGINEERING LOG</div>
              <h2 className="lb-shead__t">How the systems were built</h2>
            </div>
            <div className="lb-shead__count">{devlogDocs.length} entries</div>
          </div>
          <section className="lb-grid">
            {devlogDocs.map((d) => (
              <Link className="lb-card" href={`/library/${d.id}`} key={`dev-${d.id}`}>
                <div className="lb-card__top">
                  <span className="lb-card__kind">Devlog</span>
                  {d.star && <span className="lb-card__star">★ Featured</span>}
                </div>
                <div className="lb-card__title">{d.title}</div>
                <div className="lb-card__desc">{d.desc}</div>
              </Link>
            ))}
          </section>
        </>
      )}

      <CodexStripCard />

      <SiteFooter />
    </div>
  );
}
