"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const STEPS = [
  {
    id: 1,
    title: "Welcome",
    description: "Get oriented with your new RE Market Sense workspace.",
  },
  {
    id: 2,
    title: "Upload List",
    description: "Bring in a contact list so you can see who may be ready to move.",
  },
  {
    id: 3,
    title: "Finish",
    description: "You're ready to explore your dashboard.",
  },
] as const

type OnboardingWizardProps = {
  orgName: string
}

export function OnboardingWizard({ orgName }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-navy md:text-3xl">
          Set up {orgName}
        </h1>
        <p className="text-sm text-muted-foreground md:text-base">
          A quick walkthrough before you dive into the app.
        </p>
      </div>

      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((item) => (
          <li key={item.id} className="flex flex-1 flex-col items-center gap-2">
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                step === item.id && "bg-primary text-primary-foreground",
                step > item.id && "bg-teal text-white",
                step < item.id && "bg-muted text-muted-foreground"
              )}
            >
              {step > item.id ? <CheckCircle2 className="size-4" /> : item.id}
            </span>
            <span className="hidden text-xs font-medium text-muted-foreground sm:block">
              {item.title}
            </span>
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1].title}</CardTitle>
          <CardDescription>{STEPS[step - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">
              <p>
                RE Market Sense helps you manage lists, run friendly check-ins,
                and follow up with people who may be ready to move.
              </p>
              <p>
                Your organization <span className="font-medium text-foreground">{orgName}</span>{" "}
                is ready. Next, you can upload a list — or skip and do it from
                Lists anytime.
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-5 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
                <Upload className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Upload from Lists</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  After setup, open Lists to drag in a CSV. Then choose a
                  template to find who may want to buy, sell, or move.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => router.push("/app/lists")}>
                Go to Lists
              </Button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-accent/60 p-5 text-sm">
              <p className="font-medium text-navy">You&apos;re all set.</p>
              <p className="text-muted-foreground">
                Head to your dashboard, upload a list, pick a template, and plan
                your next steps.
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Back
            </Button>

            {step < 3 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={() => router.push("/app")}>
                Go to dashboard
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
