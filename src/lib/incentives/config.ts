/**
 * Thank-you gift card copy and defaults.
 * Edit gift-card email wording here — used by email builder and UI.
 *
 * Future: Basic tier will hide/disable the gift-card option;
 * Pro (and above) keeps it available. Amount field already supports 5 or 10.
 */

export const DEFAULT_INCENTIVE_AMOUNT = 5

/** Supported amounts when we expand beyond the $5 pilot. */
export const SUPPORTED_INCENTIVE_AMOUNTS = [5, 10] as const

export type SupportedIncentiveAmount =
  (typeof SUPPORTED_INCENTIVE_AMOUNTS)[number]

/**
 * Plain-language sentence included in the check-in email when gifts are on.
 * Keep agent-friendly; avoid "incentive" jargon in recipient-facing copy.
 */
export function giftCardEmailSentence(amount = DEFAULT_INCENTIVE_AMOUNT) {
  const dollars = Number.isInteger(amount)
    ? `$${amount}`
    : `$${amount.toFixed(2)}`
  return `As a thank-you for completing this short check-in, you'll receive a ${dollars} virtual coffee gift card.`
}

/** Short label for Deploy UI radios. */
export function giftCardOptionLabel(amount = DEFAULT_INCENTIVE_AMOUNT) {
  return `Include $${amount} thank-you gift card on completion`
}

export { isTremendousConfigured } from "@/lib/incentives/tremendous"
