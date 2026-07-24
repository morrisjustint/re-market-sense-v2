"use client"

import { useMemo, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CircleStop,
  Pause,
  Play,
  Rocket,
  SquareCheckBig,
} from "lucide-react"
import { toast } from "sonner"

import { updateDeploymentStatus } from "@/lib/actions/deployments"
import { formatCurrency } from "@/lib/lists/csv"
import type { Deployment, DeploymentStatus } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
          status: "ready",
          icon: <SquareCheckBig className="size-4" />,
        },
        {
          label: "Cancel",
          status: "stopped",
          variant: "outline",
          icon: <CircleStop className="size-4" />,
        },
      ]
    case "ready":
      return [
        {
          label: "Launch",
          status: "sending",
          icon: <Rocket className="size-4" />,
        },
        {
          label: "Cancel",
          status: "stopped",
          variant: "outline",
          icon: <CircleStop className="size-4" />,
        },
      ]
    case "sending":
      return [
        {
          label: "Pause",
          status: "paused",
          variant: "secondary",
          icon: <Pause className="size-4" />,
        },
        {
          label: "Mark Completed",
          status: "completed",
          variant: "outline",
          icon: <SquareCheckBig className="size-4" />,
        },
        {
          label: "Stop",
          status: "stopped",
          variant: "destructive",
          icon: <CircleStop className="size-4" />,
        },
      ]
    case "paused":
      return [
        {
          label: "Resume",
          status: "sending",
          icon: <Play className="size-4" />,
        },
        {
          label: "Mark Completed",
          status: "completed",
          variant: "outline",
          icon: <SquareCheckBig className="size-4" />,
        },
        {
          label: "Stop",
          status: "stopped",
          variant: "destructive",
          icon: <CircleStop className="size-4" />,
        },
      ]
    default:
      return []
  }
}

function successMessage(status: DeploymentStatus) {
  switch (status) {
    case "ready":
      return "Marked ready — launch when you are set."
    case "sending":
      return "Launch recorded (stub). No SMS or email was sent."
    case "paused":
      return "Paused (stub). Nothing is sending yet."
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
}: {
  deployments: DeploymentRow[]
  highlightId?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const highlighted = useMemo(
    () => deployments.find((d) => d.id === highlightId) ?? deployments[0],
    [deployments, highlightId]
  )

  const onSetStatus = (deployment: DeploymentRow, status: DeploymentStatus) => {
    startTransition(async () => {
      const result = await updateDeploymentStatus(deployment.id, status)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(successMessage(status))
      router.refresh()
    })
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
      <Alert>
        <Rocket className="size-4" />
        <AlertTitle>Sending is not connected yet</AlertTitle>
        <AlertDescription>
          Campaign controls update status only — no SMS or email is sent.
          Cost estimates stay visible for planning. Real Twilio / SendGrid
          delivery comes in a later phase.
        </AlertDescription>
      </Alert>

      {highlighted ? (
        <Card className="border-primary/20 bg-accent/20">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="font-heading text-navy">
                  {highlighted.name}
                </CardTitle>
                <CardDescription className="mt-1">
                  {highlighted.list_name ?? "List"} ·{" "}
                  {highlighted.template_name ?? "Template"}
                </CardDescription>
              </div>
              <Badge
                variant={statusVariant(highlighted.status)}
                className="capitalize"
              >
                {highlighted.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Estimated cost
                </p>
                <p className="text-2xl font-semibold text-navy">
                  {highlighted.cost_estimate != null
                    ? formatCurrency(Number(highlighted.cost_estimate))
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
                      const current = statusIndex(highlighted.status)
                      const stepIndex = STATUS_FLOW.indexOf(status)
                      const active =
                        highlighted.status === "stopped"
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
                              highlighted.status === "paused" &&
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
                  {highlighted.status === "paused" ? (
                    <Badge variant="secondary">Paused</Badge>
                  ) : null}
                  {highlighted.status === "stopped" ? (
                    <Badge variant="destructive">Stopped</Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {actionsForStatus(highlighted.status).map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant={action.variant ?? "default"}
                  disabled={pending}
                  onClick={() => onSetStatus(highlighted, action.status)}
                >
                  {action.icon}
                  {pending ? "Updating…" : action.label}
                </Button>
              ))}
              {!actionsForStatus(highlighted.status).length ? (
                <p className="text-sm text-muted-foreground">
                  This campaign is{" "}
                  <span className="capitalize">{highlighted.status}</span>.
                  Review scored replies under Leads.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Estimate</TableHead>
                <TableHead className="pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((deployment) => (
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
                  <TableCell>{deployment.template_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariant(deployment.status)}
                      className="capitalize"
                    >
                      {deployment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {deployment.cost_estimate != null
                      ? formatCurrency(Number(deployment.cost_estimate))
                      : "—"}
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="flex flex-wrap gap-1.5">
                      {actionsForStatus(deployment.status).map((action) => (
                        <Button
                          key={action.label}
                          type="button"
                          size="sm"
                          variant={action.variant ?? "outline"}
                          disabled={pending}
                          onClick={() =>
                            onSetStatus(deployment, action.status)
                          }
                        >
                          {action.label}
                        </Button>
                      ))}
                      {!actionsForStatus(deployment.status).length ? (
                        <span className="text-sm text-muted-foreground">
                          Done
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
