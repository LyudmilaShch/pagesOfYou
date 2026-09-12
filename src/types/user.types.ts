export interface AuthUser {
  id: string
  phone: string
  name: string | null
  /** Stable fallback display number — show "Пользователь #{userNumber}" wherever `name` is null. */
  userNumber: number
  avatarUrl: string | null
  role: string
  isNew?: boolean
}

/** @deprecated use AuthUser */
export interface User {
  id: string
  email: string
}
