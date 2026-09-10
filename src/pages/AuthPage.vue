<template>
  <div class="auth-page">
    <div class="auth-page__inner">
      <!-- Logo / Brand -->
      <div class="auth-page__brand">
        <span class="auth-page__brand-name">Фолио</span>
      </div>

      <AuthForm @success="handleSuccess" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import AuthForm from '@/components/auth/AuthForm.vue'

const router = useRouter()
const route = useRoute()

async function handleSuccess(): Promise<void> {
  const redirectTo = (route.query.redirect as string) ?? '/account'
  await router.push(redirectTo)
}
</script>

<style scoped lang="scss">
.auth-page {
  min-height: 100vh;
  background-color: var(--color-bg-primary, #f8f7f4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.auth-page__inner {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.auth-page__brand {
  text-align: center;
}

.auth-page__brand-name {
  font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  font-size: 24px;
  font-weight: 700;
  color: #111111;
  letter-spacing: 0.02em;
}
</style>
