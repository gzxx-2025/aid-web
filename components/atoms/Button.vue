<template>
  <button
    :class="['button', `button--${type}`, `button--${size}`]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  type?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  type: 'secondary',
  size: 'medium',
  disabled: false
})

defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
</script>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 6px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.button:active:not(:disabled) {
  transform: translateY(0);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button--primary {
  background-color: var(--primary-color);
  color: white;
}

.button--primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.button--secondary {
  background-color: white;
  color: var(--text-color);
  border-color: var(--border-color);
}

.button--secondary:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.button--danger {
  background-color: var(--danger-color);
  color: white;
}

.button--danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.button--small {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.button--medium {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

.button--large {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}
</style>
