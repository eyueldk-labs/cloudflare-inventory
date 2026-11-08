import { CircleCheck, Circle } from "lucide-react"
import { useMemo, useState } from "react"
import { formatEtb, monthKey, productUnitCost, todayISO, valueOf, type Sale } from "@shared/domain"
import { DateText, HeaderAction, PageHeader } from "@/components/app/kit"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSales } from "@/lib/api"
import { go, orgPath } from "@/lib/nav"
import { cn } from "@/lib/utils"
import { Section, useOrg } from "@/screens/layout"
import { linesSummary } from "@/screens/sales"

export function OverviewScreen() {
  const { orgId, catalog, canWork, isAdmin } = useOrg()
  const month = monthKey()
  const sales = useSales(orgId, month)
  const inputsById = useMemo(() => new Map(catalog.inputs.map((i) => [i.id, i])), [catalog.inputs])
  const inputValue = catalog.inputs.filter((i) => !i.archived).reduce((sum, i) => sum + valueOf(i.onHand, i.unitCost, i.unit), 0)
  const productValue = catalog.products
    .filter((p) => !p.archived)
    .reduce((sum, p) => sum + p.onHand * productUnitCost(p.lines, p.additionalCost, inputsById), 0)
  const sold = (sales.data ?? []).filter((s) => s.status === "sold")
  const monthTotal = sold.reduce((sum, s) => sum + s.total, 0)

  const steps = [
    { id: "input", label: "New input", done: catalog.inputs.length > 0, href: `${orgPath(orgId, "inputs")}?panel=new`, allowed: canWork },
    { id: "product", label: "New product", done: catalog.products.length > 0, href: `${orgPath(orgId, "products")}?panel=new`, allowed: isAdmin },
    { id: "produce", label: "Stock product", done: catalog.products.some((p) => p.onHand > 0) || sold.length > 0, href: `${orgPath(orgId, "products")}?panel=produce`, allowed: canWork },
    { id: "sale", label: "Record sale", done: sold.length > 0 || (sales.data?.length ?? 0) > 0, href: `${orgPath(orgId, "sales")}?panel=new`, allowed: canWork },
  ]
  const showChecklist = steps.some((s) => !s.done) && catalog.products.length < 3

  return (
    <>
      <PageHeader title="Overview">
        {canWork ? (
          <>
            <HeaderAction label="Stock input" variant="outline" onClick={() => go(orgPath(orgId, "inputs"), { panel: "stock" })} />
            <HeaderAction label="Stock product" variant="outline" onClick={() => go(orgPath(orgId, "products"), { panel: "produce" })} />
            <HeaderAction label="Record sale" onClick={() => go(orgPath(orgId, "sales"), { panel: "new" })} />
          </>
        ) : null}
      </PageHeader>

      {showChecklist ? (
        <Section title="Get started">
          <Card>
            <CardContent className="flex flex-col gap-1">
              {steps.map((step, index) => (
                <a
                  key={step.id}
                  href={step.allowed ? step.href : undefined}
                  aria-disabled={!step.allowed}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-2 text-sm",
                    step.allowed && !step.done && "hover:bg-accent",
                    step.done && "text-muted-foreground line-through"
                  )}
                >
                  {step.done ? <CircleCheck className="size-5 text-severity-success" aria-hidden="true" /> : <Circle className="size-5 text-muted-foreground" aria-hidden="true" />}
                  <span>
                    {index + 1}. {step.label}
                  </span>
                </a>
              ))}
            </CardContent>
          </Card>
        </Section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Inputs value" value={formatEtb(inputValue)} />
        <Stat label="Product value" value={formatEtb(productValue)} hint="At unit cost" />
        <Stat label="Sales this month" value={sales.isPending ? null : formatEtb(monthTotal)} hint={`${sold.length} ${sold.length === 1 ? "sale" : "sales"}`} />
      </div>

      <Section title="Daily sales">
        <Card>
          <CardContent>{sales.isPending ? <Skeleton className="h-56" /> : <SalesChart sales={sold} month={month} />}</CardContent>
        </Card>
      </Section>

      <Section title="Recent sales" action={<a className="text-sm text-primary hover:underline" href={orgPath(orgId, "sales")}>View all</a>}>
        {sales.isPending ? (
          <Skeleton className="h-40" />
        ) : sold.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales this month yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <ul className="divide-y">
              {sold.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <a href={`${orgPath(orgId, "sales")}?panel=sale&id=${s.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2 text-sm hover:bg-[color-mix(in_oklch,var(--primary)_20%,var(--background))]">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{linesSummary(s)}</span>
                      <span className="text-xs text-muted-foreground">{s.code}</span>
                    </span>
                    <DateText iso={s.date} className="hidden text-muted-foreground sm:inline-flex" />
                    <span className="w-16 text-right tabular-nums text-muted-foreground">{s.qty} pcs</span>
                    <span className="w-32 text-right tabular-nums">{formatEtb(s.total)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  )
}

function Stat({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        {value === null ? <Skeleton className="h-9 w-40" /> : <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</span>}
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </CardContent>
    </Card>
  )
}

/** Hand-drawn SVG line chart (no chart library: smaller bundle). */
function SalesChart({ sales, month }: { sales: Sale[]; month: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const [y, m] = month.split("-").map(Number) as [number, number]
  const days = new Date(y, m, 0).getDate()
  const today = todayISO()
  const lastDay = today.startsWith(month) ? Number(today.slice(8, 10)) : days
  const totals = Array.from({ length: days }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, "0")}`
    return sales.filter((s) => s.date === day).reduce((sum, s) => sum + s.total, 0)
  })
  const max = Math.max(...totals, 1)
  const niceMax = niceCeil(max)
  const W = 720
  const H = 220
  const pad = { l: 56, r: 12, t: 12, b: 28 }
  const x = (i: number) => pad.l + (i / Math.max(days - 1, 1)) * (W - pad.l - pad.r)
  const yPos = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b)
  const points = totals.slice(0, lastDay).map((v, i) => `${x(i)},${yPos(v)}`)
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => f * niceMax)
  const short = (v: number) => (v / 100 >= 1000 ? `${+(v / 100_000).toFixed(1)}k` : String(Math.round(v / 100)))

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Daily sales for ${month}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={yPos(t)} y2={yPos(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.l - 8} y={yPos(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">
              {short(t)}
            </text>
          </g>
        ))}
        {[1, 8, 15, 22, days].map((d) => (
          <text key={d} x={x(d - 1)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
            {d}
          </text>
        ))}
        {points.length > 1 ? <polyline points={points.join(" ")} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" /> : null}
        {totals.slice(0, lastDay).map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={yPos(v)} r={hover === i ? 5 : v > 0 ? 3 : 0} fill="var(--chart-1)" />
            <rect x={x(i) - (W / days) / 2} y={pad.t} width={W / days} height={H - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} />
          </g>
        ))}
      </svg>
      {hover !== null ? (
        <div className="pointer-events-none absolute top-2 right-2 rounded-md border bg-popover px-3 py-2 text-xs shadow">
          <div className="text-muted-foreground">
            {month}-{String(hover + 1).padStart(2, "0")}
          </div>
          <div className="tabular-nums">{formatEtb(totals[hover] ?? 0)}</div>
        </div>
      ) : null}
      <p className="sr-only">Total this month: {formatEtb(totals.reduce((a, b) => a + b, 0))}</p>
    </div>
  )
}

function niceCeil(santim: number) {
  const etb = santim / 100
  const pow = 10 ** Math.floor(Math.log10(Math.max(etb, 1)))
  const n = Math.ceil(etb / pow)
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10 // 5 even ticks
  return step * pow * 100
}
