"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, CircleDollarSign } from "lucide-react"
import { toast } from "sonner"

import { createDeployment } from "@/lib/actions/lists"
import {
  estimateOutreachCost,
  formatCurrency,
} from "@/lib/lists/csv"
import type { List, Template } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function ResearchPageClient({
  lists,
  templates,
  initialListId,
}: {
  lists: List[]
  templates: Template[]
  initialListId?: string
}) {
  const router = useRouter()
  const [listId, setListId] = useState(initialListId ?? lists[0]?.id ?? "")
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "")
  const [pending, startTransition] = useTransition()

  const selectedList = useMemo(
    () => lists.find((list) => list.id === listId),
    [lists, listId]
  )
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId),
    [templates, templateId]
  )

  const cost = selectedList
    ? estimateOutreachCost(selectedList.contact_count)
    : 0

  const onContinue = () => {
    if (!listId || !templateId) {
      toast.error("Pick a list and a template to continue.")
      return
    }

    startTransition(async () => {
      const result = await createDeployment({ listId, templateId })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Draft ready — review it on Deploy.")
      router.push(`/app/deploy?id=${result.data!.deploymentId}`)
      router.refresh()
    })
  }

  if (!lists.length) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Upload a list first</CardTitle>
          <CardDescription>
            Add contacts, then come back here to choose a check-in template and
            see who may be ready to move.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/app/lists">Go to Lists</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>1. Choose a list</CardTitle>
            <CardDescription>
              Who should get this check-in?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="list">List</Label>
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger id="list" className="w-full">
                <SelectValue placeholder="Select a list" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name} ({list.contact_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Choose a template</CardTitle>
            <CardDescription>
              Plain-language questions agents can stand behind.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.map((template) => {
              const active = template.id === templateId
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setTemplateId(template.id)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    active
                      ? "border-primary bg-accent/50 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-navy">{template.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                    {active ? (
                      <CheckCircle2 className="size-5 shrink-0 text-primary" />
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {template.questions?.length ?? 0} questions
                    </Badge>
                    {template.scoring_rules?.bands?.map((band) => (
                      <Badge key={band.id} variant="outline">
                        {band.label}
                      </Badge>
                    ))}
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Question preview</CardTitle>
            <CardDescription>
              {selectedTemplate
                ? selectedTemplate.intro_text
                : "Select a template to preview."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTemplate?.questions?.length ? (
              selectedTemplate.questions.map((question, index) => (
                <div
                  key={question.id}
                  className="rounded-lg border border-border/80 bg-muted/20 p-3"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Question {index + 1}
                    {question.required ? "" : " · optional"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {question.prompt}
                  </p>
                  {question.options?.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {question.options.map((option) => (
                        <li key={option.id}>• {option.label}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            ) : selectedTemplate ? (
              <p className="text-sm text-muted-foreground">
                This template has no questions yet.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDollarSign className="size-5 text-primary" />
              Cost estimate
            </CardTitle>
            <CardDescription>
              Placeholder only — no messages send in this phase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-navy">
              {formatCurrency(cost)}
            </p>
            <p className="text-sm text-muted-foreground">
              Based on {selectedList?.contact_count ?? 0} contacts at about $0.06
              each (text/email blend). Final pricing comes when sending is
              enabled.
            </p>
            <Button
              type="button"
              className="w-full"
              disabled={pending || !listId || !templateId}
              onClick={onContinue}
            >
              {pending ? "Creating draft…" : "Continue to Deploy"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
