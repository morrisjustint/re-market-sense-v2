/**
 * Minimal SendGrid v3 integration using the REST API (no SDK dependency).
 * Email is the only channel enabled in the pilot. All sends come from the
 * RE Market Sense branded sender, never an individual agent's address.
 */

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send"

export type EmailConfig = {
  apiKey: string
  fromEmail: string
  fromName: string
}

export type SendEmailInput = {
  to: string
  toName?: string | null
  subject: string
  html: string
  text: string
  /** Optional reply-to so replies can reach the agent while the from stays branded. */
  replyTo?: { email: string; name?: string } | null
}

export type SendEmailResult =
  | { success: true; messageId: string | null }
  | { success: false; error: string }

/** Reads SendGrid config from the environment. Returns null if not fully set. */
export function getEmailConfig(): EmailConfig | null {
  const apiKey = process.env.SENDGRID_API_KEY?.trim()
  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim()
  const fromName = process.env.SENDGRID_FROM_NAME?.trim() || "RE Market Sense"

  if (!apiKey || !fromEmail) return null

  return { apiKey, fromEmail, fromName }
}

export function isEmailConfigured(): boolean {
  return getEmailConfig() !== null
}

export async function sendEmail(
  config: EmailConfig,
  input: SendEmailInput
): Promise<SendEmailResult> {
  try {
    const body = {
      personalizations: [
        {
          to: [
            {
              email: input.to,
              ...(input.toName ? { name: input.toName } : {}),
            },
          ],
          subject: input.subject,
        },
      ],
      from: { email: config.fromEmail, name: config.fromName },
      ...(input.replyTo?.email
        ? { reply_to: { email: input.replyTo.email, name: input.replyTo.name } }
        : {}),
      content: [
        { type: "text/plain", value: input.text },
        { type: "text/html", value: input.html },
      ],
      // Honor SendGrid's unsubscribe/suppression handling.
      mail_settings: { bypass_list_management: { enable: false } },
      tracking_settings: {
        click_tracking: { enable: true, enable_text: false },
        open_tracking: { enable: true },
      },
    }

    const response = await fetch(SENDGRID_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const messageId = response.headers.get("x-message-id")
      return { success: true, messageId }
    }

    let detail = `SendGrid responded ${response.status}`
    try {
      const payload = (await response.json()) as {
        errors?: Array<{ message?: string }>
      }
      const first = payload.errors?.[0]?.message
      if (first) detail = first
    } catch {
      // Non-JSON error body — keep the status-based message.
    }

    return { success: false, error: detail }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Email request failed.",
    }
  }
}
