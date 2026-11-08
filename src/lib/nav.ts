import { useRouterState, useSearch } from "@tanstack/react-router"
import { useCallback } from "react"
import { router, type PanelSearch } from "@/router"

const LAST_ORG = "inventory:last-org"

export function rememberOrg(orgId: string) {
  try {
    localStorage.setItem(LAST_ORG, orgId)
  } catch {
    // Private mode: ignore.
  }
}

export function lastOrg(): string | null {
  try {
    return localStorage.getItem(LAST_ORG)
  } catch {
    return null
  }
}

function hrefWith(pathname: string, search: PanelSearch) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) if (value) params.set(key, value)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function go(path: string, search: PanelSearch = {}, replace = false) {
  return router.navigate({ href: hrefWith(path, search), replace })
}

export function orgPath(orgId: string, screen = "") {
  return `/o/${orgId}${screen ? `/${screen}` : ""}`
}

/** Drawers are addressed by URL (?panel=…&id=…): shortcuts and alerts link straight to them. */
export function usePanel() {
  const search = useSearch({ strict: false }) as PanelSearch
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const open = useCallback(
    (panel: string, id?: string) => go(pathname, { month: search.month, panel, id }),
    [pathname, search.month]
  )
  const close = useCallback(() => go(pathname, { month: search.month }, true), [pathname, search.month])
  const setMonth = useCallback((month: string) => go(pathname, { month }, true), [pathname])
  return { panel: search.panel, id: search.id, month: search.month, open, close, setMonth }
}
