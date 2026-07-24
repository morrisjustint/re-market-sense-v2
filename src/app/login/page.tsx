import type { Metadata } from "next"
import Link from "next/link"

import { LoginForm } from "@/components/auth/login-form"
import { Logo } from "@/components/brand/logo"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Sign in",
}

type LoginPageProps = {
  searchParams: Promise<{ next?: string; message?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const message =
    params.message === "check-email"
      ? "Check your email to confirm your account, then sign in."
      : undefined

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.88_0.05_195)_0%,_transparent_55%),linear-gradient(180deg,_oklch(0.98_0.01_210),_oklch(0.95_0.02_220))]"
      />
      <div className="relative z-10 mb-8">
        <Logo />
      </div>
      <Card className="relative z-10 w-full max-w-md shadow-lg shadow-navy/5">
        <CardHeader>
          <CardTitle className="font-heading text-2xl text-navy">
            Welcome back
          </CardTitle>
          <CardDescription>Sign in to your RE Market Sense workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={params.next} message={message} />
        </CardContent>
      </Card>
      <p className="relative z-10 mt-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          ← Back to home
        </Link>
      </p>
    </div>
  )
}
