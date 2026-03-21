import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConnectionBanner } from './components/ConnectionBanner'

const UserSelectionScreen = lazy(() => import('./pages/UserSelectionScreen'))
const BookLibrary = lazy(() => import('./pages/BookLibrary'))
const ReaderPage = lazy(() => import('./pages/ReaderPage'))

function App() {
  return (
    <BrowserRouter>
      <ConnectionBanner />
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
