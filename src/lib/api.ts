import { QueryClient, useMutation, useQuery, type QueryKey } from "@tanstack/react-query"
import { toast } from "sonner"
import type { AuditRow, Catalog, HistoryEntry, Input, Invite, Me, Member, Org, PricingScheme, Product, Sale } from "@shared/domain"

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
  if (!response.ok) throw new ApiError(response.status, data.error ?? data.message ?? "Something went wrong.")
  return data as T
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Fewer refetches = fewer Worker requests. Data refreshes on focus only after it is a minute old.
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
})

// ---------------------------------------------------------------------------
// Queries

export const keys = {
  me: ["me"] as const,
  catalog: (orgId: string) => ["catalog", orgId] as const,
  sales: (orgId: string, month: string) => ["sales", orgId, month] as const,
  audit: (orgId: string, month: string) => ["audit", orgId, month] as const,
  members: (orgId: string) => ["members", orgId] as const,
  history: (orgId: string, type: "input" | "product", id: string) => ["history", orgId, type, id] as const,
}

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<Me>("/me"), staleTime: Infinity })

export const useCatalog = (orgId: string) =>
  useQuery({ queryKey: keys.catalog(orgId), queryFn: () => api<Catalog>(`/o/${orgId}/catalog`) })

export const useSales = (orgId: string, month: string) =>
  useQuery({
    queryKey: keys.sales(orgId, month),
    queryFn: async () => (await api<{ sales: Sale[] }>(`/o/${orgId}/sales?month=${month}`)).sales,
  })

export const useAudit = (orgId: string, month: string) =>
  useQuery({
    queryKey: keys.audit(orgId, month),
    queryFn: async () => (await api<{ rows: AuditRow[] }>(`/o/${orgId}/audit?month=${month}`)).rows,
  })

export const useMembers = (orgId: string) =>
  useQuery({ queryKey: keys.members(orgId), queryFn: () => api<{ members: Member[]; invites: Invite[] }>(`/o/${orgId}/members`) })

export const useHistory = (orgId: string, type: "input" | "product", id: string | null) =>
  useQuery({
    queryKey: keys.history(orgId, type, id ?? ""),
    enabled: !!id,
    staleTime: 0,
    queryFn: () =>
      api<{ history: HistoryEntry[]; versions?: { id: string; version: number; lines: Product["lines"]; additionalCost: number }[] }>(
        `/o/${orgId}/${type === "input" ? "inputs" : "products"}/${id}/history`
      ),
  })

// ---------------------------------------------------------------------------
// Mutations: responses carry the changed rows, which are merged into the cache (no refetch request).

export type CatalogPatch = { inputs?: Input[]; products?: Product[]; schemes?: PricingScheme[]; org?: Org }
export type MutationResult = { patch?: CatalogPatch; sale?: Sale; voided?: Sale; id?: string }

function mergeById<T extends { id: string }>(list: T[], updates: T[] | undefined) {
  if (!updates?.length) return list
  const byId = new Map(updates.map((u) => [u.id, u]))
  const merged = list.map((item) => byId.get(item.id) ?? item)
  for (const u of updates) if (!list.some((item) => item.id === u.id)) merged.push(u)
  return merged
}

export function applyPatch(orgId: string, result: MutationResult) {
  const patch = result.patch
  if (patch) {
    queryClient.setQueryData<Catalog>(keys.catalog(orgId), (old) =>
      old
        ? {
            org: patch.org ?? old.org,
            inputs: mergeById(old.inputs, patch.inputs),
            products: mergeById(old.products, patch.products),
            schemes: patch.schemes ?? old.schemes,
          }
        : old
    )
    if (patch.org) queryClient.invalidateQueries({ queryKey: keys.me })
  }
  for (const sale of [result.sale, result.voided]) {
    if (!sale) continue
    queryClient.setQueryData<Sale[]>(keys.sales(orgId, sale.date.slice(0, 7)), (old) =>
      old ? mergeById(old, [sale]).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)) : old
    )
  }
  // Histories and Audit only refetch when they are on screen.
  queryClient.invalidateQueries({ queryKey: ["history", orgId] })
  queryClient.invalidateQueries({ queryKey: ["audit", orgId] })
}

export function useAction<V>(orgId: string, request: (vars: V) => Promise<MutationResult>, options?: { success?: string; onDone?: (r: MutationResult) => void }) {
  return useMutation({
    mutationFn: request,
    onSuccess: (result) => {
      applyPatch(orgId, result)
      if (options?.success) toast.success(options.success)
      options?.onDone?.(result)
    },
    onError: (error) => toast.error(error.message),
  })
}

export function invalidate(key: QueryKey) {
  return queryClient.invalidateQueries({ queryKey: key })
}
