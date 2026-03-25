import { useCallback, useEffect, useMemo, useState } from 'react'
import { extractBookTitle } from '../utils/epubMeta'
import { useNavigate } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  LinearProgress,
  Skeleton,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  TextField,
  Tooltip,
  Toolbar,
  Typography,
} from '@mui/material'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import FolderIcon from '@mui/icons-material/Folder'
import PersonIcon from '@mui/icons-material/Person'
import SwitchAccountIcon from '@mui/icons-material/SwitchAccount'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useUserStore } from '../stores/userStore'
import { useBookStore } from '../stores/bookStore'
import { api } from '../services/api.service'
import type { Book } from '../types/index'
import UploadDialog from '../components/UploadDialog'
import type { UploadFile } from '../components/UploadDialog'

// Parse progress string (new format: @@chapterIndex@@fraction@@totalSections, old: @@idx@@fraction)
function parseProgressPercent(progress?: string): number {
  if (!progress) return 0
  const parts = progress.split('@@').filter(Boolean)
  // New format: @@index@@fraction@@totalSections@@weightedFraction
  if (parts.length >= 4) {
    const weighted = parseFloat(parts[3])
    if (!isNaN(weighted)) return Math.min(100, Math.max(0, Math.round(weighted * 100)))
  }
  // Old format: @@index@@fraction@@totalSections
  if (parts.length >= 3) {
    const idx = parseFloat(parts[0])
    const frac = parseFloat(parts[1])
    const total = parseFloat(parts[2])
    if (total > 0) return Math.round(((idx + frac) / total) * 100)
  }
  if (parts.length >= 2) return Math.round(parseFloat(parts[1]) * 100)
  return 0
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

function groupBooksByCollection(books: Book[]): { collection: string | null; books: Book[] }[] {
  const map = new Map<string | null, Book[]>()
  for (const book of books) {
    const key = book.collection ?? null
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(book)
  }
  const result: { collection: string | null; books: Book[] }[] = []
  const namedCollections = ([...map.keys()].filter(k => k !== null) as string[]).sort()
  for (const col of namedCollections) {
    result.push({ collection: col, books: map.get(col)! })
  }
  if (map.has(null)) {
    result.push({ collection: null, books: map.get(null)! })
  }
  return result
}

interface BookCardProps {
  book: Book
  progressPercent?: number
  bookmarked?: boolean
  showClearProgress?: boolean
  canDelete?: boolean
  onDelete: (book: Book) => void
  onClick: (book: Book) => void
  onBookmark: (bookId: string) => void
  onClearProgress?: (bookId: string) => void
}

function BookCard({ book, progressPercent, bookmarked, showClearProgress, canDelete, onDelete, onClick, onBookmark, onClearProgress }: BookCardProps) {
  const pct = progressPercent ?? parseProgressPercent(book.progress)

  return (
    <Card
      sx={{
        bgcolor: '#2a2a2a',
        color: 'white',
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.15s',
        '&:hover': { transform: 'scale(1.03)' },
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
            sx={{ height: 200, objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              height: 200,
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
        <CardContent sx={{ flexGrow: 1, pb: '8px !important', px: 1.5, pt: 1 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 0.5 }}
          >
            {book.title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'grey.500', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {book.author}
          </Typography>
          {pct > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ flex: 1, borderRadius: 1, height: 5, bgcolor: 'grey.800', '& .MuiLinearProgress-bar': { bgcolor: '#90caf9' } }}
              />
              <Typography variant="caption" sx={{ color: 'grey.400', minWidth: 28, textAlign: 'right', fontSize: 10 }}>
                {pct}%
              </Typography>
            </Box>
          )}
        </CardContent>
      </CardActionArea>

      {/* Action buttons */}
      <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {showClearProgress && onClearProgress && (
          <Tooltip title="不看了" placement="left">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onClearProgress(book.id) }}
              sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'grey.300', width: 28, height: 28, '&:hover': { bgcolor: 'rgba(200,0,0,0.7)', color: 'white' } }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={bookmarked ? '取消稍後閱讀' : '稍後閱讀'} placement="left">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onBookmark(book.id) }}
            sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: bookmarked ? '#ffc107' : 'grey.300', width: 28, height: 28, '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}
          >
            {bookmarked
              ? <BookmarkIcon sx={{ fontSize: 14 }} />
              : <BookmarkBorderIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
        {canDelete && (
          <Tooltip title="刪除" placement="left">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDelete(book) }}
              sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'grey.300', width: 28, height: 28, '&:hover': { bgcolor: 'rgba(200,0,0,0.7)', color: 'white' } }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Card>
  )
}


