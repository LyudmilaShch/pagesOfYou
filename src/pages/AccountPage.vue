<template>
  <div class="account-page">
    <div class="account-page__inner">
      <!-- Header -->
      <div class="account-page__header">
        <router-link to="/" class="account-page__back">
          <v-icon size="18">mdi-arrow-left</v-icon>
          На главную
        </router-link>
      </div>

      <!-- Profile card -->
      <v-card class="account-card" variant="outlined">
        <div class="account-card__avatar">
          <span class="account-card__avatar-letter">{{ avatarLetter }}</span>
        </div>

        <div class="account-card__info">
          <h1 class="account-card__title">Личный кабинет</h1>

          <div class="account-card__field">
            <span class="account-card__field-label">Телефон</span>
            <span class="account-card__field-value">{{ authStore.userPhone ?? '—' }}</span>
          </div>

          <div class="account-card__field">
            <span class="account-card__field-label">ID пользователя</span>
            <span class="account-card__field-value account-card__field-value--mono">
              {{ authStore.user?.id ?? '—' }}
            </span>
          </div>

          <div class="account-card__field">
            <span class="account-card__field-label">Роль</span>
            <v-chip size="small" variant="tonal" color="primary" label>
              {{ authStore.user?.role ?? '—' }}
            </v-chip>
          </div>
        </div>

        <v-divider class="account-card__divider" />

        <div class="account-card__actions">
          <v-btn
            variant="outlined"
            color="error"
            size="large"
            :loading="loading"
            prepend-icon="mdi-logout"
            @click="handleLogout"
          >
            Выйти
          </v-btn>
        </div>
      </v-card>
    </div>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      location="bottom center"
      :timeout="3000"
      rounded="lg"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
const router = useRouter()

const loading = ref(false)
const snackbar = reactive({ show: false, text: '', color: 'success' as string })

const avatarLetter = computed(() => {
  const phone = authStore.userPhone ?? ''
  return phone ? phone.slice(-2, -1) : '?'
})

async function handleLogout(): Promise<void> {
  loading.value = true
  try {
    await authStore.logout()
    await router.push('/auth')
  } catch {
    snackbar.text = 'Произошла ошибка при выходе'
    snackbar.color = 'error'
    snackbar.show = true
    await router.push('/auth')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.account-page {
  min-height: 100vh;
  background-color: #f8f7f4;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.account-page__inner {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.account-page__header {
  display: flex;
  align-items: center;
}

.account-page__back {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666666;
  text-decoration: none;
  font-family: Inter, -apple-system, sans-serif;
  transition: color 0.2s;

  &:hover {
    color: #111111;
  }
}

.account-card {
  border-color: #d7d0c7 !important;
  background: #ffffff;
  padding: 0;

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #e3ddd5;
    margin: 32px auto 0;
  }

  &__avatar-letter {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 28px;
    font-weight: 700;
    color: #111111;
  }

  &__info {
    padding: 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 24px;
    font-weight: 700;
    color: #111111;
    text-align: center;
    margin: 0;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__field-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #8a8580;
    font-family: Inter, -apple-system, sans-serif;
  }

  &__field-value {
    font-size: 15px;
    color: #111111;
    font-family: Inter, -apple-system, sans-serif;

    &--mono {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #666666;
      word-break: break-all;
    }
  }

  &__divider {
    margin: 0 32px;
    border-color: #e8e3dc;
  }

  &__actions {
    padding: 24px 32px 32px;
    display: flex;
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .account-card__info {
    padding: 20px;
  }

  .account-card__divider {
    margin: 0 20px;
  }

  .account-card__actions {
    padding: 20px;
  }
}
</style>
