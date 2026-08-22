import { createClient } from "@/lib/supabase/server"
import {
  createTremendousOrder,
  getTremendousConfig,
} from "@/lib/incentives/tremendous"

export type IncentiveFulfillmentResult = {
  queued: boolean
  sent: boolean
  amount?: number
  status?: string
  /** True when env is missing — reward stays pending without calling Tremendous. */
  notConfigured?: boolean
}

/**
 * Create/update incentive_rewards, then call Tremendous Sandbox when env is set.
 * Never throws — callers keep check-in success even if fulfillment fails.
 */
export async function fulfillIncentiveForToken(
  token: string
): Promise<IncentiveFulfillmentResult> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("queue_incentive_for_token", {
      p_token: token,
    })

    if (error || !data || typeof data !== "object") {
      console.error("[incentive] queue failed", error?.message ?? "no data")
      return { queued: false, sent: false }
    }

    const payload = data as Record<string, unknown>
    if (payload.ok !== true || payload.queued !== true) {
      return { queued: false, sent: false }
    }

    const amount = Number(payload.amount ?? 5)
    const rewardId =
      typeof payload.reward_id === "string" ? payload.reward_id : null
    const status = String(payload.status ?? "pending")

    if (payload.already_sent === true || status === "sent") {
      return { queued: true, sent: true, amount, status: "sent" }
    }

    if (!rewardId) {
      console.error("[incentive] queue returned no reward_id")
      return { queued: true, sent: false, amount, status: "pending" }
    }

    const config = getTremendousConfig()
    if (!config) {
      return {
        queued: true,
        sent: false,
        amount,
        status: "pending",
        notConfigured: true,
      }
    }

    const email =
      typeof payload.contact_email === "string"
        ? payload.contact_email.trim()
        : ""
    const nameFromPayload =
      typeof payload.contact_name === "string"
        ? payload.contact_name.trim()
        : ""
    const first =
      typeof payload.contact_first_name === "string"
        ? payload.contact_first_name
        : ""
    const last =
      typeof payload.contact_last_name === "string"
        ? payload.contact_last_name
        : ""
    const name =
      nameFromPayload ||
      [first, last].filter(Boolean).join(" ").trim() ||
      email.split("@")[0] ||
      "Valued contact"

    const order = await createTremendousOrder(config, {
      amount,
      currency:
        typeof payload.currency === "string" ? payload.currency : "USD",
      recipient: { name, email },
      externalId: `re-ms-reward-${rewardId}`,
    })

    if (!order.success) {
      console.error("[incentive] Tremendous order failed", order.error)
      await supabase.rpc("update_incentive_reward_status", {
        p_reward_id: rewardId,
        p_status: "failed",
        p_external_id: null,
        p_error: order.error.slice(0, 500),
      })
      return { queued: true, sent: false, amount, status: "failed" }
    }

    const externalId = order.rewardId
      ? `${order.orderId}:${order.rewardId}`
      : order.orderId

    await supabase.rpc("update_incentive_reward_status", {
      p_reward_id: rewardId,
      p_status: "sent",
      p_external_id: externalId,
      p_error: null,
    })

    return { queued: true, sent: true, amount, status: "sent" }
  } catch (error) {
    console.error(
      "[incentive] fulfillment error",
      error instanceof Error ? error.message : error
    )
    return { queued: false, sent: false }
  }
}
