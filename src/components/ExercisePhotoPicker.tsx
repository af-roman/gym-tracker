import { useRef } from 'react'
import { useTranslation } from '../context/SettingsContext'
import {
  instructionPhotoSrc,
  MAX_INSTRUCTION_PHOTO_BYTES,
  MAX_INSTRUCTION_PHOTOS,
} from '../lib/exercises'

interface ExercisePhotoPickerProps {
  photos: string[]
  thumbnailIndex: number
  onChange: (photos: string[], thumbnailIndex: number) => void
  onError?: (message: string) => void
}

export function ExercisePhotoPicker({
  photos,
  thumbnailIndex,
  onChange,
  onError,
}: ExercisePhotoPickerProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addPhoto = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onError?.(t('exercises.photoInvalidType'))
      return
    }
    if (file.size > MAX_INSTRUCTION_PHOTO_BYTES) {
      onError?.(t('exercises.photoTooLarge'))
      return
    }
    if (photos.length >= MAX_INSTRUCTION_PHOTOS) {
      onError?.(t('exercises.photoMaxCount', { max: MAX_INSTRUCTION_PHOTOS }))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      const next = [...photos, reader.result]
      onChange(next, photos.length === 0 ? 0 : thumbnailIndex)
    }
    reader.onerror = () => onError?.(t('exercises.photoReadError'))
    reader.readAsDataURL(file)
  }

  const removePhoto = (index: number) => {
    const next = photos.filter((_, i) => i !== index)
    let nextThumb = thumbnailIndex
    if (index === thumbnailIndex) {
      nextThumb = 0
    } else if (index < thumbnailIndex) {
      nextThumb = thumbnailIndex - 1
    }
    if (nextThumb >= next.length) {
      nextThumb = Math.max(0, next.length - 1)
    }
    onChange(next, next.length === 0 ? 0 : nextThumb)
  }

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <span className="text-sm font-medium">{t('exercises.photos')}</span>
      <p className="mt-1 text-xs text-slate-500">
        {t('exercises.photosHint', { max: MAX_INSTRUCTION_PHOTOS })}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <div key={index} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onChange(photos, index)}
              className={`relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 ${
                thumbnailIndex === index
                  ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900'
                  : ''
              }`}
              aria-label={t('exercises.setThumbAria', { step: index + 1 })}
              aria-pressed={thumbnailIndex === index}
            >
              <img
                src={instructionPhotoSrc(photo)}
                alt={t('exercises.stepAlt', { step: index + 1 })}
                className="h-full w-full object-cover"
              />
              {thumbnailIndex === index && (
                <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {t('exercises.photoThumb')}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => removePhoto(index)}
              className="w-full rounded-lg border border-red-200 px-1 py-1 text-[10px] font-medium text-red-600 dark:border-red-900 dark:text-red-400"
            >
              {t('exercises.removePhoto')}
            </button>
          </div>
        ))}

        {photos.length < MAX_INSTRUCTION_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-700"
          >
            <span className="text-lg">+</span>
            {t('exercises.addPhoto')}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          addPhoto(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
