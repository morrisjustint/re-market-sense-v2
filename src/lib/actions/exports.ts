"use server"

import { getScoredLeads, requireOrg } from "@/lib/data"
import { leadsToCsv, leadsToDocxBuffer } from "@/lib/exports/leads"
import type { ScoredLead } from "@/types/database"

type ExportInput = {
  deploymentId?: string
  /** When provided (e.g. sample preview), export these instead of DB rows. */
  leads?: ScoredLead[]
}

async function resolveLeads(input?: ExportInput) {
  if (input?.leads?.length) return input.leads
  return getScoredLeads(
    input?.deploymentId ? { deploymentId: input.deploymentId } : undefined
  )
}

export async function exportLeadsCsv(input?: ExportInput | string) {
  const normalized =
    typeof input === "string" ? { deploymentId: input } : input
  const leads = await resolveLeads(normalized)
  const csv = leadsToCsv(leads)
  return {
    filename: `re-market-sense-leads-${new Date().toISOString().slice(0, 10)}.csv`,
    content: csv,
    mimeType: "text/csv;charset=utf-8",
  }
}

export async function exportLeadsDocx(input?: ExportInput | string) {
  const normalized =
    typeof input === "string" ? { deploymentId: input } : input
  const org = await requireOrg()
  const leads = await resolveLeads(normalized)
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
