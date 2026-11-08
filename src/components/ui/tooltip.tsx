"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

type TooltipGroupValue = {
  openId: string | null
  setOpenId: React.Dispatch<React.SetStateAction<string | null>>
}

const TooltipGroup = React.createContext<TooltipGroupValue | null>(null)
const TooltipIdContext = React.createContext<string | null>(null)
const TooltipShownContext = React.createContext(true)

function TooltipProvider({
  delay = 0,
  children,
  ...props
}: TooltipPrimitive.Provider.Props) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const value = React.useMemo(() => ({ openId, setOpenId }), [openId])

  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      closeDelay={0}
      timeout={0}
      {...props}
    >
      <TooltipGroup.Provider value={value}>{children}</TooltipGroup.Provider>
    </TooltipPrimitive.Provider>
  )
}

function Tooltip({
  open: openProp,
  onOpenChange,
  ...props
}: TooltipPrimitive.Root.Props) {
  const group = React.useContext(TooltipGroup)
  const id = React.useId()
  const controlled = openProp !== undefined
  const open = controlled ? openProp : group ? group.openId === id : undefined
  const setOpenId = group?.setOpenId

  React.useEffect(() => {
    if (!open || controlled || !setOpenId) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setOpenId?.((current) => (current === id ? null : current))
    }

    window.addEventListener("keydown", onKeyDown, true)

    return () => {
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [controlled, id, open, setOpenId])

  const shown = open !== false

  return (
    <TooltipIdContext.Provider value={id}>
      <TooltipShownContext.Provider value={shown}>
        <TooltipPrimitive.Root
          {...props}
          disableHoverablePopup
          open={open}
          onOpenChange={(next, details) => {
            if (setOpenId && !controlled) {
              setOpenId((current) => {
                if (next) {
                  return id
                }

                return current === id ? null : current
              })
            }

            onOpenChange?.(next, details)
          }}
        />
      </TooltipShownContext.Provider>
    </TooltipIdContext.Provider>
  )
}

function TooltipTrigger({
  onBlur,
  onFocus,
  onPointerLeave,
  ...props
}: TooltipPrimitive.Trigger.Props) {
  const group = React.useContext(TooltipGroup)
  const id = React.useContext(TooltipIdContext)

  function closeIfCurrent() {
    if (!group || !id) {
      return
    }

    group.setOpenId((current) => (current === id ? null : current))
  }

  return (
    <TooltipPrimitive.Trigger
      {...props}
      onFocus={(event) => {
        onFocus?.(event)
        if (group && id) {
          group.setOpenId(id)
        }
      }}
      onBlur={(event) => {
        onBlur?.(event)
        closeIfCurrent()
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        closeIfCurrent()
      }}
    />
  )
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 8,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  const shown = React.useContext(TooltipShownContext)
  if (!shown) {
    return null
  }

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={12}
        collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          role="tooltip"
          data-slot="tooltip-content"
          className={cn(
            "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background opacity-100 data-closed:pointer-events-none data-closed:opacity-0 has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
