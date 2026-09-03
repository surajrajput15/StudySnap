import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://studysnap-sigma.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const lastModified = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Public routes only. Protected/authenticated pages (notes, voice notes,
  // AI tutor, revision, profile) are session-scoped and would only produce
  // login-churn for crawlers, so they are NOT indexed. The marketing landing
  // (/) and the app shell (/app) are both listed for SEO discovery.
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/app`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/sign-in`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/sign-up`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}