import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ComingSoonPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-navy md:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          {description}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            This module will be available in a later phase.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
