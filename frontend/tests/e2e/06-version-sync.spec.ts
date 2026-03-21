import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import path from 'path'
import { createUser, deleteUser, uploadBook, deleteBook, assertBackendReady } from '../helpers/testDb'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEST_EPUB = path.resolve(__dirname, '../fixtures/test-minimal.epub')
const API_BASE = 'http://localhost:3003/api'

let testUser: any
let testBook: any

test.beforeAll(async () => {
  await assertBackendReady()
})

test.beforeEach(async () => {
  testUser = await createUser(`__test06_${Date.now()}`)
  testBook = await uploadBook(TEST_EPUB, testUser.id)
})

test.afterEach(async () => {
  if (testBook) await deleteBook(testBook.id).catch(() => {})
  if (testUser) await deleteUser(testUser.id).catch(() => {})
})

// Helper: update progress via API
async function updateProgress(
  userId: string,
  bookId: string,
  cfi: string,
  percentage: number,
  version?: number
) {
  const body: Record<string, unknown> = { cfi, percentage }
  if (version !== undefined) body.version = version
  const res = await fetch(`${API_BASE}/users/${userId}/books/${bookId}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

// Helper: resolve progress conflict
async function resolveProgress(
  userId: string,
  bookId: string,
  cfi: string,
  percentage: number
) {
  const res = await fetch(`${API_BASE}/users/${userId}/books/${bookId}/progress/resolve`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cfi, percentage }),
  })
  return { status: res.status, data: await res.json() }
}

// Helper: get progress
async function getProgress(userId: string, bookId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/books/${bookId}/progress`)
  return res.json()
}

