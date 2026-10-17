import { test, expect } from '@playwright/test'
import { createUser, deleteUser, uploadBook, deleteBook } from '../helpers/testDb'
import { fileURLToPath } from 'url'
import path from 'path'
import { tmpdir } from 'os'
import { unlinkSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { MIN_SPREAD_GUTTER, getReaderPaneBounds, resolveHorizontalViewportSegments, spreadGutterPx } from '../../src/utils/viewportSegments'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const TXT_PATH = path.resolve(__dirname, '../fixtures/minimal.txt')

let testUser: Awaited<ReturnType<typeof createUser>> | undefined
let testBook: Awaited<ReturnType<typeof uploadBook>> | undefined
let temporaryPdfPath: string | undefined

test('Surface Duo geometry selects one left pane or the full spread', () => {
  const segments = resolveHorizontalViewportSegments(
    { left: 0, width: 760, top: 0, height: 800 },
    { left: 800, width: 760, top: 0, height: 800 },
  )
  expect(segments?.hingeGap).toBe(40)
  expect(getReaderPaneBounds('single', segments)).toEqual({ left: 0, width: 760 })
  expect(getReaderPaneBounds('spread', segments)).toBeNull()
})

test('spread gutter keeps a minimum centre gap even without hinge data', () => {
  expect(spreadGutterPx(0, 680, 0.06)).toBe(MIN_SPREAD_GUTTER)
  expect(spreadGutterPx(120, 680, 0.06)).toBe(120)
  expect(spreadGutterPx(0, 2000, 0.06)).toBe(120)
})

function createMinimalPdf(): string {
  const objects: string[] = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  const kids: string[] = []
  for (let index = 0; index < 4; index++) {
    const pageId = 4 + index * 2
    const streamId = pageId + 1
    kids.push(`${pageId} 0 R`)
    const stream = `BT /F1 24 Tf 72 720 Td (Page ${index + 1}) Tj ET`
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`
    objects[streamId] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  }
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count 4 >>`
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf)
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f\n`
  for (let id = 1; id < objects.length; id++) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n\n`
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  const filePath = path.join(tmpdir(), `readflix-spread-${randomUUID()}.pdf`)
  writeFileSync(filePath, pdf)
  return filePath
}

test.afterEach(async () => {
  if (testBook) await deleteBook(testBook.id, testUser?.id).catch(() => {})
  if (testUser) await deleteUser(testUser.id).catch(() => {})
  if (temporaryPdfPath) unlinkSync(temporaryPdfPath)
  testBook = undefined
  testUser = undefined
  temporaryPdfPath = undefined
})

async function openBook(page: import('@playwright/test').Page, filePath: string) {
  testUser = await createUser(`__test14_${Date.now()}`)
  testBook = await uploadBook(filePath, testUser.id)
  await page.setViewportSize({ width: 1365, height: 900 })
  await page.addInitScript((id) => localStorage.setItem(`readflix.reader.pageLayout.${id}`, 'spread'), testUser.id)
  await page.goto('/')
  await page.getByText(testUser.name).click()
  await page.waitForURL('/library')
  await page.getByRole('link', { name: `閱讀 ${testBook.title}` }).click()
  await page.waitForURL((url) => url.pathname === `/reader/${testBook?.id}`)
}

test('PDF 雙頁模式並排顯示兩頁，翻頁移動一組', async ({ page }) => {
  temporaryPdfPath = createMinimalPdf()
  await openBook(page, temporaryPdfPath)
  const pdfPages = page.locator('.pdf-document .react-pdf__Page')
  await expect(pdfPages).toHaveCount(2)
  await page.locator('.epub-tap-right').click()
  await expect(page.locator('.pdf-document .react-pdf__Page[data-page-number="3"]')).toBeVisible()
  await expect(pdfPages).toHaveCount(2)
})

test('TXT 雙頁模式以兩欄排版', async ({ page }) => {
  await openBook(page, TXT_PATH)
  const content = page.getByTestId('txt-reader-content')
  await expect(content).toBeVisible()
  await expect.poll(() => content.evaluate((element) => getComputedStyle(element).columnCount)).toBe('2')
})
