<template>
  <v-dialog :model-value="open" max-width="420" @update:model-value="$emit('update:open', $event)">
    <v-card>
      <v-card-title>Содержание</v-card-title>
      <v-card-text>
        Добавить под названием строку описания? Её текст берётся из поля «Описание для содержания»
        у разворота или страницы. Этот выбор потом изменить нельзя.
      </v-card-text>
      <v-card-actions>
        <v-btn variant="text" @click="choose(false)">Без описания</v-btn>
        <v-spacer />
        <v-btn variant="flat" color="primary" @click="choose(true)">С описанием</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  choose: [showDescription: boolean]
}>()

function choose(showDescription: boolean): void {
  emit('choose', showDescription)
  emit('update:open', false)
}
</script>
