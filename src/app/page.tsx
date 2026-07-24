import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { getCurrentUser, getUserOrg } from "@/lib/auth"

export default async function LandingPage() {
  const user = await getCurrentUser()
  const org = user ? await getUserOrg() : null
  const ctaHref = user ? (org ? "/app" : "/onboarding") : "/signup"

  return (
    <div className="relative min-h-svh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.85_0.06_195)_0%,_transparent_50%),radial-gradient(ellipse_at_bottom_left,_oklch(0.9_0.04_250)_0%,_transparent_45%),linear-gradient(180deg,_oklch(0.98_0.01_210)_0%,_oklch(0.94_0.02_220)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(oklch(0.28_0.05_250_/_0.04)_1px,transparent_1px),linear-gradient(90deg,oklch(0.28_0.05_250_/_0.04)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 md:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild>
              <Link href={ctaHref}>
                Open app
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col px-4 pb-16 pt-10 md:px-6 md:pt-20">
        <div className="max-w-2xl space-y-6">
          <p className="font-heading text-4xl font-semibold tracking-tight text-navy sm:text-5xl md:text-6xl">
            RE Market Sense
          </p>
          <h1 className="max-w-xl text-xl font-medium leading-relaxed text-foreground/90 md:text-2xl">
            Know who on your list is ready to buy, sell, or move — and what to do
            next.
          </h1>
          <p className="max-w-lg text-base text-muted-foreground md:text-lg">
            Upload contact lists, send check-ins, score replies, and follow up
            with clear next steps from one professional workspace.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href={ctaHref}>
                Get Started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            {!user ? (
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-16 overflow-hidden rounded-2xl border border-border/80 bg-card/70 shadow-[0_24px_60px_-28px_oklch(0.28_0.05_250_/_0.35)] backdrop-blur">
          <div className="border-b border-border/70 bg-navy px-4 py-3 text-sm text-white/80">
            Workspace preview
          </div>
          <div className="grid gap-px bg-border/60 md:grid-cols-[200px_1fr]">
            <div className="hidden space-y-2 bg-sidebar p-4 text-sm text-sidebar-foreground/70 md:block">
              {["Dashboard", "Lists", "Research", "Deploy", "Leads"].map(
                (item) => (
                  <div
                    key={item}
                    className="rounded-md px-3 py-2 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    data-active={item === "Dashboard"}
                  >
                    {item}
                  </div>
                )
              )}
            </div>
            <div className="space-y-4 bg-card p-5 md:p-8">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="grid gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 rounded-xl border border-border/80 bg-gradient-to-br from-accent/80 to-muted/40"
                  />
                ))}
              </div>
              <div className="h-36 rounded-xl border border-dashed border-border bg-muted/30" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
