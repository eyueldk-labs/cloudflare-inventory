import { EllipsisVertical, Plus, Star, Trash2 } from "lucide-react"
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
  priceFor,
  productionNeeds,
  productUnitCost,
  todayISO,
  type HistoryEntry,
  type Product,
} from "@shared/domain"
import { DataTable, type DataTableColumn } from "@/components/app/data-table"
import { DateField, DateText, Fact, Field, FormDrawer, HeaderAction, PageHeader, ReasonDialog, SelectField, SelectInput, TextField } from "@/components/app/kit"
import { SeverityMessage } from "@/components/app/severity"
import { StockLevel, stockLevelSortKey } from "@/components/app/stock-level"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input as TextInput } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, applyPatch, useAction, useHistory, type MutationResult } from "@/lib/api"
import { orgPath, usePanel } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { useOrg } from "@/screens/layout"

export function ProductsScreen() {
  const { orgId, catalog, isAdmin, canWork } = useOrg()
  const panel = usePanel()
  const [archived, setArchived] = useState(false)
  const inputsById = useMemo(() => new Map(catalog.inputs.map((i) => [i.id, i])), [catalog.inputs])
  const rows = useMemo(() => catalog.products.filter((p) => p.archived === archived), [catalog.products, archived])
  const selected = catalog.products.find((p) => p.id === panel.id) ?? null

  const columns: DataTableColumn<Product>[] = [
    {
      id: "product",
      header: "Product",
      accessor: (r) => `${r.name} ${r.code}`,
      cell: (r) => (
        <span className="flex flex-col">
          <span>{r.name}</span>
          <span className="text-xs text-muted-foreground">{r.code}</span>
        </span>
      ),
    },
    { id: "cost", header: "Unit cost", align: "end", accessor: (r) => productUnitCost(r.lines, r.additionalCost, inputsById), cell: (r) => formatEtb(productUnitCost(r.lines, r.additionalCost, inputsById)) },
    { id: "price", header: "Price", align: "end", accessor: (r) => priceFor(r), cell: (r) => formatEtb(priceFor(r)) },
    { id: "onHand", header: "On hand", align: "end", accessor: (r) => r.onHand, cell: (r) => formatAmount(r.onHand, "pcs") },
    {
      id: "level",
      header: "Stock level",
      accessor: (r) => stockLevelSortKey({ available: r.onHand, lowLevel: r.lowLevel }),
      cell: (r) => <StockLevel available={r.onHand} lowLevel={r.lowLevel} unit="pcs" />,
    },
  ]

  return (
    <>
      <PageHeader title="Products">
        {canWork ? <HeaderAction label="Stock product" variant={isAdmin ? "outline" : "default"} onClick={() => panel.open("produce")} /> : null}
        {isAdmin ? <HeaderAction label="New product" onClick={() => panel.open("new")} /> : null}
      </PageHeader>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        searchPlaceholder="Search products"
        emptyTitle={archived ? "No archived products." : "No products yet. A product holds the inputs for one unit."}
        emptyAction={isAdmin && !archived ? <Button size="touch" onClick={() => panel.open("new")}>New product</Button> : undefined}
        initialSort={{ id: "product", desc: false }}
        toolbar={
          <ToggleGroup value={[archived ? "archived" : "active"]} onValueChange={(v) => v[0] && setArchived(v[0] === "archived")} className="w-auto" aria-label="Filter products">
            <ToggleGroupItem value="active">Active</ToggleGroupItem>
            <ToggleGroupItem value="archived">Archived</ToggleGroupItem>
          </ToggleGroup>
        }
        getRowHref={(r) => `${orgPath(orgId, "products")}?panel=${isAdmin ? "edit" : "history"}&id=${r.id}`}
        onRowOpen={(r) => panel.open(isAdmin ? "edit" : "history", r.id)}
        rowActions={(r) =>
          [
            canWork && !r.archived ? { id: "produce", label: "Stock product", onSelect: () => panel.open("produce", r.id) } : null,
            isAdmin ? { id: "edit", label: "Edit", onSelect: () => panel.open("edit", r.id) } : null,
            isAdmin ? { id: "duplicate", label: "Duplicate", onSelect: () => panel.open("duplicate", r.id) } : null,
            { id: "history", label: "History", onSelect: () => panel.open("history", r.id) },
            isAdmin && !r.archived ? { id: "adjust", label: "Adjust count", onSelect: () => panel.open("adjust", r.id) } : null,
            isAdmin ? (r.archived ? { id: "restore", label: "Restore", onSelect: () => panel.open("restore", r.id) } : { id: "archive", label: "Archive", onSelect: () => panel.open("archive", r.id) }) : null,
          ].filter((a) => a !== null)
        }
      />

      <ProductDrawer open={isAdmin && (panel.panel === "new" || ((panel.panel === "edit" || panel.panel === "duplicate") && !!selected))} mode={panel.panel === "edit" ? "edit" : panel.panel === "duplicate" ? "duplicate" : "new"} product={selected} onClose={panel.close} />
      <ProduceDrawer open={canWork && panel.panel === "produce"} product={selected} onClose={panel.close} />
      {selected ? (
        <>
          <AdjustDrawer open={isAdmin && panel.panel === "adjust"} product={selected} onClose={panel.close} />
          <FormDrawer title={`History: ${selected.name}`} open={panel.panel === "history"} onClose={panel.close} dirty={false} wide>
            <ProductFacts product={selected} />
            <ProductHistory product={selected} />
          </FormDrawer>
          <ArchiveDialog product={selected} mode={panel.panel === "archive" ? "archive" : panel.panel === "restore" ? "restore" : null} onClose={panel.close} />
        </>
      ) : null}
    </>
  )
}

