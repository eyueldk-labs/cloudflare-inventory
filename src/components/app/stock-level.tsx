// Shared stock-level bar with a low-level marker.
import { StopIcon, SuccessStatusIcon, WarningStatusIcon } from "@/components/app/status-icons"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatAmount, type Unit } from "@shared/domain"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type StockLevelProps = {
  /** Current available amount in the same unit as lowLevel. */
  available: number
  /** Low-stock threshold. Null means no marker. */
  lowLevel: number | null
  unit: Unit
  className?: string
}

export type StockLevelTone = "ok" | "low" | "out"

/**
 * Shared stock remaining bar with a minimum-stock marker.
 * Visible UI is bar + severity icon only (#34). Exact figures live in the
 * tooltip and in the accessible name / sr-only text.
 */
export function StockLevel({
  available,
  lowLevel,
  unit,
  className,
}: StockLevelProps) {
  const tone = stockLevelTone({ available, lowLevel })
  const capacity = stockLevelCapacity({ available, lowLevel })
  const fillPct = capacity > 0 ? Math.min(100, (available / capacity) * 100) : 0
  const markerPct = lowLevel !== null ? 50 : null
  const tip = stockLevelTooltip({ available, lowLevel, unit })
  const accessibleName = stockLevelAccessibleName({ available, lowLevel, unit })
  const Icon = tone === "out" ? StopIcon : tone === "low" ? WarningStatusIcon : SuccessStatusIcon
  const iconLabel =
    tone === "out" ? "Out of stock" : tone === "low" ? "Low stock" : "Above minimum stock"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            type="button"
            data-slot="stock-level"
            data-tone={tone}
            className={cn(
              "group/stock relative z-20 flex justify-start px-0 hover:bg-transparent min-h-11 w-full min-w-[7rem] items-center gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:pointer-fine:min-h-8",
              className
            )}
            aria-label={accessibleName}
          />
        }
      >
        {lowLevel === null ? <span className="text-muted-foreground" aria-hidden="true">—</span> : <>
        <span className="relative flex h-3.5 min-w-0 flex-1 items-center overflow-visible">
          <span className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <span
              data-slot="stock-level-fill"
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                tone === "ok" && "bg-severity-success",
                tone === "low" && "bg-severity-warning",
                tone === "out" && "bg-severity-error"
              )}
              style={{ width: `${fillPct}%` }}
              aria-hidden="true"
            />
          </span>
          {markerPct !== null ? (
            <span
              data-slot="stock-level-marker"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-neutral-300/50 shadow-[0_0_0_1px_var(--background)]"
              style={{
                left: `${markerPct}%`,
                height: "14px",
              }}
            />
          ) : null}
        </span>
        {(
          <Icon
            data-slot="stock-level-icon"
            className="size-4 shrink-0"
            aria-label={iconLabel}
            role="img"
          />
        )}
        </>}
        <span className="sr-only">{accessibleName}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        {tip}
      </TooltipContent>
    </Tooltip>
  )
}

export function stockLevelTone({
  available,
  lowLevel,
}: {
  available: number
  lowLevel: number | null
}): StockLevelTone {
  if (available <= 0) {
    return "out"
  }

  if (lowLevel !== null && available <= lowLevel) {
    return "low"
  }

  return "ok"
}

/** 100% is the midpoint. Fill caps at 200%, independently of the sort key. */
export function stockLevelCapacity({ available, lowLevel }: { available: number; lowLevel: number | null }): number {
  return lowLevel !== null && lowLevel > 0 ? lowLevel * 2 : Math.max(available, 1e-9)
}

/** Missing minimums always sort last, using TanStack sortUndefined. */
export function stockLevelSortKey({ available, lowLevel }: { available: number; lowLevel: number | null }): number | undefined {
  if (lowLevel === null) return undefined
  if (lowLevel === 0) return available > 0 ? Number.POSITIVE_INFINITY : 0
  return available / lowLevel
}

export function stockLevelTooltip({ available, lowLevel, unit }: { available: number; lowLevel: number | null; unit: Unit }): string {
  const amount = formatStockAmount({ amount: available, unit })
  if (lowLevel === null) return `Available ${amount} · No minimum stock set`
  const minimum = formatStockAmount({ amount: lowLevel, unit })
  const ratio = stockLevelSortKey({ available, lowLevel })!
  const percent = Number.isFinite(ratio) ? `${Math.round(ratio * 100)}%` : "∞%"
  return `Available ${amount} · Minimum stock ${minimum} (${percent})`
}

export const stockLevelAccessibleName = stockLevelTooltip

function formatStockAmount({ amount, unit }: { amount: number; unit: Unit }) {
  return formatAmount(amount, unit)
}
