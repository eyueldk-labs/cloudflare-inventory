import { Navigate, Outlet, useParams, useRouterState } from "@tanstack/react-router"
import { Bell, ClipboardList, KeyRound, Layers, LayoutDashboard, LogOut, Package, Plus, Receipt, Settings, Users } from "lucide-react"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { alertsFor, type Catalog, type Me, type Role } from "@shared/domain"
import { AppShell, type AppNavEntry } from "@/components/app/app-shell"
import { EntitySwitcher } from "@/components/app/entity-switcher"
import { FormDrawer, TextField } from "@/components/app/kit"
import { NotificationBell } from "@/components/app/notification-bell"
import { OrgMark, orgColors, orgIcons } from "@/components/app/org-mark"
import { FullPageSpinner, ScreenSkeleton } from "@/components/app/spinner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { api, keys, queryClient, useCatalog, useMe } from "@/lib/api"
import { go, orgPath, rememberOrg } from "@/lib/nav"

type OrgContextValue = {
  orgId: string
  role: Role
  me: Me
  catalog: Catalog
  isAdmin: boolean
  canWork: boolean
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function useOrg() {
  const value = useContext(OrgContext)
  if (!value) throw new Error("useOrg outside OrgLayout")
  return value
}

const nav: { id: string; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "", label: "Overview", icon: LayoutDashboard },
  { id: "inputs", label: "Inputs", icon: Layers },
  { id: "products", label: "Products", icon: Package },
  { id: "sales", label: "Sales", icon: Receipt },
  { id: "audit", label: "Audit", icon: ClipboardList },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "users", label: "Users", icon: Users },
]

export function OrgLayout() {
  const { orgId } = useParams({ strict: false }) as { orgId: string }
  const me = useMe()
  const catalog = useCatalog(orgId)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (orgId) rememberOrg(orgId)
  }, [orgId])

  if (me.isPending) return <FullPageSpinner />
  if (me.isError) return <FullPageSpinner label="Cannot reach the server. Refresh to try again." />
  if (me.data.needsSetup) return <Navigate to="/setup" replace />
  if (!me.data.user) return <Navigate to="/sign-in" replace />
  const membership = me.data.orgs.find((o) => o.id === orgId)
  if (!membership) return <Navigate to="/" replace />

  const screen = pathname.replace(`/o/${orgId}`, "").replace(/^\//, "").split("/")[0] ?? ""
  const entries: AppNavEntry[] = nav.map((item) => ({
    id: item.id || "overview",
    label: item.label,
    href: orgPath(orgId, item.id),
    icon: item.icon,
    active: screen === item.id,
  }))

  return (
    <AppShell
      nav={entries}
      footer={[{ id: "settings", label: "Settings", href: orgPath(orgId, "settings"), icon: Settings, active: screen === "settings" }]}
      switcher={<OrgSwitcher me={me.data} orgId={orgId} />}
      toolbar={catalog.data ? <AlertsBell orgId={orgId} catalog={catalog.data} /> : null}
      user={<AccountMenu me={me.data} />}
      labels={{ openMenu: "Open menu", close: "Close" }}
    >
      {catalog.isPending ? (
        <ScreenSkeleton />
      ) : catalog.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{catalog.error.message}</p>
          <Button variant="outline" size="touch" onClick={() => catalog.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <OrgContext.Provider
          value={{
            orgId,
            role: membership.role,
            me: me.data,
            catalog: catalog.data,
            isAdmin: membership.role === "admin",
            canWork: membership.role !== "viewer",
          }}
        >
          <Outlet />
        </OrgContext.Provider>
      )}
    </AppShell>
  )
}

