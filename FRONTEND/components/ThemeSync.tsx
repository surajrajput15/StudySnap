'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store/useStore';

export default function ThemeSync() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    // Phase B P2: keep color-scheme + theme-color in sync on runtime toggles
    // (first paint is handled by the blocking head script in app/layout.tsx).
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1a1c23' : '#0061A4');
  }, [theme]);

  return null;
}
