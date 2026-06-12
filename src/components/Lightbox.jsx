import React, { useRef, useState, useEffect, useCallback } from 'react'

export default function Lightbox({ url, label, onClose }) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef(null)
  const lastDistRef = useRef(null)
  const lastTouchRef = useRef(null)

  useEffect(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [url])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  // Attach non-passive listeners so we can call preventDefault
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 0.87
      setScale(s => {
        const next = Math.min(Math.max(s * factor, 1), 8)
        if (next <= 1) setOffset({ x: 0, y: 0 })
        return next
      })
    }

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastDistRef.current = Math.hypot(dx, dy)
        lastTouchRef.current = null
      } else if (e.touches.length === 1) {
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        lastDistRef.current = null
      }
    }

    const onTouchMove = (e) => {
      e.preventDefault()
      if (e.touches.length === 2 && lastDistRef.current != null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const factor = dist / lastDistRef.current
        setScale(s => Math.min(Math.max(s * factor, 1), 8))
        lastDistRef.current = dist
      } else if (e.touches.length === 1 && lastTouchRef.current) {
        const dx = e.touches[0].clientX - lastTouchRef.current.x
        const dy = e.touches[0].clientY - lastTouchRef.current.y
        setScale(s => {
          if (s > 1) setOffset(o => ({ x: o.x + dx, y: o.y + dy }))
          return s
        })
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }

    const onTouchEnd = () => {
      lastDistRef.current = null
      lastTouchRef.current = null
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
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
      style={{ touchAction: 'none' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <img
        src={url}
        alt={label ? `Version ${label}` : 'Full size'}
        draggable={false}
        className="select-none"
        style={{
          maxWidth: scale <= 1 ? '100vw' : 'none',
          maxHeight: scale <= 1 ? '100vh' : 'none',
          objectFit: 'contain',
          transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
          transformOrigin: 'center center',
          cursor: scale > 1 ? 'grab' : 'zoom-in',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'none',
        }}
      />

      {/* Version label */}
      {label && (
        <div className="absolute top-4 left-4 bg-black/50 text-white text-sm font-semibold px-3 py-1 rounded-full">
          Version {label}
        </div>
      )}

      {/* Close */}
      <button
        className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
        onClick={onClose}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Zoom hint */}
      {scale <= 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 text-white/70 text-xs rounded-full px-3 py-1.5 pointer-events-none">
          Pinch or scroll to zoom · tap outside to close
        </div>
      )}

      {/* Reset zoom */}
      {scale > 1 && (
        <button
          className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 hover:bg-black/70 text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
          onClick={resetZoom}
        >
          Reset zoom
        </button>
      )}
    </div>
  )
}
