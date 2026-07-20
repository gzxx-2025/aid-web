<template>
  <button
    type="button"
    class="works-lib-add-card"
    :disabled="disabled"
    :aria-label="ariaLabel || label"
    @click="onClick"
  >
    <div class="works-lib-add-card__cover">
      <div class="works-lib-add-card__content">
        <span class="works-lib-add-card__icon-wrap">
          <slot name="icon">
            <PlusOutlined class="works-lib-add-card__icon" />
          </slot>
        </span>
        <span class="works-lib-add-card__label">{{ label }}</span>
        <span v-if="hint" class="works-lib-add-card__hint">{{ hint }}</span>
      </div>
    </div>
    <!-- <div class="works-lib-add-card__body" aria-hidden="true" /> -->
  </button>
</template>

<script setup lang="ts">
import { PlusOutlined } from '@ant-design/icons-vue'

const props = withDefaults(
  defineProps<{
    /** 主文案，如「新建作品」「新增角色」 */
    label: string
    /** 副文案，显示在主文案下方 */
    hint?: string
    disabled?: boolean
    ariaLabel?: string
  }>(),
  { disabled: false, hint: undefined, ariaLabel: undefined }
)

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

function onClick(e: MouseEvent) {
  if (props.disabled) return
  emit('click', e)
}
</script>
