import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Conversation | AuraTranslate',
  description:
    'Real-time speech-to-speech conversation translator. Speak naturally in your language and instantly hear the translation — perfect for cross-language meetings, travel, and multilingual communication.',
};

export default function ConversationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
