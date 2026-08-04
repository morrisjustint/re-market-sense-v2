import { giftCardEmailSentence } from "@/lib/incentives/config"
import type { Contact, Template } from "@/types/database"

export type EmailContent = {
  subject: string
  html: string
  text: string
}

export type BuildEmailInput = {
  template: Pick<Template, "name" | "intro_text" | "questions">
  contact: Pick<Contact, "first_name" | "email">
  agentName: string
  orgName: string
  /** Unique check-in link for this contact + deployment. */
  respondUrl: string
  /** Where a reply / opt-out request should be directed. */
  replyToEmail?: string | null
  /** Thank-you gift card on completion. */
  incentiveEnabled?: boolean
  incentiveAmount?: number
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function greetingName(contact: Pick<Contact, "first_name">) {
  const name = contact.first_name?.trim()
  return name ? name : "there"
}

const OPT_OUT_SENTENCE =
  'If you\'d prefer not to hear from us, just reply with "STOP" and we\'ll remove you right away.'

/**
 * Builds a professional, plain-language real-estate email with a primary CTA
 * to the unique check-in link. Questions live on the form, not in the email.
 */
export function buildCheckInEmail(input: BuildEmailInput): EmailContent {
  const {
    template,
    contact,
    agentName,
    orgName,
    respondUrl,
    incentiveEnabled,
    incentiveAmount,
  } = input
  const name = greetingName(contact)
  const questionCount = (template.questions ?? []).length

  const intro =
    template.intro_text?.trim() ||
    "I wanted to check in and see how you're thinking about your home and any plans that might be ahead."

  const thankYouLine = incentiveEnabled
    ? giftCardEmailSentence(incentiveAmount ?? 5)
    : null

  const subject = `A quick note about your home${
    contact.first_name ? `, ${contact.first_name.trim()}` : ""
  }`

  const timingLine =
    questionCount > 0
      ? `It only takes a minute — ${questionCount} short question${
          questionCount === 1 ? "" : "s"
        }, whenever it's convenient.`
      : "It only takes a minute — whenever it's convenient."

  // -------- Plain text --------
  const textParts = [
    `Hi ${name},`,
    "",
    intro,
    "",
  ]
  if (thankYouLine) {
    textParts.push(thankYouLine, "")
  }
  textParts.push(
    timingLine,
    "",
    "Start the short check-in here:",
    respondUrl,
    "",
    "No pressure at all — just reply STOP if you'd rather not hear from us.",
    "",
    "Thanks so much,",
    agentName,
    `Sent on behalf of ${agentName} via ${orgName}`,
    "",
    OPT_OUT_SENTENCE
  )
  const text = textParts.join("\n")

  // -------- HTML --------
  const thankYouHtml = thankYouLine
    ? `<p style="margin:0 0 16px;padding:12px 14px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;color:#0f766e;font-size:15px;line-height:1.6;">${escapeHtml(
        thankYouLine
      )}</p>`
    : ""

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr>
        <td style="background:#0d9488;padding:16px 24px;">
          <span style="color:#ffffff;font-size:16px;font-weight:bold;">RE Market Sense</span>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 16px;color:#0f172a;font-size:15px;">Hi ${escapeHtml(
            name
          )},</p>
          <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">${escapeHtml(
            intro
          )}</p>
          ${thankYouHtml}
          <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.6;">${escapeHtml(
            timingLine
          )}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="border-radius:8px;background:#0d9488;">
                <a href="${escapeHtml(
                  respondUrl
                )}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">
                  Start the short check-in
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.5;">
            Or copy this link into your browser:<br />
            <a href="${escapeHtml(
              respondUrl
            )}" style="color:#0d9488;word-break:break-all;">${escapeHtml(
              respondUrl
            )}</a>
          </p>
          <p style="margin:24px 0 4px;color:#0f172a;font-size:15px;">Thanks so much,</p>
          <p style="margin:0;color:#0f172a;font-size:15px;font-weight:bold;">${escapeHtml(
            agentName
          )}</p>
          <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Sent on behalf of ${escapeHtml(
            agentName
          )} via ${escapeHtml(orgName)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">${escapeHtml(
            OPT_OUT_SENTENCE
          )}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, html, text }
}
