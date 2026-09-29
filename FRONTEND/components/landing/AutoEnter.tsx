"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Controlled app entry for the public landing page (/).
//
// After ~4s on the root route, smoothly fade out and navigate to the
// guest-capable /app shell (signed-in visitors land on their dashboard,
// guests land in guest mode with sign-in available). The timer:
//   - runs only on "/" (this component is mounted only there)
//   - runs once per browser session (sessionStorage flag)
//   - skips crawlers ("/" is the indexed canonical; "/app" is Disallow'd)
//   - cancels on ANY user click (manual navigation wins) and on unmount
//   - uses a single interval, cleaned up on unmount/pagehide
const ENTER_DELAY_MS = 4000;
const ENTERED_KEY = "studysnap-entered";
const APP_ROUTE = "/app";
const BOT_RE =
  /bot|crawl|slurp|spider|mediapartners|baidu|yandex|duckduck|sogou|exabot|facebot|ia_archiver|google-inspection|adsbot|semrush|ahrefs/i;

export default function AutoEnter() {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const navTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Enable scroll reveals: base styles keep sections visible, so this is
    // purely progressive enhancement for IntersectionObserver-capable agents.
    document.documentElement.setAttribute("data-reveal-ready", "true");
    const targets = Array.from(document.querySelectorAll("[data-reveal]"));
    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
      );
      targets.forEach((t) => observer?.observe(t));
    } else {
      targets.forEach((t) => t.classList.add("is-in"));
    }

    const cancel = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (navTimerRef.current !== null) {
        window.clearTimeout(navTimerRef.current);
        navTimerRef.current = null;
      }
    };
    const stop = () => {
      cancel();
      setRemaining(null);
    };

    let visited = false;
    try {
      visited = window.sessionStorage.getItem(ENTERED_KEY) === "1";
    } catch {
      visited = false;
    }
    const isBot = BOT_RE.test(window.navigator.userAgent || "");
    const skipTimer =
      typeof window !== "undefined" &&
      window.location.search.includes("skip-timer");
    if (!isBot && !visited && !skipTimer) {
      // No synchronous setState here (react-hooks lint): the interval below
      // publishes the first countdown value within 250ms of mount.
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const left = Math.ceil(
          (ENTER_DELAY_MS - (Date.now() - startedAt)) / 1000,
        );
        if (left <= 0) {
          cancel();
          try {
            window.sessionStorage.setItem(ENTERED_KEY, "1");
          } catch {
            /* storage unavailable — navigate anyway */
          }
          document
            .querySelector(".marketing-root")
            ?.classList.add("is-leaving");
          navTimerRef.current = window.setTimeout(() => {
            router.push(APP_ROUTE);
          }, 340);
        } else {
          setRemaining(left);
        }
      }, 250);
    }

    // Any click = user is engaged; manual navigation always wins.
    document.addEventListener("click", stop, true);
    document.addEventListener("pagehide", cancel);
    return () => {
      cancel();
      document.removeEventListener("click", stop, true);
      document.removeEventListener("pagehide", cancel);
      observer?.disconnect();
    };
  }, [router]);

  if (remaining === null) return null;
  return (
    <p
      className="marketing-autoenter"
      role="timer"
      aria-label="StudySnap opens automatically in a few seconds. Choose Launch App to enter now."
    >
      <span className="marketing-autoenter-dot" aria-hidden="true" />
      <span>
        Opening StudySnap in{" "}
        <strong aria-hidden="true">{remaining}s</strong>
        <span className="marketing-sr">{remaining} seconds</span>
      </span>
      <Link href="/app">Open app now →</Link>
    </p>
  );
}
