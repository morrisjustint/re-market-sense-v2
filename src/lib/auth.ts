import { createClient } from "@/lib/supabase/server"
import type { Org } from "@/types/database"

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function getUserOrg(): Promise<Org | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (!membership?.org_id) {
    return null
  }

  const { data: org } = await supabase
    .from("orgs")
    .select("id, name, created_at")
    .eq("id", membership.org_id)
    .maybeSingle()

  return org
}

export async function ensureOrganization(orgName: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_organization", {
    org_name: orgName,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
