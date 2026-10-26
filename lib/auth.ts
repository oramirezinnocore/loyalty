import { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const authConfig: NextAuthConfig = {
  trustHost: true, // Trust reverse proxy (Nginx) forwarded host
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            businessUsers: {
              include: {
                business: true
              }
            }
          }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // NextAuth v5 automatically sets token.sub = user.id
        // Add custom claims (role) but don't manually set id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // Read user ID from token.sub (standard JWT claim, not token.id)
        (session.user as any).id = token.sub as string
        (session.user as any).role = (token as any).role
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin"
  }
}