function ProductFacts({ product }: { product: Product }) {
  const { catalog } = useOrg()
  const inputsById = new Map(catalog.inputs.map((i) => [i.id, i]))
  return (
    <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 sm:grid-cols-4">
      <Fact label="Code">{product.code}</Fact>
      <Fact label="On hand">{formatAmount(product.onHand, "pcs")}</Fact>
      <Fact label="Unit cost">{formatEtb(productUnitCost(product.lines, product.additionalCost, inputsById))}</Fact>
      <Fact label="Composition">Version {product.version}</Fact>
    </div>
  )
}

// ---------------------------------------------------------------------------
// New / Edit / Duplicate

type LineDraft = { key: string; inputId: string; amount: string }
type PriceDraft = { key: string; schemeId: string; amount: string }
function snapshot(name: string, lines: LineDraft[], prices: PriceDraft[], def: string, extra: string, low: string, opening: string) {
  return JSON.stringify([name, lines.map((l) => [l.inputId, l.amount]), prices.map((p) => [p.schemeId, p.amount]), def, extra, low, opening])
}
let keySeq = 0
const nextKey = () => `k${++keySeq}`

function ProductDrawer({ open, mode, product, onClose }: { open: boolean; mode: "new" | "edit" | "duplicate"; product: Product | null; onClose: () => void }) {
  const { orgId, catalog } = useOrg()
  const source = mode === "new" ? null : product
  const inputsById = useMemo(() => new Map(catalog.inputs.map((i) => [i.id, i])), [catalog.inputs])
  const [name, setName] = useState("")
  const [lines, setLines] = useState<LineDraft[]>([])
  const [prices, setPrices] = useState<PriceDraft[]>([])
  const [defaultScheme, setDefaultScheme] = useState("")
  const [extra, setExtra] = useState("")
  const [low, setLow] = useState("")
  const [opening, setOpening] = useState("")
  const [initial, setInitial] = useState("")
  const [newScheme, setNewScheme] = useState("")

  useEffect(() => {
    if (!open) return
    const firstScheme = catalog.schemes[0]?.id ?? ""
    const n = source ? (mode === "duplicate" ? `${source.name} copy` : source.name) : ""
    const ls = source
      ? source.lines.map((l) => ({ key: nextKey(), inputId: l.inputId, amount: amountToInput(l.amount, inputsById.get(l.inputId)?.unit ?? "kg") }))
      : [{ key: nextKey(), inputId: "", amount: "" }]
    const ps = source ? source.prices.map((p) => ({ key: nextKey(), schemeId: p.schemeId, amount: moneyToInput(p.amount) })) : [{ key: nextKey(), schemeId: firstScheme, amount: "" }]
    const def = source?.defaultSchemeId ?? firstScheme
    const ex = source ? moneyToInput(source.additionalCost) : ""
    const lo = source?.lowLevel != null ? String(source.lowLevel) : ""
    setName(n)
    setLines(ls)
    setPrices(ps)
    setDefaultScheme(def)
    setExtra(ex)
    setLow(lo)
    setOpening("")
    setNewScheme("")
    setInitial(snapshot(n, ls, ps, def, ex, lo, ""))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, source?.id])

  const parsedLines = lines.map((l) => {
    const input = inputsById.get(l.inputId)
    return { ...l, input, value: input && l.amount.trim() ? parseAmount(l.amount, input.unit) : null }
  })
  const parsedPrices = prices.map((p) => ({ ...p, value: p.amount.trim() ? parseMoney(p.amount) : null }))
  const extraValue = extra.trim() ? parseMoney(extra) : 0
  const lowValue = low.trim() ? parseAmount(low, "pcs", { allowZero: true }) : null
  const openingValue = opening.trim() ? parseAmount(opening, "pcs", { allowZero: true }) : null
  const composition = parsedLines.filter((l) => l.input && l.value).map((l) => ({ inputId: l.inputId, amount: l.value! }))
  const unitCost = productUnitCost(composition, extraValue ?? 0, inputsById)
  const defaultPrice = parsedPrices.find((p) => p.schemeId === defaultScheme)?.value ?? null
  const profit = defaultPrice !== null ? defaultPrice - unitCost : null
  const margin = defaultPrice ? (profit! / defaultPrice) * 100 : null
  const duplicateInputs = new Set(lines.map((l) => l.inputId)).size !== lines.length
  const duplicatePrices = new Set(prices.map((p) => p.schemeId)).size !== prices.length

  const valid =
    !!name.trim() &&
    composition.length === lines.length &&
    lines.length > 0 &&
    !duplicateInputs &&
    parsedPrices.length > 0 &&
    parsedPrices.every((p) => p.schemeId && p.value !== null) &&
    !duplicatePrices &&
    prices.some((p) => p.schemeId === defaultScheme) &&
    extraValue !== null &&
    !(low.trim() && lowValue === null) &&
    !(opening.trim() && openingValue === null)

  const action = useAction(
    orgId,
    (body: object) => (mode === "edit" && source ? api(`/o/${orgId}/products/${source.id}`, { method: "PATCH", body }) : api(`/o/${orgId}/products`, { body })),
    { success: mode === "edit" ? "Product saved." : "Product added.", onDone: onClose }
  )
  const addScheme = useAction(orgId, (n: string) => api<MutationResult>(`/o/${orgId}/schemes`, { body: { name: n } }), {
    onDone: (r) => {
      setNewScheme("")
      if (r.id) setPrices((list) => [...list, { key: nextKey(), schemeId: r.id!, amount: "" }])
    },
  })

  const inputOptions = catalog.inputs.filter((i) => !i.archived).map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))
  const schemeOptions = catalog.schemes.map((s) => ({ value: s.id, label: s.name }))
  const title = mode === "edit" ? `Edit ${source?.name ?? ""}` : mode === "duplicate" ? "Duplicate product" : "New product"
  const dirty = mode === "duplicate" || initial !== snapshot(name, lines, prices, defaultScheme, extra, low, opening)

  return (
    <FormDrawer
      title={title}
      open={open}
      onClose={onClose}
      wide
      dirty={dirty}
      canSubmit={valid}
      pending={action.isPending}
      onSubmit={() =>
        action.mutate({
          name,
          lines: composition,
          prices: parsedPrices.map((p) => ({ schemeId: p.schemeId, amount: p.value })),
          defaultSchemeId: defaultScheme,
          additionalCost: extraValue,
          lowLevel: lowValue,
          openingUnits: openingValue ?? 0,
        })
      }
      summary={
        <span className="text-muted-foreground">
          Unit cost <span className="text-foreground tabular-nums">{formatEtb(unitCost)}</span>
          {profit !== null ? (
            <>
              {" "}· Profit <span className={cn("tabular-nums", profit < 0 ? "text-destructive" : "text-foreground")}>{formatEtb(profit)}</span>
              {margin !== null ? ` (${margin.toFixed(1)}%)` : ""}
            </>
          ) : null}
        </span>
      }
    >
      {mode === "edit" ? <ProductFacts product={source!} /> : null}
      <TextField label="Name" value={name} onChange={setName} error={name || mode !== "new" ? (name.trim() ? null : "Enter a name.") : null} autoFocus={mode !== "edit"} />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Composition for one unit</h3>
          {mode === "edit" ? <span className="text-xs text-muted-foreground">A change saves a new version. Past runs keep theirs.</span> : null}
        </div>
        {inputOptions.length === 0 ? (
          <SeverityMessage level="info">
            Add inputs first. <a className="underline" href={`${orgPath(orgId, "inputs")}?panel=new`}>New input</a>
          </SeverityMessage>
        ) : null}
        {parsedLines.map((line, index) => {
          const unit = line.input?.unit ?? "kg"
          const amountError = line.amount.trim() && line.value === null ? (unit === "kg" ? "Enter kg, up to 6 decimals." : "Enter whole pieces.") : null
          const dup = line.inputId && lines.findIndex((l) => l.inputId === line.inputId) !== index ? "This input is already listed." : null
          return (
            <div key={line.key} className="grid grid-cols-[1fr_8.5rem_auto] items-start gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_10rem_auto]">
              <Field id={`line-${line.key}`} label={`Input ${index + 1}`} error={dup}>
                <SelectInput id={`line-${line.key}`} value={line.inputId} onChange={(v) => setLines((ls) => ls.map((l) => (l.key === line.key ? { ...l, inputId: v } : l)))} options={inputOptions} placeholder="Choose an input" />
              </Field>
              <Field id={`amt-${line.key}`} label="Per unit" error={amountError} note={line.value ? gramsNote(line.value, unit) : null}>
                <div className="relative">
                  <TextInput
                    id={`amt-${line.key}`}
                    inputMode={unit === "kg" ? "decimal" : "numeric"}
                    value={line.amount}
                    onChange={(e) => setLines((ls) => ls.map((l) => (l.key === line.key ? { ...l, amount: e.target.value } : l)))}
                    className="pr-10"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{unit}</span>
                </div>
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-8 size-11 md:pointer-fine:size-8"
                aria-label={`Remove input ${index + 1}`}
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
              >
                <Trash2 />
              </Button>
            </div>
          )
        })}
        <Button type="button" variant="outline" size="touch" className="self-start" onClick={() => setLines((ls) => [...ls, { key: nextKey(), inputId: "", amount: "" }])}>
          <Plus data-icon="inline-start" /> Add input
        </Button>
        <TextField label="Additional cost per unit" suffix="ETB" inputMode="decimal" value={extra} onChange={setExtra} error={extra.trim() && extraValue === null ? "Enter an amount, for example 5.00." : null} info="Labelling, handling, and other costs per finished unit." />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Prices</h3>
        {parsedPrices.map((price, index) => (
          <div key={price.key} className="grid grid-cols-[1fr_8.5rem_auto_auto] items-end gap-2 sm:grid-cols-[1fr_10rem_auto_auto]">
            <Field id={`scheme-${price.key}`} label={`Price name ${index + 1}`}>
              <SelectInput id={`scheme-${price.key}`} value={price.schemeId} onChange={(v) => setPrices((ps) => ps.map((p) => (p.key === price.key ? { ...p, schemeId: v } : p)))} options={schemeOptions} />
            </Field>
            <Field id={`price-${price.key}`} label="Price">
              <div className="relative">
                <TextInput id={`price-${price.key}`} inputMode="decimal" value={price.amount} aria-invalid={price.amount.trim() && price.value === null ? true : undefined} onChange={(e) => setPrices((ps) => ps.map((p) => (p.key === price.key ? { ...p, amount: e.target.value } : p)))} className="pr-12" />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">ETB</span>
              </div>
            </Field>
            <Button
              type="button"
              variant={price.schemeId === defaultScheme ? "secondary" : "ghost"}
              size="icon"
              className="size-11 md:pointer-fine:size-8"
              aria-label={price.schemeId === defaultScheme ? "Default price" : "Make default"}
              aria-pressed={price.schemeId === defaultScheme}
              onClick={() => setDefaultScheme(price.schemeId)}
            >
              <Star className={price.schemeId === defaultScheme ? "fill-current text-primary" : ""} />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-11 md:pointer-fine:size-8" aria-label={`Remove price ${index + 1}`} disabled={prices.length === 1} onClick={() => setPrices((ps) => ps.filter((p) => p.key !== price.key))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        {duplicatePrices ? <SeverityMessage level="error" className="text-xs">Each price name can show only one time.</SeverityMessage> : null}
        <div className="flex flex-wrap items-end gap-2">
          {prices.length < catalog.schemes.length ? (
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => {
                const unused = catalog.schemes.find((s) => !prices.some((p) => p.schemeId === s.id))
                if (unused) setPrices((ps) => [...ps, { key: nextKey(), schemeId: unused.id, amount: "" }])
              }}
            >
              <Plus data-icon="inline-start" /> Add price
            </Button>
          ) : null}
          <div className="flex items-end gap-2">
            <TextField label="New price name" value={newScheme} onChange={setNewScheme} placeholder="For example, Distributor" />
            <Button type="button" variant="outline" size="touch" disabled={!newScheme.trim() || addScheme.isPending} onClick={() => addScheme.mutate(newScheme.trim())}>
              Add
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Price names are shared by every product. The star marks the default price. A price change applies to new sales only.</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Low level" suffix="pcs" inputMode="numeric" value={low} onChange={setLow} error={low.trim() && lowValue === null ? "Enter whole pieces." : null} note="Optional. Low stock alert at or below this." />
        {mode !== "edit" ? (
          <TextField label="Opening stock" suffix="pcs" inputMode="numeric" value={opening} onChange={setOpening} error={opening.trim() && openingValue === null ? "Enter whole pieces." : null} note="Optional. Finished units you have now." />
        ) : null}
      </div>
      {mode === "edit" && source ? <ProductHistory product={source} /> : null}
    </FormDrawer>
  )
}

// ---------------------------------------------------------------------------
// Stock product (production run)

export function ProduceDrawer({ open, product, onClose, correcting }: { open: boolean; product: Product | null; onClose: () => void; correcting?: HistoryEntry }) {
  const { orgId, catalog } = useOrg()
  const [productId, setProductId] = useState("")
  const [units, setUnits] = useState("")
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState("")
  const [reason, setReason] = useState("")
  useEffect(() => {
    if (!open) return
    setProductId(product?.id ?? "")
    setUnits(correcting ? String(correcting.amount) : "")
    setDate(correcting?.date ?? todayISO())
    setNote(correcting?.note ?? "")
    setReason("")
  }, [open, product, correcting])
  const target = catalog.products.find((p) => p.id === productId) ?? null
  const inputsById = useMemo(() => new Map(catalog.inputs.map((i) => [i.id, i])), [catalog.inputs])
  const unitsValue = units.trim() ? parseAmount(units, "pcs") : null
  // When correcting, the old run's inputs come back first.
  const adjustedInputs = useMemo(() => {
    if (!correcting || !target) return inputsById
    const copy = new Map([...inputsById].map(([k, v]) => [k, { ...v }]))
    for (const l of target.lines) {
      const i = copy.get(l.inputId)
      if (i) i.onHand += l.amount * correcting.amount
    }
    return copy
  }, [correcting, target, inputsById])
  const needs = target && unitsValue ? productionNeeds(target.lines, unitsValue, adjustedInputs) : []
  const short = needs.filter((n) => n.short > 0)
  const action = useAction(
    orgId,
    (body: object) =>
      correcting ? api(`/o/${orgId}/product-entries/${correcting.id}/void`, { body: { reason, replacement: body } }) : api(`/o/${orgId}/products/${productId}/produce`, { body }),
    { success: correcting ? "Run corrected." : "Stock added.", onDone: onClose }
  )
  const valid = !!target && unitsValue !== null && short.length === 0 && date <= todayISO() && (!correcting || !!reason.trim())
  const totals = needs.reduce(
    (acc, n) => {
      const unit = inputsById.get(n.inputId)?.unit
      if (unit === "kg") acc.kg += n.needed
      else acc.pcs += n.needed
      return acc
    },
    { kg: 0, pcs: 0 }
  )
  const productOptions = catalog.products.filter((p) => !p.archived).map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))
  return (
    <FormDrawer
      title={correcting ? "Correct production run" : "Stock product"}
      open={open}
      onClose={onClose}
      wide
      dirty={correcting ? true : !!(units || note || (!product && productId))}
      canSubmit={valid}
      pending={action.isPending}
      submitLabel={correcting ? "Correct" : "Stock product"}
      onSubmit={() => action.mutate({ units: unitsValue, date, note })}
      summary={
        target && unitsValue ? (
          short.length ? (
            <SeverityMessage level="error">Not enough stock. Nothing is saved.</SeverityMessage>
          ) : (
            <span className="text-muted-foreground">
              Make {unitsValue} {target.name}. Uses {[totals.kg ? formatAmount(totals.kg, "kg") : null, totals.pcs ? formatAmount(totals.pcs, "pcs") : null].filter(Boolean).join(", ")}.
            </span>
          )
        ) : null
      }
    >
      {product ? (
        <div className="grid grid-cols-2 gap-4 rounded-lg border p-3">
          <Fact label="Product">{product.name} · {product.code}</Fact>
          <Fact label="On hand">{formatAmount(product.onHand, "pcs")}</Fact>
        </div>
      ) : (
        <SelectField label="Product" value={productId} onChange={setProductId} options={productOptions} placeholder={productOptions.length ? "Choose a product" : "Add a product first"} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Pieces to make" suffix="pcs" inputMode="numeric" value={units} onChange={setUnits} error={units.trim() && unitsValue === null ? "Enter whole pieces, 1 or more." : null} autoFocus={!!product} />
        <DateField value={date} onChange={setDate} />
      </div>
      <TextField label="Note" value={note} onChange={setNote} placeholder="Optional, for example a batch number" />
      {correcting ? <TextField label="Reason for correction" value={reason} onChange={setReason} placeholder="Required" /> : null}
      {target ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Inputs needed</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">Input</th>
                  <th className="p-2 text-right font-medium">Needed</th>
                  <th className="p-2 text-right font-medium">On hand</th>
                  <th className="p-2 text-right font-medium">Short</th>
                </tr>
              </thead>
              <tbody>
                {(needs.length ? needs : productionNeeds(target.lines, 0, adjustedInputs)).map((n) => {
                  const input = inputsById.get(n.inputId)
                  const unit = input?.unit ?? "kg"
                  return (
                    <tr key={n.inputId} className={cn("border-b last:border-0", n.short > 0 && "text-severity-error")}>
                      <td className="p-2">{input?.name ?? "Unknown"}</td>
                      <td className="p-2 text-right tabular-nums">{formatAmount(n.needed, unit)}</td>
                      <td className="p-2 text-right tabular-nums">{formatAmount(n.onHand, unit)}</td>
                      <td className="p-2 text-right tabular-nums">{n.short > 0 ? formatAmount(n.short, unit) : "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </FormDrawer>
  )
}

function AdjustDrawer({ open, product, onClose }: { open: boolean; product: Product; onClose: () => void }) {
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
  const value = counted.trim() ? parseAmount(counted, "pcs", { allowZero: true }) : null
  const diff = value !== null ? value - product.onHand : null
  const action = useAction(orgId, (body: object) => api(`/o/${orgId}/products/${product.id}/adjust`, { body }), { success: "Count saved.", onDone: onClose })
  return (
    <FormDrawer
      title={`Adjust count: ${product.name}`}
      open={open}
      onClose={onClose}
      dirty={!!(counted || reason)}
      canSubmit={value !== null && diff !== 0 && !!reason.trim()}
      pending={action.isPending}
      onSubmit={() => action.mutate({ counted: value, date, reason })}
    >
      <Fact label="On hand now">{formatAmount(product.onHand, "pcs")}</Fact>
      <TextField label="Counted units" suffix="pcs" inputMode="numeric" value={counted} onChange={setCounted} note={diff !== null ? `Change: ${formatSignedAmount(diff, "pcs")}` : null} autoFocus />
      <DateField value={date} onChange={setDate} />
      <TextField label="Reason" value={reason} onChange={setReason} placeholder="Required" />
    </FormDrawer>
  )
}

const typeLabel: Record<string, string> = { made: "Produced", sold: "Sold", adjusted: "Adjusted", edit: "Edited", version: "Composition" }

function ProductHistory({ product }: { product: Product }) {
  const { orgId, isAdmin, catalog } = useOrg()
  const history = useHistory(orgId, "product", product.id)
  const [correcting, setCorrecting] = useState<HistoryEntry | null>(null)
  const [voiding, setVoiding] = useState<HistoryEntry | null>(null)
  const voidAction = useAction(orgId, (v: { id: string; reason: string }) => api(`/o/${orgId}/product-entries/${v.id}/void`, { body: { reason: v.reason } }), {
    success: "Entry voided.",
    onDone: () => setVoiding(null),
  })
  const inputsById = new Map(catalog.inputs.map((i) => [i.id, i]))
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">History</h3>
      {history.isPending ? (
        <Skeleton className="h-24" />
      ) : history.isError ? (
        <p className="text-sm text-muted-foreground">{history.error.message}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {history.data.history.map((h) => {
            const version = h.kind === "version" ? history.data.versions?.find((v) => v.id === h.id) : null
            return (
              <li key={h.id} className="flex items-start gap-3 p-3 text-sm">
                <div className={cn("flex min-w-0 flex-1 flex-col gap-1", h.voided && "text-muted-foreground line-through")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{typeLabel[h.type] ?? h.type}</Badge>
                    {h.kind === "entry" ? <span className="font-medium tabular-nums">{formatSignedAmount(h.amount, "pcs")}</span> : null}
                    {h.kind === "edit" ? (
                      <span>
                        {h.field}: {h.oldValue} → {h.newValue}
                      </span>
                    ) : null}
                    {h.kind === "version" ? <span>Version {h.version}</span> : null}
                    {h.saleCode ? <span className="text-muted-foreground">{h.saleCode}</span> : null}
                    {h.type === "made" && h.version ? <span className="text-muted-foreground">composition v{h.version}</span> : null}
                  </div>
                  {version ? (
                    <div className="text-xs text-muted-foreground">
                      {version.lines.map((l) => `${inputsById.get(l.inputId)?.name ?? "?"} ${formatAmount(l.amount, inputsById.get(l.inputId)?.unit ?? "kg")}`).join(" · ")}
                      {version.additionalCost ? ` · Additional ${formatEtb(version.additionalCost)}` : ""}
                    </div>
                  ) : null}
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
                ) : isAdmin && h.kind === "entry" && (h.type === "made" || h.type === "adjusted") ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Entry actions" />}>
                      <EllipsisVertical />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {h.type === "made" ? <DropdownMenuItem onClick={() => setCorrecting(h)}>Correct</DropdownMenuItem> : null}
                      <DropdownMenuItem onClick={() => setVoiding(h)}>Void</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <ProduceDrawer open={!!correcting} product={product} correcting={correcting ?? undefined} onClose={() => setCorrecting(null)} />
      <ReasonDialog
        open={!!voiding}
        title="Void this entry?"
        description={voiding?.type === "made" ? "The inputs go back and the units go away. Refused when the units are already sold." : "On hand changes back."}
        confirmLabel="Void"
        pending={voidAction.isPending}
        onCancel={() => setVoiding(null)}
        onConfirm={(reason) => voiding && voidAction.mutate({ id: voiding.id, reason })}
      />
    </section>
  )
}

function ArchiveDialog({ product, mode, onClose }: { product: Product; mode: "archive" | "restore" | null; onClose: () => void }) {
  const { orgId } = useOrg()
  const action = useAction(orgId, (body: object) => api(`/o/${orgId}/products/${product.id}/${mode}`, { body }), {
    success: mode === "archive" ? "Product archived." : "Product restored.",
    onDone: onClose,
  })
  return (
    <ReasonDialog
      open={mode !== null}
      title={mode === "archive" ? `Archive ${product.name}?` : `Restore ${product.name}?`}
      description={mode === "archive" ? "It leaves the list and the pickers. History stays. The code is never reused." : "It comes back to the list and the pickers."}
      confirmLabel={mode === "archive" ? "Archive" : "Restore"}
      destructive={mode === "archive"}
      pending={action.isPending}
      onCancel={onClose}
      onConfirm={(reason) => action.mutate({ reason })}
    />
  )
}

export { applyPatch }
