// Shared responsive TanStack table, composed from shadcn UI controls.
"use client"

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react"
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, EllipsisIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/app/empty-state"

export const touchTarget = "min-h-11 min-w-11"

const touchHeight = "h-11 md:pointer-fine:h-8"
const touchMenuButton = cn(
  touchTarget,
  "md:pointer-fine:size-8 md:pointer-fine:min-h-8 md:pointer-fine:min-w-8",
)

export type DataTableAction<Row> = {
  id: string
  label: string
  href?: string
  external?: boolean
  onSelect?: (row: Row) => void
}

export type DataTableColumn<Row = any> = {
  id: string
  header: string
  accessor?: (row: Row) => string | number | undefined
  cell?: (row: Row) => ReactNode
  align?: "start" | "end"
  className?: string
  enableSorting?: boolean
  search?: boolean
  /** Renders this cell as the row link. Defaults to the first column that is not an actions column. */
  primary?: boolean
  /** Rendered after the row link in the same cell, never inside it. */
  after?: (row: Row) => ReactNode
  /** Phone card field label. Defaults to the column header. */
  phoneLabel?: string | ((row: Row) => string)
  /** Screen-reader header only. Default text is "Actions". */
  actions?: boolean
}

export type DataTableLabels = {
  search?: string
  error?: string
  empty?: string
  retry?: string
  clearSearch?: string
  previous?: string
  next?: string
  pageSize?: string
  actions?: string
  range?: (range: { start: number; end: number; total: number }) => string
  page?: (page: { page: number; pages: number }) => string
}

export type DataTableProps<Row = any> = {
  columns: readonly DataTableColumn<Row>[]
  rows: readonly Row[]
  getRowId: (row: Row) => string
  searchPlaceholder?: string
  status?: "ready" | "loading" | "error"
  onRetry?: () => void
  emptyTitle?: string
  pinEmptyToViewport?: boolean
  emptyIcon?: ReactNode
  emptyAction?: ReactNode
  paginate?: boolean
  searchable?: boolean
  initialSort?: { id: string; desc: boolean }
  toolbar?: ReactNode
  labels?: DataTableLabels
  /** The detail URL for a row. The primary cell renders as a real <a href>. */
  getRowHref?: (row: Row) => string
  /**
   * Client open for a plain left click. Modified clicks follow the href.
   */
  onRowOpen?: (row: Row) => void
  /** Row ⋯ menu. The trigger is 44px on a coarse pointer. */
  rowActions?: (row: Row) => readonly DataTableAction<Row>[]
}

const pageSizeItems = [
  { label: "10", value: "10" },
  { label: "20", value: "20" },
  { label: "50", value: "50" },
  { label: "100", value: "100" },
]

