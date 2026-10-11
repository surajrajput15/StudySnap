import type { Metadata } from 'next';
import IntroScreen from '@/components/IntroScreen';
import { SITE_URL } from '@/lib/marketing/constants';

export const metadata: Metadata = {
  title: 'StudySnap — Study smarter, not harder.',
  description:
    'Organize your notes, learn with AI, and stay on track with your revision.',
  alternates: { canonical: SITE_URL },
};

export default function Page() {
  return <IntroScreen />;
}
