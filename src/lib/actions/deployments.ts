"use server"

import { revalidatePath } from "next/cache"

import { requireOrg, getTemplateById } from "@/lib/data"
import { scoreResponse, type ResponseAnswers } from "@/lib/scoring"
import { createClient } from "@/lib/supabase/server"
import type { DeploymentStatus } from "@/types/database"

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }

const ALLOWED_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  draft: ["ready", "stopped"],
  ready: ["sending", "stopped"],
  sending: ["paused", "completed", "stopped"],
  paused: ["sending", "completed", "stopped"],
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
        error: `Cannot move from ${from} to ${status}.`,
      }
    }

    const patch: {
      status: DeploymentStatus
      launched_at?: string
    } = { status }

    if (status === "sending" && from === "ready") {
      patch.launched_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from("deployments")
      .update(patch)
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
          recommended_next_step: scored.recommendedNextStep,
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
