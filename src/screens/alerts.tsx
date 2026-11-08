import { useMemo } from "react"
import { alertsFor, type Alert } from "@shared/domain"
import { DataTable, type DataTableColumn } from "@/components/app/data-table"
import { PageHeader } from "@/components/app/kit"
import { SeverityBadge } from "@/components/app/severity"
import { Button } from "@/components/ui/button"
import { go, orgPath } from "@/lib/nav"
import { useOrg } from "@/screens/layout"

/** Alerts come from current data on the client. They clear when the cause is fixed. */
export function AlertsScreen() {
  const { orgId, catalog, canWork } = useOrg()
  const alerts = useMemo(() => alertsFor(catalog), [catalog])

  const fix = (a: Alert) => {
    if (a.action === "stock-product") go(orgPath(orgId, "products"), { panel: canWork ? "produce" : "history", id: a.itemId })
    else if (a.itemType === "input") go(orgPath(orgId, "inputs"), { panel: canWork ? "stock" : "history", id: a.itemId })
    else go(orgPath(orgId, "products"), { panel: "history", id: a.itemId })
  }

  const columns: DataTableColumn<Alert>[] = [
    { id: "alert", header: "Alert", accessor: (a) => a.title, cell: (a) => <SeverityBadge level={a.level}>{a.title}</SeverityBadge> },
    {
      id: "item",
      header: "Item",
      accessor: (a) => `${a.itemName} ${a.itemCode}`,
      cell: (a) => (
        <span className="flex flex-col">
          <span>{a.itemName}</span>
          <span className="text-xs text-muted-foreground">{a.itemCode}</span>
        </span>
      ),
    },
    { id: "detail", header: "Detail", accessor: (a) => a.detail, cell: (a) => <span className="text-muted-foreground">{a.detail}</span> },
    {
      id: "action",
      header: "Action",
      align: "end",
      enableSorting: false,
      cell: (a) =>
        canWork ? (
          <Button size="sm" variant="outline" className="relative z-10" onClick={() => fix(a)}>
            {a.action === "stock-product" ? "Stock product" : a.itemType === "input" ? "Stock input" : "View"}
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Alerts" />
      <DataTable columns={columns} rows={alerts} getRowId={(a) => a.id} searchPlaceholder="Search alerts" emptyTitle="No alerts. Stock levels are fine." />
    </>
  )
}
