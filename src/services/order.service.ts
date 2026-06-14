export interface Order {
  id: string
}

export const orderService = {
  getOrders(): Promise<Order[]> {
    return Promise.resolve([])
  },

  getOrderById(_id: string): Promise<Order> {
    return Promise.resolve({} as Order)
  },

  createOrder(_payload: unknown): Promise<Order> {
    return Promise.resolve({} as Order)
  },
}
