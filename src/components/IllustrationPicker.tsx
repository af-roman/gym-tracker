import { useRef } from 'react'
import { assetUrl } from '../lib/assets'
import { BUILT_IN_ILLUSTRATIONS } from '../lib/exercises'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

interface IllustrationPickerProps {
  value: string
  onChange: (value: string) => void
  onError?: (message: string) => void
}

export function IllustrationPicker({
  value,
  onChange,
  onError,
}: IllustrationPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onError?.('Please choose an image file.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onError?.('Image must be under 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result)
      }
    }
    reader.onerror = () => onError?.('Could not read the image.')
    reader.readAsDataURL(file)
  }

  const builtInValue = BUILT_IN_ILLUSTRATIONS.includes(value) ? value : ''

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <span className="text-sm font-medium">Illustration</span>
      <div className="mt-3 flex gap-4">
        <img
          src={value.startsWith('data:') ? value : assetUrl(value)}
          alt=""
          className="h-24 w-24 shrink-0 rounded-xl bg-slate-100 object-contain p-1 dark:bg-slate-800"
          onError={(e) => {
            e.currentTarget.src = assetUrl('/illustrations/placeholder.svg')
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <select
            value={builtInValue}
            onChange={(e) => {
              if (e.target.value) onChange(e.target.value)
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">
              {value.startsWith('data:')
                ? 'Custom image (from device)'
                : 'Pick a built-in illustration…'}
            </option>
            {BUILT_IN_ILLUSTRATIONS.map((path) => (
              <option key={path} value={path}>
                {path.replace('/illustrations/', '')}
              </option>
            ))}
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"
          >
            Choose from device
          </button>

          {value.startsWith('data:') && (
            <button
              type="button"
              onClick={() => onChange('/illustrations/placeholder.svg')}
              className="text-left text-xs text-slate-500 underline"
            >
              Remove custom image
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
