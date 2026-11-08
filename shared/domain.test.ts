import { describe, expect, it } from "vitest"
import { alertsFor, formatAmount, formatEtb, parseAmount, parseMoney, productionNeeds, productUnitCost, valueOf } from "./domain"

describe("units", () => {
  it("parses kg into milligrams without floating point", () => {
    expect(parseAmount("0.0003", "kg")).toBe(300)
    expect(parseAmount("1.5", "kg")).toBe(1_500_000)
    expect(parseAmount("0.1234567", "kg")).toBeNull()
    expect(parseAmount("0", "kg")).toBeNull()
    expect(parseAmount("0", "kg", { allowZero: true })).toBe(0)
  })
  it("accepts whole pieces only", () => {
    expect(parseAmount("12", "pcs")).toBe(12)
    expect(parseAmount("1.5", "pcs")).toBeNull()
  })
  it("formats amounts", () => {
    expect(formatAmount(1_500_000, "kg")).toBe("1.5 kg")
    expect(formatAmount(300, "kg")).toBe("0.0003 kg")
    expect(formatAmount(1200, "pcs")).toBe("1,200 pcs")
  })
})

describe("money", () => {
  it("parses ETB into santim", () => {
    expect(parseMoney("450")).toBe(45_000)
    expect(parseMoney("0.35")).toBe(35)
    expect(parseMoney("1,234.5")).toBe(123_450)
    expect(parseMoney("1.234")).toBeNull()
  })
  it("formats santim as ETB", () => {
    expect(formatEtb(1_248_000)).toBe("12,480.00 ETB")
  })
})

describe("cost", () => {
  const inputs = new Map([
    ["g", { unit: "kg" as const, unitCost: 50_000, onHand: 20_000_000 }],
    ["j", { unit: "pcs" as const, unitCost: 1_200, onHand: 100 }],
  ])
  it("values stock", () => {
    expect(valueOf(20_000_000, 50_000, "kg")).toBe(1_000_000)
  })
  it("computes product unit cost from composition", () => {
    // 0.05 kg × 500 ETB + 1 jar × 12 ETB + 5 ETB additional = 42 ETB
    expect(productUnitCost([{ inputId: "g", amount: 50_000 }, { inputId: "j", amount: 1 }], 500, inputs)).toBe(4_200)
  })
  it("finds shortfalls", () => {
    const needs = productionNeeds([{ inputId: "j", amount: 1 }], 120, inputs)
    expect(needs[0]?.short).toBe(20)
  })
})

describe("alerts", () => {
  it("raises low and out alerts", () => {
    const base = { kind: "material" as const, unit: "kg" as const, unitCost: 0, archived: false, archiveReason: "" }
    const alerts = alertsFor({
      inputs: [
        { ...base, id: "a", code: "MAT00001", name: "A", onHand: 0, lowLevel: null },
        { ...base, id: "b", code: "MAT00002", name: "B", onHand: 1, lowLevel: 5 },
        { ...base, id: "c", code: "MAT00003", name: "C", onHand: 10, lowLevel: 5 },
      ],
      products: [],
    })
    expect(alerts.map((a) => a.title)).toEqual(["Out of stock", "Low stock"])
  })
})
