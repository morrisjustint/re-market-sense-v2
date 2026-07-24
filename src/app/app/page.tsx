import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, List, Rocket, Search } from "lucide-react"

import { getDeployments, getLists } from "@/lib/data"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  const [lists, deployments] = await Promise.all([
    getLists(),
    getDeployments(),
  ])

  const contactTotal = lists.reduce((sum, list) => sum + list.contact_count, 0)
  const readyOrLive = deployments.filter((d) =>
    ["ready", "sending", "paused"].includes(d.status)
  ).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-navy md:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Upload lists, pick a check-in, and track who may be ready to move.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lists
            </CardTitle>
            <List className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-navy">{lists.length}</p>
            <CardDescription className="mt-1">
              {contactTotal} contacts across your lists
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Check-ins planned
            </CardTitle>
            <Search className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-navy">
              {deployments.length}
            </p>
            <CardDescription className="mt-1">
              List + template pairings
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ready / in progress
            </CardTitle>
            <Rocket className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-navy">{readyOrLive}</p>
            <CardDescription className="mt-1">
              Moving toward follow-up
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
          <CardDescription>
            {lists.length === 0
              ? "Start by uploading a list of contacts."
              : "Your lists are ready — choose a template to find who is ready to move."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/app/lists">
              {lists.length === 0 ? "Upload a list" : "View lists"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {lists.length > 0 ? (
            <Button asChild variant="outline">
              <Link href="/app/research">Choose a template</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
