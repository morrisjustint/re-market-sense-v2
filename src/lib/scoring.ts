import type {
  ScoringBand,
  ScoringRules,
  Template,
  TemplateQuestion,
} from "@/types/database"

/** Answers map question id → selected option id (single-select). */
export type ResponseAnswers = Record<string, string>

export type ScoredResponse = {
  score: number
  band: ScoringBand | null
  recommendedNextStep: string
}

function findOptionPoints(question: TemplateQuestion, optionId: string) {
  const option = question.options?.find((o) => o.id === optionId)
  return option?.points ?? 0
}

export function sumAnswerScore(
  questions: TemplateQuestion[] | null | undefined,
  answers: ResponseAnswers
) {
  if (!questions?.length) return 0

  let score = 0
  for (const question of questions) {
    const selected = answers[question.id]
    if (!selected) continue
    score += findOptionPoints(question, selected)
  }
  return score
}

export function resolveBand(
  scoringRules: ScoringRules | null | undefined,
  score: number
): ScoringBand | null {
  const bands = scoringRules?.bands
  if (!bands?.length) return null

  const match = bands.find((band) => score >= band.min && score <= band.max)
  if (match) return match

  // Prefer highest band whose min is still <= score, else lowest.
  const sorted = [...bands].sort((a, b) => a.min - b.min)
  const floor = [...sorted].reverse().find((band) => score >= band.min)
  return floor ?? sorted[0] ?? null
}

const BAND_NEXT_STEP: Record<string, string> = {
  hot: "Call or text this week — they look ready to move.",
  warm: "Send a helpful check-in and stay close.",
  future: "Add to nurture — check back in a few months.",
}

export function recommendedNextStepForBand(band: ScoringBand | null) {
  if (!band) return "Review their answers and decide on a follow-up."
  return (
    BAND_NEXT_STEP[band.id] ??
    band.description ??
    "Review their answers and decide on a follow-up."
  )
}

export function scoreResponse(
  template: Pick<Template, "questions" | "scoring_rules">,
  answers: ResponseAnswers
): ScoredResponse {
  const score = sumAnswerScore(template.questions, answers)
  const band = resolveBand(template.scoring_rules, score)
  return {
    score,
    band,
    recommendedNextStep: recommendedNextStepForBand(band),
  }
}

/** Build plausible sample answers for demo / preview scoring. */
export function sampleAnswersForTemplate(
  template: Pick<Template, "questions">,
  heat: "hot" | "warm" | "future"
): ResponseAnswers {
  const answers: ResponseAnswers = {}
  const questions = template.questions ?? []

  for (const question of questions) {
    const options = [...(question.options ?? [])].sort(
      (a, b) => b.points - a.points
    )
    if (!options.length) continue

    if (heat === "hot") {
      answers[question.id] = options[0]!.id
    } else if (heat === "warm") {
      const mid = options[Math.min(1, options.length - 1)]!
      answers[question.id] = mid.id
    } else {
      const low = options[options.length - 1]!
      answers[question.id] = low.id
    }
  }

  return answers
}
