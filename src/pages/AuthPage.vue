<template>
  <div class="auth-page">
    <div class="auth-page__inner">
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
  min-height: calc(100vh - $header-height);
  background-color: $bg-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-6 $spacing-4;
}

.auth-page__inner {
  width: 100%;
  max-width: 440px;
}
</style>
