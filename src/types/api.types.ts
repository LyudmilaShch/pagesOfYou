/** Unified success envelope from backend */
export interface BackendResponse<T> {
  success: true
  data: T
}

/** Unified error envelope from backend */
export interface BackendError {
  success: false
  statusCode: number
  message: string
  errors: string[]
  timestamp: string
  path: string
}

export interface ApiResponse<T> {
  data: T
}

export interface ApiError {
  message: string
  status: number
}

// Auth API shapes
export interface SendCodeResponse {
  message: string
  expiresIn: number
}

export interface VerifyCodeResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    id: string
    phone: string
    name: string | null
    role: string
    isNew: boolean
  }
}

export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}
