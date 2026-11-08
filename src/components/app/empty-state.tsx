import type { ReactNode } from "react"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export type EmptyStateProps = {
  icon?: ReactNode
  title: string
  action?: ReactNode
  heading?: boolean
}

export function EmptyState({ title, action, icon, heading = false }: EmptyStateProps) {
  return (
    <Empty className="border-border bg-card">
      <EmptyHeader>
        {icon}
        {heading ? (
          <h1 data-slot="empty-title" className="font-heading text-sm font-medium tracking-tight">
            {title}
          </h1>
        ) : (
          <EmptyTitle className="font-heading">{title}</EmptyTitle>
        )}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
