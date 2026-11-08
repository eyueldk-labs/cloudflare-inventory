import { Navigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { FullPageSpinner } from "@/components/app/spinner"
import { useMe } from "@/lib/api"
import { go, lastOrg, orgPath } from "@/lib/nav"

/** Sends people to setup, sign-in, or their last organization. */
export function Home() {
  const me = useMe()
  if (me.isPending) return <FullPageSpinner />
  if (me.isError) return <FullPageSpinner label="Cannot reach the server. Refresh to try again." />
  const data = me.data
  if (data.needsSetup) return <Navigate to="/setup" replace />
  if (!data.user) return <Navigate to="/sign-in" replace />
  const remembered = lastOrg()
  const target = data.orgs.find((o) => o.id === remembered) ?? data.orgs[0]
  if (!target) return <FullPageSpinner label="You are not a member of an organization yet. Ask an admin for an invite link." />
  return <Redirect href={orgPath(target.id)} />
}

function Redirect({ href }: { href: string }) {
  useEffect(() => {
    go(href, {}, true)
  }, [href])
  return <FullPageSpinner />
}
