import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import type { User } from '../types/index'

export default function UserSelectionScreen() {
  const navigate = useNavigate()
  const { users, setUsers, setCurrentUser } = useUserStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    api.users.list()
      .then((data) => {
        setUsers(data)
        setError(null)
      })
      .catch(() => setError('無法載入讀者列表'))
      .finally(() => setLoading(false))
  }, [setUsers])

  const handleSelectUser = (user: User) => {
    setCurrentUser(user)
    navigate('/library')
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

  const handleDelete = async (e: React.MouseEvent, id: number) => {
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
        bgcolor: '#121212',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 3,
        py: 6,
      }}
    >
      <Typography variant="h4" fontWeight={700} mb={5}>
        選擇讀者
      </Typography>

      {loading && <CircularProgress sx={{ color: 'white', mt: 4 }} />}

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
                  width: 140,
                  bgcolor: '#1e1e1e',
                  color: 'white',
                  position: 'relative',
                  '&:hover': { bgcolor: '#2a2a2a' },
                }}
              >
                <CardActionArea onClick={() => handleSelectUser(user)} sx={{ pb: 1 }}>
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
                      sx={{ width: 64, height: 64, bgcolor: '#5c6bc0', fontSize: 28 }}
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
                  onClick={(e) => handleDelete(e, user.id)}
                  disabled={deletingId === user.id}
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    color: 'rgba(255,255,255,0.4)',
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
                width: 140,
                height: '100%',
                minHeight: 140,
                bgcolor: '#1e1e1e',
                border: '2px dashed rgba(255,255,255,0.2)',
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
                <PersonAddIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 36 }} />
                <Typography variant="body2" color="rgba(255,255,255,0.5)">
                  新增讀者
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>
      )}

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        PaperProps={{ sx: { bgcolor: '#1e1e1e', color: 'white', minWidth: 320 } }}
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
              '& .MuiOutlinedInput-root': { color: 'white' },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={creating} sx={{ color: 'rgba(255,255,255,0.6)' }}>
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
