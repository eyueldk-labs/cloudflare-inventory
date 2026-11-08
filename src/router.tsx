import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router"
import { Home } from "@/screens/home"
import { OrgLayout } from "@/screens/layout"

export type PanelSearch = { panel?: string; id?: string; month?: string }

const validateSearch = (search: Record<string, unknown>): PanelSearch => ({
  panel: typeof search.panel === "string" ? search.panel : undefined,
  id: typeof search.id === "string" ? search.id : undefined,
  month: typeof search.month === "string" && /^\d{4}-\d{2}$/.test(search.month) ? search.month : undefined,
})

const rootRoute = createRootRoute({ component: () => <Outlet /> })

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Home })
const signInRoute = createRoute({ getParentRoute: () => rootRoute, path: "/sign-in", component: lazyRouteComponent(() => import("@/screens/auth"), "SignIn") })
const setupRoute = createRoute({ getParentRoute: () => rootRoute, path: "/setup", component: lazyRouteComponent(() => import("@/screens/auth"), "Setup") })
const inviteRoute = createRoute({ getParentRoute: () => rootRoute, path: "/invite/$token", component: lazyRouteComponent(() => import("@/screens/auth"), "AcceptInvite") })

export const orgRoute = createRoute({ getParentRoute: () => rootRoute, path: "/o/$orgId", component: OrgLayout })

const child = (path: string, file: () => Promise<Record<string, unknown>>, name: string) =>
  createRoute({ getParentRoute: () => orgRoute, path, validateSearch, component: lazyRouteComponent(file as never, name as never) })

const routeTree = rootRoute.addChildren([
  homeRoute,
  signInRoute,
  setupRoute,
  inviteRoute,
  orgRoute.addChildren([
    child("/", () => import("@/screens/overview"), "OverviewScreen"),
    child("/inputs", () => import("@/screens/inputs"), "InputsScreen"),
    child("/products", () => import("@/screens/products"), "ProductsScreen"),
    child("/sales", () => import("@/screens/sales"), "SalesScreen"),
    child("/audit", () => import("@/screens/audit"), "AuditScreen"),
    child("/alerts", () => import("@/screens/alerts"), "AlertsScreen"),
    child("/users", () => import("@/screens/users"), "UsersScreen"),
    child("/settings", () => import("@/screens/settings"), "SettingsScreen"),
  ]),
])

export const router = createRouter({ routeTree, defaultPreload: "intent", scrollRestoration: true })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
