import Papa from "papaparse"
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  BorderStyle,
} from "docx"

import type { ScoredLead } from "@/types/database"

export type LeadExportRow = {
  "First Name": string
  "Last Name": string
  Email: string
  Phone: string
  "Street Address": string
  City: string
  State: string
  Zip: string
  Score: number
  Band: string
  "Next Step": string
  Deployment: string
  List: string
  Template: string
  Tags: string
}

function cell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ""
  return String(value)
}

export function leadsToFubRows(leads: ScoredLead[]): LeadExportRow[] {
  return leads.map((lead) => ({
    "First Name": cell(lead.first_name),
    "Last Name": cell(lead.last_name),
    Email: cell(lead.email),
    Phone: cell(lead.phone),
    "Street Address": cell(lead.address),
    City: cell(lead.city),
    State: cell(lead.state),
    Zip: cell(lead.zip),
    Score: lead.score,
    Band: cell(lead.band_label ?? lead.band_id),
    "Next Step": cell(lead.recommended_next_step),
    Deployment: cell(lead.deployment_name),
    List: cell(lead.list_name),
    Template: cell(lead.template_name),
    Tags: [lead.band_label, lead.band_id].filter(Boolean).join("; "),
  }))
}

export function leadsToCsv(leads: ScoredLead[]) {
  return Papa.unparse(leadsToFubRows(leads), { header: true })
}

function thinBorder() {
  return {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "CBD5E1",
  }
}

function headerCell(text: string) {
  return new TableCell({
    width: { size: 2000, type: WidthType.DXA },
    borders: {
      top: thinBorder(),
      bottom: thinBorder(),
      left: thinBorder(),
      right: thinBorder(),
    },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, bold: true, color: "0F172A", size: 18 }),
        ],
      }),
    ],
  })
}

function bodyCell(text: string) {
  return new TableCell({
    width: { size: 2000, type: WidthType.DXA },
    borders: {
      top: thinBorder(),
      bottom: thinBorder(),
      left: thinBorder(),
      right: thinBorder(),
    },
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 18, color: "334155" })],
      }),
    ],
  })
}

export async function leadsToDocxBuffer(
  leads: ScoredLead[],
  options?: { orgName?: string; title?: string }
) {
  const counts = { hot: 0, warm: 0, future: 0 }
  for (const lead of leads) {
    const id = lead.band_id?.toLowerCase()
    if (id === "hot") counts.hot += 1
    else if (id === "warm") counts.warm += 1
    else if (id === "future") counts.future += 1
  }

  const title = options?.title ?? "Who's ready to move"
  const orgName = options?.orgName ?? "RE Market Sense"

  const tableRows = [
    new TableRow({
      children: [
        headerCell("Name"),
        headerCell("Score"),
        headerCell("Band"),
        headerCell("Next step"),
        headerCell("Phone / Email"),
      ],
    }),
    ...leads.slice(0, 40).map((lead) => {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"
      const contact = [lead.phone, lead.email].filter(Boolean).join(" · ") || "—"
      return new TableRow({
        children: [
          bodyCell(name),
          bodyCell(String(lead.score)),
          bodyCell(lead.band_label ?? lead.band_id ?? "—"),
          bodyCell(lead.recommended_next_step ?? "—"),
          bodyCell(contact),
        ],
      })
    }),
  ]

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "RE Market Sense",
                bold: true,
                color: "0D9488",
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: orgName,
                color: "64748B",
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: title,
                bold: true,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `Hot: ${counts.hot}  ·  Warm: ${counts.warm}  ·  Future: ${counts.future}`,
                color: "334155",
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 280 },
            children: [
              new TextRun({
                text: "Scored contacts with recommended next steps for your follow-up.",
                italics: true,
                color: "64748B",
                size: 20,
              }),
            ],
          }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: tableRows,
          }),
          new Paragraph({
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: "Generated by RE Market Sense — SMS/email sending not included in this report.",
                color: "94A3B8",
                size: 16,
              }),
            ],
          }),
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}
