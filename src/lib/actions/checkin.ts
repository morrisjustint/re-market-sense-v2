"use server"

import { revalidatePath } from "next/cache"

import {
  loadCheckInByToken,
  submitCheckInByToken,
} from "@/lib/checkin/public"
import type { ResponseAnswers } from "@/lib/scoring"

export type SubmitPublicCheckInResult =
  | { success: true; score: number; bandLabel: string | null }
  | { success: false; error: string; code?: string }

/**
 * Public (no-login) check-in submit. Scores answers server-side, then stores
 * via SECURITY DEFINER RPC so only this token's contact/deployment is touched.
 */
export async function submitPublicCheckIn(input: {
  token: string
  answers: ResponseAnswers
}): Promise<SubmitPublicCheckInResult> {
  try {
    const token = input.token?.trim()
    if (!token || token.length < 16) {
      return {
        success: false,
        error: "This check-in link is not valid.",
        code: "invalid",
      }
    }

    const loaded = await loadCheckInByToken(token)
    if (!loaded.ok) {
      if (loaded.error === "already_submitted") {
        return {
          success: false,
          error: "You have already completed this check-in.",
          code: "already_submitted",
        }
      }
      if (loaded.error === "expired") {
        return {
          success: false,
          error: "This check-in link has expired.",
          code: "expired",
        }
      }
      return {
        success: false,
        error: "This check-in link is not valid.",
        code: "invalid",
      }
    }

    const questions = loaded.questions ?? []
    const required = questions.filter((q) => q.required)
    for (const question of required) {
      if (!input.answers[question.id]) {
        return {
          success: false,
          error: "Please answer all required questions.",
        }
      }
    }

    const cleaned: ResponseAnswers = {}
    for (const question of questions) {
      const selected = input.answers[question.id]
      if (!selected) continue
      const valid = question.options?.some((o) => o.id === selected)
      if (!valid) {
        return {
          success: false,
          error: "One of the answers was not recognized.",
        }
      }
      cleaned[question.id] = selected
    }

    const result = await submitCheckInByToken({
      token,
      answers: cleaned,
      questions,
      scoringRules: loaded.scoring_rules,
      templateName: loaded.template_name,
    })

    if (result.success) {
      revalidatePath("/app/analytics")
      revalidatePath("/app/deploy")
    }

    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    }
  }
}
