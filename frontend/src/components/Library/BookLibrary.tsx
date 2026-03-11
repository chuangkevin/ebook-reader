import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import type { AppDispatch, RootState } from '../../store';
import { fetchBooks, fetchUserProgress, fetchBookmarks, toggleBookmark, deleteBook, addBook, setUploadProgress } from '../../store/bookSlice';
import { selectUser } from '../../store/userSlice';
import apiService from '../../services/api.service';
import type { Book } from '../../types';

function useTextConverter() {
  const convertToTraditional = useSelector((state: RootState) => state.settings.convertToTraditional);
  const converterRef = useRef<((text: string) => string) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (convertToTraditional) {
      import('opencc-js').then((OpenCC) => {
        converterRef.current = OpenCC.Converter({ from: 'cn', to: 'tw' });
        setReady(true);
      });
    } else {
      converterRef.current = null;
      setReady(false);
    }
  }, [convertToTraditional]);

  const convert = useCallback((text: string) => {
    if (converterRef.current && ready) return converterRef.current(text);
    return text;
  }, [ready]);

  return convert;
}

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
  const { books, userProgress, bookmarks, isLoading, uploadProgress } = useSelector((state: RootState) => state.books);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const convert = useTextConverter();

  useEffect(() => {
    dispatch(fetchBooks());
    if (currentUser) {
      dispatch(fetchUserProgress(currentUser.id));
      dispatch(fetchBookmarks(currentUser.id));
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

  const handleToggleBookmark = (bookId: string) => {
    if (!currentUser) return;
    dispatch(toggleBookmark({ userId: currentUser.id, bookId }));
  };

  const handleSwitchUser = () => {
    dispatch(selectUser(null));
    navigate('/');
  };

  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);

  // 區分「繼續閱讀」、「稍後閱讀」和「書庫」
  const { continueReading, readLaterBooks, otherBooks } = useMemo(() => {
    const progressMap = new Map(userProgress.map(p => [p.bookId, p]));
    const reading: Array<{ book: Book; percentage: number }> = [];
    const readLater: Book[] = [];
    const other: Book[] = [];

    for (const book of books) {
      const progress = progressMap.get(book.id);
      if (progress && (progress.percentage > 0 || progress.cfi)) {
        reading.push({ book, percentage: progress.percentage });
      } else if (bookmarkSet.has(book.id)) {
        readLater.push(book);
      } else {
        other.push(book);
      }
    }

    reading.sort((a, b) => {
      const pa = progressMap.get(a.book.id);
      const pb = progressMap.get(b.book.id);
      return (pb?.lastReadAt || 0) - (pa?.lastReadAt || 0);
    });

    return { continueReading: reading, readLaterBooks: readLater, otherBooks: other };
  }, [books, userProgress, bookmarkSet]);

  if (isLoading && books.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // 書籍卡片（共用）
  const renderBookCard = (book: Book, options?: { showProgress?: number }) => (
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
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {convert(book.title)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
              {convert(book.author)}
            </Typography>
            <Chip label={book.format.toUpperCase()} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
          </Box>
          {options?.showProgress !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={options.showProgress}
                sx={{ flex: 1, borderRadius: 1, height: 6 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32, textAlign: 'right' }}>
                {Math.round(options.showProgress)}%
              </Typography>
            </Box>
          )}
        </CardContent>
      </CardActionArea>

      {/* 操作按鈕 */}
      <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5 }}>
        <Tooltip title={bookmarkSet.has(book.id) ? '取消稍後閱讀' : '稍後閱讀'}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleToggleBookmark(book.id); }}
            sx={{ bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
          >
            {bookmarkSet.has(book.id) ? (
              <BookmarkIcon fontSize="small" sx={{ color: '#ffc107' }} />
            ) : (
              <BookmarkBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        {currentUser && book.uploadedBy === currentUser.id && (
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(book.id); setDeleteDialogOpen(true); }}
            sx={{ bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'error.dark' } }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Card>
  );

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
              <Box key={book.id} sx={{ minWidth: 180, maxWidth: 180, flexShrink: 0 }}>
                {renderBookCard(book, { showProgress: percentage })}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* 稍後閱讀 */}
      {readLaterBooks.length > 0 && (
        <Box sx={{ mb: 5 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            稍後閱讀
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, '::-webkit-scrollbar': { height: 6 }, '::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 3 } }}>
            {readLaterBooks.map((book) => (
              <Box key={book.id} sx={{ minWidth: 180, maxWidth: 180, flexShrink: 0 }}>
                {renderBookCard(book)}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* 書庫 */}
      {otherBooks.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            書庫
          </Typography>
          <Grid container spacing={2}>
            {otherBooks.map((book) => (
              <Grid item xs={6} sm={4} md={3} lg={2} key={book.id}>
                {renderBookCard(book)}
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {books.length === 0 && (
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
