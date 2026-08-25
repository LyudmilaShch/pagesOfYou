<template>
  <v-group v-if="spec.nodeType === 'group'" :config="spec.config">
    <EffectExtraNode v-for="(child, index) in spec.children ?? []" :key="index" :spec="child" />
  </v-group>
  <v-rect v-else-if="spec.nodeType === 'rect'" :config="spec.config" />
  <v-circle v-else-if="spec.nodeType === 'circle'" :config="spec.config" />
  <v-line v-else-if="spec.nodeType === 'line'" :config="spec.config" />
</template>

<script setup lang="ts">
import type { EffectExtraNodeSpec } from '../../models/effect-descriptor.model'

defineProps<{ spec: EffectExtraNodeSpec }>()
</script>
