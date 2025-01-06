export interface StorageError {
  message: string
  status: number
}

export interface UploadResponse {
  path: string
  id: string
}

export interface StorageFile {
  name: string
  id: string
  size: number
  created_at: string
}
