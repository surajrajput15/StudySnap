import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://studysnap-sigma.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const lastModified = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // HOTFIX (master audit): /app is the authenticated client shell and
  // /sign-in + /sign-up are auth flows — none are indexable content, so
  // they stay out of the sitemap. The public static pages (landing,
  // privacy, terms) are listed below. Resubmit this sitemap in GSC/Bing
  // after deploy.
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}