import type { MetadataRoute } from "next";
import { listArticles } from "@/lib/articles";

const SITE_URL = "https://tamna-iota.vercel.app";
export const revalidate = 120;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let guide: MetadataRoute.Sitemap = [];
  try {
    const articles = await listArticles(500);
    guide = articles.map((a) => ({
      url: `${SITE_URL}/guide/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly",
      priority: a.type === "authority" ? 0.8 : 0.6,
    }));
  } catch {
    /* noop */
  }
  const now = new Date().toISOString();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/guide`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...guide,
  ];
}
