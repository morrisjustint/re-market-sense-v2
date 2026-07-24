"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { createListWithContacts } from "@/lib/actions/lists"
import {
  parseContactCsv,
  type ParsedContactRow,
} from "@/lib/lists/csv"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Step = "upload" | "preview"

export function ListUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>("upload")
  const [listName, setListName] = useState("")
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<ParsedContactRow[]>([])
  const [validRows, setValidRows] = useState<ParsedContactRow[]>([])
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [invalidCount, setInvalidCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [pending, startTransition] = useTransition()

  const reset = useCallback(() => {
    setStep("upload")
    setListName("")
    setFileName("")
    setRows([])
    setValidRows([])
    setDuplicateCount(0)
    setInvalidCount(0)
    setDragOver(false)
  }, [])

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a CSV file.")
      return
    }

    try {
      const text = await file.text()
      const result = parseContactCsv(text)

      if (!result.rows.length) {
        toast.error("No contacts found in this file.")
        return
      }

      if (!result.validRows.length) {
        toast.error("No valid contacts found. Each row needs a valid email or phone.")
      }

      setFileName(file.name)
      setListName(file.name.replace(/\.csv$/i, "").replace(/[_-]+/g, " "))
      setRows(result.rows)
      setValidRows(result.validRows)
      setDuplicateCount(result.duplicateCount)
      setInvalidCount(result.invalidCount)
      setStep("preview")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read CSV.")
    }
  }

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) await processFile(file)
  }

  const onSave = () => {
    if (!listName.trim()) {
      toast.error("Give this list a name.")
      return
    }
    if (!validRows.length) {
      toast.error("Nothing to save — fix validation issues first.")
      return
    }

    startTransition(async () => {
      const result = await createListWithContacts({
        name: listName.trim(),
        contacts: validRows.map(
          ({
            first_name,
            last_name,
            email,
            phone,
            address,
            city,
            state,
            zip,
            consent_status,
            tags,
          }) => ({
            first_name,
            last_name,
            email,
            phone,
            address,
            city,
            state,
            zip,
            consent_status,
            tags,
          })
        ),
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(
        `Saved “${listName.trim()}” with ${result.data?.contactCount ?? validRows.length} contacts.`
      )
      handleClose(false)
      router.push(`/app/lists/${result.data!.listId}`)
      router.refresh()
    })
  }

  const previewRows = rows.slice(0, 50)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="font-heading text-navy">
            {step === "upload" ? "Upload a list" : "Preview & save"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Upload a CSV with your contacts. We’ll check emails, phones, and duplicates."
              : "Review who made it through, then save the list."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === "upload" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center transition-colors",
                dragOver
                  ? "border-primary bg-accent/60"
                  : "border-border bg-muted/30"
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
                <Upload className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  Drag and drop your CSV here
                </p>
                <p className="text-sm text-muted-foreground">
                  Common real estate exports work — include email and/or phone.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                <FileSpreadsheet className="size-4" />
                Choose file
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void processFile(file)
                  e.target.value = ""
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="list-name">List name</Label>
                <Input
                  id="list-name"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="Spring farm list"
                  disabled={pending}
                />
                <p className="text-xs text-muted-foreground">
                  Source file: {fileName}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{validRows.length} ready to save</Badge>
                {duplicateCount > 0 ? (
                  <Badge variant="outline">{duplicateCount} duplicates skipped</Badge>
                ) : null}
                {invalidCount > 0 ? (
                  <Badge variant="destructive">{invalidCount} need a fix</Badge>
                ) : null}
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => (
                      <TableRow
                        key={`${row.rowNumber}-${row.email}-${row.phone}`}
                        className={cn(!row.isValid && "bg-destructive/5")}
                      >
                        <TableCell className="text-muted-foreground">
                          {row.rowNumber}
                        </TableCell>
                        <TableCell>
                          {[row.first_name, row.last_name].filter(Boolean).join(" ") ||
                            "—"}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">
                          {row.email || "—"}
                        </TableCell>
                        <TableCell>{row.phone || "—"}</TableCell>
                        <TableCell>{row.city || "—"}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <span className="text-sm text-primary">Ready</span>
                          ) : (
                            <span className="text-sm text-destructive">
                              {row.errors[0]}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 50 ? (
                <p className="text-xs text-muted-foreground">
                  Showing first 50 of {rows.length} rows. All valid contacts will
                  be saved.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t px-5 py-4 sm:justify-between">
          {step === "preview" ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setStep("upload")}
            >
              <X className="size-4" />
              Choose another file
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>
            {step === "preview" ? (
              <Button
                type="button"
                disabled={pending || !validRows.length}
                onClick={onSave}
              >
                {pending ? "Saving…" : `Save ${validRows.length} contacts`}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
