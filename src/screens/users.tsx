import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ROLES, type Invite, type Member, type Role } from "@shared/domain"
import { DataTable, type DataTableColumn } from "@/components/app/data-table"
import { DateText, FormDrawer, HeaderAction, PageHeader, SelectField, TextField } from "@/components/app/kit"
import { SeverityMessage } from "@/components/app/severity"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, invalidate, keys, useMembers } from "@/lib/api"
import { usePanel } from "@/lib/nav"
import { Section, useOrg } from "@/screens/layout"

const roleLabel: Record<Role, string> = { admin: "Admin", contributor: "Contributor", viewer: "Viewer" }
const roleHelp: Record<Role, string> = {
  admin: "Everything, including edits, corrections, settings, and members.",
  contributor: "Daily work: new inputs, stock, Stock product, and Record sale.",
  viewer: "Read only.",
}
const roleOptions = ROLES.map((r) => ({ value: r, label: roleLabel[r] }))

function day(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}

export function UsersScreen() {
  const { orgId, isAdmin, me } = useOrg()
  const panel = usePanel()
  const members = useMembers(orgId)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [busy, setBusy] = useState(false)
  const selected = members.data?.members.find((m) => m.userId === panel.id) ?? null

  async function run(task: () => Promise<unknown>, message: string) {
    setBusy(true)
    try {
      await task()
      await invalidate(keys.members(orgId))
      toast.success(message)
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const memberColumns: DataTableColumn<Member>[] = [
    {
      id: "person",
      header: "Person",
      accessor: (m) => `${m.name} ${m.email}`,
      cell: (m) => (
        <span className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{m.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{m.name}{m.userId === me.user?.id ? " (you)" : ""}</span>
            <span className="truncate text-xs text-muted-foreground">{m.email}</span>
          </span>
        </span>
      ),
    },
    { id: "role", header: "Role", accessor: (m) => roleLabel[m.role], cell: (m) => <Badge variant="outline">{roleLabel[m.role]}</Badge> },
    { id: "created", header: "Joined", accessor: (m) => m.createdAt, cell: (m) => <DateText iso={day(m.createdAt)} /> },
  ]

  const inviteColumns: DataTableColumn<Invite>[] = [
    {
      id: "person",
      header: "Person",
      accessor: (i) => `${i.name} ${i.email}`,
      cell: (i) => (
        <span className="flex flex-col">
          <span>{i.name}</span>
          <span className="text-xs text-muted-foreground">{i.email}</span>
        </span>
      ),
    },
    { id: "role", header: "Role", accessor: (i) => roleLabel[i.role] },
    { id: "expires", header: "Expires", accessor: (i) => i.expiresAt, cell: (i) => <DateText iso={day(i.expiresAt)} /> },
  ]

  return (
    <>
      <PageHeader title="Users">{isAdmin ? <HeaderAction label="Invite user" onClick={() => panel.open("invite")} /> : null}</PageHeader>
      <DataTable
        columns={memberColumns}
        rows={members.data?.members ?? []}
        getRowId={(m) => m.userId}
        status={members.isPending ? "loading" : members.isError ? "error" : "ready"}
        onRetry={() => members.refetch()}
        searchPlaceholder="Search users"
        emptyTitle="No users."
        initialSort={{ id: "person", desc: false }}
        rowActions={
          isAdmin
            ? (m) => [
                { id: "role", label: "Change role", onSelect: () => panel.open("role", m.userId) },
                { id: "remove", label: "Remove", onSelect: () => setRemoving(m) },
              ]
            : undefined
        }
      />
      {isAdmin && (members.data?.invites.length ?? 0) > 0 ? (
        <Section title="Open invites">
          <DataTable
            columns={inviteColumns}
            rows={members.data?.invites ?? []}
            getRowId={(i) => i.id}
            searchable={false}
            paginate={false}
            rowActions={(i) => [{ id: "revoke", label: "Revoke", onSelect: () => run(() => api(`/o/${orgId}/invites/${i.id}`, { method: "DELETE" }), "Invite revoked.") }]}
          />
          <p className="text-xs text-muted-foreground">An invite link is shown once, when you make it. To send it again, revoke it and invite again.</p>
        </Section>
      ) : null}

      <InviteDrawer open={isAdmin && panel.panel === "invite"} onClose={panel.close} />
      {selected ? (
        <RoleDrawer
          open={isAdmin && panel.panel === "role"}
          member={selected}
          busy={busy}
          onClose={panel.close}
          onSave={async (role) => {
            if (await run(() => api(`/o/${orgId}/members/${selected.userId}`, { method: "PATCH", body: { role } }), "Role changed.")) panel.close()
          }}
        />
      ) : null}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>They lose access to this organization at once. Their past entries stay in History.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" size="touch" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="touch"
              disabled={busy}
              onClick={async () => {
                if (removing && (await run(() => api(`/o/${orgId}/members/${removing.userId}`, { method: "DELETE" }), "Member removed."))) setRemoving(null)
              }}
            >
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InviteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orgId, catalog } = useOrg()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("contributor")
  const [link, setLink] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (open) {
      setName("")
      setEmail("")
      setRole("contributor")
      setLink(null)
      setCopied(false)
    }
  }, [open])
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  return (
    <FormDrawer
      title={link ? "Invite link" : "Invite user"}
      open={open}
      onClose={onClose}
      dirty={!link && !!(name || email)}
      canSubmit={!!name.trim() && emailOk}
      pending={pending}
      submitLabel="Make invite link"
      onSubmit={
        link
          ? undefined
          : async () => {
              setPending(true)
              try {
                const result = await api<{ token: string }>(`/o/${orgId}/invites`, { body: { name, email, role } })
                setLink(`${window.location.origin}/invite/${result.token}`)
                await invalidate(keys.members(orgId))
              } catch (e) {
                toast.error((e as Error).message)
              } finally {
                setPending(false)
              }
            }
      }
    >
      {link ? (
        <>
          <SeverityMessage level="success">
            Send this link to {name}. It works one time and expires in 7 days. It joins {catalog.org.name} as {roleLabel[role]}.
          </SeverityMessage>
          <div className="flex gap-2">
            <Input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              size="touch"
              onClick={async () => {
                await navigator.clipboard.writeText(link)
                setCopied(true)
                toast.success("Link copied.")
              }}
            >
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">There is no email service. Send the link in any chat or email app.</p>
        </>
      ) : (
        <>
          <TextField label="Name" value={name} onChange={setName} autoFocus />
          <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} error={email && !emailOk ? "Enter a valid email." : null} />
          <SelectField label="Role" value={role} onChange={(v) => setRole(v as Role)} options={roleOptions} note={roleHelp[role]} />
        </>
      )}
    </FormDrawer>
  )
}

function RoleDrawer({ open, member, busy, onClose, onSave }: { open: boolean; member: Member; busy: boolean; onClose: () => void; onSave: (role: Role) => void }) {
  const [role, setRole] = useState<Role>(member.role)
  useEffect(() => {
    if (open) setRole(member.role)
  }, [open, member.role])
  return (
    <FormDrawer title={`Change role: ${member.name}`} open={open} onClose={onClose} dirty={role !== member.role} pending={busy} onSubmit={() => onSave(role)}>
      <SelectField label="Role" value={role} onChange={(v) => setRole(v as Role)} options={roleOptions} note={roleHelp[role]} />
      <p className="text-xs text-muted-foreground">Every organization keeps at least one admin.</p>
    </FormDrawer>
  )
}
