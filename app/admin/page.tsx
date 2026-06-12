"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Document } from "@/lib/db";
import { NAV } from "@/lib/site";
import SysBar from "@/components/sys/SysBar";
import SysHeader from "@/components/sys/SysHeader";
import SysFooter from "@/components/sys/SysFooter";

const BUILD_TAG = "BUILD 2026.06";
const SECTIONS = String(NAV.length).padStart(2, "0");

const Ico = {
  discord: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.3.5a17 17 0 0 1 4.3 1.4 16.6 16.6 0 0 0-13 0A17 17 0 0 1 10.7 3.5L10.4 3A19.8 19.8 0 0 0 5.5 4.4 20.4 20.4 0 0 0 2 18.3a19.9 19.9 0 0 0 6 3l.8-1.2a13 13 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l.8 1.2a19.9 19.9 0 0 0 6-3 20.4 20.4 0 0 0-3.6-13.9ZM9 15.3c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Zm6 0c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Z" />
    </svg>
  ),
  google: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 11v3.3h4.6c-.2 1.2-1.5 3.5-4.6 3.5a5 5 0 0 1 0-10c1.5 0 2.5.6 3 1.1l2.3-2.2C15.8 3.9 14 3 12 3a8.5 8.5 0 1 0 0 17c4.9 0 8.2-3.4 8.2-8.3 0-.6 0-1-.1-1.5H12Z" />
    </svg>
  ),
  github: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.1-1.1-1.5-1.1-1.5-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5a4 4 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .6 1.4.2 2.4.1 2.7a4 4 0 0 1 1 2.7c0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
    </svg>
  ),
  upload: (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  uploadSm: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  star: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1.5l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.4 4.3 13l.8-4.2L2 5.9l4.2-.5L8 1.5Z" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h10M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5Z" />
    </svg>
  ),
  ingest: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
    </svg>
  ),
};

