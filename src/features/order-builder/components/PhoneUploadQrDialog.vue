<template>
  <v-dialog :model-value="open" max-width="420" @update:model-value="onDialogToggle">
    <v-card class="phone-upload-qr">
      <v-card-title class="phone-upload-qr__title">
        Добавить с телефона
        <v-btn icon="mdi-close" variant="text" size="small" aria-label="Закрыть" @click="emit('close')" />
      </v-card-title>
      <v-card-text class="phone-upload-qr__body">
        <p class="phone-upload-qr__hint">
          Отсканируйте код камерой телефона и выберите фото. Они появятся в журнале на этом компьютере.
        </p>

        <div v-if="creating || (uploadUrl && !qrDataUrl && !errorMessage)" class="phone-upload-qr__state">
          <v-progress-circular indeterminate color="primary" />
        </div>
        <p v-else-if="errorMessage" class="phone-upload-qr__error" role="alert">{{ errorMessage }}</p>
        <img
          v-else-if="qrDataUrl"
          class="phone-upload-qr__image"
          :src="qrDataUrl"
          alt="QR-код для загрузки фото с телефона"
        />

        <p class="phone-upload-qr__count">
          {{ newCount > 0 ? `С телефона загружено: ${newCount}` : 'Ждём фото с телефона' }}
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import QRCode from 'qrcode'
import { ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  uploadUrl: string
  newCount: number
  creating: boolean
  errorMessage: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const qrDataUrl = ref('')

watch(
  () => props.uploadUrl,
  async (url) => {
    qrDataUrl.value = ''
    if (!url) {
      return
    }
    qrDataUrl.value = await QRCode.toDataURL(url, {
      margin: 1,
      width: 280,
      errorCorrectionLevel: 'M',
    })
  },
  { immediate: true },
)

function onDialogToggle(value: boolean): void {
  if (!value) {
    emit('close')
  }
}
</script>

<style scoped lang="scss">
.phone-upload-qr__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
}

.phone-upload-qr__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-4;
  text-align: center;
}

.phone-upload-qr__hint,
.phone-upload-qr__count {
  margin: 0;
  line-height: 1.45;
}

.phone-upload-qr__hint {
  color: $text-secondary;
}

.phone-upload-qr__count {
  font-weight: $font-weight-semibold;
}

.phone-upload-qr__state {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 280px;
  height: 280px;
}

.phone-upload-qr__image {
  width: 280px;
  height: 280px;
}

.phone-upload-qr__error {
  margin: 0;
  color: #c62828;
}
</style>
