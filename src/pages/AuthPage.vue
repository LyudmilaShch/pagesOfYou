<template>
  <div class="auth-page">
    <div class="auth-page__inner">
      <!-- Logo / Brand -->
      <div class="auth-page__brand">
        <span class="auth-page__brand-name">Pages of You</span>
      </div>

      <v-card class="auth-card" variant="outlined">
        <!-- Step 1: Phone -->
        <template v-if="step === 1">
          <div class="auth-card__header">
            <h1 class="auth-card__title">Войти</h1>
            <p class="auth-card__subtitle">Введите номер телефона, и мы отправим код подтверждения</p>
          </div>

          <div class="auth-card__body">
            <v-text-field
              v-model="phone"
              label="Номер телефона"
              placeholder="+7 900 000 00 00"
              type="tel"
              variant="outlined"
              color="primary"
              :error-messages="phoneError"
              :disabled="loadingSendCode"
              hide-details="auto"
              @keyup.enter="handleSendCode"
            />

            <v-btn
              class="auth-card__btn"
              color="primary"
              size="large"
              :loading="loadingSendCode"
              :disabled="!phone"
              block
              @click="handleSendCode"
            >
              Получить код
            </v-btn>
          </div>
        </template>

        <!-- Step 2: OTP -->
        <template v-if="step === 2">
          <div class="auth-card__header">
            <h1 class="auth-card__title">Код подтверждения</h1>
            <p class="auth-card__subtitle">
              Код отправлен на <strong>{{ phone }}</strong>
            </p>
          </div>

          <div class="auth-card__body">
            <v-text-field
              v-model="code"
              label="6-значный код"
              placeholder="000000"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              variant="outlined"
              color="primary"
              :error-messages="codeError"
              :disabled="loadingVerify"
              hide-details="auto"
              class="auth-card__otp-input"
              @keyup.enter="handleVerifyCode"
            />

            <!-- OTP timer -->
            <div class="auth-card__timer">
              <template v-if="countdown > 0">
                <v-icon size="16" color="textMuted">mdi-clock-outline</v-icon>
                <span>Код действует ещё {{ formatCountdown(countdown) }}</span>
              </template>
              <template v-else>
                <span class="auth-card__timer--expired">Код истёк</span>
              </template>
            </div>

            <v-btn
              class="auth-card__btn"
              color="primary"
              size="large"
              :loading="loadingVerify"
              :disabled="code.length !== 6 || countdown === 0"
              block
              @click="handleVerifyCode"
            >
              Войти
            </v-btn>

            <!-- Resend -->
            <div class="auth-card__resend">
              <v-btn
                variant="text"
                size="small"
                :loading="loadingSendCode"
                :disabled="resendCooldown > 0"
                @click="handleResend"
              >
                <template v-if="resendCooldown > 0">
                  Отправить повторно через {{ resendCooldown }} с
                </template>
                <template v-else>
                  Отправить код повторно
                </template>
              </v-btn>
            </div>

            <v-btn
              variant="text"
              size="small"
              color="secondary"
              :disabled="loadingVerify"
              @click="goBack"
            >
              ← Изменить номер
            </v-btn>
          </div>
        </template>
      </v-card>
    </div>

    <!-- Global snackbar for this page -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
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
import { onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// UI State
const step = ref<1 | 2>(1)
const phone = ref('')
const code = ref('')
const loadingSendCode = ref(false)
const loadingVerify = ref(false)
const phoneError = ref('')
const codeError = ref('')

// OTP timers
const countdown = ref(0)      // seconds until code expires
const resendCooldown = ref(0) // seconds until resend is allowed

let countdownTimer: ReturnType<typeof setInterval> | null = null
let resendTimer: ReturnType<typeof setInterval> | null = null

const snackbar = reactive({ show: false, text: '', color: 'error' as string })

function showSnack(text: string, color = 'error'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s} с`
}

function startCountdown(seconds: number): void {
  countdown.value = seconds
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      clearInterval(countdownTimer!)
      countdownTimer = null
    }
  }, 1000)
}

function startResendCooldown(): void {
  resendCooldown.value = 60
  if (resendTimer) clearInterval(resendTimer)
  resendTimer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0) {
      clearInterval(resendTimer!)
      resendTimer = null
    }
  }, 1000)
}

function validatePhone(value: string): boolean {
  const normalized = value.replace(/\s/g, '')
  return /^\+?[78]\d{10}$/.test(normalized)
}

async function handleSendCode(): Promise<void> {
  phoneError.value = ''

  const trimmed = phone.value.trim()
  if (!validatePhone(trimmed)) {
    phoneError.value = 'Введите корректный номер в формате +7XXXXXXXXXX'
    return
  }

  loadingSendCode.value = true
  try {
    const { expiresIn } = await authStore.sendCode(trimmed)
    step.value = 2
    code.value = ''
    codeError.value = ''
    startCountdown(expiresIn)
    startResendCooldown()
    showSnack('Код отправлен', 'success')
  } catch (err: unknown) {
    const message = extractErrorMessage(err) ?? 'Не удалось отправить код'
    showSnack(message)
  } finally {
    loadingSendCode.value = false
  }
}

async function handleVerifyCode(): Promise<void> {
  codeError.value = ''

  if (code.value.length !== 6) {
    codeError.value = 'Введите 6-значный код'
    return
  }

  loadingVerify.value = true
  try {
    await authStore.verifyCode(phone.value.trim(), code.value)
    const redirectTo = (route.query.redirect as string) ?? '/account'
    await router.push(redirectTo)
  } catch (err: unknown) {
    const message = extractErrorMessage(err) ?? 'Неверный или просроченный код'
    codeError.value = message
    showSnack(message)
  } finally {
    loadingVerify.value = false
  }
}

async function handleResend(): Promise<void> {
  if (resendCooldown.value > 0) return
  loadingSendCode.value = true
  try {
    const { expiresIn } = await authStore.sendCode(phone.value.trim())
    code.value = ''
    codeError.value = ''
    startCountdown(expiresIn)
    startResendCooldown()
    showSnack('Код отправлен повторно', 'success')
  } catch (err: unknown) {
    showSnack(extractErrorMessage(err) ?? 'Не удалось отправить код')
  } finally {
    loadingSendCode.value = false
  }
}

function goBack(): void {
  step.value = 1
  code.value = ''
  codeError.value = ''
  if (countdownTimer) clearInterval(countdownTimer)
  if (resendTimer) clearInterval(resendTimer)
  countdown.value = 0
  resendCooldown.value = 0
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const axiosErr = err as { response?: { data?: { message?: string } }; message?: string }
    return axiosErr.response?.data?.message ?? axiosErr.message ?? ''
  }
  return ''
}

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
  if (resendTimer) clearInterval(resendTimer)
})
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

.auth-card {
  border-color: #d7d0c7 !important;
  background: #ffffff;

  &__header {
    padding: 32px 32px 0;
  }

  &__title {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-size: 28px;
    font-weight: 700;
    color: #111111;
    margin-bottom: 8px;
    line-height: 1.2;
  }

  &__subtitle {
    font-family: Inter, -apple-system, sans-serif;
    font-size: 14px;
    color: #666666;
    line-height: 1.5;
    margin: 0;
  }

  &__body {
    padding: 24px 32px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__btn {
    margin-top: 4px;
    font-family: Inter, -apple-system, sans-serif;
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: none;
  }

  &__otp-input :deep(input) {
    font-size: 24px;
    letter-spacing: 0.3em;
    text-align: center;
    font-family: 'Courier New', monospace;
  }

  &__timer {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #8a8580;
    font-family: Inter, -apple-system, sans-serif;

    &--expired {
      color: #8b4a4a;
      font-weight: 500;
    }
  }

  &__resend {
    text-align: center;
    margin-top: -8px;
  }
}

@media (max-width: 480px) {
  .auth-card__header {
    padding: 24px 20px 0;
  }

  .auth-card__body {
    padding: 20px 20px 24px;
  }
}
</style>
