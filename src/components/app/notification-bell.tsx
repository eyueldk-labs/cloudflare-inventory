"use client"

import type { MouseEvent } from "react"
import { BellIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SeverityBadge,
  type SeverityLevel,
} from "@/components/app/severity"

export type NotificationItem = {
  id: string
  title: string
  time?: string
  href?: string
  external?: boolean
  /** Shared severity: colour + icon + text in the bell list. */
  severity?: SeverityLevel
  severityLabel?: string
}

export type NotificationBellLabels = {
  menu?: string
  empty?: string
  trigger?: string
  list?: string
}

export type NotificationBellProps = {
  items?: readonly NotificationItem[]
  onNavigate?: (id: string) => void
  labels?: NotificationBellLabels
  viewAllHref?: string
  formatTrigger?: (count: number) => string
}

const touchRow = "min-h-11 md:pointer-fine:min-h-8"
// Button transition-all fades the ring in from a transparent shadow. transition-none keeps it visible on the first frame.
const focusRing =
  "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:transition-none"

export function NotificationBell({
  items = [],
  onNavigate,
  labels,
  formatTrigger = defaultTrigger,
  viewAllHref,
}: NotificationBellProps) {
  const count = items.length
  const menuLabel = labels?.list ?? labels?.menu ?? "Notifications"
  const emptyLabel = labels?.empty ?? "No notifications."

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`relative size-11 overflow-visible md:pointer-fine:size-8 ${focusRing}`}
            aria-label={labels?.trigger ?? formatTrigger(count)}
          />
        }
      >
        {/* -right-* grows left past the icon centre when the pill is wider than 16px. Pin the left edge instead. */}
        <span className="relative inline-flex">
          <BellIcon />
          {count > 0 ? (
            <Badge
              aria-hidden
              className="pointer-events-none absolute bottom-1/2 left-[calc(50%+2px)] h-4 min-w-4 px-1 py-0 leading-none tabular-nums"
            >
              {count > 99 ? "99+" : String(count)}
            </Badge>
          ) : null}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        {/* a nested region is an illegal menu child. The group is the scroller. */}
        <DropdownMenuGroup
          tabIndex={count > 0 ? 0 : undefined}
          aria-label={menuLabel}
          className="max-h-80 overflow-x-hidden overflow-y-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {count === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={`${touchRow} items-start py-2`}
                render={
                  item.href ? <a href={item.href} {...externalProps(item.external)} /> : undefined
                }
                onClick={(event) => openItem({ event, href: item.href, id: item.id, onNavigate })}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex min-w-0 items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate font-medium" title={item.title}>{item.title}</span>
                    {item.time ? (
                      <span className="shrink-0 text-muted-foreground">
                        {item.time}
                      </span>
                    ) : null}
                  </span>
                  {item.severity && item.severityLabel ? (
                    <SeverityBadge level={item.severity}>
                      {item.severityLabel}
                    </SeverityBadge>
                  ) : null}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        {viewAllHref ? <>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={touchRow} render={<a href={viewAllHref} />}>View alerts</DropdownMenuItem>
        </> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function defaultTrigger(count: number) {
  const shown = count > 99 ? "more than 99" : String(count)
  return `Notifications, ${shown} new`
}

function openItem({
  event,
  href,
  id,
  onNavigate,
}: {
  event: MouseEvent<HTMLElement>
  href?: string
  id: string
  onNavigate?: (id: string) => void
}) {
  if (!onNavigate) {
    return
  }
  if (href && isModifiedClick(event)) {
    return
  }
  if (href) {
    event.preventDefault()
  }
  onNavigate(id)
}

function isModifiedClick(event: MouseEvent<HTMLElement>) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

function externalProps(external: boolean | undefined): { target?: "_blank"; rel?: "noopener" } {
  if (!external) {
    return {}
  }
  return { target: "_blank", rel: "noopener" }
}
