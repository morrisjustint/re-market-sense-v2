import type { ResponseAnswers } from "@/lib/scoring"

/** Primary plan / intent derived from check-in answers. */
export type PrimaryIntent =
  | "buy"
  | "sell"
  | "buy_sell"
  | "rent"
  | "exploring"
  | "no_plans"
  | "unknown"

export type OutcomeBucket =
  | "immediate"
  | "this_week"
  | "nurture_30_90"
  | "longer_term"
  | "do_not_contact"

export type IntentMeta = {
  id: PrimaryIntent
  label: string
}

export type OutcomeMeta = {
  id: OutcomeBucket
  label: string
  shortLabel: string
  hint: string
}

export const INTENT_META: Record<PrimaryIntent, IntentMeta> = {
  buy: { id: "buy", label: "Buy" },
  sell: { id: "sell", label: "Sell" },
  buy_sell: { id: "buy_sell", label: "Buy + Sell" },
  rent: { id: "rent", label: "Rent" },
  exploring: { id: "exploring", label: "Exploring" },
  no_plans: { id: "no_plans", label: "No current plans" },
  unknown: { id: "unknown", label: "Not specified" },
}

export const OUTCOME_META: Record<OutcomeBucket, OutcomeMeta> = {
  immediate: {
    id: "immediate",
    label: "Immediate Action",
    shortLabel: "24–48 hrs",
    hint: "Call or text now",
  },
  this_week: {
    id: "this_week",
    label: "Follow Up This Week",
    shortLabel: "This week",
    hint: "Stay close with a helpful check-in",
  },
  nurture_30_90: {
    id: "nurture_30_90",
    label: "Nurture 30–90 Days",
    shortLabel: "30–90 days",
    hint: "Keep them warm with light touchpoints",
  },
  longer_term: {
    id: "longer_term",
    label: "Longer-term / Low frequency",
    shortLabel: "Longer-term",
    hint: "Market updates on a slower cadence",
  },
  do_not_contact: {
    id: "do_not_contact",
    label: "Do Not Contact",
    shortLabel: "No outreach",
    hint: "Respect their preference — no active follow-up",
  },
}

const OUTCOME_ORDER: OutcomeBucket[] = [
  "immediate",
  "this_week",
  "nurture_30_90",
  "longer_term",
  "do_not_contact",
]

/**
 * Derive a simple primary intent label from template answers.
 * Works across Move Readiness, Seller Intent, and Buyer Interest templates.
 */
export function derivePrimaryIntent(
  answers: ResponseAnswers | null | undefined,
  templateName?: string | null
): IntentMeta {
  const a = answers ?? {}
  const name = (templateName ?? "").toLowerCase()

  // Explicit move-readiness interest question
  if (a.interest === "both") return INTENT_META.buy_sell
  if (a.interest === "buy") return INTENT_META.buy
  if (a.interest === "sell") return INTENT_META.sell
  if (a.interest === "not_now") return INTENT_META.no_plans

  // Housing status alone (rent) when no buy/sell signal yet
  if (a.housing_status === "rent" && !a.looking_to_buy && !a.considering_sell) {
    return INTENT_META.rent
  }

  const buySignal =
    a.looking_to_buy === "actively" ||
    a.looking_to_buy === "soon" ||
    a.looking_to_buy === "exploring" ||
    name.includes("buyer")

  const sellSignal =
    a.considering_sell === "actively" ||
    a.considering_sell === "maybe" ||
    a.considering_sell === "curious" ||
    (name.includes("seller") && !name.includes("buyer"))

  if (
    (a.looking_to_buy === "actively" || a.looking_to_buy === "soon") &&
    (a.considering_sell === "actively" || a.considering_sell === "maybe")
  ) {
    return INTENT_META.buy_sell
  }

  if (a.looking_to_buy === "exploring" && !sellSignal) {
    return INTENT_META.exploring
  }

  if (a.looking_to_buy === "no" && a.considering_sell === "no") {
    return INTENT_META.no_plans
  }

  if (buySignal && sellSignal) return INTENT_META.buy_sell
  if (buySignal) {
    if (a.looking_to_buy === "exploring") return INTENT_META.exploring
    return INTENT_META.buy
  }
  if (sellSignal) return INTENT_META.sell

  if (a.looking_to_buy === "no" || a.considering_sell === "no") {
    return INTENT_META.no_plans
  }

  return INTENT_META.unknown
}

function wantsNoContact(answers: ResponseAnswers | null | undefined) {
  const a = answers ?? {}
  return (
    a.contact_preference === "none" ||
    a.contact_method === "none" ||
    a.help_needed === "none" ||
    a.next_step === "none" ||
    (a.interest === "not_now" &&
      (a.contact_preference === "none" || a.contact_method === "none"))
  )
}

function isLongerTimeline(answers: ResponseAnswers | null | undefined) {
  const a = answers ?? {}
  return (
    a.timing === "12_plus" ||
    a.timing === "6_12" ||
    a.timeline === "flexible" ||
    a.timeline === "6_12" ||
    a.timeline === "unsure" ||
    a.looking_to_buy === "exploring" ||
    a.considering_sell === "curious"
  )
}

/**
 * Map temperature + answers to a recommended-outcome bucket
 * (Intent → Temperature → Outcome flow, without a Sankey).
 */
export function deriveOutcomeBucket(
  bandId: string | null | undefined,
  answers?: ResponseAnswers | null
): OutcomeMeta {
  if (wantsNoContact(answers)) return OUTCOME_META.do_not_contact

  const band = (bandId ?? "").toLowerCase()
  if (band === "hot") return OUTCOME_META.immediate
  if (band === "warm") return OUTCOME_META.this_week
  if (band === "future") {
    return isLongerTimeline(answers)
      ? OUTCOME_META.longer_term
      : OUTCOME_META.nurture_30_90
  }

  return OUTCOME_META.longer_term
}

export function countIntents(
  leads: Array<{ primary_intent?: PrimaryIntent }>
) {
  const counts: Record<PrimaryIntent, number> = {
    buy: 0,
    sell: 0,
    buy_sell: 0,
    rent: 0,
    exploring: 0,
    no_plans: 0,
    unknown: 0,
  }
  for (const lead of leads) {
    const id = lead.primary_intent ?? "unknown"
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

export function countOutcomes(
  leads: Array<{ outcome_id?: OutcomeBucket }>
) {
  const counts: Record<OutcomeBucket, number> = {
    immediate: 0,
    this_week: 0,
    nurture_30_90: 0,
    longer_term: 0,
    do_not_contact: 0,
  }
  for (const lead of leads) {
    const id = lead.outcome_id ?? "longer_term"
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

export function orderedOutcomeEntries(
  counts: Record<OutcomeBucket, number>
): Array<OutcomeMeta & { count: number }> {
  return OUTCOME_ORDER.map((id) => ({
    ...OUTCOME_META[id],
    count: counts[id] ?? 0,
  }))
}

/** Active follow-ups = immediate + this week (key takeaway style). */
export function activeFollowUpCount(counts: Record<OutcomeBucket, number>) {
  return (counts.immediate ?? 0) + (counts.this_week ?? 0)
}
