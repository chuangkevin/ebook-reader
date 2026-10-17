const HINGE_GAP_PROBE = 'max(36px, calc(env(viewport-segment-left 1 0, 50vw) - env(viewport-segment-width 0 0, 50vw)))'

export interface HorizontalViewportSegments {
  first: { left: number; width: number; top: number; height: number }
  second: { left: number; width: number; top: number; height: number }
  hingeGap: number
}

export function getReaderPaneBounds(
  pageLayout: 'single' | 'spread',
  segments: HorizontalViewportSegments | null,
): { left: number; width: number } | null {
  return pageLayout === 'single' && segments
    ? { left: segments.first.left, width: segments.first.width }
    : null
}

interface ViewportSegment {
  left: number
  width: number
  top: number
  height: number
}

export function resolveHorizontalViewportSegments(
  first: ViewportSegment,
  second: ViewportSegment,
): HorizontalViewportSegments | null {
  if (first.width <= 0 || second.width <= 0 || first.height <= 0 || second.height <= 0) return null
  if (Math.abs(first.top - second.top) > 2 || Math.abs(first.height - second.height) > 2 || second.left <= first.left) return null
  return {
    first,
    second,
    hingeGap: Math.max(0, second.left - (first.left + first.width)),
  }
}

function readViewportSegment(column: number, row: number) {
  if (typeof document === 'undefined') return null
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;left:env(viewport-segment-left ${column} ${row}, 0px);top:env(viewport-segment-top ${column} ${row}, 0px);width:env(viewport-segment-width ${column} ${row}, 0px);height:env(viewport-segment-height ${column} ${row}, 0px)`
  document.body.appendChild(probe)
  const { left, top, width, height } = probe.getBoundingClientRect()
  probe.remove()
  return { left, top, width, height }
}

export function measureHorizontalViewportSegments(): HorizontalViewportSegments | null {
  const first = readViewportSegment(0, 0)
  const second = readViewportSegment(1, 0)
  return first && second ? resolveHorizontalViewportSegments(first, second) : null
}

export function measureViewportHingeGap(): number {
  const segments = measureHorizontalViewportSegments()
  if (segments) return segments.hingeGap
  if (typeof document === 'undefined') return 36
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;width:${HINGE_GAP_PROBE};height:0;inset:0 auto auto 0`
  document.body.appendChild(probe)
  const width = Number.parseFloat(getComputedStyle(probe).width)
  probe.remove()
  return Number.isFinite(width) ? width : 36
}
