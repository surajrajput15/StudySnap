import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://studysnap-sigma.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const lastModified = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Public routes only. Protected/authenticated pages (/dashboard, /notes/[id],
  // /ai-tutor, /revision, /voice-notes, profile) are NOT indexed — they are
  // session-scoped and would only produce login-churn for crawlers.
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
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