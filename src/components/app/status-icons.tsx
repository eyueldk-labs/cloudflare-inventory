import { CircleCheck, OctagonMinus, TriangleAlert, type LucideIcon, type LucideProps } from "lucide-react"
import { cn } from "@/lib/utils"

// One outline glyph and muted semantic colour per status.
function statusIcon(Icon: LucideIcon, meaning: string, colour: string) {
  return function StatusIcon({ className, ...props }: LucideProps) {
    return <Icon {...props} data-status-icon={meaning} strokeWidth={1.5} className={cn(colour, className)} />
  }
}

export const ErrorStatusIcon = statusIcon(OctagonMinus, "error", "text-severity-error/80")
export const WarningStatusIcon = statusIcon(TriangleAlert, "warning", "text-severity-warning/80")
export const SuccessStatusIcon = statusIcon(CircleCheck, "success", "text-severity-success/80")
export { ErrorStatusIcon as StopIcon }