function OrgSwitcher({ me, orgId }: { me: Me; orgId: string }) {
  const [creating, setCreating] = useState(false)
  const current = me.orgs.find((o) => o.id === orgId)
  return (
    <>
      <EntitySwitcher
        items={me.orgs.map((o) => {
          const Icon = orgIcons[o.icon]
          return { id: o.id, name: o.name, color: orgColors[o.color], icon: <Icon /> }
        })}
        value={orgId}
        labels={{ menu: "Organizations", search: "Search organizations", empty: "No results.", trigger: `Organization, ${current?.name ?? ""}` }}
        onValueChange={(id) => go(orgPath(id))}
        footerLinks={[{ id: "settings", label: "Settings", href: orgPath(orgId, "settings") }]}
        footer={
          me.isOwner ? (
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-1.5 text-left text-sm hover:bg-accent md:pointer-fine:min-h-8"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-4" aria-hidden="true" /> New organization
            </button>
          ) : null
        }
      />
      <NewOrgDrawer open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function NewOrgDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (open) setName("")
  }, [open])
  return (
    <FormDrawer
      title="New organization"
      open={open}
      onClose={onClose}
      dirty={name.trim().length > 0}
      canSubmit={name.trim().length > 0}
      pending={pending}
      submitLabel="Create"
      onSubmit={async () => {
        setPending(true)
        try {
          const result = await api<{ orgId: string }>("/orgs", { body: { name } })
          await queryClient.invalidateQueries({ queryKey: keys.me })
          toast.success("Organization created.")
          onClose()
          go(orgPath(result.orgId))
        } catch (error) {
          toast.error((error as Error).message)
        } finally {
          setPending(false)
        }
      }}
    >
      <p className="text-sm text-muted-foreground">Each organization keeps its own inputs, products, sales, and members.</p>
      <TextField label="Name" value={name} onChange={setName} autoFocus />
    </FormDrawer>
  )
}

function AlertsBell({ orgId, catalog }: { orgId: string; catalog: Catalog }) {
  const alerts = useMemo(() => alertsFor(catalog), [catalog])
  return (
    <NotificationBell
      viewAllHref={orgPath(orgId, "alerts")}
      items={alerts.map((a) => ({
        id: a.id,
        title: `${a.itemName}: ${a.title}`,
        severity: a.level,
        severityLabel: a.title,
        href: a.action === "stock-product" ? `${orgPath(orgId, "products")}?panel=produce&id=${a.itemId}` : alertTarget(orgId, a),
      }))}
      labels={{ menu: "Alerts", empty: "No alerts" }}
      formatTrigger={(count) => (count === 0 ? "Alerts" : `Alerts, ${count}`)}
    />
  )
}

function alertTarget(orgId: string, a: ReturnType<typeof alertsFor>[number]) {
  if (a.itemType === "input") return `${orgPath(orgId, "inputs")}?panel=stock&id=${a.itemId}`
  return `${orgPath(orgId, "products")}?panel=edit&id=${a.itemId}`
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

function AccountMenu({ me }: { me: Me }) {
  const [changing, setChanging] = useState(false)
  const name = me.user?.name ?? ""
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/50">
          <Avatar className="size-8">
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-sm">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{me.user?.email}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem className="min-h-11" onClick={() => setChanging(true)}>
            <KeyRound aria-hidden="true" /> Change password
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            onClick={async () => {
              await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
              queryClient.clear()
              go("/sign-in", {}, true)
            }}
          >
            <LogOut aria-hidden="true" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePassword open={changing} onClose={() => setChanging(false)} />
    </>
  )
}

function ChangePassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (open) {
      setCurrent("")
      setNext("")
      setConfirm("")
    }
  }, [open])
  const tooShort = next.length > 0 && next.length < 8 ? "Use at least 8 characters." : null
  const mismatch = confirm.length > 0 && confirm !== next ? "The passwords do not match." : null
  return (
    <FormDrawer
      title="Change password"
      open={open}
      onClose={onClose}
      dirty={!!(current || next || confirm)}
      canSubmit={!!current && next.length >= 8 && next === confirm}
      pending={pending}
      onSubmit={async () => {
        setPending(true)
        try {
          await api("/auth/change-password", { body: { currentPassword: current, newPassword: next, revokeOtherSessions: true } })
          toast.success("Password changed.")
          onClose()
        } catch (error) {
          toast.error((error as Error).message)
        } finally {
          setPending(false)
        }
      }}
    >
      <TextField label="Current password" type="password" autoComplete="current-password" value={current} onChange={setCurrent} />
      <TextField label="New password" type="password" autoComplete="new-password" value={next} onChange={setNext} error={tooShort} />
      <TextField label="New password again" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={mismatch} />
    </FormDrawer>
  )
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export { OrgMark }
