import {
  recommendedNextStepForBand,
  sampleAnswersForTemplate,
  scoreResponse,
  type ResponseAnswers,
} from "@/lib/scoring"
import type { ScoredLead, Template, TemplateQuestion } from "@/types/database"

export type LeadAnswerDetail = {
  questionId: string
  prompt: string
  optionLabel: string
  points: number
}

export type DisplayLead = ScoredLead & {
  answer_details: LeadAnswerDetail[]
  is_sample?: boolean
}

const FIRST_NAMES = [
  "Jordan",
  "Taylor",
  "Alex",
  "Casey",
  "Morgan",
  "Riley",
  "Cameron",
  "Avery",
  "Quinn",
  "Harper",
  "Jamie",
  "Drew",
  "Sam",
  "Chris",
  "Pat",
  "Dana",
  "Kelly",
  "Shawn",
  "Tracy",
  "Jesse",
]

const LAST_NAMES = [
  "Nguyen",
  "Patel",
  "Johnson",
  "Williams",
  "Garcia",
  "Martinez",
  "Brown",
  "Davis",
  "Wilson",
  "Anderson",
  "Thomas",
  "Jackson",
  "White",
  "Harris",
  "Clark",
  "Lewis",
  "Walker",
  "Young",
  "Allen",
  "King",
]

const LOCALES: Array<{
  city: string
  state: "TX" | "TN"
  zip: string
  area: string
  streets: string[]
}> = [
  {
    city: "Austin",
    state: "TX",
    zip: "78704",
    area: "512",
    streets: ["S Lamar Blvd", "E Riverside Dr", "Manchaca Rd", "William Cannon Dr"],
  },
  {
    city: "Dallas",
    state: "TX",
    zip: "75204",
    area: "214",
    streets: ["N Hall St", "Ross Ave", "Greenville Ave", "Mockingbird Ln"],
  },
  {
    city: "Houston",
    state: "TX",
    zip: "77006",
    area: "713",
    streets: ["Westheimer Rd", "Montrose Blvd", "Kirby Dr", "Shepherd Dr"],
  },
  {
    city: "San Antonio",
    state: "TX",
    zip: "78209",
    area: "210",
    streets: ["Broadway", "N New Braunfels Ave", "McCullough Ave", "Hildebrand Ave"],
  },
  {
    city: "Fort Worth",
    state: "TX",
    zip: "76107",
    area: "817",
    streets: ["Camp Bowie Blvd", "University Dr", "7th St", "Magruder St"],
  },
  {
    city: "Plano",
    state: "TX",
    zip: "75024",
    area: "972",
    streets: ["Legacy Dr", "Preston Rd", "Parkwood Blvd", "Spring Creek Pkwy"],
  },
  {
    city: "Nashville",
    state: "TN",
    zip: "37203",
    area: "615",
    streets: ["Music Row", "8th Ave S", "Charlotte Ave", "West End Ave"],
  },
  {
    city: "Franklin",
    state: "TN",
    zip: "37064",
    area: "615",
    streets: ["Main St", "Hillsboro Rd", "Cool Springs Blvd", "Carothers Pkwy"],
  },
  {
    city: "Memphis",
    state: "TN",
    zip: "38104",
    area: "901",
    streets: ["Union Ave", "Poplar Ave", "Cooper St", "Madison Ave"],
  },
  {
    city: "Knoxville",
    state: "TN",
    zip: "37919",
    area: "865",
    streets: ["Kingston Pike", "Cumberland Ave", "N Broadway", "Gay St"],
  },
  {
    city: "Murfreesboro",
    state: "TN",
    zip: "37129",
    area: "615",
    streets: ["Medical Center Pkwy", "Old Fort Pkwy", "N Thompson Ln", "Broad St"],
  },
  {
    city: "Chattanooga",
    state: "TN",
    zip: "37402",
    area: "423",
    streets: ["Market St", "Broad St", "McCallie Ave", "MLK Blvd"],
  },
]

const EMAIL_DOMAINS = ["gmail.com", "outlook.com", "yahoo.com", "icloud.com"]

const SAMPLE_STORAGE_KEY = "re-ms-sample-leads-v1"

function pick<T>(items: T[], index: number) {
  return items[index % items.length]!
}

function formatPhone(area: string, seed: number) {
  const mid = String(200 + (seed % 700)).padStart(3, "0")
  const last = String(1000 + ((seed * 37) % 9000)).padStart(4, "0")
  return `(${area}) ${mid}-${last}`
}

function emailFor(first: string, last: string, seed: number) {
  const domain = pick(EMAIL_DOMAINS, seed)
  const styles = [
    `${first}.${last}`.toLowerCase(),
    `${first[0]}${last}`.toLowerCase(),
    `${first}.${last}${seed % 17}`.toLowerCase(),
  ]
  return `${pick(styles, seed)}@${domain}`
}

