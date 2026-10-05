"use client";

import { useEffect } from "react";

// Progressive enhancement scroll-reveal controller for the public landing page.
// Activates IntersectionObserver-driven scroll reveals for sections with [data-reveal].
// Zero forced auto-redirects, zero interval overhead, zero layout shifts.
export default function AutoEnter() {
  useEffect(() => {
    document.documentElement.setAttribute("data-reveal-ready", "true");
    const targets = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      targets.forEach((t) => t.classList.add("is-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    );

    targets.forEach((t) => observer.observe(t));

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
