import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './store';
import UserSelectionScreen from './components/UserSelection/UserSelectionScreen';
import BookLibrary from './components/Library/BookLibrary';
import BookReader from './components/Reader/BookReader';

function AppContent() {
  const { currentUser } = useSelector((state: RootState) => state.user);

  return (
    <Routes>
      <Route path="/" element={
        currentUser ? <Navigate to="/library" replace /> : <UserSelectionScreen />
      } />
      <Route path="/library" element={
        currentUser ? <BookLibrary /> : <Navigate to="/" replace />
      } />
      <Route path="/read/:bookId" element={
        currentUser ? <BookReader /> : <Navigate to="/" replace />
      } />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
