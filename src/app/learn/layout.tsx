import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Language Learning | AuraTranslate',
  description:
    'AI-powered language learning assistant. Get word explanations, grammar corrections, pronunciation guides, synonym suggestions, example sentences, vocabulary analysis, and difficulty assessments powered by Gemini AI.',
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
