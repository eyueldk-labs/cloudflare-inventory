import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { cn } from "@/lib/utils"

function ToggleGroup({
  className,
  ...props
}: ToggleGroupPrimitive.Props) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn("flex w-full gap-1", className)}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  ...props
}: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:pointer-fine:h-8 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
