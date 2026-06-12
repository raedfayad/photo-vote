import React, { useRef, useState, useEffect, useCallback } from 'react'

export default function Lightbox({
  versions,
  initialIndex = 0,
  selectedIds = [],
  likedNone = false,
  onToggleVersion,
  onToggleNone,
  onClose,
}) {
  const [index, setIndex] = useState(initialIndex)
  const [isZoomed, setIsZoomed] = useState(false)

  const containerRef = useRef(null)
  const imgRef = useRef(null)
  // All gesture state in refs — never triggers React re-renders during gestures
  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const swipeXRef = useRef(0)
  const pinchStartDistRef = useRef(null)
  const pinchStartScaleRef = useRef(1)
  const lastTouchRef = useRef(null)
  const swipeOriginRef = useRef(null)
  const swipingRef = useRef(false)

  const current = versions[index]
  const isSelected = current ? selectedIds.includes(current.id) : false

  // Write transform directly to the DOM — no React re-render needed
  const applyTransform = useCallback(() => {
    if (!imgRef.current) return
    const s = scaleRef.current
    const { x, y } = offsetRef.current
    imgRef.current.style.transform = s > 1
      ? `scale(${s}) translate(${x / s}px, ${y / s}px)`
      : `translateX(${swipeXRef.current}px)`
  }, [])

  const resetGesture = useCallback(() => {
    scaleRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
    swipeXRef.current = 0
    setIsZoomed(false)
    if (imgRef.current) imgRef.current.style.transform = ''
  }, [])

  const goTo = useCallback((i) => {
    const next = Math.max(0, Math.min(i, versions.length - 1))
    resetGesture()
    setIndex(next)
  }, [versions.length, resetGesture])

  useEffect(() => {
    setIndex(initialIndex)
    resetGesture()
  }, [initialIndex, resetGesture])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goTo(index - 1)
      else if (e.key === 'ArrowRight') goTo(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, onClose, goTo])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 0.87
      const next = Math.min(Math.max(scaleRef.current * factor, 1), 8)
      scaleRef.current = next
      if (next <= 1) offsetRef.current = { x: 0, y: 0 }
      applyTransform()
      setIsZoomed(next > 1)
    }

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const d = Math.hypot(dx, dy)
        if (d < 10) return
        pinchStartDistRef.current = d
        pinchStartScaleRef.current = scaleRef.current
        swipeOriginRef.current = null
        lastTouchRef.current = null
        swipingRef.current = false
      } else if (e.touches.length === 1) {
        swipeOriginRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        pinchStartDistRef.current = null
        swipingRef.current = false
      }
    }

    const onTouchMove = (e) => {
      e.preventDefault()
      if (e.touches.length === 2 && pinchStartDistRef.current != null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        // Absolute calculation from pinch start — no jitter accumulation
        const next = Math.min(Math.max(pinchStartScaleRef.current * (dist / pinchStartDistRef.current), 1), 8)
        scaleRef.current = next
        if (next <= 1) offsetRef.current = { x: 0, y: 0 }
        applyTransform()
        // Only update React state when crossing the zoom boundary
        setIsZoomed(next > 1)
      } else if (e.touches.length === 1 && swipeOriginRef.current && lastTouchRef.current) {
        const cx = e.touches[0].clientX
        const cy = e.touches[0].clientY
        const frameDx = cx - lastTouchRef.current.x
        const frameDy = cy - lastTouchRef.current.y
        if (scaleRef.current > 1) {
          offsetRef.current = { x: offsetRef.current.x + frameDx, y: offsetRef.current.y + frameDy }
        } else {
          swipingRef.current = true
          swipeXRef.current = cx - swipeOriginRef.current.x
        }
        applyTransform()
        lastTouchRef.current = { x: cx, y: cy }
      }
    }

    const onTouchEnd = (e) => {
      if (swipingRef.current && swipeOriginRef.current && e.changedTouches.length > 0) {
        const totalDx = e.changedTouches[0].clientX - swipeOriginRef.current.x
        const totalDy = e.changedTouches[0].clientY - swipeOriginRef.current.y
        if (Math.abs(totalDx) > 60 && Math.abs(totalDx) > Math.abs(totalDy)) {
          goTo(index + (totalDx < 0 ? 1 : -1))
        } else {
          swipeXRef.current = 0
          applyTransform()
        }
      }
      swipingRef.current = false
      swipeOriginRef.current = null
      lastTouchRef.current = null
      pinchStartDistRef.current = null
    }

    const opts = { passive: false }
    el.addEventListener('wheel', onWheel, opts)
    el.addEventListener('touchstart', onTouchStart, opts)
    el.addEventListener('touchmove', onTouchMove, opts)
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('wheel', onWheel, opts)
      el.removeEventListener('touchstart', onTouchStart, opts)
      el.removeEventListener('touchmove', onTouchMove, opts)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [index, goTo, applyTransform])

  if (!current) return null

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ touchAction: 'none' }}>

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="bg-white/10 text-white text-sm font-semibold px-3 py-1 rounded-full">
          Version {current.label}
          {isSelected && <span className="ml-1.5 text-indigo-300">✓</span>}
        </div>
        <button
          className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          onClick={onClose}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden"
      >
        <img
          ref={imgRef}
          key={current.id}
          src={current.url}
          alt={`Version ${current.label}`}
          draggable={false}
          className="select-none"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transformOrigin: 'center center',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none',
          }}
        />

        {/* Desktop prev / next arrows */}
        {index > 0 && (
          <button
            onClick={() => goTo(index - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {index < versions.length - 1 && (
          <button
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Reset zoom (appears when zoomed) */}
        {isZoomed && (
          <button
            className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
            onClick={() => {
              scaleRef.current = 1
              offsetRef.current = { x: 0, y: 0 }
              applyTransform()
              setIsZoomed(false)
            }}
          >
            Reset zoom
          </button>
        )}
      </div>

      {/* Bottom voting bar */}
      <div className="flex-shrink-0 bg-black px-4 pt-3 pb-8 space-y-2.5">

        {/* Version navigation dots */}
        {versions.length > 1 && (
          <div className="flex justify-center gap-2 mb-1">
            {versions.map((v, i) => {
              const isCurrent = i === index
              const sel = selectedIds.includes(v.id)
              return (
                <button
                  key={v.id}
                  onClick={() => goTo(i)}
                  className={`w-9 h-9 rounded-full text-xs font-bold transition-all duration-150 flex-shrink-0 ${
                    isCurrent
                      ? 'bg-white text-gray-900 scale-110 shadow-lg'
                      : sel
                      ? 'bg-indigo-500 text-white'
                      : likedNone
                      ? 'bg-white/10 text-white/25'
                      : 'bg-white/20 text-white/70 hover:bg-white/30'
                  }`}
                >
                  {v.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Select / deselect current version */}
        <button
          onClick={() => { if (!likedNone) onToggleVersion(current.id) }}
          className={`w-full py-3.5 rounded-xl font-semibold text-base transition-colors ${
            likedNone
              ? 'bg-white/5 text-white/25 cursor-not-allowed'
              : isSelected
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
          }`}
        >
          {isSelected
            ? `✓  Version ${current.label} selected`
            : `Select Version ${current.label}`}
        </button>

        {/* None of these */}
        <button
          onClick={onToggleNone}
          className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${
            likedNone
              ? 'bg-rose-600/80 hover:bg-rose-500/80 text-white'
              : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 border border-white/10'
          }`}
        >
          {likedNone ? "✕  None of these" : "I don't like any of these"}
        </button>
      </div>
    </div>
  )
}
