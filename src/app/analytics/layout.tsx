import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics Dashboard | AuraTranslate',
  description:
    'Your personal translation analytics — track total translations, language pairs, daily activity, voice usage, OCR stats, and translation trends.',
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
