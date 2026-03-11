import { useRef, useEffect, useCallback } from 'react';
import apiService from '../services/api.service';

export function useProgressSync(userId: string, bookId: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ cfi: string | null; percentage: number } | null>(null);
  const pendingRef = useRef<{ cfi: string | null; percentage: number } | null>(null);

  // 立即儲存（不經過 debounce），用於頁面關閉/重整等緊急情況
  const flushSync = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const pending = pendingRef.current;
    if (!pending) return;

    // 跳過重複儲存
    if (
      lastSavedRef.current &&
      lastSavedRef.current.cfi === pending.cfi &&
      lastSavedRef.current.percentage === pending.percentage
    ) {
      return;
    }

    // 使用 fetch + keepalive，確保頁面關閉時請求不會被取消
    const url = `/api/users/${userId}/books/${bookId}/progress`;
    try {
      fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cfi: pending.cfi, percentage: pending.percentage }),
        keepalive: true,
      });
      lastSavedRef.current = pending;
    } catch {
      // keepalive 失敗時的 fallback（極少發生）
    }
  }, [userId, bookId]);

  const save = useCallback((cfi: string | null, percentage: number) => {
    pendingRef.current = { cfi, percentage };

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const pending = pendingRef.current;
      if (!pending) return;

      // 跳過重複儲存
      if (
        lastSavedRef.current &&
        lastSavedRef.current.cfi === pending.cfi &&
        lastSavedRef.current.percentage === pending.percentage
      ) {
        return;
      }

      apiService.updateProgress(userId, bookId, pending.cfi, pending.percentage)
        .then(() => {
          lastSavedRef.current = pending;
        })
        .catch(err => {
          console.error('Failed to save progress:', err);
        });
    }, 3000);
  }, [userId, bookId]);

  // 頁面關閉/重整時立即儲存
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSync();
    };

    // 切換分頁或最小化時也儲存
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSync();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // 組件卸載時也立即儲存
      flushSync();
    };
  }, [flushSync]);

  return { save };
}
