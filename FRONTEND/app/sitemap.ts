import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://studysnap-sigma.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const lastModified = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // HOTFIX (master audit): sitemap lists ONLY the marketing landing.
  // /app is the authenticated client shell (guest dashboard renders, but it
  // is session-scoped UI, not indexable content); /sign-in and /sign-up are
  // auth flows. Listing them alongside robots Disallows contradicted the
  // crawler directives. One canonical URL keeps discovery unambiguous —
  // resubmit this sitemap in GSC/Bing after deploy.
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];
}