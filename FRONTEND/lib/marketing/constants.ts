// Shared marketing constants — used by the static landing page and the
// JSON-LD structured data in the root layout. Keep in sync with
// app/layout.tsx AUTHOR_* values (single source of truth for E-E-A-T).
export const AUTHOR_NAME = "Suraj Bhan Pratap Singh";
export const AUTHOR_JOB = "Full-Stack AI Engineer";
export const AUTHOR_FULL = `${AUTHOR_NAME} - ${AUTHOR_JOB}`;
export const AUTHOR_GITHUB = "https://github.com/surajkumar";
export const AUTHOR_PORTFOLIO = "https://surajbhan-15.vercel.app/";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://studysnap-sigma.vercel.app";
