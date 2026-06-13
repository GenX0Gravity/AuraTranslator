import NextAuth, { NextAuthOptions, Session, User } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

interface FirestoreUser {
  email: string;
  name: string;
  image?: string;
  authProvider: 'google' | 'credentials';
  password?: string;
  createdAt: FirebaseFirestore.Timestamp;
}

async function findUserByEmail(email: string): Promise<{ id: string; data: FirestoreUser } | null> {
  const db = getAdminDb();
  const snapshot = await db
    .collection('users')
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, data: doc.data() as FirestoreUser };
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'hello@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter an email and password');
        }

        const userRecord = await findUserByEmail(credentials.email);
        if (!userRecord) {
          throw new Error('No account found with this email');
        }

        const { id, data: user } = userRecord;

        if (user.authProvider !== 'credentials') {
          throw new Error(`Please sign in using ${user.authProvider}`);
        }

        if (!user.password) {
          throw new Error('Please sign in using a different method');
        }

        const isMatch = await bcrypt.compare(credentials.password, user.password);
        if (!isMatch) {
          throw new Error('Incorrect password');
        }

        return { id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          const db = getAdminDb();
          const existing = await findUserByEmail(user.email!);

          if (!existing) {
            const { Timestamp } = await import('firebase-admin/firestore');
            await db.collection('users').add({
              email: user.email!.toLowerCase(),
              name: user.name || '',
              image: user.image || '',
              authProvider: 'google',
              createdAt: Timestamp.now(),
            });
          }
        } catch (error) {
          logger.error('Google sign-in user creation failed', { error: String(error) });
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      // For Google, resolve the Firestore document ID
      if (account?.provider === 'google' && token.email) {
        const dbUser = await findUserByEmail(token.email);
        if (dbUser) {
          token.id = dbUser.id;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as User & { id: string }).id = token.id as string;
      }
      return session;
    },
  },

  session: { strategy: 'jwt' },
  pages: { signIn: '/auth/login' },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
