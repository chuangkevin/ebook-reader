const QUEUE_KEY = 'ebook-reader-offline-queue';

interface QueuedUpdate {
  userId: string;
  bookId: string;
  cfi: string | null;
  percentage: number;
  timestamp: number;
}

function getQueue(): QueuedUpdate[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedUpdate[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function queueProgressUpdate(userId: string, bookId: string, cfi: string | null, percentage: number) {
  const queue = getQueue();
  // Replace existing entry for same user+book (only latest matters)
  const filtered = queue.filter(q => !(q.userId === userId && q.bookId === bookId));
  filtered.push({ userId, bookId, cfi, percentage, timestamp: Date.now() });
  saveQueue(filtered);
}

export async function flushQueue(updateFn: (u: QueuedUpdate) => Promise<void>) {
  const queue = getQueue();
  if (queue.length === 0) return;

  const remaining: QueuedUpdate[] = [];
  for (const item of queue) {
    try {
      await updateFn(item);
    } catch {
      remaining.push(item);
    }
  }
  saveQueue(remaining);
}
