import type { Metadata } from "next";
import Link from "next/link";
import "../marketing.css";
import { SITE_URL } from "@/lib/marketing/constants";

export const metadata: Metadata = {
  title: "Privacy Policy — StudySnap",
  description:
    "How StudySnap handles your account, notes, voice recordings, and AI requests.",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <main className="marketing-root" aria-label="StudySnap privacy policy">
      <div className="marketing-legal">
        <div className="marketing-legal-inner">
          <Link href="/" className="marketing-link marketing-legal-back">
            ← Back to home
          </Link>
          <h1>Privacy Policy</h1>
          <p className="marketing-legal-updated">Last updated: September 2026</p>

          <h2>What StudySnap stores</h2>
          <ul>
            <li>
              <strong>Account:</strong> sign-in is handled by Clerk. We store
              only what your account needs to work — your user ID, name, and
              profile details you choose to add.
            </li>
            <li>
              <strong>Notes and study data:</strong> your notes, folders,
              subjects, voice-note metadata, revision schedules, and
              achievements are stored in your own account in our database and
              synced to your devices over an encrypted (TLS) connection.
            </li>
            <li>
              <strong>Voice recordings:</strong> audio you record is stored as
              media files so it can play back on your devices, with transcripts
              kept alongside your notes.
            </li>
            <li>
              <strong>AI requests:</strong> when you use an AI feature, the
              study material you select is sent to our AI provider to generate
              the summary, questions, or explanation you asked for.
            </li>
          </ul>

          <h2>What we don&apos;t do</h2>
          <ul>
            <li>We do not sell your personal data.</li>
            <li>We do not show third-party ads in the app.</li>
            <li>
              PIN-locked notes add an extra check inside the app before
              protected content is shown.
            </li>
          </ul>

          <h2>Your control</h2>
          <p>
            You can edit or delete your notes at any time from inside the app.
            Deleting your account removes your study data from our servers.
            If you have any privacy question, reach out through the contact
            details on the StudySnap repository.
          </p>
        </div>
      </div>
    </main>
  );
}
