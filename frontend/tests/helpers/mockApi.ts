import { Page } from '@playwright/test'

export const MOCK_USERS = [
  { id: 1, name: '小明', avatar: null },
  { id: 2, name: '小華', avatar: null },
]

export const MOCK_BOOKS = [
  {
    id: 1,
    title: '哈利波特：神秘的魔法石',
    author: 'J.K. Rowling',
    format: 'epub',
    coverUrl: null,
    progress: null,
    addedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 2,
    title: '三體',
    author: '劉慈欣',
    format: 'epub',
    coverUrl: null,
    progress: '@@3@@0.45',
    addedAt: '2026-03-10T00:00:00Z',
  },
]

export const MOCK_SETTINGS = {
  writingMode: 'vertical-rl',
  fontSize: 18,
  theme: 'light',
  openccMode: 'none',
  tapZoneLayout: 'default',
}

/**
 * Intercept all API calls and return mock data.
 * Tests can override specific routes as needed.
 */
export async function setupMockApi(page: Page, userId = 1) {
  // Users
  await page.route('**/api/users', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: MOCK_USERS })
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      await route.fulfill({ json: { id: 99, name: body.name, avatar: null } })
    } else {
      await route.continue()
    }
  })

  await page.route(`**/api/users/${userId}`, async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
    } else {
      await route.continue()
    }
  })

  // Books
  await page.route(`**/api/users/${userId}/books`, async (route) => {
    await route.fulfill({ json: MOCK_BOOKS })
  })

  await page.route('**/api/books', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        json: {
          id: 99,
          title: 'Uploaded Book',
          author: 'Unknown',
          format: 'epub',
          coverUrl: null,
          progress: null,
          addedAt: new Date().toISOString(),
        },
      })
    } else {
      await route.continue()
    }
  })

  await page.route('**/api/books/*/file', async (route) => {
    // Return a minimal valid EPUB binary placeholder
    await route.fulfill({ status: 200, body: Buffer.from('') })
  })

  await page.route('**/api/books/**', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
    } else if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 204, body: '' })
    } else {
      await route.continue()
    }
  })

  // Settings
  await page.route(`**/api/users/${userId}/settings`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: MOCK_SETTINGS })
    } else if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 204, body: '' })
    } else {
      await route.continue()
    }
  })
}
