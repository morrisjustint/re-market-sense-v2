"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/auth"
import { CONSENT_ATTESTATION_TEXT } from "@/lib/consent"
import { requireOrg, getTemplateById } from "@/lib/data"
import { buildCheckInEmail } from "@/lib/email/content"
import { getEmailConfig, sendEmail } from "@/lib/email/sendgrid"
import { actionableNextStep } from "@/lib/leads/sample-leads"
import {
  buildRespondUrl,
  defaultInviteExpiresAt,
  generateResponseToken,
} from "@/lib/response-invites"
import { scoreResponse, type ResponseAnswers } from "@/lib/scoring"
import { createClient } from "@/lib/supabase/server"
import type { Contact, DeploymentStatus, Template } from "@/types/database"

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }

export type SendSummary = {
  sent: number
  failed: number
  skipped: number
  eligible: number
  configured: boolean
}

// Transitions handled by plain status updates. Launch/Resume (→ sending) go
// through startOrResumeSending so the consent gate + email send always run.
const ALLOWED_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  draft: ["ready", "stopped"],
  ready: ["stopped"],
  sending: ["paused", "completed", "stopped"],
  paused: ["completed", "stopped"],
  completed: [],
  stopped: [],
}

export async function updateDeploymentStatus(
  deploymentId: string,
  status: DeploymentStatus
): Promise<ActionResult> {
  try {
    const org = await requireOrg()
    const supabase = await createClient()

    const { data: current, error: currentError } = await supabase
      .from("deployments")
      .select("id, status")
      .eq("id", deploymentId)
      .eq("org_id", org.id)
      .maybeSingle()

    if (currentError || !current) {
      return {
        success: false,
        error: currentError?.message ?? "Deployment not found.",
      }
    }

    const from = current.status as DeploymentStatus
    const allowed = ALLOWED_TRANSITIONS[from] ?? []
    if (!allowed.includes(status)) {
      return {
        success: false,
        error:
          status === "sending"
            ? "Use Launch to start sending so consent can be confirmed."
            : `Cannot move from ${from} to ${status}.`,
      }
    }

    const { error } = await supabase
      .from("deployments")
      .update({ status })
      .eq("id", deploymentId)
      .eq("org_id", org.id)

    if (error) return { success: false, error: error.message }

    revalidatePath("/app/deploy")
    revalidatePath("/app/research")
    revalidatePath("/app/analytics")

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    }
  }
}

/**
 * Stores the required consent attestation for a deployment. Must exist before
 * a campaign can move to "Sending".
 */
export async function recordConsent(
  deploymentId: string
): Promise<ActionResult> {
  try {
    const org = await requireOrg()
    const user = await getCurrentUser()
    const supabase = await createClient()

    const { data: deployment } = await supabase
      .from("deployments")
      .select("id")
      .eq("id", deploymentId)
      .eq("org_id", org.id)
      .maybeSingle()

    if (!deployment) return { success: false, error: "Deployment not found." }

    const { error } = await supabase.from("deployment_consents").upsert(
      {
        org_id: org.id,
        deployment_id: deploymentId,
        attested_by_user_id: user?.id ?? null,
        attested_by_email: user?.email ?? null,
        attestation_text: CONSENT_ATTESTATION_TEXT,
        attested_at: new Date().toISOString(),
      },
      { onConflict: "deployment_id" }
    )

    if (error) return { success: false, error: error.message }

    revalidatePath("/app/deploy")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    }
  }
}

/**
 * Launches (ready → sending) or resumes (paused → sending) an email campaign.
 * Blocks unless consent has been attested, then sends branded emails to every
 * eligible contact that has not already received one, logging each attempt.
 */
