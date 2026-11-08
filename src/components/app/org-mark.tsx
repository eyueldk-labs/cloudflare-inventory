import { Box, Droplets, Factory, FlaskConical, Flower2, Gem, Leaf, Sparkles, Store, Sun, type LucideIcon } from "lucide-react"
import type { OrgColor, OrgIcon } from "@shared/domain"
import { cn } from "@/lib/utils"

export const orgIcons: Record<OrgIcon, LucideIcon> = {
  box: Box,
  flask: FlaskConical,
  leaf: Leaf,
  sun: Sun,
  droplet: Droplets,
  sparkles: Sparkles,
  store: Store,
  factory: Factory,
  gem: Gem,
  flower: Flower2,
}

export const orgColors: Record<OrgColor, string> = {
  violet: "oklch(0.55 0.12 294)",
  blue: "oklch(0.56 0.11 250)",
  teal: "oklch(0.56 0.09 190)",
  green: "oklch(0.55 0.1 150)",
  amber: "oklch(0.62 0.12 70)",
  orange: "oklch(0.6 0.13 45)",
  rose: "oklch(0.58 0.14 15)",
  pink: "oklch(0.62 0.14 350)",
  slate: "oklch(0.5 0.03 260)",
  indigo: "oklch(0.5 0.12 275)",
}

export function OrgMark({ icon, color, className }: { icon: OrgIcon; color: OrgColor; className?: string }) {
  const Icon = orgIcons[icon] ?? Box
  return (
    <span
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-white", className)}
      style={{ backgroundColor: orgColors[color] ?? orgColors.violet }}
      aria-hidden="true"
    >
      <Icon className="size-4" />
    </span>
  )
}
