import type { Metadata } from "next"

import { ResearchPageClient } from "@/components/research/research-page-client"
import { getLists, getTemplates } from "@/lib/data"

export const metadata: Metadata = {
  title: "Research",
}

type PageProps = {
  searchParams: Promise<{ list?: string }>
}

export default async function ResearchPage({ searchParams }: PageProps) {
  const params = await searchParams
  const [lists, templates] = await Promise.all([getLists(), getTemplates()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-navy md:text-3xl">
          Research
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Pair a list with a check-in template to find who is ready to move —
          then plan follow-up.
        </p>
      </div>
      <ResearchPageClient
        lists={lists}
        templates={templates}
        initialListId={params.list}
      />
    </div>
  )
}
