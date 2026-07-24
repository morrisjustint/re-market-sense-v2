"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, MoreHorizontal, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { deleteList } from "@/lib/actions/lists"
import type { List } from "@/types/database"
import { ListUploadDialog } from "@/components/lists/list-upload-dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

export function ListsPageClient({ lists }: { lists: List[] }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const onDelete = (list: List) => {
    if (
      !window.confirm(
        `Delete “${list.name}”? This removes the list and its contacts.`
      )
    ) {
      return
    }

    setPendingId(list.id)
    startTransition(async () => {
      const result = await deleteList(list.id)
      setPendingId(null)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("List deleted.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-navy md:text-3xl">
            Lists
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            Upload contacts, then choose a check-in template to find who is ready
            to move.
          </p>
        </div>
        <Button type="button" onClick={() => setUploadOpen(true)}>
          <Upload className="size-4" />
          Upload list
        </Button>
      </div>

      {lists.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Start with a list</CardTitle>
            <CardDescription>
              Drop in a CSV of homeowners or buyers. Once it’s saved, you can pick
              a template and plan your next steps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" />
              Upload your first list
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => (
            <Card key={list.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="truncate text-base">{list.name}</CardTitle>
                  <CardDescription>
                    {formatDate(list.created_at)} · {list.source.toUpperCase()}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending && pendingId === list.id}
                    >
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">List actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/app/lists/${list.id}`}>
                        <Eye className="size-4" />
                        View
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => onDelete(list)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-semibold text-navy">
                    {list.contact_count}
                  </p>
                  <span className="text-sm text-muted-foreground">contacts</span>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {list.status}
                </Badge>
              </CardContent>
              <div className="flex gap-2 border-t px-4 py-3">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href={`/app/lists/${list.id}`}>View</Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href={`/app/research?list=${list.id}`}>
                    Choose template
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ListUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  )
}
