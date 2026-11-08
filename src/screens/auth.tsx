import { Navigate, useParams } from "@tanstack/react-router"
import { Boxes } from "lucide-react"
import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { TextField } from "@/components/app/kit"
import { SeverityMessage } from "@/components/app/severity"
import { FullPageSpinner } from "@/components/app/spinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, keys, queryClient, useMe } from "@/lib/api"
import { go, orgPath } from "@/lib/nav"

function AuthFrame({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
            <Boxes className="size-5" />
          </span>
          <CardTitle className="font-heading text-xl">
            <h1>{title}</h1>
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  )
}

function useSubmit(action: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(false)
    }
  }
  return { error, pending, onSubmit }
}

async function enter(orgId?: string) {
  const me = await queryClient.fetchQuery({ queryKey: keys.me, queryFn: () => api<import("@shared/domain").Me>("/me"), staleTime: 0 })
  const target = orgId ?? me.orgs[0]?.id
  go(target ? orgPath(target) : "/", {}, true)
}

export function SignIn() {
  const me = useMe()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const { error, pending, onSubmit } = useSubmit(async () => {
    await api("/auth/sign-in/email", { body: { email: email.trim().toLowerCase(), password } })
    await enter()
  })
  if (me.isPending) return <FullPageSpinner />
  if (me.data?.needsSetup) return <Navigate to="/setup" replace />
  if (me.data?.user) return <Navigate to="/" replace />
  return (
    <AuthFrame title="Sign in" description="Use the email and password from your invite.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} autoFocus />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
        {error ? <SeverityMessage level="error" role="alert">{error}</SeverityMessage> : null}
        <Button type="submit" size="touch" disabled={pending || !email || !password}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-xs text-muted-foreground">No account? Ask an admin for an invite link.</p>
      </form>
    </AuthFrame>
  )
}

/** First run: the first person to open a fresh deploy creates the owner account and the first organization. */
export function Setup() {
  const me = useMe()
  const [orgName, setOrgName] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const { error, pending, onSubmit } = useSubmit(async () => {
    const result = await api<{ orgId: string }>("/setup", { body: { orgName, name, email, password } })
    await enter(result.orgId)
  })
  if (me.isPending) return <FullPageSpinner />
  if (me.data && !me.data.needsSetup) return <Navigate to="/" replace />
  const short = password.length > 0 && password.length < 8 ? "Use at least 8 characters." : null
  return (
    <AuthFrame
      title="Set up your inventory"
      description="Create the owner account. Only this first account is made here; invite everyone else from Users."
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField label="Organization name" value={orgName} onChange={setOrgName} autoFocus placeholder="For example, Acme Studio" />
        <TextField label="Your name" autoComplete="name" value={name} onChange={setName} />
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} />
        <TextField label="Password" type="password" autoComplete="new-password" value={password} onChange={setPassword} error={short} />
        {error ? <SeverityMessage level="error" role="alert">{error}</SeverityMessage> : null}
        <Button type="submit" size="touch" disabled={pending || !orgName.trim() || !name.trim() || !email.trim() || password.length < 8}>
          {pending ? "Creating…" : "Create and sign in"}
        </Button>
      </form>
    </AuthFrame>
  )
}

type InviteInfo = { valid: boolean; name?: string; email?: string; role?: string; orgName?: string; hasAccount?: boolean }

export function AcceptInvite() {
  const { token } = useParams({ strict: false }) as { token: string }
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  useEffect(() => {
    api<InviteInfo>(`/invite/${token}`)
      .then((data) => {
        setInfo(data)
        setName(data.name ?? "")
      })
      .catch(() => setInfo({ valid: false }))
  }, [token])
  const { error, pending, onSubmit } = useSubmit(async () => {
    await queryClient.cancelQueries()
    const result = await api<{ orgId: string }>(`/invite/${token}`, { body: { name, password } })
    await enter(result.orgId)
  })
  if (!info) return <FullPageSpinner />
  if (!info.valid) {
    return (
      <AuthFrame title="Invite unavailable" description="This link was used, revoked, or has expired. Ask an admin for a new link.">
        <Button size="touch" variant="outline" className="w-full" onClick={() => go("/sign-in")}>
          Go to sign in
        </Button>
      </AuthFrame>
    )
  }
  const existing = !!info.hasAccount
  const short = !existing && password.length > 0 && password.length < 8 ? "Use at least 8 characters." : null
  const mismatch = !existing && confirm.length > 0 && confirm !== password ? "The passwords do not match." : null
  const ready = existing ? password.length > 0 : name.trim() && password.length >= 8 && password === confirm
  return (
    <AuthFrame
      title={`Join ${info.orgName}`}
      description={
        <>
          You are invited as <span className="text-foreground">{info.role}</span> with <span className="text-foreground">{info.email}</span>.
          {existing ? " Enter your current password to accept." : " Set a password to finish."}
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {existing ? (
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} autoFocus />
        ) : (
          <>
            <TextField label="Your name" autoComplete="name" value={name} onChange={setName} />
            <TextField label="Password" type="password" autoComplete="new-password" value={password} onChange={setPassword} error={short} autoFocus />
            <TextField label="Password again" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={mismatch} />
          </>
        )}
        {error ? <SeverityMessage level="error" role="alert">{error}</SeverityMessage> : null}
        <Button type="submit" size="touch" disabled={pending || !ready}>
          {pending ? "Joining…" : "Join"}
        </Button>
      </form>
    </AuthFrame>
  )
}
