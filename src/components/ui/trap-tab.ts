import type { KeyboardEvent } from "react"

const candidateSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

function tabbableIn(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(candidateSelector)].filter((element) => {
    if (element.tabIndex < 0) {
      return false
    }

    if (element.closest("[inert], [hidden], [aria-hidden='true']")) {
      return false
    }

    return element.checkVisibility?.() ?? true
  })
}

/** Keep Tab inside a dialog or sheet. The built-in guards only return focus on the next frame. */
export function trapTabKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
    return
  }

  const root = event.currentTarget

  if (!(root instanceof HTMLElement)) {
    return
  }

  const items = tabbableIn(root)

  if (items.length === 0) {
    event.preventDefault()
    return
  }

  const index = document.activeElement instanceof HTMLElement ? items.indexOf(document.activeElement) : -1
  const leaving = event.shiftKey ? index <= 0 : index < 0 || index === items.length - 1

  if (!leaving) {
    return
  }

  event.preventDefault()
  const next = event.shiftKey ? items[items.length - 1] : items[0]
  next?.focus()
}
