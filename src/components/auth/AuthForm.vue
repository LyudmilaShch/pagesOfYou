<template>
  <v-card class="auth-card" variant="outlined">
    <!-- Step 1: Phone -->
    <template v-if="step === 1">
      <div class="auth-card__header">
        <h1 class="auth-card__title">Войти</h1>
        <p class="auth-card__subtitle">Введите номер телефона, и мы отправим код подтверждения</p>
      </div>

      <div class="auth-card__body">
        <v-text-field
          :model-value="formattedPhoneDigits"
          label="Номер телефона"
          placeholder="(999) 123-45-67"
          prefix="+7"
          type="tel"
          inputmode="numeric"
          autocomplete="tel"
          variant="outlined"
          color="primary"
          maxlength="15"
          :error-messages="phoneError"
          :disabled="loadingSendCode"
          hide-details="auto"
          @update:model-value="onPhoneInput"
          @keyup.enter="handleSendCode"
        />

        <v-btn
          class="auth-card__btn"
          color="primary"
          size="large"
          :loading="loadingSendCode"
          :disabled="!isPhoneComplete"
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
          Код отправлен на <strong>{{ displayFullPhone }}</strong>
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

  <!-- Local snackbar — this form can be mounted in a modal, so it can't rely on a host page's
       own snackbar being present. -->
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
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'

import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()

const emit = defineEmits<{
  success: []
}>()

// UI State
const step = ref<1 | 2>(1)
// Source of truth is just the 10 significant digits after "+7" — the "+7" itself is a fixed,
// uneditable `prefix` on the field (see template), never part of this value or what the user types
// into. Formatting for display is derived from this on every render (see `formatPhoneDigits`).
const phoneDigits = ref('')
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

// ── Phone mask ──────────────────────────────────────────────────────────────
// Fixed "+7" prefix + 10 digits, formatted as "(XXX) XXX-XX-XX" while typing. Pasting a full
// number with a leading 7/8 country-code digit (e.g. "89161234567" or "+79161234567") is
// normalized down to just the 10 significant digits automatically.

const isPhoneComplete = computed(() => phoneDigits.value.length === 10)
const normalizedPhone = computed(() => `+7${phoneDigits.value}`)
const formattedPhoneDigits = computed(() => formatPhoneDigits(phoneDigits.value))
const displayFullPhone = computed(() => `+7 ${formatPhoneDigits(phoneDigits.value)}`)

function formatPhoneDigits(digits: string): string {
  if (!digits) return ''
  let result = `(${digits.slice(0, 3)}`
  if (digits.length >= 3) result += ')'
  if (digits.length > 3) result += ` ${digits.slice(3, 6)}`
  if (digits.length > 6) result += `-${digits.slice(6, 8)}`
  if (digits.length > 8) result += `-${digits.slice(8, 10)}`
  return result
}

/** Strips everything but digits, and drops a leading 7/8 country-code digit if the total is
 * longer than 10 — i.e. only when it looks like the user pasted/typed the country code along
 * with the number (a genuine 10-digit mobile number never itself starts with 7 or 8). */
function extractDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 10 && (digits.startsWith('7') || digits.startsWith('8'))) {
    digits = digits.slice(1)
  }
  return digits.slice(0, 10)
}

function onPhoneInput(value: string | null): void {
  const raw = value ?? ''
  const previousDisplay = formatPhoneDigits(phoneDigits.value)
  const previousDigitCount = phoneDigits.value.length

  let digits = extractDigits(raw)

  // A single backspace that happened to delete a mask-inserted character (a paren/space/hyphen
  // the formatter itself added, not something the user typed) removes a character from the raw
  // string without reducing the digit count — reformatting would just re-insert it right back,
  // making backspace look like it does nothing. Detected as: exactly one character shorter, but
  // the same digit count as before — in that case drop one more digit, the one actually meant.
  if (previousDisplay.length - raw.length === 1 && digits.length === previousDigitCount && digits.length > 0) {
    digits = digits.slice(0, -1)
  }

  phoneDigits.value = digits
  if (phoneError.value) {
    phoneError.value = ''
  }
}

async function handleSendCode(): Promise<void> {
  phoneError.value = ''

  if (!isPhoneComplete.value) {
    phoneError.value = 'Введите корректный номер телефона'
    return
  }

  loadingSendCode.value = true
  try {
    const { expiresIn } = await authStore.sendCode(normalizedPhone.value)
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
    await authStore.verifyCode(normalizedPhone.value, code.value)
    emit('success')
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
    const { expiresIn } = await authStore.sendCode(normalizedPhone.value)
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
