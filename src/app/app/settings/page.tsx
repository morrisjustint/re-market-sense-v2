import type { Metadata } from "next"

import { getUserOrg } from "@/lib/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function SettingsPage() {
  const org = await getUserOrg()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-navy md:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Manage your organization and account preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Workspace details for your team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-muted-foreground">Name</p>
          <p className="font-medium text-navy">{org?.name ?? "—"}</p>
        </CardContent>
      </Card>
    </div>
  )
}
