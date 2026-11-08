import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from "react"
import { Info } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { StopIcon, WarningStatusIcon, SuccessStatusIcon } from "@/components/app/status-icons"

/** Shared severity levels for inline notes, badges, alerts, and the bell. */
export type SeverityLevel = "error" | "warning" | "info" | "success"

const icons: Record<SeverityLevel, ComponentType<ComponentPropsWithoutRef<"svg">>> = {
  error: StopIcon,
  warning: WarningStatusIcon,
  info: Info,
  success: SuccessStatusIcon,
}

const messageVariants = cva("flex items-start gap-2 text-sm", {
  variants: {
    level: {
      error: "text-severity-error",
      warning: "text-severity-warning",
      info: "text-severity-info",
      success: "text-severity-success",
    },
  },
  defaultVariants: {
    level: "info",
  },
})

const badgeTone: Record<
  SeverityLevel,
  "destructive" | "warning" | "info" | "success"
> = {
  error: "destructive",
  warning: "warning",
  info: "info",
  success: "success",
}

type SeverityMessageProps = {
  level: SeverityLevel
  children: ReactNode
  className?: string
  /** Use alert for blocking and warning messages that need a live region. */
  role?: "alert" | "status"
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "role" | "className">

/**
 * Colour + icon + text. Never colour alone. Use for inline field feedback,
 * sale notes, produce shortfalls, and summary lines.
 */
export function SeverityMessage({
  level,
  children,
  className,
  role,
  ...props
}: SeverityMessageProps) {
  const Icon = icons[level]

  return (
    <div
      {...props}
      data-slot="severity-message"
      data-severity={level}
      role={role}
      aria-live={role === "alert" || role === "status" ? "polite" : undefined}
      className={cn(messageVariants({ level }), className)}
    >
      <Icon
        data-icon="inline-start"
        className="mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  )
}

type SeverityBadgeProps = {
  level: SeverityLevel
  children: ReactNode
  className?: string
}

/** Compact badge for tables and the alert type column. Colour + icon + text. */
export function SeverityBadge({
  level,
  children,
  className,
}: SeverityBadgeProps) {
  const Icon = icons[level]

  return (
    <Badge
      data-slot="severity-badge"
      data-severity={level}
      variant={badgeTone[level]}
      className={className}
    >
      <Icon data-icon="inline-start" aria-hidden="true" />
      {children}
    </Badge>
  )
}

export function severityIcon(level: SeverityLevel) {
  return icons[level]
}

export type { VariantProps }
