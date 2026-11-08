// Responsive drawer: right sheet on desktop, bottom drawer under 768px.
// Desktop is a right Sheet. A viewport under 768px is a vaul bottom drawer.
// Header, scroll body, and footer are one column. Only the body scrolls.
// Vaul moves the drawer above the phone keyboard, so the footer stays in reach.
// One aria-modal dialog, a first-frame focus ring on Close, and a tab trap.
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react"
import { createPortal } from "react-dom"
import { Drawer } from "vaul"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import { focusRing } from "@/blocks/focus-ring"
import { touchSize } from "@/blocks/touch"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { trapTabKeyDown } from "@/components/ui/trap-tab"

type ResponsiveDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  titleRef?: React.Ref<HTMLHeadingElement>
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  /** Return true to keep the drawer open (for example, Escape leaves a nested step). */
  onEscape?: () => boolean
}

const DrawerFooterContext = createContext<HTMLDivElement | null>(null)

export function DrawerFooter({ children }: { children: ReactNode }) {
  const host = useContext(DrawerFooterContext)

  if (!host) {
    return null
  }

  return createPortal(children, host)
}

export function ResponsiveDrawer({
  open,
  onOpenChange,
  title,
  titleRef,
  children,
  footer,
  wide = false,
  onEscape,
}: ResponsiveDrawerProps) {
  const mobile = useMobileDrawer()
  const headingRef = useRef<HTMLElement | null>(null)
  const [footerNode, setFooterNode] = useState<HTMLDivElement | null>(null)

  // Paired totals can wrap in the sale footer. Keep toasts above its actual height.
  useLayoutEffect(() => {
    if (!open || !footerNode) return
    const update = () => {
      document.body.style.setProperty("--toast-bottom", `${footerNode.offsetHeight + 16}px`)
    }
    const observer = new ResizeObserver(update)
    observer.observe(footerNode)
    update()
    return () => {
      observer.disconnect()
      document.body.style.removeProperty("--toast-bottom")
    }
  }, [open, footerNode])

  function setHeading(node: HTMLElement | null) {
    headingRef.current = node
    assignRef(titleRef, node as HTMLHeadingElement | null)
  }

  useEffect(() => {
    if (!open) {
      return
    }

    const frame = requestAnimationFrame(() => {
      focusHeadingIfIdle(headingRef.current)
    })

    return () => cancelAnimationFrame(frame)
  }, [open])

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && onEscape?.()) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    trapTabKeyDown(event)
  }

  const frame = (
    <DrawerFooterContext.Provider value={footerNode}>
      {mobile ? (
        <div className="flex items-start justify-between gap-3 px-4 pt-3 pr-14">
          <Drawer.Title
            ref={setHeading}
            tabIndex={-1}
            className="font-heading text-base leading-none font-medium outline-none"
          >
            {title}
          </Drawer.Title>
        </div>
      ) : (
        <SheetHeader className="shrink-0 pr-12">
          <SheetTitle ref={setHeading} tabIndex={-1} className="outline-none">
            {title}
          </SheetTitle>
        </SheetHeader>
      )}
      <div
        data-slot="drawer-body"
        className="min-h-0 flex-auto overflow-y-auto overscroll-contain px-4 py-4"
      >
        {children}
      </div>
      <div
        ref={setFooterNode}
        data-slot="drawer-footer"
        className={cn(
          "flex shrink-0 flex-wrap justify-end gap-2 border-t bg-popover px-4 py-3 empty:hidden",
          mobile && "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        )}
      >
        {footer}
      </div>
    </DrawerFooterContext.Provider>
  )

  if (mobile) {
    return (
      <Drawer.Root
        open={open}
        onOpenChange={onOpenChange}
        handleOnly
        repositionInputs
        shouldScaleBackground={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/10" />
          <Drawer.Content
            data-slot="sheet-content"
            data-drawer="bottom"
            aria-modal="true"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              focusHeadingIfIdle(headingRef.current)
            }}
            onKeyDownCapture={onKeyDown}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-xl border-t bg-popover text-popover-foreground outline-none"
          >
            <Drawer.Handle className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted" />
            {frame}
            <CloseButton onClick={() => onOpenChange(false)} />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-drawer="side"
        initialFocus={false}
        onKeyDownCapture={onKeyDown}
        className={cn(
          "h-full min-h-0 w-full gap-0 overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-md",
          wide && "data-[side=right]:sm:max-w-2xl"
        )}
      >
        {frame}
      </SheetContent>
    </Sheet>
  )
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Close"
      className={cn("absolute top-3 right-3 z-10", touchSize, focusRing)}
      onClick={onClick}
    >
      <XIcon />
    </Button>
  )
}

function focusHeadingIfIdle(heading: HTMLElement | null) {
  if (!heading) {
    return
  }

  const dialog = heading.closest("[role='dialog']")
  const active = document.activeElement
  if (dialog && active instanceof Node && dialog.contains(active)) {
    return
  }

  heading.focus()
}

function assignRef(ref: Ref<HTMLHeadingElement> | undefined, node: HTMLHeadingElement | null) {
  if (!ref) {
    return
  }

  if (typeof ref === "function") {
    ref(node)
    return
  }

  ref.current = node
}

export function useMobileDrawer() {
  const query = "(max-width: 767px)"
  const [mobile, setMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  )

  useLayoutEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMobile(media.matches)
    media.addEventListener("change", onChange)
    setMobile(media.matches)
    return () => media.removeEventListener("change", onChange)
  }, [])

  return mobile
}
