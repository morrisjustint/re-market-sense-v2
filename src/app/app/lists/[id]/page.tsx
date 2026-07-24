import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getContactsForList, getListById } from "@/lib/data"
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

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const list = await getListById(id)
  return { title: list?.name ?? "List" }
}

export default async function ListDetailPage({ params }: PageProps) {
  const { id } = await params
  const list = await getListById(id)
  if (!list) notFound()

  const contacts = await getContactsForList(id)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link href="/app/lists">
              <ArrowLeft className="size-4" />
              All lists
            </Link>
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-navy md:text-3xl">
              {list.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {list.contact_count} contacts · uploaded{" "}
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(new Date(list.created_at))}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/app/research?list=${list.id}`}>Choose a template</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>
              Ready for a check-in to see who may want to buy, sell, or move.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="capitalize">
            {list.status}
          </Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-0">
          {contacts.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">
              No contacts on this list yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="pr-6">Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="pl-6 font-medium">
                      {[contact.first_name, contact.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {contact.email || "—"}
                    </TableCell>
                    <TableCell>{contact.phone || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {contact.address || "—"}
                    </TableCell>
                    <TableCell className="pr-6">
                      {[contact.city, contact.state, contact.zip]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
