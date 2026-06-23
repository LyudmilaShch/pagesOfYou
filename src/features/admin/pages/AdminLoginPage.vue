<template>
  <div class="admin-login">
    <div class="admin-login__inner">

      <div class="admin-login__brand">
        <span class="admin-login__brand-name">Pages of You</span>
        <span class="admin-login__brand-badge">Admin</span>
      </div>

      <v-card class="admin-login__card" variant="outlined">
        <div class="admin-login__header">
          <h1 class="admin-login__title">Вход в панель</h1>
          <p class="admin-login__subtitle">Для администраторов</p>
        </div>

        <div class="admin-login__body">
          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            autocomplete="email"
            variant="outlined"
            color="primary"
            :error-messages="errors.email"
            :disabled="loading"
            hide-details="auto"
            @keyup.enter="handleLogin"
          />

          <v-text-field
            v-model="password"
            label="Пароль"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            variant="outlined"
            color="primary"
            :error-messages="errors.password"
            :disabled="loading"
            hide-details="auto"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            @keyup.enter="handleLogin"
          />

          <v-btn
            color="primary"
            size="large"
            block
            :loading="loading"
            :disabled="!email || !password"
            class="admin-login__btn"
            @click="handleLogin"
          >
            Войти
          </v-btn>
        </div>
      </v-card>

      <p class="admin-login__hint">
        Доступ только для авторизованных администраторов.
      </p>
    </div>

    <v-snackbar
      v-model="snackbar.show"
      color="error"
      location="bottom center"
      :timeout="4000"
      rounded="lg"
    >
      {{ snackbar.text }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">✕</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAdminAuthStore } from '../stores/admin-auth.store'

const store = useAdminAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const showPassword = ref(false)
const errors = reactive({ email: '', password: '' })
const snackbar = reactive({ show: false, text: '' })

async function handleLogin(): Promise<void> {
  errors.email = ''
  errors.password = ''

  if (!email.value) { errors.email = 'Введите email'; return }
  if (!password.value) { errors.password = 'Введите пароль'; return }

  loading.value = true
  try {
    await store.login(email.value.trim(), password.value)
    await router.push('/admin/dashboard')
  } catch (err: unknown) {
    const msg = extractMessage(err)
    snackbar.text = msg || 'Неверный email или пароль'
    snackbar.show = true
  } finally {
    loading.value = false
  }
}

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { message?: string } }; message?: string }
    return e.response?.data?.message ?? e.message ?? ''
  }
  return ''
}
</script>

<style scoped lang="scss">
.admin-login {
  min-height: 100vh;
  background: $bg-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-6 $spacing-4;
}

.admin-login__inner {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-6;
}

.admin-login__brand {
  display: flex;
  align-items: center;
  gap: $spacing-2;
}

.admin-login__brand-name {
  font-family: $font-family-display;
  font-size: $font-size-body;
  font-weight: $font-weight-medium;
  color: $text-primary;
  letter-spacing: $letter-spacing-subheading;
}

.admin-login__brand-badge {
  font-size: 10px;
  font-weight: $font-weight-semibold;
  letter-spacing: $letter-spacing-caption;
  text-transform: uppercase;
  color: $text-muted;
  background: $bg-tertiary;
  padding: 2px 6px;
  border-radius: $radius-xs;
}

.admin-login__card {
  width: 100%;
  border-color: $border-default !important;
  background: $bg-elevated;
}

.admin-login__header {
  padding: $spacing-8 $spacing-8 0;
  text-align: center;
}

.admin-login__title {
  font-family: $font-family-display;
  font-size: 26px;
  font-weight: $font-weight-regular;
  letter-spacing: $letter-spacing-heading;
  color: $text-primary;
  margin-bottom: $spacing-1;
}

.admin-login__subtitle {
  font-size: $font-size-body-sm;
  color: $text-muted;
  margin: 0;
}

.admin-login__body {
  padding: $spacing-6 $spacing-8 $spacing-8;
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.admin-login__btn {
  text-transform: none;
  letter-spacing: $letter-spacing-button;
  margin-top: $spacing-1;
}

.admin-login__hint {
  font-size: $font-size-caption;
  color: $text-disabled;
  text-align: center;
  margin: 0;
}
</style>
