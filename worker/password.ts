/** Small crypto helpers for invite tokens. Passwords use Better Auth's default hashing. */
const enc = new TextEncoder()

function toB64(bytes: Uint8Array) {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function randomToken(bytes = 32): string {
  return toB64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
