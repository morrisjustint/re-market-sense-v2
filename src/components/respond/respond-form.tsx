"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"

import { submitPublicCheckIn } from "@/lib/actions/checkin"
import type { CheckInLoadOk } from "@/lib/checkin/public"
import { giftCardEmailSentence } from "@/lib/incentives/config"
import type { ResponseAnswers } from "@/lib/scoring"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

const STEP_THRESHOLD = 4

export function RespondForm({ checkIn }: { checkIn: CheckInLoadOk }) {
  const questions = checkIn.questions ?? []
  const useSteps = questions.length > STEP_THRESHOLD
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<ResponseAnswers>({})
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [rewardSent, setRewardSent] = useState(false)

  const progress = useMemo(() => {
    if (!questions.length) return 100
    if (useSteps) {
      return Math.round(((step + 1) / questions.length) * 100)
    }
    const answered = questions.filter((q) => answers[q.id]).length
    return Math.round((answered / questions.length) * 100)
  }, [answers, questions, step, useSteps])

  const current = questions[step]
  const requiredMissing = questions
    .filter((q) => q.required)
    .some((q) => !answers[q.id])

  const onSelect = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
  }

  const onSubmit = () => {
    startTransition(async () => {
      const result = await submitPublicCheckIn({
        token: checkIn.token,
        answers,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setRewardSent(Boolean(result.rewardSent))
      setDone(true)
    })
  }

  if (done) {
    return (
      <RespondShell agentName={checkIn.agent_name} orgName={checkIn.org_name}>
        <div className="mx-auto max-w-md space-y-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <CheckCircle2 className="size-8" />
          </div>
          <h1 className="font-heading text-2xl font-semibold text-navy">
            Thanks — we got your answers
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {checkIn.agent_name} will follow up if there&apos;s a helpful next
            step. You can close this page.
          </p>
          {checkIn.incentive_enabled ? (
            <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-navy">
              {rewardSent
                ? `Your $${checkIn.incentive_amount} thank-you gift card is on the way — check your email for a link to redeem it.`
                : `Your $${checkIn.incentive_amount} thank-you gift card is being prepared and will arrive by email soon.`}
            </p>
          ) : null}
        </div>
      </RespondShell>
    )
  }

  return (
    <RespondShell agentName={checkIn.agent_name} orgName={checkIn.org_name}>
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            On behalf of{" "}
            <span className="font-medium text-navy">{checkIn.agent_name}</span>
            {checkIn.org_name ? (
              <>
                {" "}
                · {checkIn.org_name}
              </>
            ) : null}
          </p>
          <h1 className="font-heading text-2xl font-semibold text-navy">
            {checkIn.contact_first_name
              ? `Hi ${checkIn.contact_first_name}`
              : "A quick check-in"}
          </h1>
          {checkIn.intro_text ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {checkIn.intro_text}
            </p>
          ) : null}
          {checkIn.incentive_enabled ? (
            <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-navy">
              {giftCardEmailSentence(checkIn.incentive_amount)}
            </p>
          ) : null}
        </div>

        {questions.length > STEP_THRESHOLD ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Question {Math.min(step + 1, questions.length)} of{" "}
                {questions.length}
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        ) : questions.length > 1 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{questions.length} short questions</span>
              <span>{progress}% answered</span>
            </div>
            <Progress value={progress} />
          </div>
        ) : null}

        {useSteps && current ? (
          <QuestionCard
            index={step}
            prompt={current.prompt}
            required={current.required}
            options={current.options ?? []}
            selected={answers[current.id]}
            onSelect={(optionId) => onSelect(current.id, optionId)}
          />
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                index={index}
                prompt={question.prompt}
                required={question.required}
                options={question.options ?? []}
                selected={answers[question.id]}
                onSelect={(optionId) => onSelect(question.id, optionId)}
              />
            ))}
          </div>
        )}

        {!questions.length ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            This check-in has no questions yet. Please contact{" "}
            {checkIn.agent_name}.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          {useSteps ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pending || step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ChevronLeft className="size-4" />
                Back
              </Button>
              {step < questions.length - 1 ? (
                <Button
                  type="button"
                  className="flex-1"
                  disabled={
                    pending ||
                    (current?.required && !answers[current.id])
                  }
                  onClick={() =>
                    setStep((s) => Math.min(questions.length - 1, s + 1))
                  }
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  className="flex-1"
                  disabled={pending || requiredMissing}
                  onClick={onSubmit}
                >
                  {pending ? "Sending…" : "Submit answers"}
                </Button>
              )}
            </>
          ) : (
            <Button
              type="button"
              className="w-full"
              disabled={pending || requiredMissing || !questions.length}
              onClick={onSubmit}
            >
              {pending ? "Sending…" : "Submit answers"}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          No pressure — skip any optional questions. Prefer not to hear from us?
          Reply STOP to the email.
        </p>
      </div>
    </RespondShell>
  )
}

function QuestionCard({
  index,
  prompt,
  required,
  options,
  selected,
  onSelect,
}: {
  index: number
  prompt: string
  required: boolean
  options: Array<{ id: string; label: string }>
  selected?: string
  onSelect: (optionId: string) => void
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Question {index + 1}
        {required ? "" : " · optional"}
      </p>
      <p className="mt-1 text-base font-medium text-foreground">{prompt}</p>
      <div className="mt-3 space-y-2">
        {options.map((option) => {
          const active = selected === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className={cn(
                "flex w-full items-center rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10 text-navy ring-1 ring-primary/30"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <span
                className={cn(
                  "mr-3 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  active
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                )}
              >
                {active ? (
                  <span className="size-1.5 rounded-full bg-white" />
                ) : null}
              </span>
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function RespondShell({
  children,
  agentName,
  orgName,
}: {
  children: ReactNode
  agentName?: string
  orgName?: string
}) {
  return (
    <div className="relative min-h-svh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.04_195)_0%,_transparent_55%),linear-gradient(180deg,_oklch(0.98_0.01_210)_0%,_oklch(0.95_0.02_220)_100%)]"
      />
      <div className="relative mx-auto flex min-h-svh w-full max-w-2xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-8 flex items-center justify-between gap-3">
          <Logo href="" />
          {(agentName || orgName) && (
            <p className="max-w-[50%] truncate text-right text-xs text-muted-foreground">
              {agentName}
              {orgName ? ` · ${orgName}` : ""}
            </p>
          )}
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Powered by RE Market Sense
        </footer>
      </div>
    </div>
  )
}

export function RespondErrorState({
  title,
  description,
  agentName,
  orgName,
}: {
  title: string
  description: string
  agentName?: string
  orgName?: string
}) {
  return (
    <RespondShell agentName={agentName} orgName={orgName}>
      <div className="mx-auto max-w-md space-y-3 text-center">
        <h1 className="font-heading text-2xl font-semibold text-navy">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </RespondShell>
  )
}
