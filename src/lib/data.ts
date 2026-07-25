import { createClient } from "@/lib/supabase/server"
import { getUserOrg } from "@/lib/auth"
import type {
  Contact,
  Deployment,
  DeploymentConsent,
  DeploymentSendStats,
  List,
  ScoredLead,
  ScoringRules,
  Template,
  TemplateQuestion,
} from "@/types/database"

function asTemplate(row: {
  id: string
  name: string
  description: string
  questions: unknown
  intro_text: string
  scoring_rules: unknown
  is_active: boolean
  created_at: string
}): Template {
  return {
    ...row,
    questions: (row.questions as TemplateQuestion[]) ?? [],
    scoring_rules: (row.scoring_rules as ScoringRules) ?? {
      label: "",
      method: "sum",
      bands: [],
    },
  }
}

export async function requireOrg() {
  const org = await getUserOrg()
  if (!org) {
    throw new Error("No organization found")
  }
  return org
}

export async function getLists(): Promise<List[]> {
  const org = await requireOrg()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("lists")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getListById(listId: string): Promise<List | null> {
  const org = await requireOrg()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("lists")
    .select("*")
    .eq("org_id", org.id)
    .eq("id", listId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function getContactsForList(listId: string): Promise<Contact[]> {
  const org = await requireOrg()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("org_id", org.id)
    .eq("list_id", listId)
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getTemplates(): Promise<Template[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(asTemplate)
}

export async function getTemplateById(templateId: string): Promise<Template | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? asTemplate(data) : null
}

export async function getDeployments(): Promise<
  (Deployment & { list_name?: string; template_name?: string })[]
> {
  const org = await requireOrg()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("deployments")
    .select(
      `
      id,
      org_id,
      list_id,
      template_id,
      name,
      status,
      cost_estimate,
      created_at,
      launched_at,
      lists ( name ),
      templates ( name )
    `
    )
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const listJoin = row.lists as { name: string } | null
    const templateJoin = row.templates as { name: string } | null

    return {
      id: row.id,
      org_id: row.org_id,
      list_id: row.list_id,
      template_id: row.template_id,
      name: row.name,
      status: row.status,
      cost_estimate:
        row.cost_estimate === null || row.cost_estimate === undefined
          ? null
          : Number(row.cost_estimate),
      created_at: row.created_at,
      launched_at: row.launched_at,
      list_name: listJoin?.name,
      template_name: templateJoin?.name,
    }
  })
}

export async function getScoredLeads(options?: {
  deploymentId?: string
}): Promise<ScoredLead[]> {
  const org = await requireOrg()
  const supabase = await createClient()

  let query = supabase
    .from("responses")
    .select(
      `
      id,
      org_id,
      deployment_id,
      contact_id,
      answers,
      score,
      band_id,
      band_label,
      recommended_next_step,
      created_at,
      contacts (
        first_name,
        last_name,
        email,
        phone,
        address,
        city,
        state,
        zip
      ),
      deployments (
        name,
        lists ( name ),
        templates ( name )
      )
    `
    )
    .eq("org_id", org.id)
    .order("score", { ascending: false })

  if (options?.deploymentId) {
    query = query.eq("deployment_id", options.deploymentId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const contact = row.contacts as {
      first_name: string | null
      last_name: string | null
      email: string | null
      phone: string | null
      address: string | null
      city: string | null
      state: string | null
      zip: string | null
    } | null

    const deployment = row.deployments as {
      name: string
      lists: { name: string } | null
      templates: { name: string } | null
    } | null

    return {
      id: row.id,
      org_id: row.org_id,
      deployment_id: row.deployment_id,
      contact_id: row.contact_id,
      answers: (row.answers as Record<string, string>) ?? {},
      score: row.score,
      band_id: row.band_id,
      band_label: row.band_label,
      recommended_next_step: row.recommended_next_step,
      created_at: row.created_at,
      first_name: contact?.first_name ?? null,
      last_name: contact?.last_name ?? null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      address: contact?.address ?? null,
      city: contact?.city ?? null,
      state: contact?.state ?? null,
      zip: contact?.zip ?? null,
      deployment_name: deployment?.name,
      list_name: deployment?.lists?.name,
      template_name: deployment?.templates?.name,
    }
  })
}

export function summarizeLeadBands(leads: ScoredLead[]) {
  const counts = { hot: 0, warm: 0, future: 0, other: 0 }
  for (const lead of leads) {
    const id = lead.band_id?.toLowerCase()
    if (id === "hot") counts.hot += 1
    else if (id === "warm") counts.warm += 1
    else if (id === "future") counts.future += 1
    else counts.other += 1
  }
  return counts
}

/**
 * Consent + email-send snapshot for every deployment in the org.
 * Used by the Deploy page to gate launches and show send progress.
 */
export async function getDeploymentSendData(): Promise<{
  consents: Record<string, DeploymentConsent>
  stats: Record<string, DeploymentSendStats>
}> {
  const org = await requireOrg()
  const supabase = await createClient()

  const [deploymentsRes, consentsRes, sendsRes, contactsRes] =
    await Promise.all([
      supabase
        .from("deployments")
        .select("id, list_id")
        .eq("org_id", org.id),
      supabase
        .from("deployment_consents")
        .select("*")
        .eq("org_id", org.id),
      supabase
        .from("message_sends")
        .select("deployment_id, status, channel")
        .eq("org_id", org.id)
        .eq("channel", "email"),
      supabase
        .from("contacts")
        .select("list_id, email, consent_status")
        .eq("org_id", org.id),
    ])

  if (deploymentsRes.error) throw new Error(deploymentsRes.error.message)
  if (consentsRes.error) throw new Error(consentsRes.error.message)
  if (sendsRes.error) throw new Error(sendsRes.error.message)
  if (contactsRes.error) throw new Error(contactsRes.error.message)

  // Email-eligible contacts per list (has email, not opted out).
  const eligibleByList = new Map<string, number>()
  for (const contact of contactsRes.data ?? []) {
    const hasEmail = Boolean(contact.email && contact.email.includes("@"))
    if (!hasEmail || contact.consent_status === "opted_out") continue
    eligibleByList.set(
      contact.list_id,
      (eligibleByList.get(contact.list_id) ?? 0) + 1
    )
  }

  const sentByDeployment = new Map<string, number>()
  const failedByDeployment = new Map<string, number>()
  for (const send of sendsRes.data ?? []) {
    if (send.status === "sent") {
      sentByDeployment.set(
        send.deployment_id,
        (sentByDeployment.get(send.deployment_id) ?? 0) + 1
      )
    } else if (send.status === "failed") {
      failedByDeployment.set(
        send.deployment_id,
        (failedByDeployment.get(send.deployment_id) ?? 0) + 1
      )
    }
  }

  const consents: Record<string, DeploymentConsent> = {}
  for (const consent of consentsRes.data ?? []) {
    consents[consent.deployment_id] = consent
  }

  const stats: Record<string, DeploymentSendStats> = {}
  for (const deployment of deploymentsRes.data ?? []) {
    stats[deployment.id] = {
      eligible: eligibleByList.get(deployment.list_id) ?? 0,
      sent: sentByDeployment.get(deployment.id) ?? 0,
      failed: failedByDeployment.get(deployment.id) ?? 0,
    }
  }

  return { consents, stats }
}
