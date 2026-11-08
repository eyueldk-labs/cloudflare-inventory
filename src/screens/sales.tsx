import { ChevronLeft, ChevronRight, Plus, Printer, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  formatAmount,
  formatDate,
  formatEtb,
  formatMonth,
  moneyToInput,
  monthKey,
  parseAmount,
  parseMoney,
  priceFor,
  todayISO,
  codeNumber,
  type Org,
  type Sale,
} from "@shared/domain"
import { DataTable, type DataTableColumn } from "@/components/app/data-table"
import { DateField, DateText, Fact, Field, FormDrawer, HeaderAction, PageHeader, ReasonDialog, SelectInput, TextAreaField, TextField } from "@/components/app/kit"
import { SeverityBadge, SeverityMessage } from "@/components/app/severity"
import { Button } from "@/components/ui/button"
import { Input as TextInput } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, useAction, useSales } from "@/lib/api"
import { orgPath, usePanel } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { useOrg } from "@/screens/layout"

export function linesSummary(sale: Sale) {
  const first = sale.lines[0]?.productName ?? "No lines"
  return sale.lines.length > 1 ? `${first} +${sale.lines.length - 1} more` : first
}

export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number) as [number, number]
    const d = new Date(y, m - 1 + delta, 1)
    onChange(monthKey(d))
  }
  const isCurrent = month >= monthKey()
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Month">
      <Button type="button" variant="outline" size="icon" className="size-11 md:pointer-fine:size-8" aria-label="Previous month" onClick={() => shift(-1)}>
        <ChevronLeft />
      </Button>
      <span className="min-w-24 text-center text-sm tabular-nums">{formatMonth(month)}</span>
      <Button type="button" variant="outline" size="icon" className="size-11 md:pointer-fine:size-8" aria-label="Next month" disabled={isCurrent} onClick={() => shift(1)}>
        <ChevronRight />
      </Button>
    </div>
  )
}

export function SalesScreen() {
  const { orgId, canWork } = useOrg()
  const panel = usePanel()
  const month = panel.month ?? monthKey()
  const sales = useSales(orgId, month)
  const [status, setStatus] = useState<"all" | "sold" | "void">("all")
  const rows = useMemo(() => (sales.data ?? []).filter((s) => status === "all" || s.status === status), [sales.data, status])
  const selected = sales.data?.find((s) => s.id === panel.id) ?? null

  const columns: DataTableColumn<Sale>[] = [
    {
      id: "sale",
      header: "Sale",
      accessor: (r) => `${linesSummary(r)} ${r.code} ${r.buyerNote}`,
      cell: (r) => (
        <span className="flex flex-col">
          <span className={cn(r.status === "void" && "line-through text-muted-foreground")}>{linesSummary(r)}</span>
          <span className="text-xs text-muted-foreground">{r.code}</span>
        </span>
      ),
    },
    { id: "date", header: "Date", accessor: (r) => `${r.date}-${String(codeNumber(r.code)).padStart(9, "0")}`, cell: (r) => <DateText iso={r.date} /> },
    { id: "items", header: "Items", align: "end", accessor: (r) => r.lines.length },
    { id: "qty", header: "Qty", align: "end", accessor: (r) => r.qty },
    { id: "total", header: "Total", align: "end", accessor: (r) => r.total, cell: (r) => formatEtb(r.total) },
    {
      id: "profit",
      header: "Profit",
      align: "end",
      accessor: (r) => r.total - r.cost,
      cell: (r) =>
        r.status === "void" ? (
          <SeverityBadge level="info">Void</SeverityBadge>
        ) : (
          <span className={cn(r.total - r.cost < 0 && "text-destructive")}>{formatEtb(r.total - r.cost)}</span>
        ),
    },
  ]

  const active = (sales.data ?? []).filter((s) => s.status === "sold")
  const total = active.reduce((sum, s) => sum + s.total, 0)
  const profit = active.reduce((sum, s) => sum + s.total - s.cost, 0)

  return (
    <>
      <PageHeader title="Sales">{canWork ? <HeaderAction label="Record sale" onClick={() => panel.open("new")} /> : null}</PageHeader>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <MonthPicker month={month} onChange={panel.setMonth} />
        <span>
          {active.length} {active.length === 1 ? "sale" : "sales"} · <span className="text-foreground tabular-nums">{formatEtb(total)}</span> · Profit{" "}
          <span className={cn("tabular-nums", profit < 0 ? "text-destructive" : "text-foreground")}>{formatEtb(profit)}</span>
        </span>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        status={sales.isPending ? "loading" : sales.isError ? "error" : "ready"}
        onRetry={() => sales.refetch()}
        searchPlaceholder="Search sales"
        emptyTitle={`No sales in ${formatMonth(month)}.`}
        emptyAction={canWork ? <Button size="touch" onClick={() => panel.open("new")}>Record sale</Button> : undefined}
        initialSort={{ id: "date", desc: true }}
        toolbar={
          <ToggleGroup value={[status]} onValueChange={(v) => v[0] && setStatus(v[0] as typeof status)} className="w-auto" aria-label="Filter by status">
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="sold">Sold</ToggleGroupItem>
            <ToggleGroupItem value="void">Void</ToggleGroupItem>
          </ToggleGroup>
        }
        getRowHref={(r) => `${orgPath(orgId, "sales")}?month=${month}&panel=sale&id=${r.id}`}
        onRowOpen={(r) => panel.open("sale", r.id)}
      />
      <SaleFormDrawer open={canWork && panel.panel === "new"} onClose={panel.close} />
      {selected ? <SaleDetail sale={selected} panel={panel.panel} onClose={panel.close} onOpen={panel.open} /> : null}
    </>
  )
}

