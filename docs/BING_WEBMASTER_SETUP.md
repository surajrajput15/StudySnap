# Bing Webmaster Tools — Setup Guide

**Goal:** Submit StudySnap to Bing for indexing, import from Google Search Console, submit sitemap.

**URL:** https://www.bing.com/webmasters
**Time:** ~5 minutes

---

## Step 1 — Sign in to Bing Webmaster

1. Go to **https://www.bing.com/webmasters**
2. Click **"Get Started"** or **"Sign In"**
3. Sign in with your **Microsoft account** (Outlook, Hotmail, Xbox, etc.)
   - If you don't have one, create a free Microsoft account first

---

## Step 2 — Add Your Site

1. After sign-in, click **"Add a site"** (top-right button)
2. Enter your site URL (just the domain, no path):
   ```
   https://studysnap-sigma.vercel.app
   ```
3. Choose add method:
   - **Option A (Recommended): "Import from Google Search Console"**
     - Click the import button
     - Sign in with the **same Google account** you used for GSC
     - Bing will automatically import your verified site
   - **Option B: Manual add** — requires DNS or meta-tag verification
     - Use the same HTML meta-tag method if you prefer

---

## Step 3 — Submit Sitemap

1. In the left sidebar, go to **"Sitemaps"** (under "Configure My Site")
2. Click **"Submit sitemap"**
3. Enter:
   ```
   https://studysnap-sigma.vercel.app/sitemap.xml
   ```
4. Click **"Submit"**

Bing will fetch and process the sitemap. Within 24-48 hours you'll see:
- **Submitted URLs**: 3 (homepage, sign-in, sign-up)
- **Indexed URLs**: grows over time

---

## Step 4 — (Optional) URL Inspection

1. Go to **"URL Inspection"** in the sidebar
2. Enter a URL (e.g., `https://studysnap-sigma.vercel.app/`)
3. Click **"Inspect"**
4. If the page is not indexed, click **"Request Indexing"**

---

## Step 5 — (Optional) Configure Crawl Settings

1. Go to **"Crawl Control"** (under "Configure My Site")
2. Default settings are fine. You can:
   - Set crawl rate (default is fine for Vercel)
   - Block specific paths if needed (we already disallow `/api/`, `/sign-in`, `/sign-up` in robots.txt)

---

## What to Expect

| Timeline | What Happens |
|----------|--------------|
| **Immediate** | Site added to Bing's crawl queue |
| **24-48 hours** | Bingbot crawls your sitemap, discovers 3 pages |
| **1-2 weeks** | Pages start appearing in Bing search results |
| **Ongoing** | Bing tracks clicks, impressions in "Search Performance" report |

---

## Bing-Specific Notes

- **Bingbot** is already allowed in your `robots.txt` — no changes needed
- **IndexNow** (optional, for instant indexing): Bing supports the IndexNow protocol. You can submit a ping when pages update. See https://www.bing.com/indexnow
- **Bing Webmaster + Google Search Console**: Both show similar data. Bing tends to index faster for new sites.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Site not verified | Use the same Google account (import method) or add a Bing-specific meta tag |
| Sitemap shows 0 URLs | Wait 24h. Verify sitemap URL is reachable: `curl https://studysnap-sigma.vercel.app/sitemap.xml` |
| Pages not indexing | Check "URL Inspection" → "Live URL" test. If it fails, check your CSP headers or robots.txt |

---

**Reference:** https://www.bing.com/webmasters/help
