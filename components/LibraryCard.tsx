import Link from "next/link";
import type { Document } from "@/lib/db";

type Props = {
  doc: Document;
  featured?: boolean;
};

export default function LibraryCard({ doc, featured = false }: Props) {
  return (
    <Link
      href={`/library/${doc.id}`}
      className="block rounded-lg border border-neutral-700 bg-neutral-900 p-5 hover:border-neutral-500 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-white leading-snug">
          {doc.title}
        </h3>
        {featured && (
          <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
            Featured
          </span>
        )}
      </div>
      {doc.description && (
        <p className="mt-2 text-sm text-neutral-400 line-clamp-2">
          {doc.description}
        </p>
      )}
      {doc.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {doc.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs text-neutral-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