export function describeAnswers(
  questions: TemplateQuestion[] | null | undefined,
  answers: ResponseAnswers
): LeadAnswerDetail[] {
  if (!questions?.length) return []

  const details: LeadAnswerDetail[] = []
  for (const question of questions) {
    const optionId = answers[question.id]
    if (!optionId) continue
    const option = question.options?.find((o) => o.id === optionId)
    if (!option) continue
    details.push({
      questionId: question.id,
      prompt: question.prompt,
      optionLabel: option.label,
      points: option.points,
    })
  }
  return details
}

/** Actionable next steps in plain agent language. */
export function actionableNextStep(
  bandId: string | null | undefined,
  templateName?: string | null,
  answers?: ResponseAnswers
): string {
  const name = (templateName ?? "").toLowerCase()
  const isBuyer = name.includes("buyer")
  const isSeller = name.includes("seller") && !name.includes("buyer")

  if (bandId === "hot") {
    if (isSeller || answers?.considering_sell === "actively") {
      return "Call this week – strong seller intent"
    }
    if (isBuyer || answers?.looking_to_buy === "actively") {
      return "Call this week – strong buy intent"
    }
    if (answers?.interest === "both") {
      return "Call this week – ready to buy and sell"
    }
    if (answers?.interest === "sell") {
      return "Call this week – strong seller intent"
    }
    if (answers?.interest === "buy") {
      return "Call this week – strong buy intent"
    }
    return "Call or text this week – ready to move"
  }

  if (bandId === "warm") {
    if (isSeller || answers?.value_estimate === "yes") {
      return "Send a home value update – they're curious"
    }
    if (isBuyer || answers?.next_step === "listings") {
      return "Send matching homes – stay close"
    }
    if (answers?.timing === "3_6" || answers?.timeline === "3_6") {
      return "Check in next month – 3–6 month timeline"
    }
    return "Send a helpful check-in – open to talking"
  }

  if (bandId === "future") {
    if (answers?.timing === "12_plus" || answers?.timeline === "flexible") {
      return "Send a market update – longer timeline"
    }
    return "Add to nurture – check back in a few months"
  }

  return recommendedNextStepForBand(null)
}

function heatPlan(count: number): Array<"hot" | "warm" | "future"> {
  const plan: Array<"hot" | "warm" | "future"> = []
  const hot = Math.max(3, Math.round(count * 0.35))
  const warm = Math.max(3, Math.round(count * 0.35))
  const future = Math.max(2, count - hot - warm)
  for (let i = 0; i < hot; i += 1) plan.push("hot")
  for (let i = 0; i < warm; i += 1) plan.push("warm")
  for (let i = 0; i < future; i += 1) plan.push("future")
  return plan.slice(0, count)
}

export function generateSampleLeads(
  template: Template,
  options?: { count?: number }
): DisplayLead[] {
  const count = Math.min(12, Math.max(8, options?.count ?? 10))
  const heats = heatPlan(count)
  const now = new Date().toISOString()

  return heats.map((heat, index) => {
    const first = pick(FIRST_NAMES, index * 3 + 1)
    const last = pick(LAST_NAMES, index * 5 + 2)
    const locale = pick(LOCALES, index * 2 + 3)
    const street = pick(locale.streets, index)
    const answers = sampleAnswersForTemplate(template, heat)
    const scored = scoreResponse(template, answers)
    const bandId = scored.band?.id ?? heat
    const nextStep = actionableNextStep(bandId, template.name, answers)

    return {
      id: `sample-${index}-${first}-${last}`.toLowerCase(),
      org_id: "sample",
      deployment_id: "sample-preview",
      contact_id: `sample-contact-${index}`,
      answers,
      score: scored.score,
      band_id: scored.band?.id ?? heat,
      band_label: scored.band?.label ?? heat[0]!.toUpperCase() + heat.slice(1),
      recommended_next_step: nextStep,
      created_at: now,
      first_name: first,
      last_name: last,
      email: emailFor(first, last, index + 11),
      phone: formatPhone(locale.area, index * 13 + 42),
      address: `${100 + index * 37} ${street}`,
      city: locale.city,
      state: locale.state,
      zip: locale.zip,
      deployment_name: "Sample check-in preview",
      list_name: "Sample sphere list",
      template_name: template.name,
      answer_details: describeAnswers(template.questions, answers),
      is_sample: true,
    }
  })
}

export function enrichLeadsWithAnswers(
  leads: ScoredLead[],
  templatesById: Map<string, Template>,
  templateNameFallback?: Template
): DisplayLead[] {
  return leads.map((lead) => {
    const template =
      [...templatesById.values()].find((t) => t.name === lead.template_name) ??
      templateNameFallback
    const answer_details = template
      ? describeAnswers(template.questions, lead.answers ?? {})
      : []
    return {
      ...lead,
      recommended_next_step:
        lead.recommended_next_step ||
        actionableNextStep(lead.band_id, lead.template_name, lead.answers),
      answer_details,
      is_sample: false,
    }
  })
}

export function loadSampleLeadsFromSession(): DisplayLead[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SAMPLE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DisplayLead[]
  } catch {
    return null
  }
}

export function saveSampleLeadsToSession(leads: DisplayLead[]) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SAMPLE_STORAGE_KEY, JSON.stringify(leads))
}

export function clearSampleLeadsFromSession() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(SAMPLE_STORAGE_KEY)
}