export async function startOrResumeSending(
  deploymentId: string
): Promise<ActionResult<SendSummary>> {
  try {
    const org = await requireOrg()
    const user = await getCurrentUser()
    const supabase = await createClient()

    const { data: deployment } = await supabase
      .from("deployments")
      .select("id, status, list_id, template_id")
      .eq("id", deploymentId)
      .eq("org_id", org.id)
      .maybeSingle()

    if (!deployment) return { success: false, error: "Deployment not found." }

    const from = deployment.status as DeploymentStatus
    if (from !== "ready" && from !== "paused") {
      return {
        success: false,
        error: `Cannot start sending from ${from}. Mark the campaign ready first.`,
      }
    }

    // Consent gate — impossible to skip.
    const { data: consent } = await supabase
      .from("deployment_consents")
      .select("id")
      .eq("deployment_id", deploymentId)
      .eq("org_id", org.id)
      .maybeSingle()

    if (!consent) {
      return {
        success: false,
        error:
          "Confirm the consent attestation before launching this campaign.",
      }
    }

    const template = await getTemplateById(deployment.template_id)
    if (!template) return { success: false, error: "Template not found." }

    // Move to sending immediately so controls reflect state.
    const patch: { status: DeploymentStatus; launched_at?: string } = {
      status: "sending",
    }
    if (from === "ready") patch.launched_at = new Date().toISOString()

    const { error: statusError } = await supabase
      .from("deployments")
      .update(patch)
      .eq("id", deploymentId)
      .eq("org_id", org.id)

    if (statusError) return { success: false, error: statusError.message }

    const summary = await runEmailCampaign({
      deploymentId,
      orgId: org.id,
      orgName: org.name,
      template,
      listId: deployment.list_id,
      agentName:
        (user?.user_metadata?.full_name as string | undefined)?.trim() ||
        org.name,
      agentEmail: user?.email ?? null,
    })

    revalidatePath("/app/deploy")
    revalidatePath("/app/analytics")

    return { success: true, data: summary }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    }
  }
}

async function runEmailCampaign(input: {
  deploymentId: string
  orgId: string
  orgName: string
  template: Template
  listId: string
  agentName: string
  agentEmail: string | null
}): Promise<SendSummary> {
  const supabase = await createClient()
  const config = getEmailConfig()

  // Eligible = has a valid email and is not opted out.
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, email, consent_status")
    .eq("org_id", input.orgId)
    .eq("list_id", input.listId)

  const eligible = (contacts ?? []).filter(
    (c) =>
      Boolean(c.email && c.email.includes("@")) &&
      c.consent_status !== "opted_out"
  )

  // Skip contacts already emailed for this deployment (resume-safe).
  const { data: existingSends } = await supabase
    .from("message_sends")
    .select("contact_id, status")
    .eq("deployment_id", input.deploymentId)
    .eq("channel", "email")
    .eq("status", "sent")

  const alreadySent = new Set(
    (existingSends ?? []).map((s) => s.contact_id)
  )

  const summary: SendSummary = {
    sent: alreadySent.size,
    failed: 0,
    skipped: 0,
    eligible: eligible.length,
    configured: Boolean(config),
  }

  for (const contact of eligible) {
    if (alreadySent.has(contact.id)) continue

    if (!config) {
      await logSend(supabase, {
        orgId: input.orgId,
        deploymentId: input.deploymentId,
        contactId: contact.id,
        status: "skipped",
        toAddress: contact.email,
        error: "Email sending not configured (missing SendGrid keys).",
      })
      summary.skipped += 1
      continue
    }

    const respondUrl = await ensureRespondInvite(supabase, {
      orgId: input.orgId,
      deploymentId: input.deploymentId,
      contactId: contact.id,
      agentName: input.agentName,
      orgName: input.orgName,
    })

    if (!respondUrl) {
      await logSend(supabase, {
        orgId: input.orgId,
        deploymentId: input.deploymentId,
        contactId: contact.id,
        status: "failed",
        toAddress: contact.email,
        error: "Could not create check-in link for this contact.",
      })
      summary.failed += 1
      continue
    }

    const content = buildCheckInEmail({
      template: input.template,
      contact: contact as Pick<Contact, "first_name" | "email">,
      agentName: input.agentName,
      orgName: input.orgName,
      respondUrl,
      replyToEmail: input.agentEmail,
    })

    const result = await sendEmail(config, {
      to: contact.email!,
      toName: contact.first_name,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: input.agentEmail
        ? { email: input.agentEmail, name: input.agentName }
        : null,
    })

    if (result.success) {
      await logSend(supabase, {
        orgId: input.orgId,
        deploymentId: input.deploymentId,
        contactId: contact.id,
        status: "sent",
        toAddress: contact.email,
        providerMessageId: result.messageId,
      })
      summary.sent += 1
    } else {
      await logSend(supabase, {
        orgId: input.orgId,
        deploymentId: input.deploymentId,
        contactId: contact.id,
        status: "failed",
        toAddress: contact.email,
        error: result.error,
      })
      summary.failed += 1
    }
  }

  return summary
}

