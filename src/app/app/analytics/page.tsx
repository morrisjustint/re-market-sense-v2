import type { Metadata } from "next"

import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client"
import { getDeployments, getScoredLeads, getTemplates } from "@/lib/data"

export const metadata: Metadata = {
  title: "Leads",
}

export default async function AnalyticsPage() {
  const [leads, deployments, templates] = await Promise.all([
    getScoredLeads(),
    getDeployments(),
    getTemplates(),
  ])

  return (
    <AnalyticsPageClient
      leads={leads}
      deployments={deployments}
      templates={templates}
    />
  )
}
