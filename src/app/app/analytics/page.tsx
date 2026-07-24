import type { Metadata } from "next"

import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client"
import {
  getDeployments,
  getScoredLeads,
  summarizeLeadBands,
} from "@/lib/data"

export const metadata: Metadata = {
  title: "Leads",
}

export default async function AnalyticsPage() {
  const [leads, deployments] = await Promise.all([
    getScoredLeads(),
    getDeployments(),
  ])
  const bandCounts = summarizeLeadBands(leads)

  return (
    <AnalyticsPageClient
      leads={leads}
      deployments={deployments}
      bandCounts={bandCounts}
    />
  )
}
