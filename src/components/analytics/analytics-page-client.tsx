"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Download,
  FileSpreadsheet,
  FileText,
  Flame,
  Snowflake,
  SunMedium,
} from "lucide-react"
import { toast } from "sonner"

import { seedSampleResponses } from "@/lib/actions/deployments"
import { exportLeadsCsv, exportLeadsDocx } from "@/lib/actions/exports"
import type { Deployment, ScoredLead } from "@/types/database"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

type DeploymentOption = Pick<Deployment, "id" | "name" | "status"> & {
  list_name?: string
  template_name?: string
}

function bandVariant(bandId: string | null) {
  if (bandId === "hot") return "default" as const
  if (bandId === "warm") return "secondary" as const
  return "outline" as const
}

function downloadBlob(filename: string, mimeType: string, data: BlobPart) {
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function AnalyticsPageClient({
  leads,
  deployments,
  bandCounts,
}: {
  leads: ScoredLead[]
  deployments: DeploymentOption[]
  bandCounts: { hot: number; warm: number; future: number; other: number }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [filterDeploymentId, setFilterDeploymentId] = useState<string>("all")

  const filteredLeads = useMemo(() => {
    if (filterDeploymentId === "all") return leads
    return leads.filter((lead) => lead.deployment_id === filterDeploymentId)
  }, [leads, filterDeploymentId])

  const filteredCounts = useMemo(() => {
    const counts = { hot: 0, warm: 0, future: 0 }
    for (const lead of filteredLeads) {
      const id = lead.band_id?.toLowerCase()
      if (id === "hot") counts.hot += 1
      else if (id === "warm") counts.warm += 1
      else if (id === "future") counts.future += 1
    }
    return counts
  }, [filteredLeads])

  const sampleTargetId =
    filterDeploymentId !== "all"
      ? filterDeploymentId
      : deployments[0]?.id ?? ""

  const onExportCsv = () => {
    startTransition(async () => {
      try {
        const file = await exportLeadsCsv(
          filterDeploymentId === "all" ? undefined : filterDeploymentId
        )
        downloadBlob(file.filename, file.mimeType, file.content)
        toast.success("CSV downloaded — ready for Follow Up Boss.")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not export CSV."
        )
      }
    })
  }

  const onExportDocx = () => {
    startTransition(async () => {
      try {
        const file = await exportLeadsDocx(
          filterDeploymentId === "all" ? undefined : filterDeploymentId
        )
        downloadBlob(
          file.filename,
          file.mimeType,
          base64ToUint8Array(file.contentBase64)
        )
        toast.success("DOCX report downloaded.")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not export report."
        )
      }
    })
  }

  const onSeedSamples = () => {
    if (!sampleTargetId) {
      toast.error("Create a deployment first, then preview sample replies.")
      return
    }
    startTransition(async () => {
      const result = await seedSampleResponses(sampleTargetId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(
        `Added ${result.data?.count ?? 0} sample replies for preview.`
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-navy">
            Leads
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            See who is ready to move — Hot, Warm, and Future — with clear next
            steps.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !filteredLeads.length}
            onClick={onExportCsv}
          >
            <FileSpreadsheet className="size-4" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !filteredLeads.length}
            onClick={onExportDocx}
          >
            <FileText className="size-4" />
            Export DOCX
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Flame className="size-4 text-primary" />
              Hot
            </CardDescription>
            <CardTitle className="text-3xl text-navy">
              {filterDeploymentId === "all" ? bandCounts.hot : filteredCounts.hot}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Reach out this week.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <SunMedium className="size-4 text-teal" />
              Warm
            </CardDescription>
            <CardTitle className="text-3xl text-navy">
              {filterDeploymentId === "all"
                ? bandCounts.warm
                : filteredCounts.warm}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Stay close with a helpful check-in.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Snowflake className="size-4 text-muted-foreground" />
              Future
            </CardDescription>
            <CardTitle className="text-3xl text-navy">
              {filterDeploymentId === "all"
                ? bandCounts.future
                : filteredCounts.future}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nurture for later.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Scored contacts</CardTitle>
            <CardDescription>
              Score and recommended next step from your check-in templates.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Select
              value={filterDeploymentId}
              onValueChange={setFilterDeploymentId}
            >
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="All deployments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All deployments</SelectItem>
                {deployments.map((deployment) => (
                  <SelectItem key={deployment.id} value={deployment.id}>
                    {deployment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-0">
          {!leads.length ? (
            <div className="space-y-4 px-6 pb-2">
              <Alert>
                <Download className="size-4" />
                <AlertTitle>No replies yet</AlertTitle>
                <AlertDescription>
                  When contacts respond, they will show here with a score and
                  next step. SMS/email sending is not connected yet — you can
                  preview the leads view with sample replies.
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pending || !sampleTargetId}
                  onClick={onSeedSamples}
                >
                  {pending ? "Adding…" : "Preview with sample replies"}
                </Button>
                <Button asChild variant="outline">
                  <Link href="/app/deploy">Go to Deploy</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Contact</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>Next step</TableHead>
                    <TableHead className="pr-6">Deployment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => {
                    const name =
                      [lead.first_name, lead.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="pl-6">
                          <div>
                            <p className="font-medium text-foreground">{name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[lead.email, lead.phone]
                                .filter(Boolean)
                                .join(" · ") || "No contact info"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-navy">
                          {lead.score}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={bandVariant(lead.band_id)}
                            className={cn(
                              lead.band_id === "hot" && "bg-primary"
                            )}
                          >
                            {lead.band_label ?? lead.band_id ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                          {lead.recommended_next_step ?? "—"}
                        </TableCell>
                        <TableCell className="pr-6 text-sm">
                          {lead.deployment_name ?? "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {!filteredLeads.length ? (
                <p className="px-6 py-8 text-sm text-muted-foreground">
                  No scored contacts for this deployment yet.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
