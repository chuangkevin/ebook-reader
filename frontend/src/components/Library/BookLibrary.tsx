import { useState, useEffect, useRef, useMemo } from 'react';
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
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import type { AppDispatch, RootState } from '../../store';
import { fetchBooks, fetchUserProgress, deleteBook, addBook, setUploadProgress } from '../../store/bookSlice';
import { selectUser } from '../../store/userSlice';
import apiService from '../../services/api.service';
import type { Book } from '../../types';

function BookCover({ book, height }: { book: Book; height: number }) {
  return (
    <CardMedia
      component="img"
      height={height}
      image={apiService.getBookCoverUrl(book.id)}
      alt={book.title}
      sx={{ objectFit: 'cover' }}
    />
  );
}

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
    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploading(true);
    dispatch(setUploadProgress(0));

    try {
      const book = await apiService.uploadBook(file, currentUser.id, (percent) => {
        dispatch(setUploadProgress(percent));
      });
      dispatch(addBook(book));
      dispatch(fetchUserProgress(currentUser.id));
      setSnackbar({ open: true, message: `「${book.title}」上傳成功`, severity: 'success' });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosErr.response?.status === 409) {
        setSnackbar({ open: true, message: axiosErr.response.data?.error || '此書已存在', severity: 'error' });
      } else {
        setSnackbar({ open: true, message: '上傳失敗', severity: 'error' });
      }
    } finally {
      setUploading(false);
      dispatch(setUploadProgress(0));
    }
  };

  const handleDeleteBook = async () => {
    if (!deleteTarget) return;
    try {
      await dispatch(deleteBook(deleteTarget)).unwrap();
      setSnackbar({ open: true, message: '已刪除', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: '刪除失敗', severity: 'error' });
    }
    setDeleteTarget(null);
    setDeleteDialogOpen(false);
  };

  const handleSwitchUser = () => {
    dispatch(selectUser(null));
    navigate('/');
  };

  // 區分「繼續閱讀」和「未開始閱讀」的書
  const { continueReading, unreadBooks } = useMemo(() => {
    const progressMap = new Map(userProgress.map(p => [p.bookId, p]));
    const reading: Array<{ book: Book; percentage: number }> = [];
    const unread: Book[] = [];

    for (const book of books) {
      const progress = progressMap.get(book.id);
      if (progress && (progress.percentage > 0 || progress.cfi)) {
        reading.push({ book, percentage: progress.percentage });
      } else {
        unread.push(book);
      }
    }

    // 按最後閱讀時間排序
    reading.sort((a, b) => {
      const pa = progressMap.get(a.book.id);
      const pb = progressMap.get(b.book.id);
      return (pb?.lastReadAt || 0) - (pa?.lastReadAt || 0);
    });

    return { continueReading: reading, unreadBooks: unread };
  }, [books, userProgress]);

  if (isLoading && books.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const formatLabel = (fmt: string) => {
    return fmt.toUpperCase();
  };

  return (
    <Box sx={{ minHeight: '100vh', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {currentUser?.name}，你好
          </Typography>
          <Typography variant="body1" color="text.secondary">
            書庫共 {books.length} 本書
          </Typography>
        </Box>
        <Button startIcon={<LogoutIcon />} onClick={handleSwitchUser} variant="outlined">
          切換使用者
        </Button>
      </Box>

      {/* Upload Progress */}
      {uploading && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>上傳中... {uploadProgress}%</Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      {/* 繼續閱讀 */}
      {continueReading.length > 0 && (
        <Box sx={{ mb: 5 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            繼續閱讀
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, '::-webkit-scrollbar': { height: 6 }, '::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 3 } }}>
            {continueReading.map(({ book, percentage }) => (
              <Card
                key={book.id}
                sx={{
                  minWidth: 180,
                  maxWidth: 180,
                  flexShrink: 0,
                  position: 'relative',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'scale(1.03)' },
                }}
              >
                <CardActionArea onClick={() => navigate(`/read/${book.id}`)}>
                  <BookCover book={book} height={240} />
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {book.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {book.author}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        sx={{ flex: 1, borderRadius: 1, height: 6 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32, textAlign: 'right' }}>
                        {Math.round(percentage)}%
                      </Typography>
                    </Box>
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
            ))}
          </Box>
        </Box>
      )}

      {/* 書庫 */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        {continueReading.length > 0 ? '尚未閱讀' : '書庫'}
      </Typography>

      {unreadBooks.length > 0 ? (
        <Grid container spacing={2}>
          {unreadBooks.map((book) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={book.id}>
              <Card
                sx={{
                  height: '100%',
                  position: 'relative',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'scale(1.03)' },
                }}
              >
                <CardActionArea onClick={() => navigate(`/read/${book.id}`)}>
                  <BookCover book={book} height={240} />
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                      {book.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                        {book.author}
                      </Typography>
                      <Chip label={formatLabel(book.format)} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                    </Box>
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
          ))}
        </Grid>
      ) : books.length > 0 ? null : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            還沒有書，上傳你的第一本書吧！
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            支援 EPUB、PDF、TXT 格式
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
        <DialogTitle>確認刪除？</DialogTitle>
        <DialogContent>
          <Typography>此書籍與所有閱讀進度將永久刪除。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={handleDeleteBook} color="error" variant="contained">刪除</Button>
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
