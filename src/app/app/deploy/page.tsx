import type { Metadata } from "next"

import { DeployPageClient } from "@/components/deploy/deploy-page-client"
import { getDeployments } from "@/lib/data"

export const metadata: Metadata = {
  title: "Deploy",
}

type PageProps = {
  searchParams: Promise<{ id?: string }>
}

export default async function DeployPage({ searchParams }: PageProps) {
  const params = await searchParams
  const deployments = await getDeployments()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-navy md:text-3xl">
          Deploy
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Review your draft, confirm readiness, and track launch status — without
          sending yet.
        </p>
      </div>
      <DeployPageClient deployments={deployments} highlightId={params.id} />
    </div>
  )
}