function docKind(doc: Document): string {
  const first = doc.tags[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Document";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;

  if (status === "loading") return <AdminLoading />;
  if (!isAdmin) return <AdminSignIn />;

  return (
    <AdminDashboard
      operator={session?.user?.name ?? session?.user?.email ?? "operator"}
    />
  );
}

/* ============================================================
   SIGN-IN
   ============================================================ */
function AdminSignIn() {
  const providers: { id: string; label: string; icon: ReactNode; meta: string; primary?: boolean }[] = [
    { id: "discord", label: "Continue with Discord", icon: Ico.discord, meta: "PRIMARY", primary: true },
    { id: "google", label: "Continue with Google", icon: Ico.google, meta: "FALLBACK" },
    { id: "github", label: "Continue with GitHub", icon: Ico.github, meta: "FALLBACK" },
  ];

  return (
    <div className="sys">
      <SysBar status="OPERATOR CONSOLE">
        <span className="lock">ACCESS: LOCKED</span>
        <span className="hide-sm">SECTIONS: {SECTIONS}</span>
        <span className="hide-sm">{BUILD_TAG}</span>
      </SysBar>

      <div className="au">
        <div className="au__grid" />
        <div className="au__card">
          <div className="au__bar">
            <span className="au__dot" />
            <span className="au__dot" />
            <span className="au__dot" />
            <span className="au__name">auth.sh</span>
          </div>
          <div className="au__body">
            <div className="au__kicker">
              <span className="d" />
              RESTRICTED · OPERATOR ACCESS
            </div>
            <h1 className="au__title">Sign in to the console</h1>
            <p className="au__lead">
              This panel manages the library: uploads, metadata, and what gets featured.
              Access is limited to the operator.
            </p>
            <div className="au__providers">
              {providers.map((p) => (
                <button
                  key={p.id}
                  className={"au__prov" + (p.primary ? " au__prov--primary" : "")}
                  onClick={() => signIn(p.id, { callbackUrl: "/admin" })}
                >
                  {p.icon}
                  {p.label}
                  <span className="meta">{p.meta}</span>
                </button>
              ))}
            </div>
            <div className="au__foot">
              <span className="d" />
              Non-operator accounts can sign in but won&apos;t see the console. Sessions run
              through the site&apos;s OAuth layer; nothing is stored locally.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   LOADING (session check)
   ============================================================ */
function AdminLoading() {
  return (
    <div className="sys">
      <SysBar status="OPERATOR CONSOLE">
        <span className="lock">VERIFYING…</span>
        <span className="hide-sm">SECTIONS: {SECTIONS}</span>
        <span className="hide-sm">{BUILD_TAG}</span>
      </SysBar>
      <div className="st-load">
        <div className="st-load__card">
          <div className="st-load__bar">
            <span className="au__dot" />
            <span className="au__dot" />
            <span className="au__dot" />
            <span className="au__name">session.sh</span>
          </div>
          <div className="st-load__body">
            <div className="st-load__line">
              <span className="st-load__dot-ok">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="tick" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 7.5l3 3 6-7" />
                </svg>
              </span>
              <span className="lbl">
                Session token <b>found</b>
              </span>
            </div>
            <div className="st-load__line">
              <span className="st-load__spin" />
              <span className="lbl run">Checking operator access…</span>
            </div>
            <div className="st-load__line">
              <span className="st-load__dot-pend">
                <span style={{ width: 5, height: 5, borderRadius: 9, background: "var(--dim)" }} />
              </span>
              <span className="lbl pend">Loading documents</span>
            </div>
            <div className="st-load__progress">
              <i />
            </div>
            <div className="st-load__cap">
              <span className="d" />
              Establishing console session
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function AdminDashboard({ operator }: { operator: string }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const json = await res.json();
      if (json.data) setDocs(json.data as Document[]);
    } catch (err) {
      console.error("[admin] failed to load documents:", err);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadError("");

    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    if (description) form.append("description", description);
    if (tags) {
      const arr = tags.split(",").map((t) => t.trim()).filter(Boolean);
      form.append("tags", JSON.stringify(arr));
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || json.error) {
        setUploadError(json.error ?? "Upload failed");
        return;
      }
      setFile(null);
      setTitle("");
      setDescription("");
      setTags("");
      fetchDocs();
    } catch (err) {
      console.error("[admin] upload failed:", err);
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handlePatch(id: number, update: Partial<Document>) {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const json = await res.json();
      if (json.data) {
        setDocs((prev) => prev.map((d) => (d.id === id ? (json.data as Document) : d)));
      }
    } catch (err) {
      console.error(`[admin] failed to update document ${id}:`, err);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this document?")) return;
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error(`[admin] failed to delete document ${id}:`, err);
    }
  }

  const total = docs.length;
  const featured = docs.filter((d) => d.featured).length;
  const categories = new Set(docs.map(docKind)).size;
  const newest = docs[0];

  return (
    <div className="sys">
      <SysBar status="OPERATOR CONSOLE">
        <span className="ok">ACCESS: GRANTED</span>
        <span className="hide-sm">OP: {operator}</span>
        <button className="sys-bar__signout" onClick={() => signOut({ callbackUrl: "/admin" })}>
          SIGN OUT
        </button>
      </SysBar>

      <SysHeader tag="Library Control" backLabel="Back to the library" backHref="/library" />

      <div className="sys-wrap">
        <div className="ad-tele">
          <div className="ad-tele__cell">
            <div className="ad-tele__v">{String(total).padStart(2, "0")}</div>
            <div className="ad-tele__l">Documents</div>
            <div className="ad-tele__s">on the shelves</div>
          </div>
          <div className="ad-tele__cell">
            <div className="ad-tele__v">
              {String(featured).padStart(2, "0")}
              <span className="u">★</span>
            </div>
            <div className="ad-tele__l">Featured</div>
            <div className="ad-tele__s">surfaced on /library</div>
          </div>
          <div className="ad-tele__cell">
            <div className="ad-tele__v">{String(categories).padStart(2, "0")}</div>
            <div className="ad-tele__l">Categories</div>
            <div className="ad-tele__s">distinct kinds</div>
          </div>
          <div className="ad-tele__cell">
            <div className="ad-tele__v">
              {newest ? (
                <>
                  {new Date(newest.uploaded_at).toLocaleDateString("en-US", { month: "short" })}
                  <span className="u">.</span>
                </>
              ) : (
                "·"
              )}
            </div>
            <div className="ad-tele__l">Last upload</div>
            <div className="ad-tele__s">{newest ? relativeDays(newest.uploaded_at) : "no activity"}</div>
          </div>
        </div>

        <div className="sys-shead">
          <div>
            <div className="sys-shead__k">// INGEST</div>
            <h2 className="sys-shead__t">Upload a document</h2>
          </div>
          <div className="sys-shead__count">self-contained HTML · no size limit</div>
        </div>

        <div className="ad-ingest">
          <div className="ad-ingest__bar">
            <span className="au__dot" />
            <span className="au__dot" />
            <span className="au__dot" />
            <span className="au__name">ingest.sh</span>
          </div>
          <form className="ad-ingest__body" onSubmit={handleUpload}>
            <label
              className={"ad-drop" + (over ? " is-over" : "")}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const f = e.dataTransfer.files[0];
                if (f) setFile(f);
              }}
            >
              <span className="ad-drop__ico">{Ico.upload}</span>
              <span className="ad-drop__t">Drop an .html file</span>
              <span className="ad-drop__s">
                or click to browse · rendered in a
                <br />
                sandboxed iframe exactly as written
              </span>
              {file && <span className="ad-drop__file">▸ {file.name}</span>}
              <input
                type="file"
                accept=".html"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
            </label>
            <div className="ad-fields">
              <div className="ad-field">
                <label>Title</label>
                <input
                  className="ad-input"
                  placeholder="Optional, auto-extracted from <title>"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="ad-field">
                <label>Description</label>
                <input
                  className="ad-input"
                  placeholder="One line for the archive card"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="ad-field">
                <label>Tags</label>
                <input
                  className="ad-input"
                  placeholder="comma, separated, tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
              <div className="ad-ingest__actions">
                <button type="submit" className="sys-btn sys-btn--solid" disabled={!file || uploading}>
                  {Ico.uploadSm}
                  {uploading ? "Uploading…" : "Upload document"}
                </button>
                {uploadError && <span className="ad-error">{uploadError}</span>}
              </div>
            </div>
          </form>
        </div>

        <div className="sys-shead">
          <div>
            <div className="sys-shead__k">// MANAGED</div>
            <h2 className="sys-shead__t">Documents</h2>
          </div>
          <div className="sys-shead__count">
            {total === 0 ? "0 total" : `${total} total · newest first`}
          </div>
        </div>

        {total === 0 ? (
          <div className="st-empty" style={{ marginBottom: 64 }}>
            <div className="st-empty__ico">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V5M8 9l4-4 4 4" />
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <div className="st-empty__k">No documents ingested</div>
            <h3 className="st-empty__t">Nothing on the shelves yet</h3>
            <p className="st-empty__s">
              Drop a self-contained .html file into the ingest panel above to publish your
              first document. It&apos;ll render in a sandboxed iframe exactly as written.
            </p>
          </div>
        ) : (
          <div className="ad-rows">
            {docs.map((doc, i) => (
              <DocRow
                key={doc.id}
                doc={doc}
                n={i + 1}
                onFeature={() => handlePatch(doc.id, { featured: !doc.featured })}
                onSave={handlePatch}
                onDelete={() => handleDelete(doc.id)}
              />
            ))}
          </div>
        )}

        <div className="ad-callout">
          <span className="ico">{Ico.ingest}</span>
          <span>
            <b>Metadata edits and feature flags write straight to the library.</b> Title,
            description, and tags update the archive card; the document body itself is whatever
            HTML was uploaded.
          </span>
        </div>
      </div>

      <SysFooter />
    </div>
  );
}

type DocRowProps = {
  doc: Document;
  n: number;
  onFeature: () => void;
  onSave: (id: number, update: Partial<Document>) => void;
  onDelete: () => void;
};

function DocRow({ doc, n, onFeature, onSave, onDelete }: DocRowProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(doc.title);
  const [description, setDescription] = useState(doc.description);
  const [tags, setTags] = useState(doc.tags.join(", "));

  function save() {
    onSave(doc.id, {
      title,
      description,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setEditing(false);
  }

  return (
    <div className="ad-row">
      <div className="ad-row__n">{String(n).padStart(2, "0")}</div>
      <div className="ad-row__main">
        {editing ? (
          <div className="ad-edit">
            <input className="ad-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input
              className="ad-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
            />
            <input
              className="ad-input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma-separated)"
            />
          </div>
        ) : (
          <>
            <div className="ad-row__title">
              {doc.title}
              {doc.featured && <span className="ad-row__star">★ Featured</span>}
            </div>
            {doc.description && <div className="ad-row__desc">{doc.description}</div>}
            {doc.tags.length > 0 && (
              <div className="ad-row__tags">
                {doc.tags.map((t) => (
                  <span className="ad-row__tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="ad-row__meta">
              <b>{formatDate(doc.uploaded_at)}</b> · /library/{doc.id} · {docKind(doc)}
            </div>
          </>
        )}
      </div>
      <div className="ad-row__ctl">
        <button className={"ad-star-btn" + (doc.featured ? " on" : "")} onClick={onFeature}>
          {Ico.star}
          {doc.featured ? "Featured" : "Feature"}
        </button>
        {editing ? (
          <button className="sys-btn sys-btn--solid sys-btn--sm" onClick={save}>
            Save
          </button>
        ) : (
          <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => setEditing(true)}>
            {Ico.edit} Edit
          </button>
        )}
        <button className="sys-btn sys-btn--danger sys-btn--sm" onClick={onDelete} aria-label="Delete document">
          {Ico.trash}
        </button>
      </div>
    </div>
  );
}
