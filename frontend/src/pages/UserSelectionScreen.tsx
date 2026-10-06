import { APP_VERSION } from '../version'
import { useEffect, useState } from 'react'
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Typography,
  Avatar,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import { api } from '../services/api.service'
import { useUserStore } from '../stores/userStore'
import ThemeSwitch from '../components/ThemeSwitch'
import { routePath, safeReturnTo } from '../utils/navigation'
import type { User } from '../types/index'

export default function UserSelectionScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const dialogOpen = routePath(location.pathname) === '/readers/new'
  const setDialogOpen = (open: boolean) =>
    navigate({ pathname: open ? '/readers/new' : '/', search: location.search })
  const { users, setUsers, setCurrentUser } = useUserStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    api.users
      .list()
      .then((data) => {
        setUsers(data)
        setError(null)
      })
      .catch(() => setError('無法載入讀者列表'))
      .finally(() => setLoading(false))
  }, [setUsers])

  const handleSelectUser = (user: User) => {
    setCurrentUser(user)
    navigate(safeReturnTo(params.get('returnTo')), { replace: true })
  }

  const handleOpenDialog = () => {
    setNewName('')
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    if (creating) return
    setDialogOpen(false)
  }

  const handleCreate = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      const user = await api.users.create(trimmed)
      setUsers([...users, user])
      setDialogOpen(false)
    } catch {
      // keep dialog open on error
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await api.users.remove(id)
      setUsers(users.filter((u) => u.id !== id))
    } catch {
      // silently ignore
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: { xs: 2, sm: 5 },
        py: 3,
      }}
    >
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Typography
          sx={{
            fontFamily: 'Baskerville, serif',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-1px',
          }}
        >
          readflix<span style={{ color: 'var(--accent)' }}>.</span>
        </Typography>
        <ThemeSwitch />
      </Box>
      <Box sx={{ textAlign: 'center', mt: { xs: 7, sm: 10 }, mb: 6 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.2em' }}>
          YOUR READING ROOM
        </Typography>
        <Typography component="h1" variant="h1" sx={{ fontSize: { xs: 42, sm: 64 }, my: 2 }}>
          留一點時間，給閱讀。
        </Typography>
        <Typography component="h2" variant="body1" color="text.secondary">
          選擇讀者，從上次停下的地方開始。
        </Typography>
      </Box>

      {loading && <CircularProgress sx={{ color: 'text.primary', mt: 4 }} />}

      {error && (
        <Typography color="error" mt={2}>
          {error}
        </Typography>
      )}

      {!loading && !error && (
        <Grid container spacing={3} justifyContent="center" sx={{ maxWidth: 800, width: '100%' }}>
          {users.map((user) => (
            <Grid key={user.id}>
              <Card
                sx={{
                  width: { xs: 148, sm: 170 },
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  position: 'relative',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <CardActionArea
                  aria-label={`選擇讀者 ${user.name}`}
                  onClick={() => handleSelectUser(user)}
                  sx={{ pb: 5, pt: 1 }}
                >
                  <CardContent
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1.5,
                      pb: '8px !important',
                    }}
                  >
                    <Avatar
                      src={user.avatar}
                      sx={{
                        width: 64,
                        height: 64,
                        bgcolor: user.avatarColor ?? '#5c6bc0',
                        fontSize: 28,
                      }}
                    >
                      {!user.avatar && user.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography
                      variant="body1"
                      fontWeight={500}
                      textAlign="center"
                      noWrap
                      sx={{ maxWidth: '100%' }}
                    >
                      {user.name}
                    </Typography>
                  </CardContent>
                </CardActionArea>
                <IconButton
                  size="small"
                  aria-label={`刪除讀者 ${user.name}`}
                  onClick={(e) => handleDelete(e, user.id)}
                  disabled={deletingId === user.id}
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    color: 'text.secondary',
                    '&:hover': { color: '#ef5350' },
                  }}
                >
                  {deletingId === user.id ? (
                    <CircularProgress size={16} sx={{ color: 'inherit' }} />
                  ) : (
                    <DeleteIcon fontSize="small" />
                  )}
                </IconButton>
              </Card>
            </Grid>
          ))}

          <Grid>
            <Card
              sx={{
                width: { xs: 148, sm: 170 },
                height: '100%',
                minHeight: 140,
                bgcolor: 'background.paper',
                border: '1px dashed',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CardActionArea
                onClick={handleOpenDialog}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  py: 2,
                }}
              >
                <PersonAddIcon sx={{ color: 'text.secondary', fontSize: 36 }} />
                <Typography variant="body2" color="text.secondary">
                  新增讀者
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 8 }}>
        READFLIX / 私人的閱讀時光 · v{APP_VERSION}
      </Typography>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            width: 420,
            maxWidth: 'calc(100vw - 48px)',
          },
        }}
      >
        <DialogTitle>新增讀者</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="讀者姓名"
            variant="outlined"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            disabled={creating}
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': { color: 'text.primary' },
              '& .MuiInputLabel-root': { color: 'text.secondary' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={creating} sx={{ color: 'text.secondary' }}>
            取消
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            variant="contained"
            startIcon={creating ? <CircularProgress size={16} /> : null}
          >
            新增
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
