import { Check } from "lucide-react"
import { useEffect, useState } from "react"
import { ORG_COLORS, ORG_ICONS, type Org, type OrgColor, type OrgIcon } from "@shared/domain"
import { Fact, PageHeader, TextAreaField, TextField } from "@/components/app/kit"
import { OrgMark, orgColors, orgIcons } from "@/components/app/org-mark"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api, useAction } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Section, useOrg } from "@/screens/layout"

export function SettingsScreen() {
  const { orgId, catalog, isAdmin, role, me } = useOrg()
  const org = catalog.org
  const [draft, setDraft] = useState<Org>(org)
  useEffect(() => setDraft(org), [org])
  const dirty = JSON.stringify(draft) !== JSON.stringify(org)
  const save = useAction(orgId, (body: Org) => api(`/o/${orgId}/settings`, { method: "PATCH", body }), { success: "Settings saved." })
  const set = <K extends keyof Org>(key: K, value: Org[K]) => setDraft((d) => ({ ...d, [key]: value }))

  return (
    <>
      <PageHeader title="Settings" />
      <Section title="Organization">
        <Card>
          <CardContent>
            {isAdmin ? (
              <form
                className="flex max-w-2xl flex-col gap-5"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (dirty && draft.name.trim()) save.mutate(draft)
                }}
              >
                <div className="flex items-center gap-3">
                  <OrgMark icon={draft.icon} color={draft.color} className="size-10" />
                  <TextField label="Name" value={draft.name} onChange={(v) => set("name", v)} error={draft.name.trim() ? null : "Enter a name."} className="flex-1" />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Icon</span>
                  <div className="flex flex-wrap gap-2">
                    {ORG_ICONS.map((icon: OrgIcon) => {
                      const Icon = orgIcons[icon]
                      return (
                        <Button key={icon} type="button" variant={draft.icon === icon ? "secondary" : "outline"} size="icon" className="size-11" aria-label={icon} aria-pressed={draft.icon === icon} onClick={() => set("icon", icon)}>
                          <Icon />
                        </Button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Color</span>
                  <div className="flex flex-wrap gap-2">
                    {ORG_COLORS.map((color: OrgColor) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={color}
                        aria-pressed={draft.color === color}
                        className={cn("flex size-11 items-center justify-center rounded-md text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50", draft.color === color && "ring-2 ring-foreground")}
                        style={{ backgroundColor: orgColors[color] }}
                        onClick={() => set("color", color)}
                      >
                        {draft.color === color ? <Check className="size-4" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
                <h3 className="pt-2 text-sm font-medium">Invoice details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Contact name" value={draft.contactName} onChange={(v) => set("contactName", v)} />
                  <TextField label="Contact email" type="email" value={draft.contactEmail} onChange={(v) => set("contactEmail", v)} />
                  <TextField label="Contact phone" value={draft.contactPhone} onChange={(v) => set("contactPhone", v)} />
                </div>
                <TextAreaField label="Address" value={draft.invoiceAddress} onChange={(v) => set("invoiceAddress", v)} />
                <div className="flex gap-2">
                  <Button type="submit" size="touch" disabled={!dirty || !draft.name.trim() || save.isPending}>
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button type="button" variant="outline" size="touch" disabled={!dirty} onClick={() => setDraft(org)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Fact label="Name">{org.name}</Fact>
                <Fact label="Contact">{[org.contactName, org.contactEmail, org.contactPhone].filter(Boolean).join(" · ") || "—"}</Fact>
                <Fact label="Address">{org.invoiceAddress || "—"}</Fact>
                <p className="text-xs text-muted-foreground sm:col-span-2">Only admins can change these settings.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </Section>
      <Section title="You">
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Fact label="Name">{me.user?.name}</Fact>
            <Fact label="Email">{me.user?.email}</Fact>
            <Fact label="Role">{role === "admin" ? "Admin" : role === "contributor" ? "Contributor" : "Viewer"}{me.isOwner ? " · Owner" : ""}</Fact>
          </CardContent>
        </Card>
      </Section>
      <p className="text-xs text-muted-foreground">Currency: ETB. Money is stored as whole santim; kg up to 6 decimals.</p>
    </>
  )
}
