import { APP_VERSION } from '../version'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { extractBookTitle } from '../utils/epubMeta'
import { Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Alert,
  Chip,
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
import ThemeSwitch from '../components/ThemeSwitch'
import { clearRecovery, waitForProgress } from '../utils/readingProgress'
import { libraryReturn, routePath } from '../utils/navigation'
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
  '#38534e',
  '#4a555f',
  '#695240',
  '#48563c',
  '#76503b',
  '#75443e',
  '#584d62',
  '#5f574b',
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
  const namedCollections = ([...map.keys()].filter((k) => k !== null) as string[]).sort()
  for (const col of namedCollections) {
    result.push({ collection: col, books: map.get(col)! })
  }
  if (map.has(null)) {
    result.push({ collection: null, books: map.get(null)! })
  }
  return result
}

interface BookCardProps {
  compact?: boolean
  book: Book
  progressPercent?: number
  bookmarked?: boolean
  showClearProgress?: boolean
  canDelete?: boolean
  onDelete: (book: Book) => void
  onBookmark: (bookId: string) => void
  onClearProgress?: (bookId: string) => void
}

function BookCard({
  compact = false,
  book,
  progressPercent,
  bookmarked,
  showClearProgress,
  canDelete,
  onDelete,
  onBookmark,
  onClearProgress,
}: BookCardProps) {
  const location = useLocation()
  const from = libraryReturn(location.pathname + location.search)
  const [coverFailed, setCoverFailed] = useState(false)
  const pct = progressPercent ?? parseProgressPercent(book.progress)

  return (
    <Card
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        position: 'relative',
        height: '100%',
        minHeight: compact ? 184 : undefined,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        transition: 'transform 180ms ease',
        '&:hover': { transform: 'translateY(-4px)' },
      }}
    >
      <CardActionArea
        aria-label={`閱讀 ${book.title}`}
        component={Link}
        to={`/reader/${encodeURIComponent(book.id)}?from=${encodeURIComponent(from)}`}
        sx={{
          flexGrow: 1,
          display: compact ? 'grid' : 'flex',
          gridTemplateColumns: compact
            ? { xs: '100px minmax(0, 1fr)', sm: '120px minmax(0, 1fr)' }
            : undefined,
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        {book.coverUrl && !coverFailed ? (
          <CardMedia
            component="img"
            image={book.coverUrl}
            alt={book.title}
            onError={() => setCoverFailed(true)}
            sx={{
              height: compact ? '100%' : { xs: 210, sm: 260 },
              minHeight: compact ? 184 : undefined,
              objectFit: 'contain',
              bgcolor: 'action.hover',
              p: compact ? 1 : 2,
            }}
          />
        ) : (
          <Box
            sx={{
              height: compact ? '100%' : { xs: 210, sm: 260 },
              minHeight: compact ? 184 : undefined,
              background: `linear-gradient(100deg, #0003 0 4%, transparent 4% 6%, #fff1 6% 7%, transparent 7%), ${placeholderColor(book.title)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="h2"
              sx={{
                color: '#fffaf0',
                fontFamily: '"Songti TC", serif',
                fontWeight: 600,
                fontSize: compact ? 22 : { xs: 26, sm: 32 },
                writingMode: /[\u3400-\u9fff]/.test(book.title) ? 'vertical-rl' : 'horizontal-tb',
                overflowWrap: 'anywhere',
                textAlign: 'center',
                maxHeight: compact ? 144 : 180,
                px: compact ? 1 : 3,
                overflow: 'hidden',
                userSelect: 'none',
              }}
            >
              {book.title}
            </Typography>
          </Box>
        )}
        <CardContent
          sx={{
            flexGrow: 1,
            minWidth: 0,
            pb: compact ? '56px !important' : '8px !important',
            px: compact ? 2 : 1.5,
            pt: compact ? 2 : 1,
          }}
        >
          <Typography
            variant={compact ? 'body1' : 'body2'}
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
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {book.author === 'Unknown' ? '作者未提供' : book.author}
          </Typography>
          {pct > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  flex: 1,
                  borderRadius: 1,
                  height: 5,
                  bgcolor: 'divider',
                  '& .MuiLinearProgress-bar': { bgcolor: 'primary.main' },
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', minWidth: 28, textAlign: 'right', fontSize: 12 }}
              >
                {pct}%
              </Typography>
            </Box>
          )}
        </CardContent>
      </CardActionArea>

      {/* Actions remain outside the reading link and never cover the book artwork. */}
      <Box
        sx={{
          position: compact ? 'absolute' : 'static',
          bottom: compact ? 0 : undefined,
          right: compact ? 4 : undefined,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 0.25,
          px: 0.5,
          pb: 0.5,
          borderTop: compact ? 'none' : '1px solid',
          borderColor: 'divider',
        }}
      >
        {showClearProgress && onClearProgress && (
          <Tooltip title="不看了" placement="left">
            <IconButton
              size="small"
              aria-label={`清除 ${book.title} 的閱讀進度`}
              onClick={(e) => {
                e.stopPropagation()
                onClearProgress(book.id)
              }}
              sx={{
                bgcolor: 'transparent',
                color: 'text.secondary',
                width: 44,
                height: 44,
                '&:hover': { bgcolor: 'rgba(200,0,0,0.7)', color: '#fff' },
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={bookmarked ? '取消稍後閱讀' : '稍後閱讀'} placement="left">
          <IconButton
            size="small"
            aria-label={`${bookmarked ? '取消稍後閱讀' : '稍後閱讀'} ${book.title}`}
            onClick={(e) => {
              e.stopPropagation()
              onBookmark(book.id)
            }}
            sx={{
              bgcolor: 'transparent',
              color: bookmarked ? 'primary.main' : 'text.secondary',
              width: 44,
              height: 44,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            {bookmarked ? (
              <BookmarkIcon sx={{ fontSize: 18 }} />
            ) : (
              <BookmarkBorderIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Tooltip>
        {canDelete && (
          <Tooltip title="刪除" placement="left">
            <IconButton
              size="small"
              aria-label={`刪除 ${book.title}`}
              onClick={(e) => {
                e.stopPropagation()
                onDelete(book)
              }}
              sx={{
                bgcolor: 'transparent',
                color: 'text.secondary',
                width: 44,
                height: 44,
                '&:hover': { bgcolor: 'rgba(200,0,0,0.7)', color: '#fff' },
              }}
            >
              <DeleteIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Card>
  )
}

export default function BookLibrary() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const pathname = routePath(location.pathname)
  const returnUrl =
    pathname === '/library'
      ? location.pathname + location.search
      : libraryReturn(params.get('returnTo'))
  const profileOpen = pathname === '/settings'
  const uploadOpen = pathname === '/upload'
  const closePanel = () => navigate(returnUrl)
  const view = params.get('view')
  const collection = params.get('collection')
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState('')
  const currentUser = useUserStore((s) => s.currentUser)
  const setCurrentUser = useUserStore((s) => s.setCurrentUser)
  const { books, setBooks } = useBookStore()
  const [loading, setLoading] = useState(true)
  const [bookmarkSet, setBookmarkSet] = useState<Set<string>>(new Set())
  const [progressMap, setProgressMap] = useState<
    Map<string, { cfi: string; percentage: number; lastReadAt: number }>
  >(new Map())
  const [confirmBook, setConfirmBook] = useState<Book | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileColor, setProfileColor] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])

  const loadData = useCallback(async () => {
    if (!currentUser) {
      navigate('/')
      return
    }
    setLoading(true)
    setLoadError(false)
    try {
      const [booksData, bookmarksData, progressData] = await Promise.all([
        api.books.list(currentUser.id),
        api.bookmarks.list(currentUser.id),
        api.books.getUserProgress(currentUser.id),
      ])
      const progMap = new Map(
        progressData.map((p) => [
          p.bookId,
          { cfi: p.cfi, percentage: p.percentage, lastReadAt: p.lastReadAt },
        ])
      )
      const booksWithProgress = booksData.map((b) => {
        const prog = progMap.get(b.id)
        return prog ? { ...b, progress: prog.cfi } : b
      })
      setBooks(booksWithProgress)
      setBookmarkSet(new Set(bookmarksData))
      setProgressMap(progMap)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [currentUser, navigate, setBooks])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Split books into sections
  const { continueReading, readLater, otherBooks } = useMemo(() => {
    const reading: Array<{ book: Book; percentage: number; lastReadAt: number }> = []
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
  const hasCollections = collectionGroups.some((g) => g.collection !== null)

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
            .filter((f) => /\.(epub|pdf|txt)$/i.test(f.name))
            .map((f) => {
              const parts = f.webkitRelativePath.split('/')
              // parts[0] = selected root folder (skip)
              // parts.length === 2 → root-level file → no collection
              // parts.length >= 3 → in subfolder → collection = subfolder name
              const collection = parts.length >= 3 ? parts[1] : null
              return { file: f, collection }
            })
        } else {
          baseList = Array.from(files).map((f) => ({ file: f, collection: null }))
        }
        if (baseList.length === 0) return

        // Extract metadata and pre-check duplicates before opening dialog
        const norm = (s: string) => s.trim().toLowerCase()
        const existingTitleSet = new Set(books.map((b) => norm(b.title)))
        const results = await Promise.allSettled(baseList.map((uf) => extractBookTitle(uf.file)))
        const uploadList: UploadFile[] = baseList.map((uf, i) => {
          const resolvedTitle =
            results[i].status === 'fulfilled'
              ? ((results[i] as PromiseFulfilledResult<string | null>).value ?? undefined)
              : undefined
          const filenameStem = uf.file.name.replace(/\.(epub|pdf|txt)$/i, '')
          // Match by: 1) extracted EPUB title  2) filename stem (covers TXT/PDF or when EPUB parse fails)
          const preMarkedDuplicate =
            (resolvedTitle !== undefined && existingTitleSet.has(norm(resolvedTitle))) ||
            existingTitleSet.has(norm(filenameStem))
          return { ...uf, resolvedTitle, preMarkedDuplicate }
        })

        setUploadFiles(uploadList)
        navigate(`/upload?returnTo=${encodeURIComponent(returnUrl)}`)
      })

      input.click()
    }, 0)
  }

  function handleUploadDone() {
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
      setProgressMap((prev) => {
        const m = new Map(prev)
        m.delete(book.id)
        return m
      })
    } catch {
      setActionError('操作未完成，請檢查連線後重試。')
    }
  }

  async function handleBookmark(bookId: string) {
    if (!currentUser) return
    try {
      await api.bookmarks.toggle(currentUser.id, bookId)
      setBookmarkSet((prev) => {
        const s = new Set(prev)
        if (s.has(bookId)) s.delete(bookId)
        else s.add(bookId)
        return s
      })
    } catch {
      setActionError('操作未完成，請檢查連線後重試。')
    }
  }

  async function handleClearProgress(bookId: string) {
    if (!currentUser) return
    try {
      await waitForProgress(currentUser.id, bookId)
      await api.books.clearProgress(currentUser.id, bookId)
      clearRecovery(currentUser.id, bookId)
      setProgressMap((prev) => {
        const m = new Map(prev)
        m.delete(bookId)
        return m
      })
    } catch {
      setActionError('操作未完成，請檢查連線後重試。')
    }
  }

  const cardProps = {
    onDelete: handleDelete,
    onBookmark: handleBookmark,
    onClearProgress: handleClearProgress,
  }
  const isUploader = (book: Book) => !!currentUser && book.uploadedBy === currentUser.id

  const PROFILE_COLORS = [
    '#5c6bc0',
    '#42a5f5',
    '#26a69a',
    '#66bb6a',
    '#ffa726',
    '#ef5350',
    '#ab47bc',
    '#8d6e63',
  ]

  function openProfile() {
    if (!currentUser) return
    setProfileName(currentUser.name)
    setProfileColor(currentUser.avatarColor ?? PROFILE_COLORS[0])
    navigate(`/settings?returnTo=${encodeURIComponent(returnUrl)}`)
  }

  useEffect(() => {
    if (profileOpen && currentUser) {
      setProfileName(currentUser.name)
      setProfileColor(currentUser.avatarColor ?? '#5c6bc0')
    }
  }, [profileOpen, currentUser])

  const filteredBooks = books.filter((book) => {
    if (
      collection &&
      (collection === '__none__' ? book.collection != null : book.collection !== collection)
    )
      return false
    if (view === 'reading' && !progressMap.get(book.id)?.percentage) return false
    if (view === 'saved' && !bookmarkSet.has(book.id)) return false
    return true
  })
  const isFiltered = !!collection || view === 'reading' || view === 'saved'
  const filterTitle =
    collection === '__none__'
      ? '其他書籍'
      : collection || (view === 'reading' ? '繼續閱讀' : '稍後閱讀')

  async function saveProfile() {
    if (!currentUser || !profileName.trim()) return
    setProfileSaving(true)
    try {
      const updated = await api.users.update(currentUser.id, profileName.trim(), profileColor)
      setCurrentUser({ ...currentUser, name: updated.name, avatarColor: profileColor })
      closePanel()
    } catch {
      setActionError('設定儲存失敗，請重試。')
    }
    setProfileSaving(false)
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', color: 'text.primary' }}>
      <a className="skip-link" href="#library-content">
        跳至書庫內容
      </a>
      <AppBar
        position="static"
        sx={{ bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar
          sx={{ width: '100%', maxWidth: 1440, mx: 'auto', gap: 1, px: { xs: 2, sm: 4, md: 6 } }}
        >
          <Typography
            component={Link}
            to="/library"
            sx={{
              flexGrow: 1,
              fontFamily: 'Baskerville, serif',
              fontSize: 28,
              fontWeight: 700,
              textDecoration: 'none',
              letterSpacing: '-1px',
            }}
          >
            readflix<span style={{ color: 'var(--accent)' }}>.</span>
          </Typography>
          <ThemeSwitch />
          <Tooltip title="個人設定">
            <IconButton aria-label="個人設定" onClick={openProfile}>
              <PersonIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="切換使用者">
            <IconButton aria-label="切換使用者" onClick={() => navigate('/')}>
              <SwitchAccountIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        id="library-content"
        sx={{
          maxWidth: 1440,
          mx: 'auto',
          px: { xs: 2, sm: 4, md: 6 },
          pt: { xs: 4, md: 6 },
          pb: 6,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 3,
            flexWrap: 'wrap',
            alignItems: 'end',
            mb: 4,
          }}
        >
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.18em' }}>
              THE PERSONAL LIBRARY
            </Typography>
            <Typography
              component="h1"
              variant="h1"
              sx={{ fontSize: { xs: 46, md: 72 }, mt: 0.5, mb: 1 }}
            >
              我的書庫<span style={{ color: 'var(--accent)' }}>。</span>
            </Typography>
            <Typography color="text.secondary">
              {currentUser?.name} 的閱讀時光{' '}
              <Box component="span" sx={{ mx: 1 }}>
                ／
              </Box>{' '}
              {books.length} 本藏書
            </Typography>
          </Box>
          <Button
            component={Link}
            to={`/upload?returnTo=${encodeURIComponent(returnUrl)}`}
            variant="contained"
            startIcon={<UploadFileIcon />}
            sx={{ px: 3 }}
          >
            上傳書籍
          </Button>
        </Box>
        <Box
          component="nav"
          aria-label="書庫分類"
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            py: 2,
            mb: 3,
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {[
            ['', '全部藏書'],
            ['reading', '繼續閱讀'],
            ['saved', '稍後閱讀'],
          ].map(([value, label]) => (
            <Button
              key={label}
              component={Link}
              to={value ? `/library?view=${value}` : '/library'}
              aria-current={view === value || (!view && !value && !collection) ? 'page' : undefined}
              variant={(view === value || (!view && !value)) && !collection ? 'contained' : 'text'}
            >
              {label}
            </Button>
          ))}
          {[...new Set(books.map((b) => b.collection).filter(Boolean))].map((name) => (
            <Chip
              key={name}
              label={name}
              component={Link}
              clickable
              to={`/library?collection=${encodeURIComponent(name!)}`}
              color={collection === name ? 'primary' : 'default'}
              sx={{ height: 44 }}
            />
          ))}
          {isFiltered && <Button onClick={() => setParams({})}>顯示全部</Button>}
        </Box>
        {actionError && (
          <Alert severity="error" onClose={() => setActionError('')} sx={{ mb: 2 }}>
            {actionError}
          </Alert>
        )}
        {loadError ? (
          <Alert severity="error" action={<Button onClick={loadData}>重試</Button>}>
            書庫暫時無法載入，請重試。
          </Alert>
        ) : loading ? (
          <Box>
            <Skeleton
              variant="text"
              width={120}
              height={32}
              sx={{ bgcolor: 'background.paper', mb: 2 }}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 2,
              }}
            >
              {[1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  variant="rectangular"
                  height={280}
                  sx={{ bgcolor: 'background.paper', borderRadius: 1, flexShrink: 0 }}
                />
              ))}
            </Box>
          </Box>
        ) : (
          <>
            {isFiltered ? (
              <Box>
                <Typography component="h2" variant="h5" sx={{ mb: 3 }}>
                  {filterTitle}{' '}
                  <Typography component="span" color="text.secondary">
                    ／{filteredBooks.length}
                  </Typography>
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, minmax(0, 1fr))',
                      sm: 'repeat(3, minmax(0, 1fr))',
                      md: 'repeat(4, minmax(0, 1fr))',
                      lg: 'repeat(5, minmax(0, 1fr))',
                    },
                    gap: 2,
                  }}
                >
                  {filteredBooks.map((book) => (
                    <BookCard
                      key={book.id}
                      {...cardProps}
                      book={book}
                      progressPercent={progressMap.get(book.id)?.percentage}
                      bookmarked={bookmarkSet.has(book.id)}
                      showClearProgress={view === 'reading'}
                      canDelete={isUploader(book)}
                    />
                  ))}
                </Box>
                {!filteredBooks.length && (
                  <Typography sx={{ py: 6 }} color="text.secondary">
                    這個書架還沒有書。選一本喜歡的，開始閱讀吧。
                  </Typography>
                )}
              </Box>
            ) : (
              <>
                {(continueReading.length > 0 || readLater.length > 0) && (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        md:
                          continueReading.length && readLater.length
                            ? 'repeat(2, minmax(0, 1fr))'
                            : 'minmax(0, 1fr)',
                      },
                      gap: { xs: 4, md: 4 },
                      mb: 6,
                    }}
                  >
                    {continueReading.length > 0 && (
                      <Box component="section" aria-labelledby="continue-heading">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: 1.5,
                          }}
                        >
                          <Typography
                            id="continue-heading"
                            component="h2"
                            variant="h6"
                            sx={{ fontWeight: 700 }}
                          >
                            繼續閱讀
                          </Typography>
                          <Button component={Link} to="/library?view=reading" size="small">
                            查看全部 · {continueReading.length}
                          </Button>
                        </Box>
                        <Box sx={{ display: 'grid', gap: 2 }}>
                          {continueReading.slice(0, 2).map(({ book, percentage }) => (
                            <BookCard
                              key={book.id}
                              {...cardProps}
                              compact
                              book={book}
                              progressPercent={percentage}
                              bookmarked={bookmarkSet.has(book.id)}
                              showClearProgress
                              canDelete={isUploader(book)}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {readLater.length > 0 && (
                      <Box component="section" aria-labelledby="saved-heading">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: 1.5,
                          }}
                        >
                          <Typography
                            id="saved-heading"
                            component="h2"
                            variant="h6"
                            sx={{ fontWeight: 700 }}
                          >
                            稍後閱讀
                          </Typography>
                          <Button component={Link} to="/library?view=saved" size="small">
                            查看全部 · {readLater.length}
                          </Button>
                        </Box>
                        <Box sx={{ display: 'grid', gap: 2 }}>
                          {readLater.slice(0, 2).map((book) => (
                            <BookCard
                              key={book.id}
                              {...cardProps}
                              compact
                              book={book}
                              bookmarked
                              canDelete={isUploader(book)}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}

                {/* 書庫 — 分類或一般顯示 */}
                {hasCollections ? (
                  <>
                    {/* Named collection grid sections */}
                    {collectionGroups
                      .filter((g) => g.collection !== null)
                      .map((g) => (
                        <Box key={g.collection} sx={{ mb: 5 }}>
                          <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
                            {g.collection}
                          </Typography>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: {
                                xs: 'repeat(2, minmax(0, 1fr))',
                                sm: 'repeat(3, minmax(0, 1fr))',
                                md: 'repeat(4, minmax(0, 1fr))',
                                lg: 'repeat(5, minmax(0, 1fr))',
                              },
                              gap: 2,
                            }}
                          >
                            {g.books.map((book) => (
                              <BookCard
                                key={book.id}
                                {...cardProps}
                                book={book}
                                bookmarked={bookmarkSet.has(book.id)}
                                canDelete={isUploader(book)}
                              />
                            ))}
                          </Box>
                        </Box>
                      ))}
                    {/* Uncategorized books */}
                    {(() => {
                      const uncategorized = collectionGroups.find((g) => g.collection === null)
                      if (!uncategorized || uncategorized.books.length === 0) return null
                      return (
                        <Box>
                          <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
                            其他書籍
                          </Typography>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: {
                                xs: 'repeat(2, minmax(0, 1fr))',
                                sm: 'repeat(3, minmax(0, 1fr))',
                                md: 'repeat(4, minmax(0, 1fr))',
                                lg: 'repeat(5, minmax(0, 1fr))',
                              },
                              gap: 2,
                            }}
                          >
                            {uncategorized.books.map((book) => (
                              <BookCard
                                key={book.id}
                                {...cardProps}
                                book={book}
                                bookmarked={bookmarkSet.has(book.id)}
                                canDelete={isUploader(book)}
                              />
                            ))}
                          </Box>
                        </Box>
                      )
                    })()}
                  </>
                ) : (
                  /* No collections — original grid display */
                  otherBooks.length > 0 && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
                        書庫
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: 'repeat(2, minmax(0, 1fr))',
                            sm: 'repeat(3, minmax(0, 1fr))',
                            md: 'repeat(4, minmax(0, 1fr))',
                            lg: 'repeat(5, minmax(0, 1fr))',
                          },
                          gap: 2,
                        }}
                      >
                        {otherBooks.map((book) => (
                          <BookCard
                            key={book.id}
                            {...cardProps}
                            book={book}
                            bookmarked={bookmarkSet.has(book.id)}
                            canDelete={isUploader(book)}
                          />
                        ))}
                      </Box>
                    </Box>
                  )
                )}
              </>
            )}
            {books.length === 0 && (
              <Box sx={{ textAlign: 'center', mt: 12, color: 'text.secondary' }}>
                <Typography variant="h6">書庫是空的</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  上傳第一本書，開始你的閱讀時光。
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      <Box
        component="footer"
        sx={{
          mx: { xs: 2, sm: 4, md: 6 },
          py: 3,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          color: 'text.secondary',
        }}
      >
        <Typography variant="caption">一本書，一段自己的時間。</Typography>
        <Typography variant="caption">READFLIX · v{APP_VERSION}</Typography>
      </Box>
      <Dialog
        open={uploadOpen && uploadFiles.length === 0}
        onClose={closePanel}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>上傳書籍</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            選擇 EPUB、PDF 或 TXT，加入你的書庫。重新整理後需重新選取檔案。
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<UploadFileIcon />}
              onClick={() => openFilePicker(false)}
            >
              選擇檔案
            </Button>
            <Button
              variant="outlined"
              startIcon={<FolderIcon />}
              onClick={() => openFilePicker(true)}
            >
              選擇資料夾
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closePanel}>關閉</Button>
        </DialogActions>
      </Dialog>
      <UploadDialog
        open={uploadOpen && uploadFiles.length > 0}
        files={uploadFiles}
        userId={currentUser?.id ?? ''}
        onClose={() => {
          setUploadFiles([])
          if (uploadOpen) closePanel()
        }}
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
          <Button onClick={confirmDelete} color="error" variant="contained">
            刪除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 個人設定 Drawer */}
      <Drawer
        anchor="bottom"
        open={profileOpen}
        onClose={() => closePanel()}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            px: 3,
            py: 3,
            maxHeight: '90dvh',
            width: '100%',
            maxWidth: 640,
            mx: 'auto',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography component="h2" variant="h5">
            個人設定
          </Typography>
          <IconButton aria-label="關閉個人設定" onClick={closePanel}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ mb: 4 }}>
          <ThemeSwitch expanded />
        </Box>

        <TextField
          label="名稱"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          error={!profileName.trim()}
          helperText={!profileName.trim() ? '名稱不可為空' : ''}
          fullWidth
          sx={{ mb: 3 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          頭像顏色
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
          {PROFILE_COLORS.map((color) => (
            <IconButton
              key={color}
              aria-label={`頭像顏色 ${color}`}
              aria-pressed={profileColor === color}
              onClick={() => setProfileColor(color)}
            >
              <Avatar
                sx={{
                  bgcolor: color,
                  width: 40,
                  height: 40,
                  cursor: 'pointer',
                  border: profileColor === color ? '3px solid var(--ink)' : '3px solid transparent',
                  boxShadow: profileColor === color ? `0 0 0 2px ${color}` : 'none',
                }}
              >
                {profileColor === color ? '✓' : ''}
              </Avatar>
            </IconButton>
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