export default function BookLibrary() {
  const navigate = useNavigate()
  const currentUser = useUserStore((s) => s.currentUser)
  const setCurrentUser = useUserStore((s) => s.setCurrentUser)
  const { books, setBooks, setCurrentBook } = useBookStore()
  const [loading, setLoading] = useState(true)
  const [bookmarkSet, setBookmarkSet] = useState<Set<string>>(new Set())
  const [progressMap, setProgressMap] = useState<Map<string, { cfi: string; percentage: number; lastReadAt: number }>>(new Map())
  const [confirmBook, setConfirmBook] = useState<Book | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileColor, setProfileColor] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!currentUser) { navigate('/'); return }
    setLoading(true)
    try {
      const [booksData, bookmarksData, progressData] = await Promise.all([
        api.books.list(currentUser.id),
        api.bookmarks.list(currentUser.id),
        api.books.getUserProgress(currentUser.id),
      ])
      const progMap = new Map(progressData.map(p => [p.bookId, { cfi: p.cfi, percentage: p.percentage, lastReadAt: p.lastReadAt }]))
      const booksWithProgress = booksData.map(b => {
        const prog = progMap.get(b.id)
        return prog ? { ...b, progress: prog.cfi } : b
      })
      setBooks(booksWithProgress)
      setBookmarkSet(new Set(bookmarksData))
      setProgressMap(progMap)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentUser, navigate, setBooks])

  useEffect(() => { loadData() }, [loadData])

  // Split books into sections
  const { continueReading, readLater, otherBooks } = useMemo(() => {
    const reading: Array<{ book: Book; percentage: number; lastReadAt: number; }> = []
    const later: Book[] = []
    const other: Book[] = []

    for (const book of books) {
      const prog = progressMap.get(book.id)
      if (prog && prog.percentage > 0) {
        reading.push({ book, percentage: prog.percentage, lastReadAt: prog.lastReadAt })
      } else if (bookmarkSet.has(book.id)) {
        later.push(book)
      } else {
        other.push(book)
      }
    }

    reading.sort((a, b) => b.lastReadAt - a.lastReadAt)
    return { continueReading: reading, readLater: later, otherBooks: other }
  }, [books, progressMap, bookmarkSet])

  const collectionGroups = useMemo(() => groupBooksByCollection(otherBooks), [otherBooks])
  const hasCollections = collectionGroups.some(g => g.collection !== null)

  function openFilePicker(folder: boolean) {
    // setTimeout(0) lets the SpeedDial backdrop close before the file picker opens
    setTimeout(() => {
      const input = document.createElement('input')
      input.type = 'file'
      input.style.position = 'fixed'
      input.style.opacity = '0'
      input.style.pointerEvents = 'none'
      if (folder) {
        input.setAttribute('webkitdirectory', '')
      } else {
        input.multiple = true
        input.accept = '.epub,.pdf,.txt'
      }
      document.body.appendChild(input)

      input.addEventListener('change', async () => {
        const files = input.files
        document.body.removeChild(input)
        if (!files || files.length === 0 || !currentUser) return

        let baseList: UploadFile[]
        if (folder) {
          baseList = Array.from(files)
            .filter(f => /\.(epub|pdf|txt)$/i.test(f.name))
            .map(f => {
              const parts = f.webkitRelativePath.split('/')
              // parts[0] = selected root folder (skip)
              // parts.length === 2 → root-level file → no collection
              // parts.length >= 3 → in subfolder → collection = subfolder name
              const collection = parts.length >= 3 ? parts[1] : null
              return { file: f, collection }
            })
        } else {
          baseList = Array.from(files).map(f => ({ file: f, collection: null }))
        }
        if (baseList.length === 0) return

        // Extract metadata and pre-check duplicates before opening dialog
        const norm = (s: string) => s.trim().toLowerCase()
        const existingTitleSet = new Set(books.map(b => norm(b.title)))
        const results = await Promise.allSettled(
          baseList.map(uf => extractBookTitle(uf.file))
        )
        const uploadList: UploadFile[] = baseList.map((uf, i) => {
          const resolvedTitle = results[i].status === 'fulfilled'
            ? (results[i] as PromiseFulfilledResult<string | null>).value ?? undefined
            : undefined
          const filenameStem = uf.file.name.replace(/\.(epub|pdf|txt)$/i, '')
          // Match by: 1) extracted EPUB title  2) filename stem (covers TXT/PDF or when EPUB parse fails)
          const preMarkedDuplicate =
            (resolvedTitle !== undefined && existingTitleSet.has(norm(resolvedTitle))) ||
            existingTitleSet.has(norm(filenameStem))
          return { ...uf, resolvedTitle, preMarkedDuplicate }
        })

        setUploadFiles(uploadList)
        setUploadOpen(true)
      })

      input.click()
    }, 0)
  }

  function handleUploadDone() {
    setUploadOpen(false)
    loadData()
  }

  async function handleDelete(book: Book) {
    setConfirmBook(book)
  }

  async function confirmDelete() {
    if (!confirmBook || !currentUser) return
    const book = confirmBook
    setConfirmBook(null)
    try {
      await api.books.remove(book.id, currentUser.id)
      setBooks(books.filter((b) => b.id !== book.id))
      setProgressMap(prev => { const m = new Map(prev); m.delete(book.id); return m })
    } catch {
      // ignore
    }
  }

  async function handleBookmark(bookId: string) {
    if (!currentUser) return
    try {
      await api.bookmarks.toggle(currentUser.id, bookId)
      setBookmarkSet(prev => {
        const s = new Set(prev)
        s.has(bookId) ? s.delete(bookId) : s.add(bookId)
        return s
      })
    } catch {
      // ignore
    }
  }

  async function handleClearProgress(bookId: string) {
    if (!currentUser) return
    try {
      await api.books.clearProgress(currentUser.id, bookId)
      setProgressMap(prev => { const m = new Map(prev); m.delete(bookId); return m })
    } catch {
      // ignore
    }
  }

  function handleCardClick(book: Book) {
    setCurrentBook(book)
    navigate(`/reader/${book.id}`)
  }

  const cardProps = { onDelete: handleDelete, onClick: handleCardClick, onBookmark: handleBookmark, onClearProgress: handleClearProgress }
  const isUploader = (book: Book) => !!currentUser && book.uploadedBy === currentUser.id

  const PROFILE_COLORS = ['#5c6bc0', '#42a5f5', '#26a69a', '#66bb6a', '#ffa726', '#ef5350', '#ab47bc', '#8d6e63']

  function openProfile() {
    if (!currentUser) return
    setProfileName(currentUser.name)
    setProfileColor(currentUser.avatarColor ?? PROFILE_COLORS[0])
    setProfileOpen(true)
  }

  async function saveProfile() {
    if (!currentUser || !profileName.trim()) return
    setProfileSaving(true)
    try {
      const updated = await api.users.update(currentUser.id, profileName.trim(), profileColor)
      setCurrentUser({ ...currentUser, name: updated.name, avatarColor: profileColor })
    } catch { /* ignore */ }
    setProfileSaving(false)
    setProfileOpen(false)
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#1a1a1a', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" sx={{ bgcolor: '#111', boxShadow: 'none', borderBottom: '1px solid #222' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            書庫
          </Typography>
          <Typography variant="body2" sx={{ color: 'grey.400', mr: 0.5 }}>
            {currentUser?.name}
          </Typography>
          <Tooltip title="切換使用者">
            <IconButton color="inherit" size="small" onClick={() => navigate('/')}>
              <SwitchAccountIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, pt: 3, pb: 10 }}>
        {loading ? (
          <Box sx={{ px: 2 }}>
            <Skeleton variant="text" width={120} height={32} sx={{ bgcolor: '#2a2a2a', mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} variant="rectangular" width={160} height={280} sx={{ bgcolor: '#2a2a2a', borderRadius: 1, flexShrink: 0 }} />
              ))}
            </Box>
          </Box>
        ) : (
          <>
            {/* 繼續閱讀 */}
            {continueReading.length > 0 && (
              <Box sx={{ mb: 5, px: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>繼續閱讀</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
                  {continueReading.map(({ book, percentage }) => (
                    <BookCard key={book.id} {...cardProps} book={book} progressPercent={percentage} bookmarked={bookmarkSet.has(book.id)} showClearProgress canDelete={isUploader(book)} />
                  ))}
                </Box>
              </Box>
            )}

            {/* 稍後閱讀 */}
            {readLater.length > 0 && (
              <Box sx={{ mb: 5, px: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>稍後閱讀</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
                  {readLater.map((book) => (
                    <BookCard key={book.id} {...cardProps} book={book} bookmarked canDelete={isUploader(book)} />
                  ))}
                </Box>
              </Box>
            )}

            {/* 書庫 — 分類或一般顯示 */}
            {hasCollections ? (
              <>
                {/* Named collection grid sections */}
                {collectionGroups.filter(g => g.collection !== null).map(g => (
                  <Box key={g.collection} sx={{ mb: 5, px: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
                      {g.collection}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
                      {g.books.map(book => (
                        <BookCard key={book.id} {...cardProps} book={book} bookmarked={bookmarkSet.has(book.id)} canDelete={isUploader(book)} />
                      ))}
                    </Box>
                  </Box>
                ))}
                {/* Uncategorized books */}
                {(() => {
                  const uncategorized = collectionGroups.find(g => g.collection === null)
                  if (!uncategorized || uncategorized.books.length === 0) return null
                  return (
                    <Box sx={{ px: 2 }}>
                      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>其他書籍</Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
                        {uncategorized.books.map(book => (
                          <BookCard key={book.id} {...cardProps} book={book} bookmarked={bookmarkSet.has(book.id)} canDelete={isUploader(book)} />
                        ))}
                      </Box>
                    </Box>
                  )
                })()}
              </>
            ) : (
              /* No collections — original grid display */
              otherBooks.length > 0 && (
                <Box sx={{ px: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
                    書庫
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
                    {otherBooks.map((book) => (
                      <BookCard key={book.id} {...cardProps} book={book} bookmarked={bookmarkSet.has(book.id)} canDelete={isUploader(book)} />
                    ))}
                  </Box>
                </Box>
              )
            )}

            {books.length === 0 && (
              <Box sx={{ textAlign: 'center', mt: 12, color: 'grey.600' }}>
                <Typography variant="h6">書庫是空的</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>點擊右下角 + 上傳書籍</Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      <SpeedDial
        ariaLabel="上傳書籍"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction
          icon={<FolderIcon />}
          tooltipTitle="選擇資料夾"
          onClick={() => openFilePicker(true)}
        />
        <SpeedDialAction
          icon={<UploadFileIcon />}
          tooltipTitle="選擇檔案"
          onClick={() => openFilePicker(false)}
        />
      </SpeedDial>

      <UploadDialog
        open={uploadOpen}
        files={uploadFiles}
        userId={currentUser?.id ?? ''}
        onClose={() => setUploadOpen(false)}
        onAllDone={handleUploadDone}
      />

      <Dialog open={!!confirmBook} onClose={() => setConfirmBook(null)}>
        <DialogTitle>確認刪除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            確定要刪除《{confirmBook?.title}》嗎？此操作無法復原。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmBook(null)}>取消</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">刪除</Button>
        </DialogActions>
      </Dialog>

      {/* PROFILE 按鈕 */}
      <Button
        variant="outlined"
        startIcon={<PersonIcon />}
        onClick={openProfile}
        sx={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: 8,
          px: 4,
          py: 1,
          bgcolor: 'rgba(0,0,0,0.6)',
          color: '#fff',
          borderColor: 'rgba(255,255,255,0.2)',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.4)' },
          zIndex: 10,
        }}
      >
        個人設定
      </Button>

      {/* 個人設定 Drawer */}
      <Drawer
        anchor="bottom"
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            px: 3,
            py: 3,
            maxHeight: '50%',
          },
        }}
      >
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>個人設定</Typography>

        <TextField
          label="名稱"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          error={!profileName.trim()}
          helperText={!profileName.trim() ? '名稱不可為空' : ''}
          fullWidth
          sx={{ mb: 3 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>頭像顏色</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
          {PROFILE_COLORS.map((color) => (
            <Avatar
              key={color}
              sx={{
                bgcolor: color,
                width: 40,
                height: 40,
                cursor: 'pointer',
                border: profileColor === color ? '3px solid #fff' : '3px solid transparent',
                boxShadow: profileColor === color ? `0 0 0 2px ${color}` : 'none',
              }}
              onClick={() => setProfileColor(color)}
            >
              {profileColor === color ? '✓' : ''}
            </Avatar>
          ))}
        </Box>

        <Button
          variant="contained"
          onClick={saveProfile}
          disabled={!profileName.trim() || profileSaving}
          fullWidth
        >
          {profileSaving ? '儲存中...' : '儲存'}
        </Button>
      </Drawer>
    </Box>
  )
}
