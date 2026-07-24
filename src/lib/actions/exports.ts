"use server"

import { getScoredLeads, requireOrg } from "@/lib/data"
import { leadsToCsv, leadsToDocxBuffer } from "@/lib/exports/leads"

export async function exportLeadsCsv(deploymentId?: string) {
  const leads = await getScoredLeads(
    deploymentId ? { deploymentId } : undefined
  )
  const csv = leadsToCsv(leads)
  return {
    filename: `re-market-sense-leads-${new Date().toISOString().slice(0, 10)}.csv`,
    content: csv,
    mimeType: "text/csv;charset=utf-8",
  }
}

export async function exportLeadsDocx(deploymentId?: string) {
  const org = await requireOrg()
  const leads = await getScoredLeads(
    deploymentId ? { deploymentId } : undefined
  )
  const buffer = await leadsToDocxBuffer(leads, {
    orgName: org.name,
    title: "Who's ready to move",
  })

  return {
    filename: `re-market-sense-leads-${new Date().toISOString().slice(0, 10)}.docx`,
    contentBase64: Buffer.from(buffer).toString("base64"),
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }
}
