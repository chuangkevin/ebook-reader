const HINGE_GAP_PROBE = 'max(80px, calc(env(viewport-segment-left 1 0, 50vw) - env(viewport-segment-width 0 0, 50vw)))'

// Minimum blank space reserved at the centre of a two-page spread so text never
// runs into the physical hinge of a folding device. Applied even when the
// browser does not expose `viewport-segment-*` values.
export const MIN_SPREAD_GUTTER = 80

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

// Central gutter for a two-page spread: the detected hinge when available,
// otherwise the reader's requested margin, never less than MIN_SPREAD_GUTTER.
export function spreadGutterPx(hingeGap: number, pageFlowSize: number, gapFraction: number): number {
  return Math.max(hingeGap, pageFlowSize * gapFraction, MIN_SPREAD_GUTTER)
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
  if (segments) return Math.max(MIN_SPREAD_GUTTER, segments.hingeGap)
  if (typeof document === 'undefined') return MIN_SPREAD_GUTTER
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;width:${HINGE_GAP_PROBE};height:0;inset:0 auto auto 0`
  document.body.appendChild(probe)
  const width = Number.parseFloat(getComputedStyle(probe).width)
  probe.remove()
  return Number.isFinite(width) ? width : MIN_SPREAD_GUTTER
}
