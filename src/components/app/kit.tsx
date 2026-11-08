import { Info, Plus } from "lucide-react"
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react"
import Kenat from "kenat"
import { focusRing } from "@/blocks/focus-ring"
import { DrawerFooter, ResponsiveDrawer } from "@/components/app/responsive-drawer"
import { SeverityMessage } from "@/components/app/severity"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatDate, todayISO } from "@shared/domain"

// ---------------------------------------------------------------------------
// Page header

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div data-slot="page-header" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight wrap-break-word">{title}</h1>
      {children ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">{children}</div> : null}
    </div>
  )
}

export function HeaderAction({ label, onClick, variant = "default" }: { label: string; onClick: () => void; variant?: "default" | "outline" }) {
  return (
    <Button size="touch" variant={variant} className="w-full sm:w-auto" onClick={onClick}>
      <Plus data-icon="inline-start" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Fields: label on top, input below, feedback under the field.

export function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button type="button" variant="ghost" size="icon" className={cn("size-8 text-muted-foreground md:pointer-fine:size-6", focusRing)} aria-label={label} />}
      >
        <Info />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  )
}

type FieldProps = {
  id: string
  label: string
  info?: string
  error?: string | null
  warning?: string | null
  note?: ReactNode
  children: ReactNode
  className?: string
}

export function Field({ id, label, info, error, warning, note, children, className }: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex min-h-6 items-center gap-1">
        <Label htmlFor={id}>{label}</Label>
        {info ? <InfoTip label={`About ${label}`} text={info} /> : null}
      </div>
      {children}
      {note ? <div className="text-xs text-muted-foreground">{note}</div> : null}
      {error ? (
        <SeverityMessage level="error" role="alert" className="text-xs">
          {error}
        </SeverityMessage>
      ) : warning ? (
        <SeverityMessage level="warning" role="status" className="text-xs">
          {warning}
        </SeverityMessage>
      ) : null}
    </div>
  )
}

type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | null
  warning?: string | null
  note?: ReactNode
  info?: string
  suffix?: string
  placeholder?: string
  type?: string
  inputMode?: "decimal" | "numeric" | "text" | "email"
  autoComplete?: string
  autoFocus?: boolean
  className?: string
  disabled?: boolean
}

export function TextField({ label, value, onChange, error, warning, note, info, suffix, className, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <Field id={id} label={label} info={info} error={error} warning={warning} note={note} className={className}>
      <div className="relative">
        <Input
          id={id}
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(suffix && "pr-12", rest.type === "date" && "dark:[color-scheme:dark]")}
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
    </Field>
  )
}

export function DateField({ label = "Date", value, onChange, error }: { label?: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  return (
    <TextField
      label={label}
      type="date"
      value={value}
      onChange={onChange}
      error={error ?? (value > todayISO() ? "The date cannot be in the future." : null)}
      note={value ? <DateText iso={value} /> : null}
    />
  )
}

export function TextAreaField({ label, value, onChange, error, placeholder }: { label: string; value: string; onChange: (v: string) => void; error?: string | null; placeholder?: string }) {
  const id = useId()
  return (
    <Field id={id} label={label} error={error}>
      <Textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} />
    </Field>
  )
}

export type Option = { value: string; label: string }

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose",
  error,
  info,
  note,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  error?: string | null
  info?: string
  note?: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <Field id={id} label={label} error={error} info={info} note={note} className={className}>
      <SelectInput id={id} value={value} onChange={onChange} options={options} placeholder={placeholder} invalid={!!error} />
    </Field>
  )
}

export function SelectInput({ id, value, onChange, options, placeholder = "Choose", invalid, label }: { id?: string; value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string; invalid?: boolean; label?: string }) {
  return (
    <Select
      items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
      value={value === "" ? null : value}
      onValueChange={(next) => typeof next === "string" && onChange(next)}
    >
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid ? true : undefined} aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------------------
// Dates: Gregorian text, Ethiopian date in a tooltip on the adjacent icon.

const ET_MONTHS = ["መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን"]

export function ethiopianDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  try {
    const et = new Kenat(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).getEthiopian()
    return `${ET_MONTHS[et.month - 1]} ${et.day}, ${et.year} (Ethiopian)`
  } catch {
    return iso
  }
}

export function DateText({ iso, className }: { iso: string; className?: string }) {
  const gregorian = formatDate(iso)
  const ethiopian = ethiopianDate(iso)
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      <span>{gregorian}</span>
      <Tooltip>
        <TooltipTrigger
          closeOnClick={false}
          onClick={(e) => e.currentTarget.focus()}
          render={<Button type="button" variant="ghost" size="icon-xs" className="relative z-1 size-5 text-muted-foreground" aria-label={`${gregorian}, Ethiopian calendar ${ethiopian}`} />}
        >
          <Info className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{ethiopian}</TooltipContent>
      </Tooltip>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Drawers: open as the edit form. Close / Escape / Cancel ask first when the form is dirty.

export function FormDrawer({
  title,
  open,
  onClose,
  dirty,
  onSubmit,
  submitLabel = "Save",
  canSubmit = true,
  pending = false,
  wide,
  summary,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  dirty: boolean
  onSubmit?: () => void
  submitLabel?: string
  canSubmit?: boolean
  pending?: boolean
  wide?: boolean
  summary?: ReactNode
  children: ReactNode
}) {
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    if (!open) setAsking(false)
  }, [open])

  function requestClose() {
    if (dirty && !pending) setAsking(true)
    else onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (canSubmit && !pending) onSubmit?.()
  }

  return (
    <>
      <ResponsiveDrawer
        open={open && !asking}
        wide={wide}
        title={title}
        onEscape={() => {
          requestClose()
          return true
        }}
        onOpenChange={(next) => {
          if (!next && !asking) requestClose()
        }}
      >
        <form id="drawer-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
          {children}
        </form>
        <DrawerFooter>
          {summary ? <div className="mr-auto flex min-w-0 basis-full items-center text-sm sm:basis-auto">{summary}</div> : null}
          <Button type="button" variant="outline" size="touch" onClick={requestClose}>
            {onSubmit ? "Cancel" : "Close"}
          </Button>
          {onSubmit ? (
            <Button type="submit" form="drawer-form" size="touch" disabled={!canSubmit || pending || !dirty}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          ) : null}
        </DrawerFooter>
      </ResponsiveDrawer>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Your changes are not saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" size="touch" onClick={() => setAsking(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              size="touch"
              onClick={() => {
                setAsking(false)
                onClose()
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Confirmation that requires a reason (Void, Archive). */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
  destructive = true,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
  destructive?: boolean
}) {
  const [reason, setReason] = useState("")
  useEffect(() => {
    if (open) setReason("")
  }, [open])
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (reason.trim()) onConfirm(reason.trim())
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <TextField label="Reason" value={reason} onChange={setReason} autoFocus placeholder="Required" />
          <AlertDialogFooter>
            <Button type="button" variant="outline" size="touch" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} size="touch" disabled={!reason.trim() || pending}>
              {pending ? "Saving…" : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Read-only label + value pair used in drawers. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm tabular-nums">{children}</span>
    </div>
  )
}
