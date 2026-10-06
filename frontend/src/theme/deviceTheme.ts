import { create } from 'zustand'

export type Appearance = 'light' | 'dark' | 'system'
export type ReadingPaper = 'default' | 'sepia'
export const THEME_KEY = 'readflix.appearance'
const PAPER_KEY = 'readflix.reading-paper'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Private/storage-restricted browser: keep this session usable. */
  }
}
const saved = read(THEME_KEY)
const preference: Appearance = saved === 'light' || saved === 'dark' ? saved : 'system'
const media = window.matchMedia('(prefers-color-scheme: dark)')
const resolve = (value: Appearance) =>
  value === 'system' ? (media.matches ? 'dark' : 'light') : value
function apply(mode: 'light' | 'dark') {
  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = mode
  document.documentElement.style.backgroundColor = mode === 'dark' ? '#181a19' : '#f5f2eb'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', mode === 'dark' ? '#181a19' : '#f5f2eb')
}

interface DeviceTheme {
  preference: Appearance
  mode: 'light' | 'dark'
  paper: ReadingPaper
  setAppearance: (value: Appearance) => void
  setPaper: (value: ReadingPaper) => void
}
export const useDeviceTheme = create<DeviceTheme>((set) => ({
  preference,
  mode: resolve(preference),
  paper: read(PAPER_KEY) === 'sepia' ? 'sepia' : 'default',
  setAppearance: (value) => {
    write(THEME_KEY, value)
    const mode = resolve(value)
    apply(mode)
    set({ preference: value, mode })
  },
  setPaper: (paper) => {
    write(PAPER_KEY, paper)
    set({ paper })
  },
}))
apply(useDeviceTheme.getState().mode)
media.addEventListener('change', () => {
  if (useDeviceTheme.getState().preference !== 'system') return
  const mode = resolve('system')
  apply(mode)
  useDeviceTheme.setState({ mode })
})
window.addEventListener('storage', (event) => {
  if (event.key !== THEME_KEY && event.key !== PAPER_KEY && event.key !== null) return
  const saved = read(THEME_KEY)
  const preference = saved === 'light' || saved === 'dark' ? saved : 'system'
  const mode = resolve(preference)
  apply(mode)
  useDeviceTheme.setState({
    preference,
    mode,
    paper: read(PAPER_KEY) === 'sepia' ? 'sepia' : 'default',
  })
})
