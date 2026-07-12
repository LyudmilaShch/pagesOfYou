import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/features/admin/pages/AdminLoginPage.vue'),
    meta: { requiresAdminGuest: true },
  },
  {
    path: '/admin/magazine-types/:magazineTypeId/pages/:pageId/editor',
    component: () => import('@/modules/editor/layouts/EditorLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'admin-magazine-page-editor',
        component: () => import('@/modules/editor/pages/MagazinePageEditorPage.vue'),
      },
    ],
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
      {
        path: 'magazine-types',
        name: 'admin-magazine-types',
        component: () => import('@/features/admin/pages/AdminMagazineTypesPage.vue'),
      },
      {
        path: 'magazine-types/:id/edit',
        name: 'admin-magazine-type-edit',
        component: () => import('@/features/admin/pages/AdminMagazineTypeEditPage.vue'),
      },
      {
        path: 'photo-frames',
        name: 'admin-photo-frames',
        component: () => import('@/features/admin/pages/AdminPhotoFramesPage.vue'),
      },
      {
        path: 'orders',
        name: 'admin-orders',
        component: () => import('@/features/admin/pages/AdminDashboardPage.vue'),
      },
    ],
  },
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
    path: '/order/create/fill',
    name: 'create-order-fill',
    component: () => import('@/features/order-builder/pages/FillOrderPage.vue'),
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
