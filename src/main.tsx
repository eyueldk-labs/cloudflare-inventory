import "./index.css"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { queryClient } from "@/lib/api"
import { router } from "@/router"

// Plain <a href> links inside shared components navigate in-app instead of reloading the page.
document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
  if (!anchor || anchor.target || anchor.hasAttribute("download") || anchor.origin !== window.location.origin) return
  if (anchor.pathname.startsWith("/api/")) return
  event.preventDefault()
  router.navigate({ href: anchor.pathname + anchor.search + anchor.hash })
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={300}>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
)
