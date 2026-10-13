export interface CloudinaryAsset {
  imageUrl: string
  publicId: string
  format: string
  width: number
  height: number
}

interface CloudinaryUploadResponse {
  secure_url: string
  public_id: string
  format: string
  width: number
  height: number
}

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME   as string | undefined
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined

export async function uploadToCloudinary(
  file: File,
  folder?: string,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryAsset> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured.')
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', UPLOAD_PRESET)
  if (folder) form.append('folder', folder)

  return new Promise<CloudinaryAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as CloudinaryUploadResponse | { error?: { message?: string } }

        if (xhr.status < 200 || xhr.status >= 300 || !('secure_url' in json)) {
          const msg = (json as any)?.error?.message ?? `Upload failed (${xhr.status})`
          reject(new Error(msg))
          return
        }

        resolve({
          imageUrl: (json as CloudinaryUploadResponse).secure_url,
          publicId: (json as CloudinaryUploadResponse).public_id,
          format:   (json as CloudinaryUploadResponse).format,
          width:    (json as CloudinaryUploadResponse).width,
          height:   (json as CloudinaryUploadResponse).height,
        })
      } catch {
        reject(new Error('Unexpected response from Cloudinary.'))
      }
    }

    xhr.onerror = () => reject(new Error('Network error while uploading to Cloudinary.'))
    xhr.send(form)
  })
}