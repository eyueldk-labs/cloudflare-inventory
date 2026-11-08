"use client"

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ComponentType,
  type ReactNode,
} from "react"
import { ChevronDownIcon, PanelLeftIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export type AppNavItem = {
  id: string
  label: string
  href: string
  icon: ComponentType
  active?: boolean
  external?: boolean
}

export type AppNavGroup = {
  id: string
  label: string
  items: readonly AppNavItem[]
  /** Persist open/closed under this localStorage key when set. */
  storageKey?: string
  /** Open when true on first paint (and when storage has no value). */
  defaultOpen?: boolean
}

export type AppNavEntry = AppNavItem | AppNavGroup

export type AppShellLabels = {
  openMenu?: string
  close?: string
}

export type AppShellMobileSwitcher = "topbar" | "drawer"

export type AppShellProps = {
  title?: string
  mark?: ReactNode
  nav: readonly AppNavEntry[]
  footer?: readonly AppNavItem[]
  switcher?: ReactNode
  mobile?: ReactNode
  toolbar?: ReactNode
  mobileToolbar?: ReactNode
  mobileSwitcher?: AppShellMobileSwitcher
  user?: ReactNode
  labels?: AppShellLabels
  children: ReactNode
}

const touchRow = "min-h-11 md:pointer-fine:min-h-8"
// Button transition-all fades the ring in from a transparent shadow. transition-none keeps it visible on the first frame.
const focusRing =
  "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:transition-none"

function isNavGroup(entry: AppNavEntry): entry is AppNavGroup {
  return "items" in entry
}

export function AppShell({
  title,
  mark,
  nav,
  footer = [],
  switcher,
  mobile,
  toolbar,
  mobileToolbar,
  mobileSwitcher = "topbar",
  user,
  labels,
  children,
}: AppShellProps) {
  const showFooter = footer.length > 0 || user != null
  const brandTitle = title?.trim() ?? ""
  const showBrand = Boolean(mark) || brandTitle.length > 0
  const phoneAction = mobileToolbar ?? copyNode(toolbar)
  const toolbarBesideSwitcher = !showBrand && Boolean(toolbar)
  const switcherInTopBar = mobileSwitcher === "topbar" && Boolean(switcher)

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="gap-3 overflow-visible p-3">
          <DrawerClose label={labels?.close ?? "Close"} />
          {showBrand ? (
            <div className="flex items-center gap-2 px-2">
              {mark}
              {brandTitle.length > 0 ? (
                <span className="truncate font-heading text-base font-semibold tracking-tight">
                  {brandTitle}
                </span>
              ) : null}
              {toolbar ? <div className="ml-auto hidden md:flex">{toolbar}</div> : null}
            </div>
          ) : null}
          {switcher || toolbarBesideSwitcher ? (
            <div className="flex items-center gap-2">
              {switcher ? (
                <div className={`min-w-0 flex-1${switcherInTopBar ? " hidden md:block" : ""}`}>
                  {switcher}
                </div>
              ) : null}
              {toolbarBesideSwitcher ? (
                <div className="hidden shrink-0 md:block">{toolbar}</div>
              ) : null}
            </div>
          ) : null}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((entry) =>
                  isNavGroup(entry) ? (
                    <NavGroup key={entry.id} group={entry} />
                  ) : (
                    <NavItem key={entry.id} item={entry} />
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        {showFooter ? (
          <SidebarFooter className="gap-2 p-3">
            {footer.length > 0 ? (
              <SidebarMenu>
                {footer.map((item) => (
                  <NavItem key={item.id} item={item} />
                ))}
              </SidebarMenu>
            ) : null}
            {user}
          </SidebarFooter>
        ) : null}
      </Sidebar>
      <SidebarInset className="min-w-0">
        <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <MobileNavTrigger label={labels?.openMenu ?? "Open menu"} />
          {phoneAction}
          <div className="min-w-0 flex-1">{switcherInTopBar ? copyNode(switcher) : mobile}</div>
        </div>
        <div className="flex flex-1 flex-col gap-8 p-4 md:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function DrawerClose({ label }: { label: string }) {
  const { toggleSidebar } = useSidebar()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`size-11 pointer-fine:size-8 md:hidden ${focusRing}`}
      aria-label={label}
      onClick={toggleSidebar}
    >
      <XIcon />
    </Button>
  )
}

function MobileNavTrigger({ label }: { label: string }) {
  const { toggleSidebar } = useSidebar()
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`size-11 md:pointer-fine:size-8 ${focusRing}`}
      aria-label={label}
      onClick={toggleSidebar}
    >
      <PanelLeftIcon />
    </Button>
  )
}

function NavItem({ item }: { item: AppNavItem }) {
  const Icon = item.icon
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="lg"
        isActive={item.active}
        className={`${touchRow} data-active:text-primary`}
        render={
          <a
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            onClick={() => isMobile && setOpenMobile(false)}
            {...externalProps(item.external)}
          />
        }
      >
        <Icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavGroup({ group }: { group: AppNavGroup }) {
  const panelId = useId()
  const childActive = group.items.some((item) => item.active)
  const [open, setOpen] = useState(() =>
    readNavGroupOpen(group.storageKey, group.defaultOpen ?? childActive)
  )

  useEffect(() => {
    if (childActive) {
      setOpen(true)
    }
  }, [childActive])

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (group.storageKey) {
      try {
        window.localStorage.setItem(group.storageKey, next ? "1" : "0")
      } catch {
        // Ignore quota / private-mode failures.
      }
    }
  }

  return (
    <SidebarMenuItem>
      <Collapsible open={open} onOpenChange={onOpenChange} className="w-full">
        <CollapsibleTrigger
          className={cn(
            touchRow,
            focusRing,
            "flex w-full items-center justify-between gap-2 rounded-md px-2 text-left text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span>{group.label}</span>
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 transition-transform",
              open ? "rotate-0" : "-rotate-90"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent id={panelId}>
          <SidebarMenu className="mt-1 ml-2 border-l border-sidebar-border pl-2">
            {group.items.map((item) => (
              <NavItem key={item.id} item={item} />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}

function readNavGroupOpen(
  storageKey: string | undefined,
  fallback: boolean
): boolean {
  if (!storageKey || typeof window === "undefined") {
    return fallback
  }
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === "1") return true
    if (stored === "0") return false
  } catch {
    // Ignore.
  }
  return fallback
}

function externalProps(external: boolean | undefined): {
  target?: "_blank"
  rel?: "noopener"
} {
  if (!external) {
    return {}
  }
  return { target: "_blank", rel: "noopener" }
}

// clones toolbar into the phone bar when mobileToolbar is unset. A ref on that node attaches to one instance. Pass mobileToolbar when the phone action must be a different node.
function copyNode(node: ReactNode): ReactNode {
  if (!isValidElement(node)) {
    return node
  }
  return cloneElement(node)
}
