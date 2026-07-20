<template>
  <div class="form-field">
    <label v-if="label" class="form-field__label">{{ label }}</label>
    <slot />
    <p v-if="error" class="form-field__error">{{ error }}</p>
    <p v-else-if="hint" class="form-field__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label?: string
  error?: string
  hint?: string
}

defineProps<Props>()
</script>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.form-field__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
}

.form-field__error {
  font-size: 0.875rem;
  color: var(--danger-color);
}

.form-field__hint {
  font-size: 0.875rem;
  color: var(--secondary-color);
}
</style>
