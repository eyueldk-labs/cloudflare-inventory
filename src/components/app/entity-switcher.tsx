"use client"

import { useMemo, useState, type MouseEvent, type ReactNode } from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"

export type EntitySwitcherItem = {
  id: string
  name: string
  icon: ReactNode
  color: string
  external?: boolean
}

export type EntitySwitcherLink = {
  id: string
  label: string
  href: string
  external?: boolean
}

export type EntitySwitcherLabels = {
  menu?: string
  search?: string
  empty?: string
  trigger?: string
}

export type EntitySwitcherProps = {
  items: readonly EntitySwitcherItem[]
  value: string
  getHref?: (item: EntitySwitcherItem) => string
  onValueChange?: (value: string) => void
  labels?: EntitySwitcherLabels
  footerLinks?: readonly EntitySwitcherLink[]
  footer?: ReactNode
}

const touchControl = "h-11 md:pointer-fine:h-8"
// Button transition-all fades the ring in from a transparent shadow. transition-none keeps it visible on the first frame.
const focusRing =
  "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:transition-none"
const touchRow = "min-h-11 md:pointer-fine:min-h-8"
const rowClass =
  "flex w-full items-center gap-2 rounded-md px-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export function EntitySwitcher({
  items,
  value,
  getHref,
  onValueChange,
  labels,
  footerLinks = [],
  footer,
}: EntitySwitcherProps) {
  const menuLabel = labels?.menu ?? "Items"
  const searchLabel = labels?.search ?? "Search"
  const emptyLabel = labels?.empty ?? "No results."
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const current = items.find((item) => item.id === value)
  const showSearch = items.length > 7
  const visible = useMemo(() => filterItems({ items, query, value }), [items, query, value])
  const showFooter = footerLinks.length > 0 || footer != null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={`w-full justify-between ${touchControl} ${focusRing}`}
            aria-label={labels?.trigger}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          {current ? <ItemMark item={current} /> : null}
          <span className="truncate">{current?.name ?? menuLabel}</span>
        </span>
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-1 p-1">
        <PopoverTitle className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{menuLabel}</PopoverTitle>
        {showSearch ? (
          <Input
            value={query}
            placeholder={searchLabel}
            aria-label={searchLabel}
            className={touchControl}
            onChange={(event) => setQuery(event.target.value)}
          />
        ) : null}
        {visible.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col">
            {visible.map((item) => (
              <li key={item.id}>
                <SwitcherRow
                  item={item}
                  selected={item.id === value}
                  href={getHref?.(item)}
                  onValueChange={onValueChange}
                  onClose={() => setOpen(false)}
                />
              </li>
            ))}
          </ul>
        )}
        {showFooter ? (
          <div className="mt-1 border-t pt-1">
            {footerLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                className={`${rowClass} ${touchRow}`}
                onClick={() => setOpen(false)}
                {...externalProps(link.external)}
              >
                {link.label}
              </a>
            ))}
            <div onClick={() => setOpen(false)}>{footer}</div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function SwitcherRow({
  item,
  selected,
  href,
  onValueChange,
  onClose,
}: {
  item: EntitySwitcherItem
  selected: boolean
  href?: string
  onValueChange?: (value: string) => void
  onClose: () => void
}) {
  const className = `${rowClass} ${touchRow}`
  const onClick = (event: MouseEvent<HTMLElement>) => {
    const followLink = selectItem({ event, href, itemId: item.id, onValueChange })
    if (!followLink) {
      onClose()
    }
  }

  if (href) {
    return (
      <a
        href={href}
        className={className}
        aria-current={selected ? "true" : undefined}
        {...externalProps(item.external)}
        onClick={onClick}
      >
        <RowBody item={item} selected={selected} />
      </a>
    )
  }

  return (
    <button type="button" className={className} aria-current={selected ? "true" : undefined} onClick={onClick}>
      <RowBody item={item} selected={selected} />
    </button>
  )
}

function RowBody({ item, selected }: { item: EntitySwitcherItem; selected: boolean }) {
  return (
    <>
      <ItemMark item={item} />
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      {selected ? <CheckIcon /> : <span className="size-4" aria-hidden />}
    </>
  )
}

function ItemMark({ item }: { item: EntitySwitcherItem }) {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted"
      style={{ color: item.color }}
    >
      {item.icon}
    </span>
  )
}

// search starts at 8 items. Pass a shorter list to hide it. A `searchable` prop is the upgrade if a caller needs a different cutoff.
function filterItems({
  items,
  query,
  value,
}: {
  items: readonly EntitySwitcherItem[]
  query: string
  value: string
}) {
  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? items.filter((item) => item.name.toLowerCase().includes(needle))
    : [...items]
  return filtered.sort((a, b) => Number(b.id === value) - Number(a.id === value))
}

function selectItem({
  event,
  href,
  itemId,
  onValueChange,
}: {
  event: MouseEvent<HTMLElement>
  href?: string
  itemId: string
  onValueChange?: (value: string) => void
}): boolean {
  if (href && isModifiedClick(event)) {
    return true
  }
  if (onValueChange) {
    if (href) {
      event.preventDefault()
    }
    onValueChange(itemId)
  }
  return false
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
