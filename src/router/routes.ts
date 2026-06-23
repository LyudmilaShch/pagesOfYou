import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  // ── Admin Portal ────────────────────────────────────────────────────────────
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/features/admin/pages/AdminLoginPage.vue'),
    meta: { requiresAdminGuest: true },
  },
  {
    path: '/admin',
    component: () => import('@/features/admin/layouts/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      {
        path: '',
        redirect: { name: 'admin-dashboard' },
      },
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/features/admin/pages/AdminDashboardPage.vue'),
      },
      // Placeholder routes for future sections
      {
        path: 'magazine-types',
        name: 'admin-magazine-types',
        component: () => import('@/features/admin/pages/AdminMagazineTypesPage.vue'),
      },
      {
        path: 'magazine-styles',
        name: 'admin-magazine-styles',
        component: () => import('@/features/admin/pages/AdminDashboardPage.vue'),
      },
      {
        path: 'spreads',
        name: 'admin-spreads',
        component: () => import('@/features/admin/pages/AdminDashboardPage.vue'),
      },
      {
        path: 'orders',
        name: 'admin-orders',
        component: () => import('@/features/admin/pages/AdminDashboardPage.vue'),
      },
    ],
  },
  // ── Client routes ────────────────────────────────────────────────────────────
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/pages/HomePage.vue'),
      },
      {
        path: 'catalog',
        name: 'catalog',
        component: () => import('@/pages/CatalogPage.vue'),
      },
    ],
  },
  {
    path: '/order/create',
    name: 'create-order',
    component: () => import('@/features/order-builder/pages/CreateOrderPage.vue'),
  },
  {
    path: '/auth',
    name: 'auth',
    component: () => import('@/pages/AuthPage.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/account',
    name: 'account',
    component: () => import('@/pages/AccountPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
  },
]
