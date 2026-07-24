"use client"

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import {
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Flame,
  Sparkles,
  Snowflake,
  SunMedium,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { exportLeadsCsv, exportLeadsDocx } from "@/lib/actions/exports"
import {
  clearSampleLeadsFromSession,
  enrichLeadsWithAnswers,
  generateSampleLeads,
  loadSampleLeadsFromSession,
  saveSampleLeadsToSession,
  type DisplayLead,
} from "@/lib/leads/sample-leads"
import type { Deployment, ScoredLead, Template } from "@/types/database"
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
import { cn } from "@/lib/utils"

type DeploymentOption = Pick<Deployment, "id" | "name" | "status"> & {
  list_name?: string
  template_name?: string
}

type BandFilter = "all" | "hot" | "warm" | "future"

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

function countBands(leads: DisplayLead[]) {
  const counts = { hot: 0, warm: 0, future: 0, other: 0 }
  for (const lead of leads) {
    const id = lead.band_id?.toLowerCase()
    if (id === "hot") counts.hot += 1
    else if (id === "warm") counts.warm += 1
    else if (id === "future") counts.future += 1
    else counts.other += 1
  }
  return counts
}

function contactName(lead: DisplayLead) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"
}

export function AnalyticsPageClient({
  leads,
  deployments,
  templates,
}: {
  leads: ScoredLead[]
  deployments: DeploymentOption[]
  templates: Template[]
}) {
  const [pending, startTransition] = useTransition()
  const [filterDeploymentId, setFilterDeploymentId] = useState("all")
  const [bandFilter, setBandFilter] = useState<BandFilter>("all")
  const [sampleLeads, setSampleLeads] = useState<DisplayLead[] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const templatesByName = useMemo(() => {
    const map = new Map<string, Template>()
    for (const template of templates) map.set(template.name, template)
    return map
  }, [templates])

  const defaultTemplate =
    templates.find((t) => t.name.includes("Move Readiness")) ??
    templates[0] ??
    null

  const realLeads = useMemo(
    () => enrichLeadsWithAnswers(leads, templatesByName, defaultTemplate ?? undefined),
    [leads, templatesByName, defaultTemplate]
  )

  useEffect(() => {
    if (realLeads.length) {
      setSampleLeads(null)
      clearSampleLeadsFromSession()
      setHydrated(true)
      return
    }
    const stored = loadSampleLeadsFromSession()
    if (stored?.length) setSampleLeads(stored)
    setHydrated(true)
  }, [realLeads.length])

  const usingSamples = !realLeads.length && Boolean(sampleLeads?.length)
  const activeLeads = usingSamples ? sampleLeads! : realLeads

  const deploymentFiltered = useMemo(() => {
    if (usingSamples || filterDeploymentId === "all") return activeLeads
    return activeLeads.filter((lead) => lead.deployment_id === filterDeploymentId)
  }, [activeLeads, filterDeploymentId, usingSamples])

  const visibleLeads = useMemo(() => {
    if (bandFilter === "all") return deploymentFiltered
    return deploymentFiltered.filter(
      (lead) => lead.band_id?.toLowerCase() === bandFilter
    )
  }, [deploymentFiltered, bandFilter])

  const bandCounts = useMemo(
    () => countBands(deploymentFiltered),
    [deploymentFiltered]
  )

  const onGenerateSamples = () => {
    if (!defaultTemplate) {
      toast.error("No check-in templates available yet.")
      return
    }
    const generated = generateSampleLeads(defaultTemplate, { count: 10 })
    setSampleLeads(generated)
    saveSampleLeadsToSession(generated)
    setBandFilter("all")
    setExpandedId(null)
    toast.success("Sample replies ready — nothing was saved to your lists.")
  }

  const onClearSamples = () => {
    setSampleLeads(null)
    clearSampleLeadsFromSession()
    setExpandedId(null)
    toast.message("Sample preview cleared.")
  }

  const onExportCsv = () => {
    const toExport = bandFilter === "all" ? deploymentFiltered : visibleLeads

    startTransition(async () => {
      try {
        const file = await exportLeadsCsv(
          toExport.length
            ? { leads: toExport }
            : {
                deploymentId:
                  filterDeploymentId === "all"
                    ? undefined
                    : filterDeploymentId,
              }
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
    const toExport = bandFilter === "all" ? deploymentFiltered : visibleLeads

    startTransition(async () => {
      try {
        const file = await exportLeadsDocx(
          toExport.length
            ? { leads: toExport }
            : {
                deploymentId:
                  filterDeploymentId === "all"
                    ? undefined
                    : filterDeploymentId,
              }
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

  const showEmpty = hydrated && !realLeads.length && !sampleLeads?.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-navy md:text-3xl">
            Who&apos;s ready to move
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground md:text-base">
            Hot, Warm, and Future contacts with a clear next step for each
            person on your list.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !activeLeads.length}
            onClick={onExportCsv}
          >
            <FileSpreadsheet className="size-4" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !activeLeads.length}
            onClick={onExportDocx}
          >
            <FileText className="size-4" />
            Export DOCX
          </Button>
        </div>
      </div>

      {usingSamples ? (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-accent/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-foreground/90">
              <span className="font-medium text-navy">Sample preview</span>
              {" — "}
              demo contacts only. Nothing was added to your real lists.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearSamples}
          >
            <X className="size-4" />
            Clear sample
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <BandSummaryCard
          band="hot"
          label="Hot"
          count={bandCounts.hot}
          hint="Call or text this week"
          active={bandFilter === "hot"}
          onClick={() =>
            setBandFilter((prev) => (prev === "hot" ? "all" : "hot"))
          }
          icon={<Flame className="size-5" />}
          className="border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card"
          accent="text-primary"
        />
        <BandSummaryCard
          band="warm"
          label="Warm"
          count={bandCounts.warm}
          hint="Stay close with a check-in"
          active={bandFilter === "warm"}
          onClick={() =>
            setBandFilter((prev) => (prev === "warm" ? "all" : "warm"))
          }
          icon={<SunMedium className="size-5" />}
          className="border-teal/30 bg-gradient-to-br from-teal/10 via-card to-card"
          accent="text-teal"
        />
        <BandSummaryCard
          band="future"
          label="Future"
          count={bandCounts.future}
          hint="Nurture for later"
          active={bandFilter === "future"}
          onClick={() =>
            setBandFilter((prev) => (prev === "future" ? "all" : "future"))
          }
          icon={<Snowflake className="size-5" />}
          className="border-navy/20 bg-gradient-to-br from-navy/8 via-card to-card"
          accent="text-navy"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="gap-4 space-y-0 border-b bg-muted/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Scored contacts</CardTitle>
              <CardDescription>
                Recommended next action for each person — expand a row to see
                their answers.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "All"],
                    ["hot", "Hot"],
                    ["warm", "Warm"],
                    ["future", "Future"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={bandFilter === value ? "default" : "outline"}
                    className="h-8"
                    onClick={() => setBandFilter(value)}
                  >
                    {label}
                    {value !== "all" ? (
                      <span className="ml-1 tabular-nums opacity-80">
                        {bandCounts[value]}
                      </span>
                    ) : (
                      <span className="ml-1 tabular-nums opacity-80">
                        {deploymentFiltered.length}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
              {!usingSamples && deployments.length > 0 ? (
                <Select
                  value={filterDeploymentId}
                  onValueChange={setFilterDeploymentId}
                >
                  <SelectTrigger className="w-full sm:w-[240px]">
                    <SelectValue placeholder="All check-ins" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All check-ins</SelectItem>
                    {deployments.map((deployment) => (
                      <SelectItem key={deployment.id} value={deployment.id}>
                        {deployment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {showEmpty ? (
            <EmptyLeadsState
              pending={pending}
              canSample={Boolean(defaultTemplate)}
              onGenerateSamples={onGenerateSamples}
            />
          ) : (
            <div className="divide-y">
              {visibleLeads.map((lead) => {
                const expanded = expandedId === lead.id
                return (
                  <div key={lead.id} className="bg-card">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expanded ? null : lead.id)
                      }
                      className="grid w-full grid-cols-1 gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.4fr)_auto] sm:items-center sm:gap-4 sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {contactName(lead)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[lead.city, lead.state].filter(Boolean).join(", ")}
                          {lead.city || lead.state ? " · " : ""}
                          {[lead.phone, lead.email]
                            .filter(Boolean)
                            .join(" · ") || "No contact info"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            lead.band_id === "hot"
                              ? "default"
                              : lead.band_id === "warm"
                                ? "secondary"
                                : "outline"
                          }
                          className={cn(
                            "capitalize",
                            lead.band_id === "hot" && "bg-primary"
                          )}
                        >
                          {lead.band_label ?? lead.band_id ?? "—"}
                        </Badge>
                        <span className="text-sm font-semibold tabular-nums text-navy">
                          {lead.score}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Recommended next action
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">
                          {lead.recommended_next_step ?? "Review and follow up"}
                        </p>
                      </div>

                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform justify-self-end",
                          expanded && "rotate-180"
                        )}
                      />
                    </button>

                    {expanded ? (
                      <div className="border-t bg-muted/20 px-4 py-4 sm:px-6">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Their answers
                        </p>
                        {lead.answer_details?.length ? (
                          <ul className="grid gap-2 md:grid-cols-2">
                            {lead.answer_details.map((answer) => (
                              <li
                                key={answer.questionId}
                                className="rounded-lg border border-border/70 bg-card px-3 py-2"
                              >
                                <p className="text-xs text-muted-foreground">
                                  {answer.prompt}
                                </p>
                                <p className="mt-1 text-sm font-medium text-foreground">
                                  {answer.optionLabel}
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    +{answer.points} pts
                                  </span>
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Answer details are not available for this contact.
                          </p>
                        )}
                        <p className="mt-3 text-xs text-muted-foreground">
                          {lead.template_name ?? "Check-in"}
                          {lead.list_name ? ` · ${lead.list_name}` : ""}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )
              })}

              {!visibleLeads.length ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No contacts in this filter. Try All, or another readiness
                  level.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BandSummaryCard({
  label,
  count,
  hint,
  active,
  onClick,
  icon,
  className,
  accent,
}: {
  band: BandFilter
  label: string
  count: number
  hint: string
  active: boolean
  onClick: () => void
  icon: ReactNode
  className?: string
  accent: string
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={cn(
          "h-full border-2 transition-shadow",
          className,
          active
            ? "ring-2 ring-primary shadow-md"
            : "hover:shadow-sm"
        )}
      >
        <CardHeader className="pb-2">
          <CardDescription
            className={cn("flex items-center gap-2 font-medium", accent)}
          >
            {icon}
            {label}
          </CardDescription>
          <CardTitle className="font-heading text-4xl tabular-nums text-navy">
            {count}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </button>
  )
}

function EmptyLeadsState({
  pending,
  canSample,
  onGenerateSamples,
}: {
  pending: boolean
  canSample: boolean
  onGenerateSamples: () => void
}) {
  return (
    <div className="relative overflow-hidden px-6 py-12 sm:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.9_0.05_195)_0%,_transparent_55%)]"
      />
      <div className="relative mx-auto max-w-lg text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="size-6" />
        </div>
        <h2 className="font-heading text-xl font-semibold text-navy">
          See who on your list is ready
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          When people reply to your check-in, they show up here as Hot, Warm, or
          Future — with a clear next step for each contact. Sending is not
          connected yet, so start with a sample preview to walk through the
          experience.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            disabled={pending || !canSample}
            onClick={onGenerateSamples}
          >
            <Sparkles className="size-4" />
            {pending ? "Building preview…" : "Preview with sample replies"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/research">Choose a check-in</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Sample contacts stay in this browser session only — they are never
          saved to your lists.
        </p>
      </div>
    </div>
  )
}
