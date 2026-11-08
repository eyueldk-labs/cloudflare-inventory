import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      {label ? null : <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />}
      <p className="max-w-sm">{label ?? "Loading…"}</p>
    </div>
  )
}

export function ScreenSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}
