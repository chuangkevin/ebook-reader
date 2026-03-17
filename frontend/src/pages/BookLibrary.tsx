import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppBar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Grid,
  IconButton,
  LinearProgress,
  Skeleton,
  Toolbar,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useUserStore } from '../stores/userStore'
import { useBookStore } from '../stores/bookStore'
import { api } from '../services/api.service'
import type { Book } from '../types/index'

function parseProgress(progress?: string): number {
  if (!progress) return 0
  const parts = progress.split('@@').filter(Boolean)
  return parts.length >= 2 ? parseFloat(parts[1]) * 100 : 0
}

const PLACEHOLDER_COLORS = [
  '#5c6bc0', '#42a5f5', '#26a69a', '#66bb6a',
  '#ffa726', '#ef5350', '#ab47bc', '#8d6e63',
]

function placeholderColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash)
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length]
}

function BookCard({
  book,
  onDelete,
  onClick,
}: {
  book: Book
  onDelete: (book: Book) => void
  onClick: (book: Book) => void
}) {
  const progress = parseProgress(book.progress)

  return (
    <Card
      sx={{
        bgcolor: '#2a2a2a',
        color: 'white',
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardActionArea
        onClick={() => onClick(book)}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {book.coverUrl ? (
          <CardMedia
            component="img"
            image={book.coverUrl}
            alt={book.title}
            sx={{ height: 180, objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              height: 180,
              bgcolor: placeholderColor(book.title),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="h2" sx={{ color: 'white', fontWeight: 700, userSelect: 'none' }}>
              {book.title.charAt(0)}
            </Typography>
          </Box>
        )}
        <CardContent sx={{ flexGrow: 1, pb: '8px !important' }}>
          <Typography
            variant="body1"
            fontWeight={600}
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 0.5,
            }}
          >
            {book.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'grey.500',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {book.author}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ mt: 1, borderRadius: 1, bgcolor: 'grey.800', '& .MuiLinearProgress-bar': { bgcolor: '#90caf9' } }}
          />
        </CardContent>
      </CardActionArea>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(book)
        }}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          bgcolor: 'rgba(0,0,0,0.55)',
          color: 'grey.300',
          '&:hover': { bgcolor: 'rgba(200,0,0,0.7)', color: 'white' },
        }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Card>
  )
}

export default function BookLibrary() {
  const navigate = useNavigate()
  const currentUser = useUserStore((s) => s.currentUser)
  const { books, setBooks, setCurrentBook } = useBookStore()
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!currentUser) {
      navigate('/')
      return
    }
    setLoading(true)
    api.books.list(currentUser.id).then((data) => {
      setBooks(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [currentUser, navigate, setBooks])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    e.target.value = ''
    try {
      const book = await api.books.upload(file, currentUser.id)
      setBooks([...books, book])
    } catch {
      // upload failed silently
    }
  }

  async function handleDelete(book: Book) {
    try {
      await api.books.remove(book.id)
      setBooks(books.filter((b) => b.id !== book.id))
    } catch {
      // delete failed silently
    }
  }

  function handleCardClick(book: Book) {
    setCurrentBook(book)
    navigate(`/reader/${book.id}`)
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#1a1a1a', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" sx={{ bgcolor: '#111', boxShadow: 'none', borderBottom: '1px solid #333' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            書庫
          </Typography>
          <Typography variant="body2" sx={{ color: 'grey.400', mr: 2 }}>
            {currentUser?.name}
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => fileInputRef.current?.click()}
            title="上傳書籍"
            sx={{ gap: 0.5 }}
          >
            <UploadFileIcon />
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              上傳書籍
            </Typography>
          </IconButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub,.pdf,.txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, flexGrow: 1 }}>
        <Grid container spacing={2}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Grid item xs={6} sm={4} md={3} key={i}>
                  <Skeleton variant="rectangular" height={280} sx={{ bgcolor: '#2a2a2a', borderRadius: 1 }} />
                </Grid>
              ))
            : books.map((book) => (
                <Grid item xs={6} sm={4} md={3} key={book.id}>
                  <BookCard book={book} onDelete={handleDelete} onClick={handleCardClick} />
                </Grid>
              ))}
          {!loading && books.length === 0 && (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', mt: 8, color: 'grey.600' }}>
                <UploadFileIcon sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6">書庫是空的</Typography>
                <Typography variant="body2">點擊右上角上傳書籍</Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Box>
    </Box>
  )
}