/** Reuse an unused invite token, or create a fresh one. Returns the public URL. */
async function ensureRespondInvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    orgId: string
    deploymentId: string
    contactId: string
    agentName: string
    orgName: string
  }
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("response_invites")
    .select("token, used_at, expires_at")
    .eq("deployment_id", input.deploymentId)
    .eq("contact_id", input.contactId)
    .maybeSingle()

  if (
    existing?.token &&
    !existing.used_at &&
    new Date(existing.expires_at).getTime() > Date.now()
  ) {
    return buildRespondUrl(existing.token)
  }

  const token = generateResponseToken()
  const expiresAt = defaultInviteExpiresAt()

  const { error } = await supabase.from("response_invites").upsert(
    {
      org_id: input.orgId,
      deployment_id: input.deploymentId,
      contact_id: input.contactId,
      token,
      agent_name: input.agentName,
      org_name: input.orgName,
      expires_at: expiresAt,
      used_at: null,
      response_id: null,
    },
    { onConflict: "deployment_id,contact_id" }
  )

  if (error) return null
  return buildRespondUrl(token)
}

async function logSend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    orgId: string
    deploymentId: string
    contactId: string
    status: "sent" | "failed" | "skipped"
    toAddress?: string | null
    providerMessageId?: string | null
    error?: string | null
  }
) {
  await supabase.from("message_sends").upsert(
    {
      org_id: input.orgId,
      deployment_id: input.deploymentId,
      contact_id: input.contactId,
      channel: "email",
      status: input.status,
      to_address: input.toAddress ?? null,
      provider_message_id: input.providerMessageId ?? null,
      error: input.error ?? null,
    },
    { onConflict: "deployment_id,contact_id,channel" }
  )
}

export async function recordResponse(input: {
  deploymentId: string
  contactId: string
  answers: ResponseAnswers
}): Promise<ActionResult<{ responseId: string; score: number }>> {
  try {
    const org = await requireOrg()
    const supabase = await createClient()

    const { data: deployment } = await supabase
      .from("deployments")
      .select("id, template_id, list_id")
      .eq("id", input.deploymentId)
      .eq("org_id", org.id)
      .maybeSingle()

    if (!deployment) return { success: false, error: "Deployment not found." }

    const { data: contact } = await supabase
      .from("contacts")
      .select("id, list_id")
      .eq("id", input.contactId)
      .eq("org_id", org.id)
      .maybeSingle()

    if (!contact || contact.list_id !== deployment.list_id) {
      return { success: false, error: "Contact not found on this list." }
    }

    const template = await getTemplateById(deployment.template_id)
    if (!template) return { success: false, error: "Template not found." }

    const scored = scoreResponse(template, input.answers)
    const nextStep = actionableNextStep(
      scored.band?.id,
      template.name,
      input.answers
    )

    const { data: response, error } = await supabase
      .from("responses")
      .upsert(
        {
          org_id: org.id,
          deployment_id: deployment.id,
          contact_id: contact.id,
          answers: input.answers,
          score: scored.score,
          band_id: scored.band?.id ?? null,
          band_label: scored.band?.label ?? null,
          recommended_next_step: nextStep,
        },
        { onConflict: "deployment_id,contact_id" }
      )
      .select("id, score")
      .single()

    if (error || !response) {
      return {
        success: false,
        error: error?.message ?? "Could not save response.",
      }
    }

    revalidatePath("/app/analytics")
    revalidatePath("/app/deploy")

    return {
      success: true,
      data: { responseId: response.id, score: response.score },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    }
  }
}
