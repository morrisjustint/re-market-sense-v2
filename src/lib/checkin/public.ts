import { createClient } from "@/lib/supabase/server"
import { actionableNextStep } from "@/lib/leads/sample-leads"
import { scoreResponse, type ResponseAnswers } from "@/lib/scoring"
import type { Json, ScoringRules, TemplateQuestion } from "@/types/database"

export type CheckInLoadOk = {
  ok: true
  invite_id: string
  token: string
  agent_name: string
  org_name: string
  contact_first_name: string | null
  intro_text: string
  template_name: string
  questions: TemplateQuestion[]
  scoring_rules: ScoringRules | null
  expires_at: string
  incentive_enabled: boolean
  incentive_amount: number
}

export type CheckInLoadError = {
  ok: false
  error: "invalid" | "expired" | "already_submitted" | "unknown"
  agent_name?: string
  org_name?: string
}

export type CheckInLoadResult = CheckInLoadOk | CheckInLoadError

function asQuestions(value: unknown): TemplateQuestion[] {
  if (!Array.isArray(value)) return []
  return value as TemplateQuestion[]
}

function asScoringRules(value: unknown): ScoringRules | null {
  if (!value || typeof value !== "object") return null
  const rules = value as ScoringRules
  if (!Array.isArray(rules.bands)) return null
  return {
    label: typeof rules.label === "string" ? rules.label : "",
    method: "sum",
    bands: rules.bands,
  }
}

export async function loadCheckInByToken(
  token: string
): Promise<CheckInLoadResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_checkin_by_token", {
    p_token: token,
  })

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: "invalid" }
  }

  const payload = data as Record<string, unknown>
  if (payload.ok !== true) {
    const code = String(payload.error ?? "invalid")
    if (
      code === "expired" ||
      code === "already_submitted" ||
      code === "invalid"
    ) {
      return {
        ok: false,
        error: code,
        agent_name:
          typeof payload.agent_name === "string" ? payload.agent_name : undefined,
        org_name:
          typeof payload.org_name === "string" ? payload.org_name : undefined,
      }
    }
    return { ok: false, error: "unknown" }
  }

  return {
    ok: true,
    invite_id: String(payload.invite_id),
    token: String(payload.token),
    agent_name: String(payload.agent_name ?? "your agent"),
    org_name: String(payload.org_name ?? "RE Market Sense"),
    contact_first_name:
      typeof payload.contact_first_name === "string"
        ? payload.contact_first_name
        : null,
    intro_text: String(payload.intro_text ?? ""),
    template_name: String(payload.template_name ?? "Check-in"),
    questions: asQuestions(payload.questions),
    scoring_rules: asScoringRules(payload.scoring_rules),
    expires_at: String(payload.expires_at ?? ""),
    incentive_enabled: Boolean(payload.incentive_enabled),
    incentive_amount: Number(payload.incentive_amount ?? 5),
  }
}

export async function submitCheckInByToken(input: {
  token: string
  answers: ResponseAnswers
  questions: TemplateQuestion[]
  scoringRules: ScoringRules | null
  templateName: string
}): Promise<
  | { success: true; score: number; bandLabel: string | null }
  | { success: false; error: string; code?: string }
> {
  const scored = scoreResponse(
    {
      questions: input.questions,
      scoring_rules: input.scoringRules ?? {
        label: "",
        method: "sum",
        bands: [],
      },
    },
    input.answers
  )

  const nextStep = actionableNextStep(
    scored.band?.id,
    input.templateName,
    input.answers
  )

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("submit_checkin_by_token", {
    p_token: input.token,
    p_answers: input.answers as Json,
    p_score: scored.score,
    p_band_id: scored.band?.id ?? null,
    p_band_label: scored.band?.label ?? null,
    p_recommended_next_step: nextStep,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const payload = (data ?? {}) as Record<string, unknown>
  if (payload.ok !== true) {
    const code = String(payload.error ?? "invalid")
    if (code === "already_submitted") {
      return {
        success: false,
        error: "You have already completed this check-in.",
        code,
      }
    }
    if (code === "expired") {
      return {
        success: false,
        error: "This check-in link has expired.",
        code,
      }
    }
    return {
      success: false,
      error: "This check-in link is not valid.",
      code: "invalid",
    }
  }

  return {
    success: true,
    score: Number(payload.score ?? scored.score),
    bandLabel:
      typeof payload.band_label === "string"
        ? payload.band_label
        : scored.band?.label ?? null,
  }
}

/**
 * Queue a thank-you gift after a successful public submit, then fulfill via
 * Tremendous Sandbox when configured. Failures never throw — check-in stays OK.
 */
export async function queueIncentiveForToken(token: string) {
  const { fulfillIncentiveForToken } = await import("@/lib/incentives/fulfill")
  return fulfillIncentiveForToken(token)
}
