import { cn } from "@/lib/utils"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// AlertDialog and Dialog share Base UI's popup parts and the shadcn styles.
const AlertDialog = AlertDialogPrimitive.Root
function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof DialogContent>) {
  return <DialogContent showCloseButton={false} className={cn("pointer-events-auto", className)} {...props} />
}

export {
  AlertDialog,
  AlertDialogContent,
  DialogDescription as AlertDialogDescription,
  DialogFooter as AlertDialogFooter,
  DialogHeader as AlertDialogHeader,
  DialogTitle as AlertDialogTitle,
}
