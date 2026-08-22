/**
 * Tremendous Sandbox Orders API client.
 * Uses env-only credentials — never hard-code keys or campaign IDs.
 * Production (api.tremendous.com) is intentionally not used yet.
 */

export type TremendousConfig = {
  apiKey: string
  campaignId: string
  baseUrl: string
}

export type TremendousRecipient = {
  name: string
  email: string
}

export type CreateTremendousOrderInput = {
  amount: number
  currency?: string
  recipient: TremendousRecipient
  /** Idempotency key — reuse the incentive_rewards.id */
  externalId: string
}

export type CreateTremendousOrderResult =
  | {
      success: true
      orderId: string
      rewardId: string | null
      raw: unknown
    }
  | { success: false; error: string }

const DEFAULT_SANDBOX_BASE = "https://testflight.tremendous.com/api/v2"

/** Read Sandbox config. Returns null if key or campaign is missing. */
export function getTremendousConfig(): TremendousConfig | null {
  const apiKey = process.env.TREMENDOUS_API_KEY?.trim()
  const campaignId = process.env.TREMENDOUS_CAMPAIGN_ID?.trim()
  const baseUrl =
    process.env.TREMENDOUS_API_BASE_URL?.trim().replace(/\/$/, "") ||
    DEFAULT_SANDBOX_BASE

  if (!apiKey || !campaignId) return null

  return { apiKey, campaignId, baseUrl }
}

export function isTremendousConfigured(): boolean {
  return getTremendousConfig() !== null
}

/**
 * Create a Sandbox order that emails a gift to the recipient via the
 * configured campaign. Uses BALANCE funding (Tremendous Sandbox fake money).
 */
export async function createTremendousOrder(
  config: TremendousConfig,
  input: CreateTremendousOrderInput
): Promise<CreateTremendousOrderResult> {
  const denomination = Math.round(Number(input.amount) * 100) / 100
  if (!Number.isFinite(denomination) || denomination <= 0) {
    return { success: false, error: "Invalid gift amount." }
  }

  const email = input.recipient.email?.trim()
  if (!email || !email.includes("@")) {
    return { success: false, error: "Contact has no valid email for the gift." }
  }

  const name =
    input.recipient.name?.trim() || email.split("@")[0] || "Valued contact"

  const body = {
    external_id: input.externalId,
    payment: {
      funding_source_id: "BALANCE",
    },
    reward: {
      campaign_id: config.campaignId,
      value: {
        denomination,
        currency_code: (input.currency || "USD").toUpperCase(),
      },
      delivery: {
        method: "EMAIL",
      },
      recipient: {
        name,
        email,
      },
    },
  }

  try {
    const response = await fetch(`${config.baseUrl}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    })

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!response.ok) {
      const message = extractTremendousError(payload, response.status)
      return { success: false, error: message }
    }

    const order = (payload as { order?: Record<string, unknown> })?.order
    const orderId =
      typeof order?.id === "string"
        ? order.id
        : typeof (payload as { id?: string })?.id === "string"
          ? (payload as { id: string }).id
          : null

    const rewards = order?.rewards as Array<{ id?: string }> | undefined
    const rewardId =
      typeof rewards?.[0]?.id === "string" ? rewards[0].id : null

    if (!orderId) {
      return {
        success: false,
        error: "Tremendous order succeeded but no order ID was returned.",
      }
    }

    return {
      success: true,
      orderId,
      rewardId,
      raw: payload,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tremendous request failed.",
    }
  }
}

function extractTremendousError(payload: unknown, status: number) {
  if (payload && typeof payload === "object") {
    const obj = payload as {
      errors?: Array<{ message?: string } | string>
      error?: string | { message?: string }
      message?: string
    }
    if (Array.isArray(obj.errors) && obj.errors.length) {
      const first = obj.errors[0]
      if (typeof first === "string") return first
      if (first?.message) return first.message
    }
    if (typeof obj.error === "string") return obj.error
    if (obj.error && typeof obj.error === "object" && obj.error.message) {
      return obj.error.message
    }
    if (typeof obj.message === "string") return obj.message
  }
  return `Tremendous responded ${status}`
}