export function DataTable<Row = any>({
  columns,
  rows,
  getRowId,
  searchPlaceholder,
  status = "ready",
  onRetry,
  emptyTitle,
  pinEmptyToViewport,
  emptyIcon,
  emptyAction,
  paginate = true,
  searchable = true,
  initialSort,
  toolbar,
  labels,
  getRowHref,
  onRowOpen,
  rowActions,
}: DataTableProps<Row>) {
  const copy = resolveLabels({ labels, searchPlaceholder, emptyTitle })
  const frameRef = useRef<HTMLDivElement>(null)
  const scrolled = usePinnedEdge(frameRef)
  const resolvedColumns = useMemo(
    () => withActionsColumn({ columns, rowActions, actionsLabel: copy.actions }),
    [columns, rowActions, copy.actions],
  )
  const primaryId = (
    resolvedColumns.find((column) => column.primary) ??
    resolvedColumns.find((column) => !column.actions) ??
    resolvedColumns[0]
  )?.id
  // Date controls need a row hit area below both the icon and pinned identifier.
  const hasDateControls = resolvedColumns.some(column => column.id === "date" || column.id === "created")
  const [sorting, setSorting] = useState<SortingState>(
    initialSort ? [{ id: initialSort.id, desc: initialSort.desc }] : [],
  )
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState("")
  const [globalFilter, setGlobalFilter] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setGlobalFilter(query), 200)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }, [globalFilter])

  const columnDefs = useMemo(
    () => buildColumns({ columns: resolvedColumns, actionsLabel: copy.actions }),
    [resolvedColumns, copy.actions],
  )

  const table: any = useTable({
    features,
    data: [...rows],
    columns: columnDefs,
    getRowId,
    state: { sorting, globalFilter, pagination, columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: (row: any, _columnId: string, filterValue: unknown) =>
      matchesQuery({ columns: resolvedColumns, row: row.original, filterValue }),
  } as any)

  const filteredCount = table.getRowCount()
  const pageStart = filteredCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const pageEnd = Math.min(filteredCount, (pagination.pageIndex + 1) * pagination.pageSize)
  const showEmpty = status === "ready" && rows.length === 0
  const showNoResults = status === "ready" && rows.length > 0 && filteredCount === 0

  return (
    <div className="min-w-0 max-w-full flex flex-col gap-3" data-slot="data-table" data-table-layout="table">
      {searchable || toolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {searchable ? (
            <Input
              value={query}
              placeholder={copy.search}
              aria-label={copy.search}
              className={`w-full max-w-sm ${touchHeight}`}
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className={cn("ml-auto focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:transition-none", touchHeight)} />}>Columns</DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().filter((column: any) => column.getCanHide()).map((column: any) => (
                <DropdownMenuCheckboxItem key={column.id} className="min-h-11 md:pointer-fine:min-h-8" checked={column.getIsVisible()} onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}>
                  {resolvedColumns.find(item => item.id === column.id)?.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
      <div
        ref={frameRef}
        data-slot="data-table-body"
        data-scrolled={scrolled ? "" : undefined}
        className="group/frame @container overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10"
      >
        <Table className="min-w-[40rem] border-collapse">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup: any) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header: any, index: number) => {
                  const column = resolvedColumns.find((item) => item.id === header.column.id)
                  return (
                    <TableHead key={header.id} className={cn(cellClass(column), index === 0 && pinnedClass)}>
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {status === "loading" ? (
              Array.from({ length: 6 }, (_, index) => (
                <TableRow key={index}>
                  {resolvedColumns.map((column, columnIndex) => (
                    <TableCell key={column.id} className={cn(columnIndex === 0 && pinnedClass)}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : status === "error" ? (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-28 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <p>{copy.error}</p>
                    {onRetry ? (
                      <Button type="button" variant="outline" className={touchHeight} onClick={onRetry}>
                        {copy.retry}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : showEmpty ? (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="p-4">
                  <div className={pinEmptyToViewport ? "sticky left-4 w-[calc(100cqw-2rem)]" : undefined}>
                    <EmptyState icon={emptyIcon} title={copy.empty} action={emptyAction} />
                  </div>
                </TableCell>
              </TableRow>
            ) : showNoResults ? (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-28 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <p>{copy.empty}</p>
                    <Button
                      type="button"
                      variant="outline"
                      className={touchHeight}
                      onClick={() => setQuery("")}
                    >
                      {copy.clearSearch}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row: any) => (
                <TableRow
                  key={row.id}
                  className="group/row relative"
                >
                  {row.getVisibleCells().map((cell: any, index: number) => {
                    const column = resolvedColumns.find((item) => item.id === cell.column.id)
                    const href = column?.id === primaryId ? getRowHref?.(row.original) : undefined
                    const after = column?.after?.(row.original)
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(cellClass(column, { numeric: true }), index === 0 && pinnedClass)}
                      >
                        {href ? (
                          <RowLink
                            href={href}
                            stretch={!hasDateControls}
                            onOpen={onRowOpen ? () => onRowOpen(row.original) : undefined}
                          >
                            <table.FlexRender cell={cell} />
                          </RowLink>
                        ) : (
                          <table.FlexRender cell={cell} />
                        )}
                        {hasDateControls && index === row.getVisibleCells().length - 1 && getRowHref?.(row.original) ? (
                          <a
                            data-slot="row-hit-area"
                            aria-hidden="true"
                            tabIndex={-1}
                            href={getRowHref(row.original)}
                            className="absolute inset-0 z-0"
                            onClick={(event) => {
                              if (!onRowOpen || isModifiedClick(event)) return
                              event.preventDefault()
                              onRowOpen(row.original)
                            }}
                          />
                        ) : null}
                        {after ? <div className="relative z-10 mt-2">{after}</div> : null}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {paginate && status === "ready" && !showEmpty && !showNoResults ? (
        <div
          data-slot="data-table-pager"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            {copy.range({ start: pageStart, end: pageEnd, total: filteredCount })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={pageSizeItems}
              value={String(pagination.pageSize)}
              onValueChange={(value) => {
                if (value) {
                  table.setPageSize(Number(value))
                }
              }}
            >
              <SelectTrigger
                className="w-24 data-[size=default]:h-11 md:pointer-fine:data-[size=default]:h-8"
                aria-label={copy.pageSize}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pageSizeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className={touchHeight}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              {copy.previous}
            </Button>
            <span className="text-sm text-muted-foreground">
              {copy.page({
                page: table.getPageCount() === 0 ? 0 : pagination.pageIndex + 1,
                pages: table.getPageCount(),
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              className={touchHeight}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {copy.next}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const features = tableFeatures({
  columnVisibilityFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
} as any)

function resolveLabels({
  labels,
  searchPlaceholder,
  emptyTitle,
}: {
  labels?: DataTableLabels
  searchPlaceholder?: string
  emptyTitle?: string
}) {
  return {
    search: searchPlaceholder ?? labels?.search ?? "Search",
    error: labels?.error ?? "Could not load data.",
    empty: emptyTitle ?? labels?.empty ?? "No results.",
    retry: labels?.retry ?? "Retry",
    clearSearch: labels?.clearSearch ?? "Clear search",
    previous: labels?.previous ?? "Previous",
    next: labels?.next ?? "Next",
    pageSize: labels?.pageSize ?? "Page size",
    actions: labels?.actions ?? "Actions",
    range:
      labels?.range ??
      ((range: { start: number; end: number; total: number }) =>
        `Showing ${range.start}–${range.end} of ${range.total}`),
    page:
      labels?.page ??
      ((page: { page: number; pages: number }) => `Page ${page.page} of ${page.pages}`),
  }
}

function withActionsColumn<Row>({
  columns,
  rowActions,
  actionsLabel,
}: {
  columns: readonly DataTableColumn<Row>[]
  rowActions?: (row: Row) => readonly DataTableAction<Row>[]
  actionsLabel: string
}): readonly DataTableColumn<Row>[] {
  if (!rowActions || columns.some((column) => column.actions)) {
    return columns
  }
  const menu = rowActions
  const actionsColumn: DataTableColumn<Row> = {
    id: "actions",
    header: actionsLabel,
    actions: true,
    align: "end",
    enableSorting: false,
    search: false,
    cell: (row) => <RowMenu row={row} actions={menu(row)} label={actionsLabel} />,
  }
  return [...columns, actionsColumn]
}

function buildColumns({
  columns,
  actionsLabel,
}: {
  columns: readonly DataTableColumn[]
  actionsLabel: string
}): any[] {
  const helper = createColumnHelper<any, any>()
  return columns.map((column) => {
    if (column.actions || !column.accessor) {
      return helper.display({
        id: column.id,
        header: column.actions
          ? () => <span className="sr-only">{column.header.trim() || actionsLabel}</span>
          : column.header,
        enableSorting: false,
        enableHiding: !column.actions && !column.primary,
        cell: ({ row }) => column.cell?.(row.original) ?? null,
      })
    }
    const accessor = column.accessor
    return helper.accessor(accessor, {
      id: column.id,
      header: ({ column: tableColumn }) =>
        column.enableSorting === false ? (
          column.header
        ) : (
          <Button
            type="button"
            variant="ghost"
            className={cn("-ml-2", touchHeight)}
            onClick={() => tableColumn.toggleSorting(tableColumn.getIsSorted() === "asc")}
          >
            {column.header}
            <SortIcon direction={tableColumn.getIsSorted()} />
          </Button>
        ),
      enableSorting: column.enableSorting !== false,
      enableHiding: !column.primary,
      sortUndefined: "last",
      sortFn: (left: any, right: any, id: string) => {
        const a = left.getValue(id)
        const b = right.getValue(id)
        if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1
        return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true })
      },
      cell: ({ row }) => column.cell?.(row.original) ?? String(accessor(row.original)),
    })
  })
}

function matchesQuery<Row = any>({
  columns,
  row,
  filterValue,
}: {
  columns: readonly DataTableColumn<Row>[]
  row: Row
  filterValue: unknown
}) {
  const query = String(filterValue ?? "").trim().toLowerCase()
  if (!query) {
    return true
  }
  return columns.some((column) => {
    if (column.search === false || !column.accessor) {
      return false
    }
    return String(column.accessor(row)).toLowerCase().includes(query)
  })
}

function cellClass(
  column: { align?: "start" | "end"; className?: string } | undefined,
  options: { numeric?: boolean } = {},
) {
  return cn(
    "bg-transparent",
    column?.align === "end" && "text-right",
    options.numeric && column?.align === "end" && "tabular-nums",
    column?.className,
  )
}

const pinnedClass =
  "sticky left-0 z-10 bg-card group-data-[scrolled]/frame:shadow-[inset_-1px_0_0_var(--border),6px_0_8px_-6px_rgb(0_0_0/0.6)]"

// Date rows place their stretched hit area outside the sticky cell so icons
// remain interactive while horizontal scrolling still masks them under the identifier.
function RowLink({
  stretch = true,
  href,
  onOpen,
  children,
}: {
  href: string
  stretch?: boolean
  onOpen?: () => void
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={cn("relative z-10 inline-flex max-w-[12rem] min-h-11 items-center rounded-md font-medium underline-offset-4 outline-none after:absolute after:-inset-y-2 after:-left-2 after:z-0 hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 md:pointer-fine:min-h-8", stretch ? "after:w-[calc(100cqw+0.5rem)] after:content-['']" : "w-full max-w-none after:w-[calc(100%+1rem)] after:content-['']")}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (!onOpen || isModifiedClick(event)) {
          return
        }
        event.preventDefault()
        onOpen()
      }}
    >
      {children}
    </a>
  )
}

function RowMenu<Row>({
  row,
  actions,
  label,
}: {
  row: Row
  actions: readonly DataTableAction<Row>[]
  label: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [boundary, setBoundary] = useState<Element | null>(null)

  useLayoutEffect(() => {
    const root = hostRef.current?.closest('[data-slot="data-table"]')
    const body = root?.querySelector('[data-slot="data-table-body"]') ?? null
    setBoundary(body)
  }, [])

  return (
    <div ref={hostRef} className="relative z-10">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                touchMenuButton,
                // Button transition-all fades the ring in from a transparent shadow. transition-none keeps it visible on the first frame.
                "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:transition-none",
              )}
              aria-label={label}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          collisionBoundary={boundary ?? undefined}
          collisionPadding={16}
          collisionAvoidance={{
            side: "flip",
            align: "shift",
            fallbackAxisSide: "none",
          }}
        >
          <DropdownMenuGroup>
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                className="min-h-11 md:pointer-fine:min-h-8"
                render={
                  action.href ? (
                    <a href={action.href} {...externalProps(action.external)} />
                  ) : undefined
                }
                onClick={(event) => runAction({ event, action, row })}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function runAction<Row>({
  event,
  action,
  row,
}: {
  event: MouseEvent<HTMLElement>
  action: DataTableAction<Row>
  row: Row
}) {
  if (!action.onSelect) {
    return
  }
  if (action.href && isModifiedClick(event)) {
    return
  }
  if (action.href) {
    event.preventDefault()
  }
  action.onSelect(row)
}

function usePinnedEdge(frameRef: RefObject<HTMLDivElement | null>) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const scroller = frameRef.current?.querySelector<HTMLElement>('[data-slot="table-container"]')
    if (!scroller) {
      return
    }
    const update = () => setScrolled(scroller.scrollLeft > 0)
    update()
    scroller.addEventListener("scroll", update, { passive: true })
    return () => scroller.removeEventListener("scroll", update)
  }, [frameRef])

  return scrolled
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") {
    return <ArrowUpIcon data-icon="inline-end" />
  }
  if (direction === "desc") {
    return <ArrowDownIcon data-icon="inline-end" />
  }
  return <ArrowUpDownIcon data-icon="inline-end" />
}

function isModifiedClick(event: MouseEvent<HTMLElement>) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

function externalProps(external: boolean | undefined): { target?: "_blank"; rel?: "noopener" } {
  if (!external) {
    return {}
  }
  return { target: "_blank", rel: "noopener" }
}
