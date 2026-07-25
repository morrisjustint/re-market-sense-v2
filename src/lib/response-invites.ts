import { randomBytes } from "crypto"

/** Cryptographically random, URL-safe token for /respond/[token]. */
export function generateResponseToken() {
  return randomBytes(32).toString("base64url")
}

/** Default invite lifetime: 30 days. */
export function defaultInviteExpiresAt(from = new Date()) {
  const expires = new Date(from)
  expires.setDate(expires.getDate() + 30)
  return expires.toISOString()
}

export function getAppBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`
  }

  return "http://localhost:3000"
}

export function buildRespondUrl(token: string) {
  return `${getAppBaseUrl()}/respond/${encodeURIComponent(token)}`
}
