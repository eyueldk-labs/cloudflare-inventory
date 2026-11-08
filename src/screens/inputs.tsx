import { EllipsisVertical } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  amountToInput,
  formatAmount,
  formatEtb,
  formatSignedAmount,
  gramsNote,
  moneyToInput,
  parseAmount,
  parseMoney,
  todayISO,
  unitForKind,
  valueOf,
  codeNumber,
  type HistoryEntry,
  type Input,
  type InputKind,
} from "@shared/domain"
import { DataTable, type DataTableColumn } from "@/components/app/data-table"
import { DateField, DateText, Fact, FormDrawer, HeaderAction, PageHeader, ReasonDialog, SelectField, TextField } from "@/components/app/kit"
import { SeverityMessage } from "@/components/app/severity"
import { StockLevel, stockLevelSortKey } from "@/components/app/stock-level"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, useAction, useHistory } from "@/lib/api"
import { orgPath, usePanel } from "@/lib/nav"
import { useOrg } from "@/screens/layout"

const kindLabel = (kind: InputKind) => (kind === "material" ? "Material" : "Packaging")
const costSuffix = (unit: "kg" | "pcs") => `ETB / ${unit}`

export function InputsScreen() {
  const { orgId, catalog, isAdmin, canWork } = useOrg()
  const panel = usePanel()
  const [filter, setFilter] = useState<"all" | InputKind | "archived">("all")
  const rows = useMemo(
    () =>
      catalog.inputs.filter((i) =>
        filter === "archived" ? i.archived : !i.archived && (filter === "all" || i.kind === filter)
      ),
    [catalog.inputs, filter]
  )
  const selected = catalog.inputs.find((i) => i.id === panel.id) ?? null

  const columns: DataTableColumn<Input>[] = [
    {
      id: "input",
      header: "Input",
      accessor: (r) => `${r.name} ${r.code}`,
      cell: (r) => (
        <span className="flex flex-col">
          <span>{r.name}</span>
          <span className="text-xs text-muted-foreground">{r.code}</span>
        </span>
      ),
      search: true,
    },
    { id: "code", header: "Code", accessor: (r) => codeNumber(r.code), cell: (r) => r.code, className: "hidden" },
    { id: "kind", header: "Type", accessor: (r) => kindLabel(r.kind) },
    { id: "cost", header: "Unit cost", align: "end", accessor: (r) => r.unitCost, cell: (r) => `${formatEtb(r.unitCost)} / ${r.unit}` },
    { id: "onHand", header: "On hand", align: "end", accessor: (r) => r.onHand, cell: (r) => formatAmount(r.onHand, r.unit) },
    {
      id: "level",
      header: "Stock level",
      accessor: (r) => stockLevelSortKey({ available: r.onHand, lowLevel: r.lowLevel }),
      cell: (r) => <StockLevel available={r.onHand} lowLevel={r.lowLevel} unit={r.unit} />,
    },
  ]

  return (
    <>
      <PageHeader title="Inputs">
        {canWork ? (
          <>
            <HeaderAction label="Stock input" variant="outline" onClick={() => panel.open("stock")} />
            <HeaderAction label="New input" onClick={() => panel.open("new")} />
          </>
        ) : null}
      </PageHeader>
      <DataTable
        columns={columns.filter((c) => c.id !== "code")}
        rows={rows}
        getRowId={(r) => r.id}
        searchPlaceholder="Search inputs"
        emptyTitle={filter === "archived" ? "No archived inputs." : "No inputs yet. Add the materials and packaging you buy."}
        emptyAction={canWork && filter !== "archived" ? <Button size="touch" onClick={() => panel.open("new")}>New input</Button> : undefined}
        initialSort={{ id: "input", desc: false }}
        toolbar={
          <ToggleGroup value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as typeof filter)} className="w-auto" aria-label="Filter inputs">
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="material">Materials</ToggleGroupItem>
            <ToggleGroupItem value="packaging">Packaging</ToggleGroupItem>
            <ToggleGroupItem value="archived">Archived</ToggleGroupItem>
          </ToggleGroup>
        }
        getRowHref={(r) => `${orgPath(orgId, "inputs")}?panel=${isAdmin ? "edit" : "history"}&id=${r.id}`}
        onRowOpen={(r) => panel.open(isAdmin ? "edit" : "history", r.id)}
        rowActions={(r) =>
          [
            canWork && !r.archived ? { id: "stock", label: r.kind === "material" ? "Stock material" : "Stock packaging", onSelect: () => panel.open("stock", r.id) } : null,
            isAdmin ? { id: "edit", label: "Edit", onSelect: () => panel.open("edit", r.id) } : null,
            isAdmin && !r.archived ? { id: "adjust", label: "Adjust count", onSelect: () => panel.open("adjust", r.id) } : null,
            { id: "history", label: "History", onSelect: () => panel.open("history", r.id) },
            isAdmin ? (r.archived ? { id: "restore", label: "Restore", onSelect: () => panel.open("restore", r.id) } : { id: "archive", label: "Archive", onSelect: () => panel.open("archive", r.id) }) : null,
          ].filter((a) => a !== null)
        }
      />

      <NewInputDrawer open={panel.panel === "new" && canWork} onClose={panel.close} />
      <StockDrawer open={panel.panel === "stock" && canWork} input={selected} onClose={panel.close} />
      {selected ? (
        <>
          <EditDrawer open={panel.panel === "edit" && isAdmin} input={selected} onClose={panel.close} />
          <AdjustDrawer open={panel.panel === "adjust" && isAdmin} input={selected} onClose={panel.close} />
          <HistoryDrawer open={panel.panel === "history"} input={selected} onClose={panel.close} />
          <ArchiveDialog input={selected} mode={panel.panel === "archive" ? "archive" : panel.panel === "restore" ? "restore" : null} onClose={panel.close} />
        </>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------

function NewInputDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orgId } = useOrg()
  const [kind, setKind] = useState<InputKind>("material")
  const [name, setName] = useState("")
  const [cost, setCost] = useState("")
  const [low, setLow] = useState("")
  const [opening, setOpening] = useState("")
  const [date, setDate] = useState(todayISO())
  useEffect(() => {
    if (open) {
      setKind("material")
      setName("")
      setCost("")
      setLow("")
      setOpening("")
      setDate(todayISO())
    }
  }, [open])
  const unit = unitForKind(kind)
  const costValue = parseMoney(cost)
  const lowValue = low.trim() ? parseAmount(low, unit, { allowZero: true }) : null
  const openingValue = opening.trim() ? parseAmount(opening, unit) : null
  const errors = {
    name: name.trim() ? null : "Enter a name.",
    cost: cost.trim() && costValue === null ? "Enter a cost, for example 450.00." : null,
    low: low.trim() && lowValue === null ? amountError(unit) : null,
    opening: opening.trim() && openingValue === null ? amountError(unit) : null,
  }
  const action = useAction(orgId, (body: object) => api("/o/" + orgId + "/inputs", { body }), { success: "Input added.", onDone: onClose })
  const valid = !errors.name && !errors.cost && !errors.low && !errors.opening && costValue !== null
  return (
    <FormDrawer
      title="New input"
      open={open}
      onClose={onClose}
      dirty={!!(name || cost || low || opening)}
      canSubmit={valid}
      pending={action.isPending}
      onSubmit={() =>
        action.mutate({ kind, name, unitCost: costValue, lowLevel: lowValue, openingAmount: openingValue, openingDate: date })
      }
    >
      <SelectField
        label="Type"
        value={kind}
        onChange={(v) => setKind(v as InputKind)}
        options={[
          { value: "material", label: "Material (kg)" },
          { value: "packaging", label: "Packaging (pcs)" },
        ]}
      />
      <TextField label="Name" value={name} onChange={setName} error={name ? errors.name : null} autoFocus />
      <TextField label="Unit cost" suffix={costSuffix(unit)} inputMode="decimal" value={cost} onChange={setCost} error={errors.cost} info="The cost of the opening amount. Later, each stock entry updates the weighted average." />
      <TextField
        label="Low level"
        suffix={unit}
        inputMode={unit === "kg" ? "decimal" : "numeric"}
        value={low}
        onChange={setLow}
        error={errors.low}
        note="Optional. You get a Low stock alert at or below this amount."
      />
      <TextField
        label="Opening amount"
        suffix={unit}
        inputMode={unit === "kg" ? "decimal" : "numeric"}
        value={opening}
        onChange={setOpening}
        error={errors.opening}
        note={openingValue ? gramsNote(openingValue, unit) : "Optional. What you have now."}
      />
      {openingValue ? <DateField label="Opening date" value={date} onChange={setDate} /> : null}
    </FormDrawer>
  )
}

