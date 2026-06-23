export interface AuthUser {
  id: string
  phone: string
  name: string | null
  role: string
  isNew?: boolean
}

/** @deprecated use AuthUser */
export interface User {
  id: string
  email: string
}
