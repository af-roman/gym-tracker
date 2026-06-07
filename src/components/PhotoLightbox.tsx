import { useEffect, useRef } from 'react'

interface PhotoLightboxProps {
  photos: string[]
  index: number
  onClose: () => void
  onChangeIndex: (index: number) => void
}

const SWIPE_THRESHOLD_PX = 50

export function PhotoLightbox({
  photos,
  index,
  onClose,
  onChangeIndex,
}: PhotoLightboxProps) {
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && index > 0) onChangeIndex(index - 1)
      if (event.key === 'ArrowRight' && index < photos.length - 1) {
        onChangeIndex(index + 1)
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [index, onChangeIndex, onClose, photos.length])

  const handleTouchStart = (clientX: number) => {
    touchStartX.current = clientX
  }

  const handleTouchEnd = (clientX: number) => {
    if (touchStartX.current === null) return
    const delta = clientX - touchStartX.current
    touchStartX.current = null

    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
    if (delta < 0 && index < photos.length - 1) {
      onChangeIndex(index + 1)
    } else if (delta > 0 && index > 0) {
      onChangeIndex(index - 1)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Step ${index + 1} photo`}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">
          Step {index + 1} of {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1 text-sm font-medium text-white/90"
        >
          Close
        </button>
      </div>

      <div
        className="flex flex-1 touch-pan-y items-center justify-center px-4 pb-6"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => handleTouchStart(e.touches[0].clientX)}
        onTouchEnd={(e) => handleTouchEnd(e.changedTouches[0].clientX)}
      >
        <img
          src={photos[index]}
          alt={`Step ${index + 1}`}
          className="max-h-[80vh] max-w-full select-none rounded-xl object-contain"
          draggable={false}
          onClick={onClose}
        />
      </div>
    </div>
  )
}
