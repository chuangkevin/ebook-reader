/**
 * testDb.ts
 * 直接操作後端 API 的測試輔助工具。
 * 用於在整合測試的 before/after hooks 中建立與清理測試資料。
 * 需要 Node.js 18+（使用原生 fetch 與 FormData）。
 */

import fs from 'fs'
import path from 'path'

const API_BASE = 'http://localhost:3003/api'

export interface TestUser {
  id: number
  name: string
  avatar: string | null
}

export interface TestBook {
  id: number
  title: string
  author: string
  format: string
  coverUrl: string | null
  filePath?: string
  addedAt: string
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function createUser(name: string): Promise<TestUser> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`createUser failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<TestUser>
}

export async function deleteUser(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' })
  // 404 means already gone – that's fine during cleanup
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteUser(${id}) failed (${res.status})`)
  }
}

export async function listUsers(): Promise<TestUser[]> {
  const res = await fetch(`${API_BASE}/users`)
  if (!res.ok) throw new Error(`listUsers failed (${res.status})`)
  return res.json() as Promise<TestUser[]>
}

/**
 * 刪除名稱以 prefix 開頭的所有使用者（用於清理殘餘測試資料）。
 */
export async function cleanupUsersWithPrefix(prefix: string): Promise<void> {
  const users = await listUsers()
  await Promise.all(
    users.filter((u) => u.name.startsWith(prefix)).map((u) => deleteUser(u.id))
  )
}

// ─── Books ───────────────────────────────────────────────────────────────────

/**
 * 透過 multipart/form-data 上傳 epub 檔至後端。
 * filePath 為 Node.js 可讀取的絕對路徑。
 *
 * 若後端回傳 409（重複書名），會先刪除舊書再重新上傳一次，確保測試前狀態乾淨。
 */
export async function uploadBook(
  filePath: string,
  uploadedBy: number
): Promise<TestBook> {
  const doUpload = async (): Promise<Response> => {
    const buffer = fs.readFileSync(filePath)
    const filename = path.basename(filePath)
    const blob = new Blob([buffer], { type: 'application/epub+zip' })
    const form = new FormData()
    form.append('file', blob, filename)
    form.append('uploadedBy', String(uploadedBy))
    return fetch(`${API_BASE}/books`, { method: 'POST', body: form })
  }

  let res = await doUpload()

  if (res.status === 409) {
    // 重複書名：先刪除現有的書再重試
    const errBody = await res.json() as { error: string }
    // 錯誤格式：「<title>」已存在書庫中
    const titleMatch = errBody.error.match(/「(.+)」/)
    if (titleMatch) {
      await cleanupBookByTitle(titleMatch[1])
    }
    res = await doUpload()
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`uploadBook failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<TestBook>
}

/**
 * 刪除書庫中符合指定書名的書（用於清理殘留測試書籍）。
 */
export async function cleanupBookByTitle(title: string): Promise<void> {
  const books = await listBooks()
  const found = books.find((b) => b.title === title)
  if (found) {
    await deleteBook(found.id)
  }
}

export async function deleteBook(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/books/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteBook(${id}) failed (${res.status})`)
  }
}

export async function listBooks(): Promise<TestBook[]> {
  const res = await fetch(`${API_BASE}/books`)
  if (!res.ok) throw new Error(`listBooks failed (${res.status})`)
  return res.json() as Promise<TestBook[]>
}

// ─── Health ───────────────────────────────────────────────────────────────────

/**
 * 確認後端正在運行。若後端未啟動則拋出清晰的錯誤訊息。
 */
export async function assertBackendReady(): Promise<void> {
  try {
    const res = await fetch('http://localhost:3003/health')
    if (!res.ok) throw new Error(`status ${res.status}`)
  } catch (err) {
    throw new Error(
      `後端未啟動 (http://localhost:3003/health 無法連線)。請先執行後端再跑整合測試。\n原始錯誤：${err}`
    )
  }
}
