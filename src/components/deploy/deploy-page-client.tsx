"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CircleStop,
  MailCheck,
  MessageSquare,
  Pause,
  Play,
  Rocket,
  ShieldCheck,
  SquareCheckBig,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import {
  recordConsent,
  startOrResumeSending,
  updateDeploymentStatus,
} from "@/lib/actions/deployments"
import { CONSENT_ATTESTATION_TEXT } from "@/lib/consent"
import { formatCurrency } from "@/lib/lists/csv"
import type {
  Deployment,
  DeploymentConsent,
  DeploymentSendStats,
  DeploymentStatus,
} from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

type DeploymentRow = Deployment & {
  list_name?: string
  template_name?: string
}

const STATUS_FLOW: DeploymentStatus[] = [
  "draft",
  "ready",
  "sending",
  "paused",
  "completed",
]

function statusVariant(status: DeploymentStatus) {
  if (status === "sending" || status === "completed") return "default" as const
  if (status === "ready" || status === "paused") return "secondary" as const
  if (status === "stopped") return "destructive" as const
  return "outline" as const
}

function statusIndex(status: DeploymentStatus) {
  if (status === "stopped") return -1
  if (status === "paused") return STATUS_FLOW.indexOf("sending")
  return STATUS_FLOW.indexOf(status)
}

type CampaignAction = {
  label: string
  /** "send" routes through the consent-gated send flow; "status" is a plain update. */
  kind: "send" | "status"
  status: DeploymentStatus
  variant?: "default" | "outline" | "secondary" | "destructive"
  icon?: ReactNode
}

function actionsForStatus(status: DeploymentStatus): CampaignAction[] {
  switch (status) {
    case "draft":
      return [
        {
          label: "Mark Ready",
          kind: "status",
          status: "ready",
          icon: <SquareCheckBig className="size-4" />,
        },
        {
          label: "Cancel",
          kind: "status",
          status: "stopped",
          variant: "outline",
          icon: <CircleStop className="size-4" />,
        },
      ]
    case "ready":
      return [
        {
          label: "Launch",
          kind: "send",
          status: "sending",
          icon: <Rocket className="size-4" />,
        },
        {
          label: "Cancel",
          kind: "status",
          status: "stopped",
          variant: "outline",
          icon: <CircleStop className="size-4" />,
        },
      ]
    case "sending":
      return [
        {
          label: "Pause",
          kind: "status",
          status: "paused",
          variant: "secondary",
          icon: <Pause className="size-4" />,
        },
        {
          label: "Mark Completed",
          kind: "status",
          status: "completed",
          variant: "outline",
          icon: <SquareCheckBig className="size-4" />,
        },
        {
          label: "Stop",
          kind: "status",
          status: "stopped",
          variant: "destructive",
          icon: <CircleStop className="size-4" />,
        },
      ]
    case "paused":
      return [
        {
          label: "Resume",
          kind: "send",
          status: "sending",
          icon: <Play className="size-4" />,
        },
        {
          label: "Mark Completed",
          kind: "status",
          status: "completed",
          variant: "outline",
          icon: <SquareCheckBig className="size-4" />,
        },
        {
          label: "Stop",
          kind: "status",
          status: "stopped",
          variant: "destructive",
          icon: <CircleStop className="size-4" />,
        },
      ]
    default:
      return []
  }
}

function statusUpdateMessage(status: DeploymentStatus) {
  switch (status) {
    case "ready":
      return "Marked ready — confirm consent, then launch."
    case "paused":
      return "Campaign paused."
    case "completed":
      return "Marked completed."
    case "stopped":
      return "Stopped / cancelled."
    default:
      return "Status updated."
  }
}

