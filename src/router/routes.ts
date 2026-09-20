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
    path: '/admin/orders/:orderId/journal-pages/:journalPageId/editor',
    component: () => import('@/modules/editor/layouts/EditorLayout.vue'),
    props: (route) => ({
      backTo: { name: 'admin-order-detail', params: { id: route.params.orderId } },
      backLabel: 'К заказу',
      savedMessage: 'Сохранено',
      saveErrorMessage: 'Не удалось сохранить',
    }),
    meta: { requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'admin-order-journal-page-editor',
        component: () => import('@/features/admin/pages/AdminOrderJournalPageEditorPage.vue'),
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
        path: 'custom-photo-masks',
        name: 'admin-custom-photo-masks',
        component: () => import('@/features/admin/pages/AdminCustomPhotoMasksPage.vue'),
      },
      {
        path: 'fonts',
        name: 'admin-fonts',
        component: () => import('@/features/admin/pages/AdminFontsPage.vue'),
      },
      {
        path: 'orders',
        name: 'admin-orders',
        component: () => import('@/features/admin/pages/AdminOrdersPage.vue'),
      },
      {
        path: 'orders/:id',
        name: 'admin-order-detail',
        component: () => import('@/features/admin/pages/AdminOrderDetailPage.vue'),
      },
      {
        path: 'promo-codes',
        name: 'admin-promo-codes',
        component: () => import('@/features/admin/pages/AdminPromoCodesPage.vue'),
      },
      {
        path: 'settings',
        name: 'admin-settings',
        component: () => import('@/features/admin/pages/AdminSettingsPage.vue'),
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
      {
        path: 'auth',
        name: 'auth',
        component: () => import('@/pages/AuthPage.vue'),
        meta: { requiresGuest: true },
      },
    ],
  },
  {
    path: '/order/create',
    name: 'create-order',
    component: () => import('@/features/order-builder/pages/CreateOrderPage.vue'),
  },
  {
    path: '/order/:orderId/journal-pages/:journalPageId/editor',
    component: () => import('@/modules/editor/layouts/EditorLayout.vue'),
    props: {
      backUseHistory: true,
      backLabel: 'Назад',
      savedMessage: 'Сохранено',
      saveErrorMessage: 'Не удалось сохранить',
    },
    // No requiresAuth: the advanced editor works against a local, not-yet-persisted draft for
    // guests too (see JournalPageEditorPage.vue's ensureOrderLoaded) — only submitting the
    // finished order requires an account. A real order's URL still safely 401s for a guest, since
    // the backend enforces auth + ownership on /orders/* regardless of this route's meta.
    children: [
      {
        path: '',
        name: 'journal-page-editor',
        component: () => import('@/features/order-builder/pages/JournalPageEditorPage.vue'),
      },
    ],
  },
  {
    path: '/order/:orderId/photos',
    name: 'order-photo-upload',
    component: () => import('@/features/order-builder/pages/PhotoUploadPage.vue'),
    // No requiresAuth — same reasoning as order-questionnaire below: works for an unsaved guest
    // draft too, reached only via in-app navigation from CreateOrderPage.
  },
  {
    path: '/order/:orderId/questionnaire',
    name: 'order-questionnaire',
    component: () => import('@/features/order-builder/pages/QuestionnairePage.vue'),
    // No requiresAuth — same reasoning as journal-page-editor: works for an unsaved guest draft
    // too (ensureOrderLoaded inside only works when the order is already in the store, i.e. this
    // route is reached via in-app navigation from the editor, never a cold URL hit for a guest).
  },
  {
    path: '/order/:orderId/review',
    name: 'order-review',
    component: () => import('@/features/order-builder/pages/JournalReviewPage.vue'),
    // No requiresAuth — same reasoning as order-questionnaire above; the missing-photos gate and
    // guest-draft-to-order conversion happen inside the page itself, right before checkout.
  },
  {
    path: '/order/:orderId/checkout',
    name: 'order-checkout',
    component: () => import('@/features/order-builder/pages/CheckoutPage.vue'),
    meta: { requiresAuth: true },
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
