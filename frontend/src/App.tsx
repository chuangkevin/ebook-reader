import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ReaderGate from './components/ReaderGate'
import RouteState from './components/RouteState'

const UserSelectionScreen = lazy(() => import('./pages/UserSelectionScreen'))
const BookLibrary = lazy(() => import('./pages/BookLibrary'))
const ReaderPage = lazy(() => import('./pages/ReaderPage'))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteState loading title="正在翻開下一頁" />}>
        <Routes>
          <Route path="/" element={<UserSelectionScreen />} />
          <Route path="/readers" element={<UserSelectionScreen />} />
          <Route path="/readers/new" element={<UserSelectionScreen />} />
          <Route
            path="/library"
            element={
              <ReaderGate>
                <BookLibrary />
              </ReaderGate>
            }
          />
          <Route
            path="/settings"
            element={
              <ReaderGate>
                <BookLibrary />
              </ReaderGate>
            }
          />
          <Route
            path="/upload"
            element={
              <ReaderGate>
                <BookLibrary />
              </ReaderGate>
            }
          />
          <Route
            path="/reader/:bookId"
            element={
              <ReaderGate>
                <ReaderPage />
              </ReaderGate>
            }
          />
          <Route
            path="*"
            element={
              <RouteState title="這一頁不在書架上" message="網址可能已變更，請回到書庫繼續閱讀。" />
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
export default App
