import { useMemo, type ReactNode } from 'react'
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material'
import { useDeviceTheme } from './deviceTheme'
import { READER_FONT_FAMILY } from '../utils/readerFont'

export default function AppTheme({ children }: { children: ReactNode }) {
  const mode = useDeviceTheme((s) => s.mode)
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === 'dark' ? '#e6a18a' : '#98432e',
            contrastText: mode === 'dark' ? '#211510' : '#fffaf5',
          },
          background: {
            default: mode === 'dark' ? '#181a19' : '#ffffff',
            paper: mode === 'dark' ? '#222522' : '#ffffff',
          },
          text: {
            primary: mode === 'dark' ? '#f0eee7' : '#252c28',
            secondary: mode === 'dark' ? '#b4b9af' : '#62685e',
          },
          divider: mode === 'dark' ? '#43483f' : '#d4d5c9',
          error: { main: mode === 'dark' ? '#ffaaa3' : '#b3261e' },
        },
        shape: { borderRadius: 8 },
        typography: {
          fontFamily: READER_FONT_FAMILY,
          h1: {
            fontFamily: READER_FONT_FAMILY,
            fontWeight: 600,
            letterSpacing: '-0.02em',
          },
          h2: {
            fontFamily: READER_FONT_FAMILY,
            fontWeight: 600,
          },
          h4: { fontFamily: READER_FONT_FAMILY, fontWeight: 600 },
          button: { textTransform: 'none', fontWeight: 600 },
          body1: { lineHeight: 1.7 },
        },
        components: {
          MuiButton: { styleOverrides: { root: { minHeight: 44, boxShadow: 'none' } } },
          MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
          MuiToggleButton: { styleOverrides: { root: { minHeight: 44, minWidth: 44 } } },
          MuiInputBase: { styleOverrides: { input: { fontSize: 16 } } },
          MuiSlider: {
            styleOverrides: {
              root: { padding: '20px 0', '@media (pointer: coarse)': { padding: '20px 0' } },
            },
          },
          MuiListItemButton: { styleOverrides: { root: { minHeight: 48 } } },
          MuiAppBar: {
            defaultProps: { color: 'transparent', elevation: 0 },
            styleOverrides: { root: { backgroundImage: 'none' } },
          },
          MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
          MuiCard: { defaultProps: { elevation: 0 } },
          MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none' } } },
          MuiDialog: { styleOverrides: { paper: { maxHeight: 'calc(100dvh - 48px)' } } },
          MuiCssBaseline: { styleOverrides: { body: { backgroundColor: 'var(--canvas)' } } },
        },
      }),
    [mode]
  )
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