export function DeployPageClient({
  deployments,
  highlightId,
  consents,
  stats,
  emailConfigured,
}: {
  deployments: DeploymentRow[]
  highlightId?: string
  consents: Record<string, DeploymentConsent>
  stats: Record<string, DeploymentSendStats>
  emailConfigured: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const highlighted = useMemo(
    () => deployments.find((d) => d.id === highlightId) ?? deployments[0],
    [deployments, highlightId]
  )

  const onStatusChange = (
    deployment: DeploymentRow,
    status: DeploymentStatus
  ) => {
    startTransition(async () => {
      const result = await updateDeploymentStatus(deployment.id, status)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(statusUpdateMessage(status))
      router.refresh()
    })
  }

  const onSend = (deployment: DeploymentRow) => {
    if (!consents[deployment.id]) {
      toast.error("Confirm the consent attestation before launching.")
      return
    }
    startTransition(async () => {
      const result = await startOrResumeSending(deployment.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const summary = result.data
      if (summary) {
        if (!summary.configured) {
          toast.warning(
            `Campaign is sending, but email isn't configured — ${summary.skipped} contact(s) skipped. Add SendGrid keys to deliver.`
          )
        } else {
          toast.success(
            `Sent ${summary.sent} of ${summary.eligible} email(s)${
              summary.failed ? ` · ${summary.failed} failed` : ""
            }.`
          )
        }
      } else {
        toast.success("Campaign sending.")
      }
      router.refresh()
    })
  }

  const onConfirmConsent = (deployment: DeploymentRow, checked: boolean) => {
    if (!checked || consents[deployment.id]) return
    startTransition(async () => {
      const result = await recordConsent(deployment.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Consent confirmed and recorded.")
      router.refresh()
    })
  }

  const runAction = (deployment: DeploymentRow, action: CampaignAction) => {
    if (action.kind === "send") onSend(deployment)
    else onStatusChange(deployment, action.status)
  }

  if (!deployments.length) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Nothing to launch yet</CardTitle>
          <CardDescription>
            Pick a list and template under Research to create a draft
            deployment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/app/research">Go to Research</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {emailConfigured ? (
        <Alert>
          <MailCheck className="size-4" />
          <AlertTitle>Email sending is live</AlertTitle>
          <AlertDescription>
            Launching sends branded email check-ins from RE Market Sense to
            contacts who have an email and haven&apos;t opted out. Text message
            sending is coming soon and is not part of the pilot.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Email is not configured yet</AlertTitle>
          <AlertDescription>
            Add <code>SENDGRID_API_KEY</code> and{" "}
            <code>SENDGRID_FROM_EMAIL</code> to enable delivery. You can still
            move campaigns through the workflow — sends will be logged as skipped
            until keys are added.
          </AlertDescription>
        </Alert>
      )}

      {highlighted ? (
        <HighlightedCampaign
          deployment={highlighted}
          consent={consents[highlighted.id]}
          stats={stats[highlighted.id]}
          pending={pending}
          onConfirmConsent={(checked) =>
            onConfirmConsent(highlighted, checked)
          }
          onAction={(action) => runAction(highlighted, action)}
        />
      ) : null}

      <SmsPlaceholder />

      <Card>
        <CardHeader>
          <CardTitle>All deployments</CardTitle>
          <CardDescription>
            Draft → Ready → Sending → Paused → Completed / Stopped
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>List</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Consent</TableHead>
                <TableHead>Emails</TableHead>
                <TableHead className="pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((deployment) => {
                const stat = stats[deployment.id]
                const hasConsent = Boolean(consents[deployment.id])
                return (
                  <TableRow
                    key={deployment.id}
                    className={cn(
                      highlightId === deployment.id && "bg-accent/40"
                    )}
                  >
                    <TableCell className="pl-6 font-medium">
                      <Link
                        href={`/app/deploy?id=${deployment.id}`}
                        className="hover:underline"
                      >
                        {deployment.name}
                      </Link>
                    </TableCell>
                    <TableCell>{deployment.list_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant(deployment.status)}
                        className="capitalize"
                      >
                        {deployment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {hasConsent ? (
                        <span className="inline-flex items-center gap-1 text-sm text-primary">
                          <ShieldCheck className="size-4" />
                          Confirmed
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {stat && stat.eligible > 0
                        ? `${stat.sent}/${stat.eligible}`
                        : "—"}
                      {stat && stat.failed > 0 ? (
                        <span className="ml-1 text-destructive">
                          ({stat.failed} failed)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex flex-wrap gap-1.5">
                        {actionsForStatus(deployment.status).map((action) => {
                          const blockedSend =
                            action.kind === "send" && !hasConsent
                          return (
                            <Button
                              key={action.label}
                              type="button"
                              size="sm"
                              variant={action.variant ?? "outline"}
                              disabled={pending || blockedSend}
                              title={
                                blockedSend
                                  ? "Confirm consent on the campaign above first"
                                  : undefined
                              }
                              onClick={() => runAction(deployment, action)}
                            >
                              {action.label}
                            </Button>
                          )
                        })}
                        {!actionsForStatus(deployment.status).length ? (
                          <span className="text-sm text-muted-foreground">
                            Done
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function HighlightedCampaign({
  deployment,
  consent,
  stats,
  pending,
  onConfirmConsent,
  onAction,
}: {
  deployment: DeploymentRow
  consent?: DeploymentConsent
  stats?: DeploymentSendStats
  pending: boolean
  onConfirmConsent: (checked: boolean) => void
  onAction: (action: CampaignAction) => void
}) {
  const hasConsent = Boolean(consent)
  const showSendProgress =
    deployment.status === "sending" ||
    deployment.status === "paused" ||
    deployment.status === "completed"
  const eligible = stats?.eligible ?? 0
  const sent = stats?.sent ?? 0
  const failed = stats?.failed ?? 0
  const progress = eligible > 0 ? Math.round((sent / eligible) * 100) : 0

  return (
    <Card className="border-primary/20 bg-accent/20">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-navy">
              {deployment.name}
            </CardTitle>
            <CardDescription className="mt-1">
              {deployment.list_name ?? "List"} ·{" "}
              {deployment.template_name ?? "Template"}
            </CardDescription>
          </div>
          <Badge
            variant={statusVariant(deployment.status)}
            className="capitalize"
          >
            {deployment.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Estimated cost
            </p>
            <p className="text-2xl font-semibold text-navy">
              {deployment.cost_estimate != null
                ? formatCurrency(Number(deployment.cost_estimate))
                : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Placeholder at about $0.06 per contact.
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Status flow
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {STATUS_FLOW.filter((s) => s !== "paused").map(
                (status, index, arr) => {
                  const current = statusIndex(deployment.status)
                  const stepIndex = STATUS_FLOW.indexOf(status)
                  const active =
                    deployment.status === "stopped"
                      ? false
                      : current >= stepIndex
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                          deployment.status === "paused" &&
                            status === "sending" &&
                            "ring-2 ring-primary/40"
                        )}
                      >
                        {status}
                      </span>
                      {index < arr.length - 1 ? (
                        <span className="text-muted-foreground">→</span>
                      ) : null}
                    </div>
                  )
                }
              )}
              {deployment.status === "paused" ? (
                <Badge variant="secondary">Paused</Badge>
              ) : null}
              {deployment.status === "stopped" ? (
                <Badge variant="destructive">Stopped</Badge>
              ) : null}
            </div>
          </div>
        </div>

        {showSendProgress ? (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-navy">Email progress</p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {sent} of {eligible} sent
                {failed > 0 ? (
                  <span className="ml-2 text-destructive">
                    {failed} failed
                  </span>
                ) : null}
              </p>
            </div>
            <Progress value={progress} className="mt-3" />
            {eligible === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No email-eligible contacts on this list (missing email or opted
                out).
              </p>
            ) : null}
          </div>
        ) : null}

        <ConsentGate
          consent={consent}
          pending={pending}
          locked={deployment.status !== "draft" && deployment.status !== "ready"}
          onConfirmConsent={onConfirmConsent}
        />

        <div className="flex flex-wrap gap-2">
          {actionsForStatus(deployment.status).map((action) => {
            const blockedSend = action.kind === "send" && !hasConsent
            return (
              <Button
                key={action.label}
                type="button"
                variant={action.variant ?? "default"}
                disabled={pending || blockedSend}
                title={
                  blockedSend
                    ? "Confirm the consent attestation to launch"
                    : undefined
                }
                onClick={() => onAction(action)}
              >
                {action.icon}
                {pending ? "Working…" : action.label}
              </Button>
            )
          })}
          {!actionsForStatus(deployment.status).length ? (
            <p className="text-sm text-muted-foreground">
              This campaign is{" "}
              <span className="capitalize">{deployment.status}</span>. Review
              scored replies under Leads.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function ConsentGate({
  consent,
  pending,
  locked,
  onConfirmConsent,
}: {
  consent?: DeploymentConsent
  pending: boolean
  locked: boolean
  onConfirmConsent: (checked: boolean) => void
}) {
  const confirmed = Boolean(consent)

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        confirmed
          ? "border-primary/30 bg-primary/5"
          : "border-amber-300/70 bg-amber-50/60"
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id="consent-attestation"
          checked={confirmed}
          disabled={pending || confirmed || locked}
          onCheckedChange={(value) => onConfirmConsent(value === true)}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <label
            htmlFor="consent-attestation"
            className="flex items-center gap-2 text-sm font-medium text-navy"
          >
            <ShieldCheck className="size-4 text-primary" />
            Consent confirmation {confirmed ? "" : "(required)"}
          </label>
          <p className="text-sm text-foreground/90">
            {CONSENT_ATTESTATION_TEXT}
          </p>
          {confirmed && consent ? (
            <p className="text-xs text-muted-foreground">
              Confirmed by {consent.attested_by_email ?? "an account member"} on{" "}
              {new Date(consent.attested_at).toLocaleString()}.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              You must confirm this before the campaign can be launched.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function SmsPlaceholder() {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-muted-foreground" />
            <CardTitle className="text-base text-muted-foreground">
              Text message check-ins
            </CardTitle>
          </div>
          <Badge variant="outline">Coming soon</Badge>
        </div>
        <CardDescription>
          SMS is not available in the pilot. Email check-ins are fully supported
          today — text messaging will follow once carrier registration is
          complete.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" disabled>
          <MessageSquare className="size-4" />
          Send text check-in (coming soon)
        </Button>
      </CardContent>
    </Card>
  )
}
