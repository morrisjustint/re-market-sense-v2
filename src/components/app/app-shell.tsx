"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  Rocket,
  Search,
  Settings,
} from "lucide-react"

import { signOut } from "@/lib/actions/auth"
import { Logo } from "@/components/brand/logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/lists", label: "Lists", icon: List },
  { href: "/app/research", label: "Research", icon: Search },
  { href: "/app/deploy", label: "Deploy", icon: Rocket },
  { href: "/app/analytics", label: "Leads", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const

type AppShellProps = {
  orgName: string
  userEmail: string
  children: React.ReactNode
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/app" ? pathname === "/app" : pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function UserMenu({ userEmail }: { userEmail: string }) {
  const initials = userEmail.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm md:inline">
            {userEmail}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Account</span>
            <span className="truncate text-xs text-muted-foreground">
              {userEmail}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="flex w-full cursor-pointer items-center gap-2">
              <LogOut className="size-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell({ orgName, userEmail, children }: AppShellProps) {
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Logo href="/app" variant="light" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <p className="truncate px-2 text-xs text-sidebar-foreground/60">
            {orgName}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-card/90 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="size-5" />
                  <span className="sr-only">Open navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
              >
                <SheetHeader className="border-b border-sidebar-border px-4 py-3 text-left">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <Logo href="/app" variant="light" />
                </SheetHeader>
                <NavLinks />
              </SheetContent>
            </Sheet>

            <div className="min-w-0 md:hidden">
              <Logo href="/app" showWordmark={false} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy">{orgName}</p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Workspace
              </p>
            </div>
          </div>

          <UserMenu userEmail={userEmail} />
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
