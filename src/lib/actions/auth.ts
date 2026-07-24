"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

export type AuthActionState = {
  error?: string
  success?: string
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function signUp(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getString(formData, "email")
  const password = getString(formData, "password")
  const orgName = getString(formData, "orgName")

  if (!email || !password || !orgName) {
    return { error: "Email, password, and organization name are required." }
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        org_name: orgName,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.user) {
    return { error: "Unable to create account. Please try again." }
  }

  // Email confirmation may disable session; only create org when session exists.
  if (data.session) {
    const { error: orgError } = await supabase.rpc("create_organization", {
      org_name: orgName,
    })

    if (orgError) {
      return {
        error: `Account created, but organization setup failed: ${orgError.message}`,
      }
    }

    revalidatePath("/", "layout")
    redirect("/onboarding")
  }

  return {
    success:
      "Account created. Check your email to confirm, then sign in to continue.",
  }
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getString(formData, "email")
  const password = getString(formData, "password")
  const next = getString(formData, "next") || "/app"

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Ensure org exists if metadata has org_name (post email-confirm first login).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (!membership) {
      const orgName =
        (user.user_metadata?.org_name as string | undefined)?.trim() ||
        `${email.split("@")[0]}'s Organization`

      const { error: orgError } = await supabase.rpc("create_organization", {
        org_name: orgName,
      })

      if (orgError) {
        return { error: orgError.message }
      }

      revalidatePath("/", "layout")
      redirect("/onboarding")
    }
  }

  revalidatePath("/", "layout")
  redirect(next.startsWith("/") ? next : "/app")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
