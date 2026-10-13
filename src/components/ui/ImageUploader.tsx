import { useRef, useState } from 'react'
import { uploadToCloudinary, type CloudinaryAsset } from '../../lib/cloudinary'

interface ImageUploaderProps {
  value: string
  onChange: (asset: CloudinaryAsset) => void
  onRemove?: () => void
  folder?: string
  label?: string
  hint?: string
  maxBytes?: number
  accept?: string
  aspect?: 'square' | 'free'
}

export function ImageUploader({
  value,
  onChange,
  onRemove,
  folder,
  label = 'Image',
  hint = 'PNG or JPG, up to 2 MB',
  maxBytes = 2 * 1024 * 1024,
  accept = 'image/png,image/jpeg,image/jpg,image/webp,image/svg+xml',
  aspect = 'free',
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setError('')

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    if (file.size > maxBytes) {
      setError(`File must be under ${Math.round(maxBytes / 1024 / 1024)} MB.`)
      return
    }

    setUploading(true)
    setProgress(0)
    try {
      const asset = await uploadToCloudinary(file, folder, setProgress)
      onChange(asset)
      setUploading(false)
      setProgress(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
      setUploading(false)
    }
  }

  function handleFiles(files: FileList | null) {
    const f = files?.[0]
    if (f) void handleFile(f)
  }

  return (
    <div>
      {label && <label className="text-sm font-medium text-ink-2 block mb-2">{label}</label>}

      {value ? (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-line bg-surface">
          <div
            className={`${aspect === 'square' ? 'w-16 h-16' : 'w-24 h-16'} rounded-xl overflow-hidden bg-warm-subtle flex items-center justify-center flex-shrink-0`}
          >
            <img src={value} alt="Uploaded" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink">Image uploaded</p>
            <p className="text-xs text-ink-3 mt-0.5 truncate">{value}</p>
          </div>
          <button
            type="button"
            onClick={() => { onRemove?.() }}
            className="text-xs text-ink-3 hover:text-[#C47B7B] transition-colors flex-shrink-0"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          className={`
            w-full border-2 border-dashed rounded-xl p-6 text-center transition-colors
            ${dragOver ? 'border-warm bg-warm-subtle/40' : 'border-line hover:border-warm'}
            ${uploading ? 'opacity-70 cursor-wait' : ''}
          `}
        >
          <div className="w-12 h-12 rounded-full bg-warm-subtle flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A847F" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
          </div>

          {uploading ? (
            <>
              <p className="text-sm text-ink-2 font-medium">Uploading… {progress}%</p>
              <div className="mt-3 h-1.5 w-40 mx-auto rounded-full bg-line overflow-hidden">
                <div className="h-full bg-ink transition-all" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-2 font-medium">Click to upload</p>
              <p className="text-xs text-ink-3 mt-1">{hint}</p>
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-[#B06A6A] mt-2">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}