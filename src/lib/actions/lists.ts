"use server"

import { revalidatePath } from "next/cache"

import { requireOrg } from "@/lib/data"
import { createClient } from "@/lib/supabase/server"
import type { ContactDraft } from "@/lib/lists/csv"
import { estimateOutreachCost } from "@/lib/lists/csv"

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }

const CONTACT_BATCH = 500

export async function createListWithContacts(input: {
  name: string
  contacts: ContactDraft[]
}): Promise<ActionResult<{ listId: string; contactCount: number }>> {
  try {
    const name = input.name.trim()
    if (!name) return { success: false, error: "List name is required." }
    if (!input.contacts.length) {
      return { success: false, error: "Add at least one valid contact." }
    }

    const org = await requireOrg()
    const supabase = await createClient()

    const { data: list, error: listError } = await supabase
      .from("lists")
      .insert({
        org_id: org.id,
        name,
        source: "csv",
        contact_count: input.contacts.length,
        status: "ready",
      })
      .select("id")
      .single()

    if (listError || !list) {
      return { success: false, error: listError?.message ?? "Could not create list." }
    }

    for (let i = 0; i < input.contacts.length; i += CONTACT_BATCH) {
      const batch = input.contacts.slice(i, i + CONTACT_BATCH).map((contact) => ({
        list_id: list.id,
        org_id: org.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        city: contact.city,
        state: contact.state,
        zip: contact.zip,
        consent_status: contact.consent_status,
        tags: contact.tags,
      }))

      const { error: contactError } = await supabase.from("contacts").insert(batch)
      if (contactError) {
        await supabase.from("lists").delete().eq("id", list.id)
        return { success: false, error: contactError.message }
      }
    }

    revalidatePath("/app")
    revalidatePath("/app/lists")
    revalidatePath("/app/research")
    revalidatePath("/app/deploy")

    return {
      success: true,
      data: { listId: list.id, contactCount: input.contacts.length },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    }
  }
}

export async function deleteList(listId: string): Promise<ActionResult> {
  try {
    const org = await requireOrg()
    const supabase = await createClient()

    const { error } = await supabase
      .from("lists")
      .delete()
      .eq("id", listId)
      .eq("org_id", org.id)

    if (error) return { success: false, error: error.message }

    revalidatePath("/app")
    revalidatePath("/app/lists")
    revalidatePath("/app/research")
    revalidatePath("/app/deploy")

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    }
  }
}

export async function createDeployment(input: {
  listId: string
  templateId: string
  name?: string
}): Promise<ActionResult<{ deploymentId: string }>> {
  try {
    const org = await requireOrg()
    const supabase = await createClient()

    const { data: list } = await supabase
      .from("lists")
      .select("id, name, contact_count")
      .eq("id", input.listId)
      .eq("org_id", org.id)
      .maybeSingle()

    if (!list) return { success: false, error: "List not found." }

    const { data: template } = await supabase
      .from("templates")
      .select("id, name")
      .eq("id", input.templateId)
      .eq("is_active", true)
      .maybeSingle()

    if (!template) return { success: false, error: "Template not found." }

    const name =
      input.name?.trim() ||
      `${list.name} · ${template.name}`

    const cost = estimateOutreachCost(list.contact_count)

    const { data: deployment, error } = await supabase
      .from("deployments")
      .insert({
        org_id: org.id,
        list_id: list.id,
        template_id: template.id,
        name,
        status: "draft",
        cost_estimate: cost,
      })
      .select("id")
      .single()

    if (error || !deployment) {
      return { success: false, error: error?.message ?? "Could not create deployment." }
    }

    revalidatePath("/app/research")
    revalidatePath("/app/deploy")

    return { success: true, data: { deploymentId: deployment.id } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    }
  }
}

