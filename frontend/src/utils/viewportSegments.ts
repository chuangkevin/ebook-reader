const HINGE_GAP_PROBE = 'max(36px, calc(env(viewport-segment-left 1 0, 50vw) - env(viewport-segment-width 0 0, 50vw)))'

export function measureViewportHingeGap(): number {
  if (typeof document === 'undefined') return 36
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;width:${HINGE_GAP_PROBE};height:0;inset:0 auto auto 0`
  document.body.appendChild(probe)
  const width = Number.parseFloat(getComputedStyle(probe).width)
  probe.remove()
  return Number.isFinite(width) ? width : 36
}