// Helper: update settings via API
async function updateSettings(
  userId: string,
  settings: Record<string, unknown>,
  version?: number
) {
  const body: Record<string, unknown> = { ...settings }
  if (version !== undefined) body.version = version
  const res = await fetch(`${API_BASE}/users/${userId}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

// Helper: resolve settings conflict
async function resolveSettings(userId: string, settings: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/users/${userId}/settings/resolve`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  return { status: res.status, data: await res.json() }
}

// Helper: get settings
async function getSettings(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/settings`)
  return res.json()
}

test.describe('Version-based Optimistic Locking — Progress', () => {
  test('新建進度返回 version=1', async () => {
    const { status, data } = await updateProgress(testUser.id, testBook.id, '@@0@@0.1', 10)
    expect(status).toBe(200)
    expect(data.version).toBe(1)
    expect(data.percentage).toBe(10)
  })

  test('不帶 version 更新（向後相容）應成功且 version 遞增', async () => {
    await updateProgress(testUser.id, testBook.id, '@@0@@0.1', 10)
    const { status, data } = await updateProgress(testUser.id, testBook.id, '@@1@@0.5', 50)
    expect(status).toBe(200)
    expect(data.version).toBe(2)
    expect(data.percentage).toBe(50)
  })

  test('帶正確 version 更新應成功', async () => {
    const { data: created } = await updateProgress(testUser.id, testBook.id, '@@0@@0.1', 10)
    expect(created.version).toBe(1)

    const { status, data } = await updateProgress(testUser.id, testBook.id, '@@1@@0.5', 50, 1)
    expect(status).toBe(200)
    expect(data.version).toBe(2)
  })

  test('帶錯誤 version 更新應返回 409 衝突', async () => {
    await updateProgress(testUser.id, testBook.id, '@@0@@0.1', 10)
    await updateProgress(testUser.id, testBook.id, '@@1@@0.3', 30, 1)

    // Try to update with stale version 1 (server is at version 2)
    const { status, data } = await updateProgress(testUser.id, testBook.id, '@@2@@0.7', 70, 1)
    expect(status).toBe(409)
    expect(data.conflict).toBe(true)
    expect(data.serverVersion).toBe(2)
    expect(data.serverData.percentage).toBe(30)
  })

  test('衝突後使用 resolve 強制覆寫', async () => {
    await updateProgress(testUser.id, testBook.id, '@@0@@0.1', 10)
    await updateProgress(testUser.id, testBook.id, '@@1@@0.3', 30, 1)

    const { status } = await updateProgress(testUser.id, testBook.id, '@@2@@0.7', 70, 1)
    expect(status).toBe(409)

    const { status: resolveStatus, data: resolved } = await resolveProgress(
      testUser.id,
      testBook.id,
      '@@2@@0.7',
      70
    )
    expect(resolveStatus).toBe(200)
    expect(resolved.percentage).toBe(70)
    expect(resolved.version).toBe(3)

    const final = await getProgress(testUser.id, testBook.id)
    expect(final.percentage).toBe(70)
    expect(final.version).toBe(3)
  })

  test('GET 進度包含 version 欄位', async () => {
    await updateProgress(testUser.id, testBook.id, '@@0@@0.5', 50)
    const progress = await getProgress(testUser.id, testBook.id)
    expect(progress.version).toBe(1)
    expect(progress.percentage).toBe(50)
  })
})

test.describe('Version-based Optimistic Locking — Settings', () => {
  test('首次設定返回 version=1', async () => {
    const { status, data } = await updateSettings(testUser.id, { fontSize: 20 })
    expect(status).toBe(200)
    expect(data.version).toBe(1)
    expect(data.fontSize).toBe(20)
  })

  test('不帶 version 更新設定應成功', async () => {
    await updateSettings(testUser.id, { fontSize: 20 })
    const { status, data } = await updateSettings(testUser.id, { fontSize: 24 })
    expect(status).toBe(200)
    expect(data.version).toBe(2)
    expect(data.fontSize).toBe(24)
  })

  test('帶正確 version 更新設定應成功', async () => {
    await updateSettings(testUser.id, { fontSize: 20 })
    const { status, data } = await updateSettings(testUser.id, { theme: 'dark' }, 1)
    expect(status).toBe(200)
    expect(data.version).toBe(2)
    expect(data.theme).toBe('dark')
  })

  test('帶錯誤 version 更新設定應返回 409', async () => {
    await updateSettings(testUser.id, { fontSize: 20 })
    await updateSettings(testUser.id, { fontSize: 24 }, 1)

    const { status, data } = await updateSettings(testUser.id, { fontSize: 30 }, 1)
    expect(status).toBe(409)
    expect(data.conflict).toBe(true)
    expect(data.serverVersion).toBe(2)
    expect(data.serverData.fontSize).toBe(24)
  })

  test('設定衝突後使用 resolve 強制覆寫', async () => {
    await updateSettings(testUser.id, { fontSize: 20 })
    await updateSettings(testUser.id, { fontSize: 24 }, 1)

    const { status } = await updateSettings(testUser.id, { fontSize: 30 }, 1)
    expect(status).toBe(409)

    const { status: rStatus, data: resolved } = await resolveSettings(testUser.id, { fontSize: 30 })
    expect(rStatus).toBe(200)
    expect(resolved.fontSize).toBe(30)
    expect(resolved.version).toBe(3)

    const settings = await getSettings(testUser.id)
    expect(settings.fontSize).toBe(30)
    expect(settings.version).toBe(3)
  })
})

test.describe('多裝置模擬 — 版本衝突場景', () => {
  test('兩台裝置同時基於同一版本更新，第二台應收到衝突', async () => {
    // Device A creates progress
    const { data: initial } = await updateProgress(testUser.id, testBook.id, '@@0@@0.1', 10)
    const baseVersion = initial.version

    // Device A updates (succeeds)
    const { status: statusA } = await updateProgress(
      testUser.id, testBook.id, '@@1@@0.5', 50, baseVersion
    )
    expect(statusA).toBe(200)

    // Device B tries to update with same base version (conflict!)
    const { status: statusB, data: conflictData } = await updateProgress(
      testUser.id, testBook.id, '@@2@@0.3', 30, baseVersion
    )
    expect(statusB).toBe(409)
    expect(conflictData.conflict).toBe(true)
    expect(conflictData.serverData.percentage).toBe(50)
    expect(conflictData.serverVersion).toBe(2)
  })
})
