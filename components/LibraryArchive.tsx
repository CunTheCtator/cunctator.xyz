"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type ArchiveDoc = {
  id: number;
  kind: string;
  title: string;
  desc: string;
  tags: string[];
  star: boolean;
  uploadedAt: string;
};

type SortKey = "newest" | "oldest" | "title";

type Props = { docs: ArchiveDoc[] };

export default function LibraryArchive({ docs }: Props) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of docs) {
      for (const t of d.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [docs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = docs.filter((d) => {
      if (tag && !d.tags.includes(tag)) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.desc.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    out = [...out].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "oldest") return a.uploadedAt.localeCompare(b.uploadedAt);
      return b.uploadedAt.localeCompare(a.uploadedAt);
    });
    return out;
  }, [docs, query, tag, sort]);

  return (
    <>
      <div className="lb-tools">
        <input
          type="search"
          className="lb-tools__search"
          placeholder="Search the shelves…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search documents"
        />
        <div className="lb-tools__sort" role="radiogroup" aria-label="Sort order">
          {(["newest", "oldest", "title"] as SortKey[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sort === s}
              data-on={sort === s ? "1" : "0"}
              onClick={() => setSort(s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="lb-tools__tags">
          <button type="button" data-on={tag === null ? "1" : "0"} onClick={() => setTag(null)}>
            ALL
          </button>
          {allTags.map((t) => (
            <button key={t} type="button" data-on={tag === t ? "1" : "0"} onClick={() => setTag(tag === t ? null : t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <section className="lb-grid">
          {filtered.map((d) => (
            <Link className="lb-card" href={`/library/${d.id}`} key={d.id}>
              <div className="lb-card__top">
                <span className="lb-card__kind">{d.kind}</span>
                {d.star && <span className="lb-card__star">★ Featured</span>}
              </div>
              <div className="lb-card__title">{d.title}</div>
              <div className="lb-card__desc">{d.desc}</div>
              <div className="lb-card__tags">
                {d.tags.map((t) => (
                  <span className="lb-card__tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <div className="lb-tools__none">
          Nothing matches{query ? ` “${query}”` : ""}{tag ? ` under ${tag.toUpperCase()}` : ""}. Clear the filters to see
          the full shelves.
        </div>
      )}
    </>
  );
}
