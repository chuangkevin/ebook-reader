import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UserSelectionScreen from './pages/UserSelectionScreen'
import BookLibrary from './pages/BookLibrary'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserSelectionScreen />} />
        <Route path="/library" element={<BookLibrary />} />
        <Route path="/reader/:bookId" element={<div>閱讀器（待實作）</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
