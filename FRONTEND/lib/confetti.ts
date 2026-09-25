import type { Options as ConfettiOptions } from 'canvas-confetti';

// Phase B P2: canvas-confetti is only needed at celebration moments (revision
// complete, achievement claim, export). A static import would bundle ~10KB
// into the initial /app chunk via HomeScreen; this helper lazy-loads it on
// first use instead. Fire-and-forget — celebrations must never throw.
export function celebrate(options?: ConfettiOptions): void {
  void import('canvas-confetti')
    .then((m) => m.default({ particleCount: 40, ...options }))
    .catch(() => {
      // Celebration is decorative; a failed chunk load is silently ignored.
    });
}
