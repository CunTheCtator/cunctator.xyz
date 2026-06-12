import type { MetadataRoute } from "next";
import { getAllDocuments } from "@/lib/db";

const BASE = "https://cunctator.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/projects`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/library`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/game`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/contact`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  let docRoutes: MetadataRoute.Sitemap = [];
  try {
    docRoutes = getAllDocuments().map((doc) => ({
      url: `${BASE}/library/${doc.id}`,
      lastModified: doc.uploaded_at ? new Date(doc.uploaded_at) : undefined,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.error("[sitemap] failed to read documents:", err);
  }

  return [...staticRoutes, ...docRoutes];
}

