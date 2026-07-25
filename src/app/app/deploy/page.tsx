import type { Metadata } from "next"

import { DeployPageClient } from "@/components/deploy/deploy-page-client"
import { getDeployments, getDeploymentSendData } from "@/lib/data"
import { isEmailConfigured } from "@/lib/email/sendgrid"

export const metadata: Metadata = {
  title: "Deploy",
}

type PageProps = {
  searchParams: Promise<{ id?: string }>
}

export default async function DeployPage({ searchParams }: PageProps) {
  const params = await searchParams
  const [deployments, sendData] = await Promise.all([
    getDeployments(),
    getDeploymentSendData(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-navy md:text-3xl">
          Deploy
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Confirm consent, launch your email check-in, and track how many
          messages have gone out.
        </p>
      </div>
      <DeployPageClient
        deployments={deployments}
        highlightId={params.id}
        consents={sendData.consents}
        stats={sendData.stats}
        emailConfigured={isEmailConfigured()}
      />
    </div>
  )
}
