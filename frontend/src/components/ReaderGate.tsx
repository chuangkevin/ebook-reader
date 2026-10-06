import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import { api } from '../services/api.service'
import RouteState from './RouteState'

export default function ReaderGate({ children }: { children: ReactNode }) {
  const { currentUser, setCurrentUser } = useUserStore()
  const location = useLocation()
  const [storedId] = useState(() => {
    try {
      return sessionStorage.getItem('readflix.reader')
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(!currentUser && !!storedId)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (currentUser || !storedId) return
    let active = true
    api.users
      .list()
      .then((users) => {
        if (!active) return
        setCurrentUser(users.find((user) => String(user.id) === storedId) ?? null)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentUser, setCurrentUser, storedId, attempt])
  if (loading && !currentUser) return <RouteState loading title="正在準備你的書庫" />
  if (error)
    return (
      <RouteState
        title="暫時無法載入讀者"
        message="請檢查連線後重試。"
        retry={() => {
          setLoading(true)
          setError(false)
          setAttempt((v) => v + 1)
        }}
      />
    )
  if (!currentUser)
    return (
      <Navigate
        replace
        to={`/?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      />
    )
  return children
}
