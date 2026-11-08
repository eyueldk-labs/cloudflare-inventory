import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  InfoIcon,
  Loader2Icon,
} from "lucide-react"

import { ErrorStatusIcon, SuccessStatusIcon, WarningStatusIcon } from "@/components/app/status-icons"

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      offset={{ bottom: "var(--toast-bottom, 16px)", right: 16 }}
      mobileOffset={{ bottom: "var(--toast-bottom, 12px)", right: 12, left: 12 }}
      className="toaster group"
      icons={{
        success: <SuccessStatusIcon className="size-4" />,
        info: <InfoIcon className="size-4 text-severity-info" />,
        warning: <WarningStatusIcon className="size-4" />,
        error: <ErrorStatusIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={toastVars({
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
      })}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          success: "!text-severity-success",
          error: "!text-red-600",
          warning: "!text-severity-warning",
          info: "!text-severity-info",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

function toastVars(vars: Record<string, string>): React.CSSProperties {
  // CSS custom properties are valid inline styles. React's style type omits them.
  return vars as React.CSSProperties
}
