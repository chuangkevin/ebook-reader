import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConnectionBanner } from './components/ConnectionBanner'
import { ConflictManager } from './components/ConflictManager'
import { initSyncListeners } from './services/syncEngine'
import { cacheAllBooks } from './services/bookCache'

const UserSelectionScreen = lazy(() => import('./pages/UserSelectionScreen'))
const BookLibrary = lazy(() => import('./pages/BookLibrary'))
const ReaderPage = lazy(() => import('./pages/ReaderPage'))

function App() {
  useEffect(() => {
    // Initialize sync engine (listens for online events, flushes queue)
    initSyncListeners()

    // Cache all books when online
    if (navigator.onLine) {
      cacheAllBooks().catch(() => {})
    }
    // Also cache when coming back online
    const handleOnline = () => { cacheAllBooks().catch(() => {}) }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return (
    <BrowserRouter>
      <ConnectionBanner />
      <ConflictManager />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<UserSelectionScreen />} />
          <Route path="/library" element={<BookLibrary />} />
          <Route path="/reader/:bookId" element={<ReaderPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
