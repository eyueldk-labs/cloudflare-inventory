import { useMemo, useState } from "react"
import { formatEtb, formatMonth, formatSignedAmount, monthKey, type AuditRow } from "@shared/domain"
import { DataTable, type DataTableColumn } from "@/components/app/data-table"
import { DateText, PageHeader, SelectInput } from "@/components/app/kit"
import { useAudit } from "@/lib/api"
import { orgPath, usePanel } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { useOrg } from "@/screens/layout"
import { MonthPicker } from "@/screens/sales"

function itemHref(orgId: string, row: AuditRow, month: string) {
  if (row.itemType === "sale") return `${orgPath(orgId, "sales")}?month=${row.date.slice(0, 7) || month}&panel=sale&id=${row.itemId}`
  if (row.itemType === "input") return `${orgPath(orgId, "inputs")}?panel=history&id=${row.itemId}`
  if (row.itemType === "product") return `${orgPath(orgId, "products")}?panel=history&id=${row.itemId}`
  return orgPath(orgId, "settings")
}

export function AuditScreen() {
  const { orgId } = useOrg()
  const panel = usePanel()
  const month = panel.month ?? monthKey()
  const audit = useAudit(orgId, month)
  const [movement, setMovement] = useState("all")
  const [person, setPerson] = useState("all")
  const movements = useMemo(() => [...new Set((audit.data ?? []).map((r) => r.movement))].sort(), [audit.data])
  const people = useMemo(() => [...new Set((audit.data ?? []).map((r) => r.byName))].sort(), [audit.data])
  const rows = useMemo(
    () => (audit.data ?? []).filter((r) => (movement === "all" || r.movement === movement) && (person === "all" || r.byName === person)),
    [audit.data, movement, person]
  )

  const columns: DataTableColumn<AuditRow>[] = [
    {
      id: "date",
      header: "Date",
      accessor: (r) => `${r.date}-${String(r.createdAt).padStart(15, "0")}`,
      cell: (r) => <DateText iso={r.date} />,
    },
    {
      id: "item",
      header: "Item",
      accessor: (r) => `${r.itemName} ${r.itemCode}`,
      cell: (r) => (
        <a href={itemHref(orgId, r, month)} className="relative z-10 flex flex-col hover:underline">
          <span className={cn(r.voided && "line-through text-muted-foreground")}>{r.itemName}</span>
          <span className="text-xs text-muted-foreground">{r.itemCode}</span>
        </a>
      ),
    },
    { id: "movement", header: "Movement", accessor: (r) => r.movement, cell: (r) => <span className={cn(r.voided && "line-through text-muted-foreground")}>{r.movement}{r.voided ? " (void)" : ""}</span> },
    { id: "person", header: "Person", accessor: (r) => r.byName },
    { id: "detail", header: "Detail", accessor: (r) => (r.voided ? `${r.detail} Void: ${r.voidReason}` : r.detail), cell: (r) => <span className="line-clamp-2 max-w-72 text-muted-foreground">{r.voided ? `Void: ${r.voidReason}` : r.detail || "—"}</span> },
    {
      id: "amount",
      header: "Amount",
      align: "end",
      accessor: (r) => r.amount ?? 0,
      cell: (r) => (
        <span className={cn("flex flex-col items-end tabular-nums", r.voided && "line-through text-muted-foreground")}>
          {r.amount !== null && r.unit ? <span>{formatSignedAmount(r.amount, r.unit)}</span> : <span>—</span>}
          {r.money !== null ? <span className="text-xs text-muted-foreground">{formatEtb(r.money)}</span> : null}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Audit" />
      <p className="-mt-4 text-sm text-muted-foreground">Every stock entry, production run, sale, count, void, and edit. Nothing is ever deleted.</p>
      <div className="flex flex-wrap items-center gap-3">
        <MonthPicker month={month} onChange={panel.setMonth} />
        <div className="w-full sm:w-56">
          <SelectInput label="Movement" value={movement} onChange={setMovement} options={[{ value: "all", label: "All movements" }, ...movements.map((m) => ({ value: m, label: m }))]} />
        </div>
        <div className="w-full sm:w-48">
          <SelectInput label="Person" value={person} onChange={setPerson} options={[{ value: "all", label: "Everyone" }, ...people.map((p) => ({ value: p, label: p }))]} />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        status={audit.isPending ? "loading" : audit.isError ? "error" : "ready"}
        onRetry={() => audit.refetch()}
        searchPlaceholder="Search audit"
        emptyTitle={`Nothing recorded in ${formatMonth(month)}.`}
        initialSort={{ id: "date", desc: true }}
      />
    </>
  )
}
