import { redirect } from "next/navigation"

import { AppShell } from "@/components/app/app-shell"
import { getCurrentUser, getUserOrg } from "@/lib/auth"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login?next=/app")
  }

  const org = await getUserOrg()

  if (!org) {
    redirect("/onboarding")
  }

  return (
    <AppShell orgName={org.name} userEmail={user.email ?? "User"}>
      {children}
    </AppShell>
  )
}
