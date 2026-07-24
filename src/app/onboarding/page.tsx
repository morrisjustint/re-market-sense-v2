import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { getCurrentUser, getUserOrg } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Onboarding",
}

export default async function OnboardingPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login?next=/onboarding")
  }

  let org = await getUserOrg()

  // Recover org from signup metadata if membership is missing.
  if (!org) {
    const orgName =
      (user.user_metadata?.org_name as string | undefined)?.trim() ||
      `${user.email?.split("@")[0] ?? "My"}'s Organization`

    const supabase = await createClient()
    await supabase.rpc("create_organization", { org_name: orgName })
    org = await getUserOrg()
  }

  if (!org) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
        <Logo />
        <p className="max-w-md text-center text-sm text-muted-foreground">
          We couldn&apos;t set up your organization. Please try signing out and
          creating your account again, or contact support.
        </p>
      </div>
    )
  }

  return (
    <div className="relative min-h-svh px-4 py-10 md:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.9_0.04_195)_0%,_transparent_50%),linear-gradient(180deg,_oklch(0.985_0.01_210),_oklch(0.95_0.02_220))]"
      />
      <div className="relative z-10 mb-10 flex justify-center">
        <Logo href="" />
      </div>
      <div className="relative z-10">
        <OnboardingWizard orgName={org.name} />
      </div>
    </div>
  )
}
