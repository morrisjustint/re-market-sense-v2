import Papa from "papaparse"

import type { ConsentStatus } from "@/types/database"

export type ContactDraft = {
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  consent_status: ConsentStatus
  tags: string[]
}

export type ParsedContactRow = ContactDraft & {
  rowNumber: number
  errors: string[]
  isValid: boolean
  isDuplicate: boolean
}

export type CsvParseResult = {
  rows: ParsedContactRow[]
  validRows: ParsedContactRow[]
  invalidCount: number
  duplicateCount: number
  headers: string[]
}

const FIELD_ALIASES: Record<keyof Omit<ContactDraft, "consent_status" | "tags">, string[]> = {
  first_name: ["first_name", "firstname", "first", "fname", "given_name"],
  last_name: ["last_name", "lastname", "last", "lname", "surname"],
  email: ["email", "email_address", "e_mail", "mail"],
  phone: [
    "phone",
    "phone_number",
    "mobile",
    "mobile_phone",
    "cell",
    "cell_phone",
    "telephone",
    "primary_phone",
  ],
  address: [
    "address",
    "street",
    "street_address",
    "address1",
    "address_1",
    "property_address",
  ],
  city: ["city", "town"],
  state: ["state", "province", "st"],
  zip: ["zip", "zipcode", "zip_code", "postal", "postal_code"],
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^\w]/g, "")
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length ? text : null
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Accepts common US formats; stores digits (optionally with leading +). */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return null
}

export function isValidPhone(phone: string) {
  return normalizePhone(phone) !== null
}

function mapRow(raw: Record<string, unknown>, headers: string[]): ContactDraft {
  const normalizedEntries = Object.fromEntries(
    headers.map((header) => [normalizeHeader(header), clean(raw[header])])
  )

  function pick(field: keyof typeof FIELD_ALIASES): string | null {
    for (const alias of FIELD_ALIASES[field]) {
      const value = normalizedEntries[alias]
      if (value) return value
    }
    return null
  }

  const email = pick("email")?.toLowerCase() ?? null
  const rawPhone = pick("phone")
  let phone: string | null = null
  if (rawPhone) {
    const normalized = normalizePhone(rawPhone)
    const digitsOnly = rawPhone.replace(/\D/g, "")
    phone = normalized ?? (digitsOnly.length ? digitsOnly : null)
  }

  return {
    first_name: pick("first_name"),
    last_name: pick("last_name"),
    email,
    phone,
    address: pick("address"),
    city: pick("city"),
    state: pick("state")?.toUpperCase().slice(0, 2) ?? pick("state"),
    zip: pick("zip"),
    consent_status: "unknown",
    tags: [],
  }
}

function validateContact(contact: ContactDraft): string[] {
  const errors: string[] = []

  if (!contact.email && !contact.phone) {
    errors.push("Email or phone is required")
  }

  if (contact.email && !isValidEmail(contact.email)) {
    errors.push("Invalid email format")
  }

  if (contact.phone && !isValidPhone(contact.phone)) {
    errors.push("Invalid phone format (use 10-digit US number)")
  }

  return errors
}

function dedupeKey(contact: ContactDraft) {
  const email = contact.email?.toLowerCase() ?? ""
  const phone = contact.phone ? normalizePhone(contact.phone) ?? contact.phone : ""
  return `${email}|${phone}`
}

export function parseContactCsv(fileText: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(fileText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  })

  if (parsed.errors.length && !parsed.data.length) {
    throw new Error(parsed.errors[0]?.message || "Could not parse CSV file")
  }

  const headers = parsed.meta.fields?.filter(Boolean) ?? []
  const seen = new Set<string>()
  const rows: ParsedContactRow[] = []

  parsed.data.forEach((raw, index) => {
    const values = Object.values(raw).map((v) => clean(v))
    if (values.every((v) => !v)) return

    const contact = mapRow(raw, headers)
    if (contact.phone) {
      const normalized = normalizePhone(contact.phone)
      contact.phone = normalized
    }

    const errors = validateContact(contact)
    const key = dedupeKey(contact)
    const isDuplicate =
      Boolean(contact.email || contact.phone) && seen.has(key) && !errors.length

    if (!errors.length && (contact.email || contact.phone)) {
      seen.add(key)
    }

    rows.push({
      ...contact,
      rowNumber: index + 2,
      errors: isDuplicate ? ["Duplicate email/phone in this file"] : errors,
      isValid: errors.length === 0 && !isDuplicate,
      isDuplicate,
    })
  })

  const validRows = rows.filter((row) => row.isValid)
  const duplicateCount = rows.filter((row) => row.isDuplicate).length
  const invalidCount = rows.filter((row) => !row.isValid && !row.isDuplicate).length

  return {
    rows,
    validRows,
    invalidCount,
    duplicateCount,
    headers,
  }
}

/** Rough placeholder cost: text/email outreach estimate. */
export function estimateOutreachCost(contactCount: number) {
  const perContact = 0.06
  return Math.round(contactCount * perContact * 100) / 100
}

/**
 * Base email/outreach cost plus optional thank-you gifts.
 * Gift cost is estimated per expected completion (defaults to all contacts).
 */
export function estimateCampaignCost(input: {
  contactCount: number
  incentiveEnabled?: boolean
  incentiveAmount?: number
  /** Expected completions for gift estimate; defaults to contactCount. */
  expectedCompletions?: number
}) {
  const base = estimateOutreachCost(input.contactCount)
  if (!input.incentiveEnabled) {
    return {
      base,
      gift: 0,
      total: base,
      expectedCompletions: 0,
      incentiveAmount: input.incentiveAmount ?? 5,
    }
  }

  const amount = input.incentiveAmount ?? 5
  const expected = Math.max(
    0,
    input.expectedCompletions ?? input.contactCount
  )
  const gift = Math.round(expected * amount * 100) / 100
  return {
    base,
    gift,
    total: Math.round((base + gift) * 100) / 100,
    expectedCompletions: expected,
    incentiveAmount: amount,
  }
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}
