import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActionArea,
  Button,
  Fab,
  LinearProgress,
  IconButton,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import type { AppDispatch, RootState } from '../../store';
import { fetchBooks, fetchUserProgress, deleteBook, addBook, setUploadProgress } from '../../store/bookSlice';
import { selectUser } from '../../store/userSlice';
import apiService from '../../services/api.service';

export default function BookLibrary() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { currentUser } = useSelector((state: RootState) => state.user);
  const { books, userProgress, isLoading, uploadProgress } = useSelector((state: RootState) => state.books);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dispatch(fetchBooks());
    if (currentUser) {
      dispatch(fetchUserProgress(currentUser.id));
    }
  }, [dispatch, currentUser]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploading(true);
    dispatch(setUploadProgress(0));

    try {
      const book = await apiService.uploadBook(file, currentUser.id, (percent) => {
        dispatch(setUploadProgress(percent));
      });
      dispatch(addBook(book));
      setSnackbar({ open: true, message: `"${book.title}" uploaded successfully`, severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to upload book', severity: 'error' });
    } finally {
      setUploading(false);
      dispatch(setUploadProgress(0));
    }
  };

  const handleDeleteBook = async () => {
    if (!deleteTarget) return;
    try {
      await dispatch(deleteBook(deleteTarget)).unwrap();
      setSnackbar({ open: true, message: 'Book deleted', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete book', severity: 'error' });
    }
    setDeleteTarget(null);
    setDeleteDialogOpen(false);
  };

  const handleSwitchUser = () => {
    dispatch(selectUser(null));
    navigate('/');
  };

  const continueReading = userProgress.filter(p => p.percentage > 0 && p.percentage < 100);

  if (isLoading && books.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Hello, {currentUser?.name}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {books.length} book{books.length !== 1 ? 's' : ''} in library
          </Typography>
        </Box>
        <Button startIcon={<LogoutIcon />} onClick={handleSwitchUser} variant="outlined">
          Switch User
        </Button>
      </Box>

      {/* Upload Progress */}
      {uploading && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>Uploading... {uploadProgress}%</Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      {/* Continue Reading */}
      {continueReading.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Continue Reading
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
            {continueReading.map((item) => (
              <Card key={item.bookId} sx={{ minWidth: 160, maxWidth: 160, flexShrink: 0 }}>
                <CardActionArea onClick={() => navigate(`/read/${item.bookId}`)}>
                  <CardMedia
                    component="img"
                    height="200"
                    image={apiService.getBookCoverUrl(item.bookId)}
                    alt={item.title}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                      {item.title}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={item.percentage}
                      sx={{ mt: 1, borderRadius: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(item.percentage)}%
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* All Books */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        All Books
      </Typography>
      <Grid container spacing={2}>
        {books.map((book) => {
          const progress = userProgress.find(p => p.bookId === book.id);
          return (
            <Grid item xs={6} sm={4} md={3} lg={2} key={book.id}>
              <Card sx={{ height: '100%', position: 'relative' }}>
                <CardActionArea onClick={() => navigate(`/read/${book.id}`)}>
                  <CardMedia
                    component="img"
                    height="240"
                    image={apiService.getBookCoverUrl(book.id)}
                    alt={book.title}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                      {book.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {book.author}
                    </Typography>
                    {progress && progress.percentage > 0 && (
                      <LinearProgress
                        variant="determinate"
                        value={progress.percentage}
                        sx={{ mt: 1, borderRadius: 1 }}
                      />
                    )}
                  </CardContent>
                </CardActionArea>
                {currentUser && book.uploadedBy === currentUser.id && (
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(book.id); setDeleteDialogOpen(true); }}
                    sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'error.dark' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {books.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No books yet. Upload your first book! (EPUB, PDF, TXT)
          </Typography>
        </Box>
      )}

      {/* Upload FAB */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.pdf,.txt"
        hidden
        onChange={handleUpload}
      />
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <AddIcon />
      </Fab>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Book?</DialogTitle>
        <DialogContent>
          <Typography>This book and all reading progress will be permanently deleted.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteBook} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
