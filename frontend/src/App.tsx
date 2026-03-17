import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UserSelectionScreen from './pages/UserSelectionScreen'
import BookLibrary from './pages/BookLibrary'
import ReaderPage from './pages/ReaderPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserSelectionScreen />} />
        <Route path="/library" element={<BookLibrary />} />
        <Route path="/reader/:bookId" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
