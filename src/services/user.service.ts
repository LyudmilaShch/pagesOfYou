import type { User } from '@/types/user.types'

export const userService = {
  getProfile(): Promise<User> {
    return Promise.resolve({} as User)
  },

  updateProfile(_payload: Partial<User>): Promise<User> {
    return Promise.resolve({} as User)
  },
}