function amountError(unit: "kg" | "pcs") {
  return unit === "kg" ? "Enter kg, up to 6 decimals." : "Enter whole pieces."
}

/** Stock material / packaging. Also used to correct a stock entry (void + replacement). */
export function StockDrawer({
  open,
  input,
  onClose,
  correcting,
}: {
  open: boolean
  input: Input | null
  onClose: () => void
  correcting?: HistoryEntry
}) {
  const { orgId, catalog } = useOrg()
  const [inputId, setInputId] = useState("")
  const [amount, setAmount] = useState("")
  const [cost, setCost] = useState("")
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState("")
  const [reason, setReason] = useState("")
  useEffect(() => {
    if (!open) return
    setInputId(input?.id ?? "")
    const unitHere = input?.unit ?? "kg"
    setAmount(correcting ? amountToInput(correcting.amount, unitHere) : "")
    setCost(correcting?.unitCost != null ? moneyToInput(correcting.unitCost) : input ? moneyToInput(input.unitCost) : "")
    setDate(correcting?.date ?? todayISO())
    setNote(correcting?.note ?? "")
    setReason("")
  }, [open, input, correcting])
  const target = catalog.inputs.find((i) => i.id === inputId) ?? null
  const unit = target?.unit ?? "kg"
  const amountValue = amount.trim() ? parseAmount(amount, unit) : null
  const costValue = parseMoney(cost)
  const action = useAction(
    orgId,
    (body: object) =>
      correcting
        ? api(`/o/${orgId}/input-entries/${correcting.id}/void`, { body: { reason, replacement: body } })
        : api(`/o/${orgId}/inputs/${inputId}/stock`, { body }),
    { success: correcting ? "Entry corrected." : "Stock added.", onDone: onClose }
  )
  const errors = {
    amount: amount.trim() && amountValue === null ? amountError(unit) : null,
    cost: cost.trim() && costValue === null ? "Enter a cost, for example 450.00." : null,
  }
  const valid = !!target && amountValue !== null && costValue !== null && !!date && date <= todayISO() && (!correcting || reason.trim().length > 0)
  const options = catalog.inputs.filter((i) => !i.archived).map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))
  const after = target && amountValue ? target.onHand + amountValue - (correcting?.amount ?? 0) : null
  return (
    <FormDrawer
      title={correcting ? "Correct stock entry" : target ? (target.kind === "material" ? "Stock material" : "Stock packaging") : "Stock input"}
      open={open}
      onClose={onClose}
      dirty={correcting ? true : !!(amount || note || (!input && inputId))}
      canSubmit={valid}
      pending={action.isPending}
      submitLabel={correcting ? "Correct" : "Save"}
      onSubmit={() => action.mutate({ amount: amountValue, unitCost: costValue, date, note })}
      summary={target && amountValue && costValue !== null ? <span className="text-muted-foreground">Adds {formatAmount(amountValue, unit)} · {formatEtb(valueOf(amountValue, costValue, unit))}</span> : null}
    >
      {correcting ? <SeverityMessage level="info">The old entry stays in History as void. The corrected entry replaces it.</SeverityMessage> : null}
      {input ? (
        <div className="grid grid-cols-2 gap-4 rounded-lg border p-3">
          <Fact label="Input">{input.name} · {input.code}</Fact>
          <Fact label="On hand">{formatAmount(input.onHand, input.unit)}</Fact>
        </div>
      ) : (
        <SelectField
          label="Input"
          value={inputId}
          onChange={(v) => {
            setInputId(v)
            const picked = catalog.inputs.find((i) => i.id === v)
            if (picked && !cost) setCost(moneyToInput(picked.unitCost))
          }}
          options={options}
          placeholder={options.length ? "Choose an input" : "Add an input first"}
          note={target ? `On hand: ${formatAmount(target.onHand, target.unit)}` : undefined}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Amount"
          suffix={unit}
          inputMode={unit === "kg" ? "decimal" : "numeric"}
          value={amount}
          onChange={setAmount}
          error={errors.amount}
          note={amountValue ? gramsNote(amountValue, unit) : null}
          autoFocus={!!input}
        />
        <TextField label="Unit cost" suffix={costSuffix(unit)} inputMode="decimal" value={cost} onChange={setCost} error={errors.cost} info="Cost per unit for this purchase. It updates the weighted-average unit cost." />
      </div>
      <DateField value={date} onChange={setDate} />
      <TextField label="Note / supplier" value={note} onChange={setNote} placeholder="Optional" />
      {correcting ? <TextField label="Reason for correction" value={reason} onChange={setReason} placeholder="Required" /> : null}
      {after !== null && after < 0 ? <SeverityMessage level="error">This correction would take on hand below zero. Adjust the count instead.</SeverityMessage> : null}
    </FormDrawer>
  )
}

function EditDrawer({ open, input, onClose }: { open: boolean; input: Input; onClose: () => void }) {
  const { orgId } = useOrg()
  const [name, setName] = useState(input.name)
  const [low, setLow] = useState("")
  useEffect(() => {
    if (open) {
      setName(input.name)
      setLow(input.lowLevel === null ? "" : amountToInput(input.lowLevel, input.unit))
    }
  }, [open, input])
  const lowValue = low.trim() ? parseAmount(low, input.unit, { allowZero: true }) : null
  const dirty = name !== input.name || lowValue !== input.lowLevel
  const action = useAction(orgId, (body: object) => api(`/o/${orgId}/inputs/${input.id}`, { method: "PATCH", body }), { success: "Saved.", onDone: onClose })
  return (
    <FormDrawer
      title={`Edit ${input.name}`}
      open={open}
      onClose={onClose}
      dirty={dirty}
      canSubmit={!!name.trim() && !(low.trim() && lowValue === null)}
      pending={action.isPending}
      onSubmit={() => action.mutate({ name, lowLevel: lowValue })}
    >
      <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 sm:grid-cols-3">
        <Fact label="Code">{input.code}</Fact>
        <Fact label="Type">{kindLabel(input.kind)}</Fact>
        <Fact label="On hand">{formatAmount(input.onHand, input.unit)}</Fact>
        <Fact label="Unit cost">{formatEtb(input.unitCost)} / {input.unit}</Fact>
        <Fact label="Value">{formatEtb(valueOf(input.onHand, input.unitCost, input.unit))}</Fact>
        {input.archived ? <Fact label="Archived">{input.archiveReason}</Fact> : null}
      </div>
      <TextField label="Name" value={name} onChange={setName} error={name.trim() ? null : "Enter a name."} />
      <TextField
        label="Low level"
        suffix={input.unit}
        inputMode={input.unit === "kg" ? "decimal" : "numeric"}
        value={low}
        onChange={setLow}
        error={low.trim() && lowValue === null ? amountError(input.unit) : null}
        note="Empty means no Low stock alert."
      />
      <p className="text-xs text-muted-foreground">On hand and unit cost come from entries. Use Stock or Adjust count to change them.</p>
      <HistoryList input={input} />
    </FormDrawer>
  )
}

function AdjustDrawer({ open, input, onClose }: { open: boolean; input: Input; onClose: () => void }) {
  const { orgId } = useOrg()
  const [counted, setCounted] = useState("")
  const [date, setDate] = useState(todayISO())
  const [reason, setReason] = useState("")
  useEffect(() => {
    if (open) {
      setCounted("")
      setDate(todayISO())
      setReason("")
    }
  }, [open])
  const value = counted.trim() ? parseAmount(counted, input.unit, { allowZero: true }) : null
  const action = useAction(orgId, (body: object) => api(`/o/${orgId}/inputs/${input.id}/adjust`, { body }), { success: "Count saved.", onDone: onClose })
  const diff = value !== null ? value - input.onHand : null
  return (
    <FormDrawer
      title={`Adjust count: ${input.name}`}
      open={open}
      onClose={onClose}
      dirty={!!(counted || reason)}
      canSubmit={value !== null && diff !== 0 && !!reason.trim()}
      pending={action.isPending}
      onSubmit={() => action.mutate({ counted: value, date, reason })}
    >
      <SeverityMessage level="info">Use this after a physical count. For a typing mistake, correct the entry in History.</SeverityMessage>
      <Fact label="On hand now">{formatAmount(input.onHand, input.unit)}</Fact>
      <TextField
        label="Counted amount"
        suffix={input.unit}
        inputMode={input.unit === "kg" ? "decimal" : "numeric"}
        value={counted}
        onChange={setCounted}
        error={counted.trim() && value === null ? amountError(input.unit) : null}
        note={diff !== null ? `Change: ${formatSignedAmount(diff, input.unit)}` : null}
        autoFocus
      />
      <DateField value={date} onChange={setDate} />
      <TextField label="Reason" value={reason} onChange={setReason} placeholder="Required" />
    </FormDrawer>
  )
}

function HistoryDrawer({ open, input, onClose }: { open: boolean; input: Input; onClose: () => void }) {
  return (
    <FormDrawer title={`History: ${input.name}`} open={open} onClose={onClose} dirty={false} wide>
      <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 sm:grid-cols-4">
        <Fact label="Code">{input.code}</Fact>
        <Fact label="On hand">{formatAmount(input.onHand, input.unit)}</Fact>
        <Fact label="Unit cost">{formatEtb(input.unitCost)} / {input.unit}</Fact>
        <Fact label="Low level">{input.lowLevel === null ? "None" : formatAmount(input.lowLevel, input.unit)}</Fact>
      </div>
      <HistoryList input={input} />
    </FormDrawer>
  )
}

const typeLabel: Record<string, string> = { added: "Added", used: "Used", adjusted: "Adjusted", edit: "Edited" }

function HistoryList({ input }: { input: Input }) {
  const { orgId, isAdmin } = useOrg()
  const history = useHistory(orgId, "input", input.id)
  const [correcting, setCorrecting] = useState<HistoryEntry | null>(null)
  const [voiding, setVoiding] = useState<HistoryEntry | null>(null)
  const voidAction = useAction(orgId, (v: { id: string; reason: string }) => api(`/o/${orgId}/input-entries/${v.id}/void`, { body: { reason: v.reason } }), {
    success: "Entry voided.",
    onDone: () => setVoiding(null),
  })
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">History</h3>
      {history.isPending ? (
        <Skeleton className="h-24" />
      ) : history.isError ? (
        <p className="text-sm text-muted-foreground">{history.error.message}</p>
      ) : history.data.history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {history.data.history.map((h) => (
            <li key={h.id} className="flex items-start gap-3 p-3 text-sm">
              <div className={`flex min-w-0 flex-1 flex-col gap-1 ${h.voided ? "text-muted-foreground line-through" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{typeLabel[h.type] ?? h.type}</Badge>
                  {h.kind === "entry" ? (
                    <span className="font-medium tabular-nums">{formatSignedAmount(h.amount, input.unit)}</span>
                  ) : (
                    <span>
                      {h.field}: {h.oldValue} → {h.newValue}
                    </span>
                  )}
                  {h.unitCost !== null ? <span className="text-muted-foreground tabular-nums">@ {formatEtb(h.unitCost)} / {input.unit}</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <DateText iso={h.date} />
                  <span>· {h.byName}</span>
                  {h.note ? <span>· {h.note}</span> : null}
                </div>
              </div>
              {h.voided ? (
                <span className="text-xs text-muted-foreground">
                  Void: {h.voidReason} ({h.voidByName})
                </span>
              ) : isAdmin && h.kind === "entry" && h.type !== "used" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Entry actions" />}>
                    <EllipsisVertical />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {h.type === "added" ? <DropdownMenuItem onClick={() => setCorrecting(h)}>Correct</DropdownMenuItem> : null}
                    <DropdownMenuItem onClick={() => setVoiding(h)}>Void</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <StockDrawer open={!!correcting} input={input} correcting={correcting ?? undefined} onClose={() => setCorrecting(null)} />
      <ReasonDialog
        open={!!voiding}
        title="Void this entry?"
        description="The entry stays in History, struck through. On hand changes back."
        confirmLabel="Void"
        pending={voidAction.isPending}
        onCancel={() => setVoiding(null)}
        onConfirm={(reason) => voiding && voidAction.mutate({ id: voiding.id, reason })}
      />
    </section>
  )
}

function ArchiveDialog({ input, mode, onClose }: { input: Input; mode: "archive" | "restore" | null; onClose: () => void }) {
  const { orgId } = useOrg()
  const action = useAction(orgId, (body: object) => api(`/o/${orgId}/inputs/${input.id}/${mode}`, { body }), {
    success: mode === "archive" ? "Input archived." : "Input restored.",
    onDone: onClose,
  })
  return (
    <ReasonDialog
      open={mode !== null}
      title={mode === "archive" ? `Archive ${input.name}?` : `Restore ${input.name}?`}
      description={mode === "archive" ? "It leaves the list and the pickers. History stays. The code is never reused." : "It comes back to the list and the pickers."}
      confirmLabel={mode === "archive" ? "Archive" : "Restore"}
      destructive={mode === "archive"}
      pending={action.isPending}
      onCancel={onClose}
      onConfirm={(reason) => action.mutate({ reason })}
    />
  )
}
