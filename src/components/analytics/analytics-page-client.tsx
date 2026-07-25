"use client"

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import {
  ChevronDown,
  Clock3,
  FileSpreadsheet,
  FileText,
  Flame,
  Leaf,
  Mail,
  Sparkles,
  Snowflake,
  SunMedium,
  UserX,
  Zap,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { exportLeadsCsv, exportLeadsDocx } from "@/lib/actions/exports"
import {
  activeFollowUpCount,
  countIntents,
  countOutcomes,
  INTENT_META,
  orderedOutcomeEntries,
  type OutcomeBucket,
  type PrimaryIntent,
} from "@/lib/leads/outcomes"
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
type OutcomeFilter = "all" | OutcomeBucket

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

const OUTCOME_ICONS: Record<OutcomeBucket, ReactNode> = {
  immediate: <Zap className="size-4" />,
  this_week: <Mail className="size-4" />,
  nurture_30_90: <Leaf className="size-4" />,
  longer_term: <Clock3 className="size-4" />,
  do_not_contact: <UserX className="size-4" />,
}

const INTENT_DISPLAY_ORDER: PrimaryIntent[] = [
  "buy",
  "sell",
  "buy_sell",
  "rent",
  "exploring",
  "no_plans",
]

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
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all")
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
    () =>
      enrichLeadsWithAnswers(
        leads,
        templatesByName,
        defaultTemplate ?? undefined
      ),
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

  const bandCounts = useMemo(
    () => countBands(deploymentFiltered),
    [deploymentFiltered]
  )
  const outcomeCounts = useMemo(
    () => countOutcomes(deploymentFiltered),
    [deploymentFiltered]
  )
  const intentCounts = useMemo(
    () => countIntents(deploymentFiltered),
    [deploymentFiltered]
  )
  const outcomeEntries = useMemo(
    () => orderedOutcomeEntries(outcomeCounts),
    [outcomeCounts]
  )
  const activeFollowUps = activeFollowUpCount(outcomeCounts)

  const visibleLeads = useMemo(() => {
    return deploymentFiltered.filter((lead) => {
      if (
        bandFilter !== "all" &&
        lead.band_id?.toLowerCase() !== bandFilter
      ) {
        return false
      }
      if (outcomeFilter !== "all" && lead.outcome_id !== outcomeFilter) {
        return false
      }
      return true
    })
  }, [deploymentFiltered, bandFilter, outcomeFilter])

  const onGenerateSamples = () => {
    if (!defaultTemplate) {
      toast.error("No check-in templates available yet.")
      return
    }
    const generated = generateSampleLeads(defaultTemplate, { count: 10 })
    setSampleLeads(generated)
    saveSampleLeadsToSession(generated)
    setBandFilter("all")
    setOutcomeFilter("all")
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
    const toExport =
      bandFilter === "all" && outcomeFilter === "all"
        ? deploymentFiltered
        : visibleLeads

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
    const toExport =
      bandFilter === "all" && outcomeFilter === "all"
        ? deploymentFiltered
        : visibleLeads

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

  const intentChips = INTENT_DISPLAY_ORDER.filter(
    (id) => (intentCounts[id] ?? 0) > 0
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-navy md:text-3xl">
            Who&apos;s ready to move
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">
            Intent → temperature → recommended next action. Use this as your
            call list for the week.
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

      {!showEmpty ? (
        <>
          {/* Temperature */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                Lead temperature
              </h2>
              <span className="text-xs text-muted-foreground">
                Click to filter
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <BandSummaryCard
                label="Hot"
                count={bandCounts.hot}
                hint="Immediate action"
                active={bandFilter === "hot"}
                onClick={() =>
                  setBandFilter((prev) => (prev === "hot" ? "all" : "hot"))
                }
                icon={<Flame className="size-5" />}
                className="border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card"
                accent="text-primary"
              />
              <BandSummaryCard
                label="Warm"
                count={bandCounts.warm}
                hint="Follow up this week"
                active={bandFilter === "warm"}
                onClick={() =>
                  setBandFilter((prev) => (prev === "warm" ? "all" : "warm"))
                }
                icon={<SunMedium className="size-5" />}
                className="border-teal/30 bg-gradient-to-br from-teal/10 via-card to-card"
                accent="text-teal"
              />
              <BandSummaryCard
                label="Future"
                count={bandCounts.future}
                hint="Nurture for later"
                active={bandFilter === "future"}
                onClick={() =>
                  setBandFilter((prev) =>
                    prev === "future" ? "all" : "future"
                  )
                }
                icon={<Snowflake className="size-5" />}
                className="border-navy/20 bg-gradient-to-br from-navy/8 via-card to-card"
                accent="text-navy"
              />
            </div>
          </section>

          {/* Recommended outcomes */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">
                  Recommended outcomes
                </h2>
                <p className="text-xs text-muted-foreground">
                  {activeFollowUps} active follow-ups
                  {outcomeCounts.immediate || outcomeCounts.this_week
                    ? ` (${outcomeCounts.immediate} immediate + ${outcomeCounts.this_week} this week)`
                    : ""}
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {outcomeEntries.map((outcome) => {
                const active = outcomeFilter === outcome.id
                return (
                  <button
                    key={outcome.id}
                    type="button"
                    onClick={() =>
                      setOutcomeFilter((prev) =>
                        prev === outcome.id ? "all" : outcome.id
                      )
                    }
                    className="text-left"
                  >
                    <Card
                      className={cn(
                        "h-full border transition-shadow",
                        outcome.id === "do_not_contact"
                          ? "border-border bg-muted/30"
                          : "border-primary/15 bg-card",
                        active
                          ? "ring-2 ring-primary shadow-md"
                          : "hover:shadow-sm"
                      )}
                    >
                      <CardHeader className="space-y-2 p-4 pb-2">
                        <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <span className="text-primary">
                            {OUTCOME_ICONS[outcome.id]}
                          </span>
                          {outcome.shortLabel}
                        </CardDescription>
                        <CardTitle className="font-heading text-2xl tabular-nums text-navy">
                          {outcome.count}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-xs font-medium text-foreground">
                          {outcome.label}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {outcome.hint}
                        </p>
                      </CardContent>
                    </Card>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Intent strip */}
          {intentChips.length ? (
            <section className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Current plan / intent
              </p>
              <div className="flex flex-wrap gap-2">
                {intentChips.map((id) => (
                  <Badge
                    key={id}
                    variant="outline"
                    className="bg-card px-2.5 py-1 text-sm font-medium"
                  >
                    {INTENT_META[id].label}
                    <span className="ml-1.5 tabular-nums text-muted-foreground">
                      {intentCounts[id]}
                    </span>
                  </Badge>
                ))}
                {(intentCounts.unknown ?? 0) > 0 ? (
                  <Badge
                    variant="outline"
                    className="bg-card px-2.5 py-1 text-sm font-medium"
                  >
                    {INTENT_META.unknown.label}
                    <span className="ml-1.5 tabular-nums text-muted-foreground">
                      {intentCounts.unknown}
                    </span>
                  </Badge>
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="gap-4 space-y-0 border-b bg-muted/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Scored contacts</CardTitle>
              <CardDescription>
                Intent, temperature, and next action — expand a row for their
                answers.
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
                      className="grid w-full grid-cols-1 gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(0,1.15fr)_auto_auto_minmax(0,1.35fr)_auto] lg:items-center lg:gap-4 lg:px-6"
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

                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Intent
                        </p>
                        <Badge variant="outline" className="mt-1 bg-muted/40">
                          {lead.primary_intent_label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Temp
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
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
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Recommended next action
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">
                          {lead.recommended_next_step ?? "Review and follow up"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {lead.outcome_label}
                        </p>
                      </div>

                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 justify-self-end text-muted-foreground transition-transform",
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
                  No contacts in this filter. Try All, or clear the outcome
                  filter.
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
          active ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm"
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
          See who on your list is ready — and what to do next
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          When people reply, they land here with intent, temperature (Hot /
          Warm / Future), and a clear recommended action. Preview with sample
          replies to walk the outcome flow.
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
