import type { Metadata } from "next"

import {
  RespondErrorState,
  RespondForm,
} from "@/components/respond/respond-form"
import { loadCheckInByToken } from "@/lib/checkin/public"

export const metadata: Metadata = {
  title: "Check-in",
  robots: { index: false, follow: false },
}

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function RespondPage({ params }: PageProps) {
  const { token: rawToken } = await params
  const token = decodeURIComponent(rawToken ?? "").trim()

  if (!token || token.length < 16) {
    return (
      <RespondErrorState
        title="This link isn't valid"
        description="Double-check the link from your email, or ask your agent to send a new check-in."
      />
    )
  }

  const checkIn = await loadCheckInByToken(token)

  if (!checkIn.ok) {
    if (checkIn.error === "already_submitted") {
      return (
        <RespondErrorState
          title="You have already completed this check-in"
          description="Thanks again — your answers were received. You can close this page."
          agentName={checkIn.agent_name}
          orgName={checkIn.org_name}
        />
      )
    }
    if (checkIn.error === "expired") {
      return (
        <RespondErrorState
          title="This check-in link has expired"
          description="Ask your agent for a fresh link if you'd still like to share an update."
          agentName={checkIn.agent_name}
          orgName={checkIn.org_name}
        />
      )
    }
    return (
      <RespondErrorState
        title="This link isn't valid"
        description="Double-check the link from your email, or ask your agent to send a new check-in."
      />
    )
  }

  return <RespondForm checkIn={checkIn} />
}
