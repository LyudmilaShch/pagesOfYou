import type { User } from '@/types/user.types'

export const authService = {
  login(_credentials: { email: string; password: string }): Promise<User> {
    return Promise.resolve({} as User)
  },

  logout(): Promise<void> {
    return Promise.resolve()
  },

  register(_payload: { email: string; password: string }): Promise<User> {
    return Promise.resolve({} as User)
  },
}
