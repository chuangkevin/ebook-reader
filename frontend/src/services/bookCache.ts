/**
 * Book Cache Service
 *
 * Uses the Cache API to pre-cache book files for offline reading.
 * The service worker (via workbox) also caches book files on fetch,
 * but this module allows proactive caching of all books when online.
 */

const BOOK_CACHE_NAME = 'readflix-books-v1'
const COVER_CACHE_NAME = 'readflix-covers-v1'

interface BookListItem {
  id: string
  title: string
  [key: string]: unknown
}

/**
 * Fetch the book list from the API and cache every book file + cover.
 * Skips books that are already cached.
 * Returns the number of newly cached books.
 */
export async function cacheAllBooks(): Promise<number> {
  const response = await fetch('/api/books')
  if (!response.ok) {
    throw new Error(`Failed to fetch book list: ${response.status}`)
  }

  const books: BookListItem[] = await response.json() as BookListItem[]
  const bookCache = await caches.open(BOOK_CACHE_NAME)
  const coverCache = await caches.open(COVER_CACHE_NAME)

  let newlyCached = 0

  for (const book of books) {
    const fileUrl = `/api/books/${book.id}/file`
    const coverUrl = `/api/books/${book.id}/cover`

    // Cache book file if not already cached
    const existingFile = await bookCache.match(fileUrl)
    if (!existingFile) {
      try {
        const fileResponse = await fetch(fileUrl)
        if (fileResponse.ok) {
          await bookCache.put(fileUrl, fileResponse)
          newlyCached++
        }
      } catch {
        // Skip this book on network error, continue with others
        console.warn(`Failed to cache book file: ${book.title} (${book.id})`)
      }
    }

    // Cache cover if not already cached
    const existingCover = await coverCache.match(coverUrl)
    if (!existingCover) {
      try {
        const coverResponse = await fetch(coverUrl)
        if (coverResponse.ok) {
          await coverCache.put(coverUrl, coverResponse)
        }
      } catch {
        // Cover caching failure is non-critical
      }
    }
  }

  return newlyCached
}

/**
 * Check if a specific book's file is cached.
 */
export async function isBookCached(bookId: string): Promise<boolean> {
  try {
    const cache = await caches.open(BOOK_CACHE_NAME)
    const match = await cache.match(`/api/books/${bookId}/file`)
    return match !== undefined
  } catch {
    return false
  }
}

/**
 * Get cache status for all books.
 * Returns a Map of bookId to cached boolean.
 */
export async function getCacheStatus(): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>()

  try {
    const response = await fetch('/api/books')
    if (!response.ok) return result

    const books: BookListItem[] = await response.json() as BookListItem[]
    const cache = await caches.open(BOOK_CACHE_NAME)

    for (const book of books) {
      const match = await cache.match(`/api/books/${book.id}/file`)
      result.set(book.id, match !== undefined)
    }
  } catch {
    // If we can't fetch the book list, try to infer from cache keys
    try {
      const cache = await caches.open(BOOK_CACHE_NAME)
      const keys = await cache.keys()
      for (const request of keys) {
        const match = request.url.match(/\/api\/books\/([^/]+)\/file$/)
        if (match) {
          result.set(match[1], true)
        }
      }
    } catch {
      // Cache API not available
    }
  }

  return result
}

/**
 * Remove a specific book from the cache.
 */
export async function removeBookFromCache(bookId: string): Promise<boolean> {
  try {
    const bookCache = await caches.open(BOOK_CACHE_NAME)
    const coverCache = await caches.open(COVER_CACHE_NAME)

    const fileDeleted = await bookCache.delete(`/api/books/${bookId}/file`)
    await coverCache.delete(`/api/books/${bookId}/cover`)

    return fileDeleted
  } catch {
    return false
  }
}

/**
 * Clear all cached books and covers.
 */
export async function clearBookCache(): Promise<void> {
  await caches.delete(BOOK_CACHE_NAME)
  await caches.delete(COVER_CACHE_NAME)
}