// ---------------------------------------------------------------------------

type LineDraft = { key: string; productId: string; qty: string; schemeId: string; custom: string }
let seq = 0
const nextKey = () => `l${++seq}`
const CUSTOM = "custom"

export function SaleFormDrawer({ open, onClose, correcting }: { open: boolean; onClose: () => void; correcting?: Sale }) {
  const { orgId, catalog } = useOrg()
  const [lines, setLines] = useState<LineDraft[]>([])
  const [date, setDate] = useState(todayISO())
  const [buyerNote, setBuyerNote] = useState("")
  const [reason, setReason] = useState("")
  useEffect(() => {
    if (!open) return
    setLines(
      correcting
        ? correcting.lines.map((l) => ({ key: nextKey(), productId: l.productId, qty: String(l.qty), schemeId: l.schemeId ?? CUSTOM, custom: l.schemeId ? "" : moneyToInput(l.unitPrice) }))
        : [{ key: nextKey(), productId: "", qty: "", schemeId: "", custom: "" }]
    )
    setDate(correcting?.date ?? todayISO())
    setBuyerNote(correcting?.buyerNote ?? "")
    setReason("")
  }, [open, correcting])

  const productsById = useMemo(() => new Map(catalog.products.map((p) => [p.id, p])), [catalog.products])
  const schemeName = (id: string) => catalog.schemes.find((s) => s.id === id)?.name ?? "Price"
  // Units from the sale being corrected come back before the new copy is checked.
  const returned = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of correcting?.lines ?? []) map.set(l.productId, (map.get(l.productId) ?? 0) + l.qty)
    return map
  }, [correcting])

  const parsed = lines.map((l) => {
    const product = productsById.get(l.productId)
    const qty = l.qty.trim() ? parseAmount(l.qty, "pcs") : null
    const unitPrice = !product ? null : l.schemeId === CUSTOM ? (l.custom.trim() ? parseMoney(l.custom) : null) : product.prices.find((p) => p.schemeId === l.schemeId)?.amount ?? null
    return { ...l, product, qtyValue: qty, unitPrice, lineTotal: qty !== null && unitPrice !== null ? qty * unitPrice : null }
  })
  const qtyByProduct = new Map<string, number>()
  for (const l of parsed) if (l.product && l.qtyValue) qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.qtyValue)
  const available = (id: string) => (productsById.get(id)?.onHand ?? 0) + (returned.get(id) ?? 0)
  const lineError = (l: (typeof parsed)[number]) => {
    if (!l.product) return null
    if (l.qty.trim() && l.qtyValue === null) return "Enter whole pieces, 1 or more."
    const need = qtyByProduct.get(l.productId) ?? 0
    if (need > available(l.productId)) return `Not enough stock: ${need} needed, ${available(l.productId)} on hand.`
    if (l.schemeId === CUSTOM && l.custom.trim() && l.unitPrice === null) return "Enter a price, for example 480.00."
    return null
  }
  const errors = parsed.map(lineError)
  const total = parsed.reduce((s, l) => s + (l.lineTotal ?? 0), 0)
  const qty = parsed.reduce((s, l) => s + (l.qtyValue ?? 0), 0)
  const complete = parsed.every((l) => l.product && l.qtyValue && l.unitPrice !== null)
  const valid = parsed.length > 0 && complete && errors.every((e) => !e) && date <= todayISO() && (!correcting || !!reason.trim())

  const action = useAction(
    orgId,
    (body: object) => (correcting ? api(`/o/${orgId}/sales/${correcting.id}/correct`, { body: { ...body, reason } }) : api(`/o/${orgId}/sales`, { body })),
    { success: correcting ? "Sale corrected." : "Sale recorded.", onDone: onClose }
  )

  const productOptions = catalog.products.filter((p) => !p.archived).map((p) => ({ value: p.id, label: `${p.name} (${p.onHand + (returned.get(p.id) ?? 0)} pcs)` }))
  const update = (key: string, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  return (
    <FormDrawer
      title={correcting ? `Correct ${correcting.code}` : "Record sale"}
      open={open}
      onClose={onClose}
      wide
      dirty={correcting ? true : lines.some((l) => l.productId || l.qty) || !!buyerNote}
      canSubmit={valid}
      pending={action.isPending}
      submitLabel={correcting ? "Correct sale" : "Record sale"}
      onSubmit={() =>
        action.mutate({
          date,
          buyerNote,
          lines: parsed.map((l) => ({ productId: l.productId, qty: l.qtyValue, schemeId: l.schemeId === CUSTOM ? null : l.schemeId, unitPrice: l.unitPrice })),
        })
      }
      summary={
        <span className="text-muted-foreground">
          Sell {qty} {qty === 1 ? "item" : "items"}, <span className="text-foreground tabular-nums">{formatEtb(total)}</span>
        </span>
      }
    >
      {correcting ? <SeverityMessage level="info">The original sale stays as void. The corrected copy gets a new code.</SeverityMessage> : null}
      {productOptions.length === 0 ? (
        <SeverityMessage level="info">
          Add a product and stock it first. <a className="underline" href={orgPath(orgId, "products")}>Products</a>
        </SeverityMessage>
      ) : null}
      {parsed.map((line, index) => {
        const schemeOptions = [
          ...(line.product?.prices ?? []).map((p) => ({ value: p.schemeId, label: `${schemeName(p.schemeId)} · ${formatEtb(p.amount)}` })),
          { value: CUSTOM, label: "Custom price" },
        ]
        return (
          <div key={line.key} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Line {index + 1}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm tabular-nums">{line.lineTotal !== null ? formatEtb(line.lineTotal) : "—"}</span>
                <Button type="button" variant="ghost" size="icon" className="size-11 md:pointer-fine:size-8" aria-label={`Remove line ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}>
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Field id={`p-${line.key}`} label="Product">
                <SelectInput
                  id={`p-${line.key}`}
                  value={line.productId}
                  options={productOptions}
                  placeholder="Choose a product"
                  onChange={(v) => {
                    const p = productsById.get(v)
                    update(line.key, { productId: v, schemeId: p ? p.defaultSchemeId : "" })
                  }}
                />
              </Field>
              <Field id={`q-${line.key}`} label="Qty" note={line.product ? `Available ${available(line.productId)} pcs` : null}>
                <div className="relative">
                  <TextInput id={`q-${line.key}`} inputMode="numeric" value={line.qty} aria-invalid={errors[index] ? true : undefined} onChange={(e) => update(line.key, { qty: e.target.value })} className="pr-10" />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">pcs</span>
                </div>
              </Field>
            </div>
            {errors[index] ? (
              <SeverityMessage level="error" role="alert" className="text-xs">
                {errors[index]}
              </SeverityMessage>
            ) : null}
            {line.product ? (
              <div className={cn("grid gap-3", line.schemeId === CUSTOM && "sm:grid-cols-[1fr_10rem]")}>
                <Field id={`s-${line.key}`} label="Price">
                  <SelectInput id={`s-${line.key}`} value={line.schemeId} options={schemeOptions} onChange={(v) => update(line.key, { schemeId: v, custom: v === CUSTOM ? moneyToInput(priceFor(line.product!)) : "" })} />
                </Field>
                {line.schemeId === CUSTOM ? (
                  <Field id={`c-${line.key}`} label="Custom unit price">
                    <div className="relative">
                      <TextInput id={`c-${line.key}`} inputMode="decimal" value={line.custom} onChange={(e) => update(line.key, { custom: e.target.value })} className="pr-12" />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">ETB</span>
                    </div>
                  </Field>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
      <Button type="button" variant="outline" size="touch" className="self-start" onClick={() => setLines((ls) => [...ls, { key: nextKey(), productId: "", qty: "", schemeId: "", custom: "" }])}>
        <Plus data-icon="inline-start" /> Add line
      </Button>
      <DateField value={date} onChange={setDate} />
      <TextAreaField label="Buyer note" value={buyerNote} onChange={setBuyerNote} placeholder="Optional" />
      {correcting ? <TextField label="Reason for correction" value={reason} onChange={setReason} placeholder="Required" /> : null}
    </FormDrawer>
  )
}

function SaleDetail({ sale, panel, onClose, onOpen }: { sale: Sale; panel?: string; onClose: () => void; onOpen: (p: string, id?: string) => void }) {
  const { orgId, isAdmin, catalog } = useOrg()
  const voidAction = useAction(orgId, (reason: string) => api(`/o/${orgId}/sales/${sale.id}/void`, { body: { reason } }), { success: "Sale voided.", onDone: onClose })
  const profit = sale.total - sale.cost
  return (
    <>
      <FormDrawer title={`Sale ${sale.code}`} open={panel === "sale"} onClose={onClose} dirty={false} wide>
        {sale.status === "void" ? (
          <SeverityMessage level="warning">
            Void: {sale.voidReason} ({sale.voidByName})
          </SeverityMessage>
        ) : null}
        <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 sm:grid-cols-4">
          <Fact label="Date"><DateText iso={sale.date} /></Fact>
          <Fact label="Total">{formatEtb(sale.total)}</Fact>
          <Fact label="Profit"><span className={cn(profit < 0 && "text-destructive")}>{formatEtb(profit)}</span></Fact>
          <Fact label="Recorded by">{sale.byName}</Fact>
          {sale.buyerNote ? <div className="col-span-full"><Fact label="Buyer note">{sale.buyerNote}</Fact></div> : null}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="p-2 text-left font-medium">Product</th>
                <th className="p-2 text-right font-medium">Qty</th>
                <th className="p-2 text-right font-medium">Unit price</th>
                <th className="p-2 text-right font-medium">Total</th>
                <th className="p-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {sale.lines.map((l, i) => {
                const lineProfit = l.lineTotal - l.unitCost * l.qty
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-2">
                      <span className="block">{l.productName}</span>
                      <span className="text-xs text-muted-foreground">{l.productCode} · {l.priceName}</span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{l.qty}</td>
                    <td className="p-2 text-right tabular-nums">{formatEtb(l.unitPrice)}</td>
                    <td className="p-2 text-right tabular-nums">{formatEtb(l.lineTotal)}</td>
                    <td className={cn("p-2 text-right tabular-nums", lineProfit < 0 && "text-destructive")}>{formatEtb(lineProfit)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="touch" onClick={() => printInvoice(sale, catalog.org)}>
            <Printer data-icon="inline-start" /> Print invoice
          </Button>
          {isAdmin && sale.status === "sold" ? (
            <>
              <Button type="button" variant="outline" size="touch" onClick={() => onOpen("correct", sale.id)}>
                Correct
              </Button>
              <Button type="button" variant="outline" size="touch" onClick={() => onOpen("void", sale.id)}>
                Void
              </Button>
            </>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">Profit uses the unit cost saved with each line. Later cost changes do not change it.</p>
      </FormDrawer>
      <SaleFormDrawer open={isAdmin && panel === "correct"} correcting={sale} onClose={onClose} />
      <ReasonDialog
        open={isAdmin && panel === "void"}
        title={`Void ${sale.code}?`}
        description="The sale stays in the list as void. Its units go back to stock."
        confirmLabel="Void sale"
        pending={voidAction.isPending}
        onCancel={onClose}
        onConfirm={(reason) => voidAction.mutate(reason)}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Invoice: a standalone, escaped print document. Save as PDF from the print dialog.

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

export function printInvoice(sale: Sale, org: Org) {
  const orgLines = [org.name, org.contactName, org.invoiceAddress, org.contactEmail, org.contactPhone].filter((l) => l.trim())
  const rows = sale.lines
    .map((l) => `<tr><td>${esc(l.productName)}</td><td class="n">${esc(formatAmount(l.qty, "pcs"))}</td><td class="n">${esc(formatEtb(l.unitPrice))}</td><td class="n">${esc(formatEtb(l.lineTotal))}</td></tr>`)
    .join("")
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(sale.code)}</title><style>
*{box-sizing:border-box}body{margin:0;padding:36px;color:#25232b;background:#fff;font:14px/1.5 system-ui,sans-serif}
h1{font-size:28px;margin:0 0 4px}header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #6b5685;padding-bottom:20px}
header p{margin:0}.muted{color:#6b6575}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:8px;border-bottom:1px solid #e5e2ea;text-align:left}
.n{text-align:right;font-variant-numeric:tabular-nums}tfoot td{font-weight:600;border-bottom:0}.void{color:#b42318;font-weight:600;margin-top:16px}
@media print{body{padding:0}}</style></head><body>
<header><div>${orgLines.map((l, i) => (i === 0 ? `<p><strong>${esc(l)}</strong></p>` : `<p class="muted">${esc(l)}</p>`)).join("")}</div>
<div style="text-align:right"><h1>${sale.status === "void" ? "VOID — " : ""}Invoice</h1><p>${esc(sale.code)}</p><p class="muted">${esc(formatDate(sale.date))}</p></div></header>
${sale.buyerNote.trim() ? `<p style="margin-top:16px"><span class="muted">Buyer:</span> ${esc(sale.buyerNote)}</p>` : ""}
<table><thead><tr><th>Product</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Total</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td colspan="3" class="n">Total</td><td class="n">${esc(formatEtb(sale.total))}</td></tr></tfoot></table>
${sale.status === "void" ? `<p class="void">This invoice is void. ${esc(sale.voidReason)}</p>` : ""}
<script>window.onload=function(){window.print()}</script></body></html>`
  const win = window.open("", "_blank", "noopener=no,width=900,height=1000")
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
}
