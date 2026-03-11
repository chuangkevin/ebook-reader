import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { AppDispatch, RootState } from '../../store';
import { fetchUsers, createUser, deleteUser, selectUser } from '../../store/userSlice';

const AVATAR_COLORS = [
  '#e53935', '#d81b60', '#8e24aa', '#5e35b1',
  '#3949ab', '#1e88e5', '#039be5', '#00acc1',
  '#00897b', '#43a047', '#7cb342', '#c0ca33',
  '#fdd835', '#ffb300', '#fb8c00', '#f4511e',
];

export default function UserSelectionScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { users, isLoading } = useSelector((state: RootState) => state.user);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const handleSelectUser = (user: typeof users[0]) => {
    dispatch(selectUser(user));
    navigate('/library');
  };

  const handleCreateUser = async () => {
    if (!newName.trim()) return;
    await dispatch(createUser({ name: newName.trim(), avatarColor: selectedColor }));
    setNewName('');
    setSelectedColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
    setDialogOpen(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    await dispatch(deleteUser(deleteTarget));
    setDeleteTarget(null);
    setDeleteDialogOpen(false);
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4 }}>
      <Typography variant="h3" sx={{ mb: 1, fontWeight: 700 }}>
        Ebook Reader
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 6 }}>
        Who's reading?
      </Typography>

      <Grid container spacing={3} justifyContent="center" sx={{ maxWidth: 800 }}>
        {users.map((user) => (
          <Grid item key={user.id}>
            <Box sx={{ position: 'relative' }}>
              <Card sx={{ width: 140, height: 160, borderRadius: 2 }}>
                <CardActionArea
                  onClick={() => handleSelectUser(user)}
                  sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 1 }}
                >
                  <Avatar sx={{ width: 72, height: 72, fontSize: 28, bgcolor: user.avatarColor, fontWeight: 700 }}>
                    {getInitials(user.name)}
                  </Avatar>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {user.name}
                  </Typography>
                </CardActionArea>
              </Card>
              <IconButton
                size="small"
                onClick={() => { setDeleteTarget(user.id); setDeleteDialogOpen(true); }}
                sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper', '&:hover': { bgcolor: 'error.dark' } }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </Grid>
        ))}

        {/* Add User Card */}
        <Grid item>
          <Card sx={{ width: 140, height: 160, borderRadius: 2, border: '2px dashed', borderColor: 'divider' }}>
            <CardActionArea
              onClick={() => setDialogOpen(true)}
              sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 1 }}
            >
              <Avatar sx={{ width: 72, height: 72, bgcolor: 'transparent', border: '2px dashed', borderColor: 'divider' }}>
                <AddIcon sx={{ fontSize: 36, color: 'text.secondary' }} />
              </Avatar>
              <Typography variant="body1" color="text.secondary">
                Add
              </Typography>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create User</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateUser()}
          />
          <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
            Choose a color
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {AVATAR_COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => setSelectedColor(color)}
                sx={{
                  width: 36, height: 36, borderRadius: '50%', bgcolor: color, cursor: 'pointer',
                  border: selectedColor === color ? '3px solid white' : '3px solid transparent',
                  transition: 'border 0.2s',
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Avatar sx={{ width: 64, height: 64, fontSize: 24, bgcolor: selectedColor, fontWeight: 700 }}>
              {newName ? getInitials(newName) : '?'}
            </Avatar>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateUser} variant="contained" disabled={!newName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete User?</DialogTitle>
        <DialogContent>
          <Typography>This will also delete all reading progress for this user.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteUser} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
