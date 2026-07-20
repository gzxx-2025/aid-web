<template>
  <a-dropdown
    v-model:open="localOpen"
    trigger="click"
    placement="bottomRight"
    overlay-class-name="storyboard-ops-dropdown-overlay"
  >
    <a-button
      type="primary"
      class="storyboard-action-btn storyboard-toolbar-cyan-btn storyboard-toolbar-ops-btn"
      :loading="loading"
      :disabled="disabled"
    >
      批量操作
      <DownOutlined
        class="storyboard-toolbar-ops-btn__arrow"
        :class="{ 'storyboard-toolbar-ops-btn__arrow--open': localOpen }"
      />
    </a-button>
    <template #overlay>
      <div class="storyboard-ops-panel" role="menu" :aria-label="ariaLabel">
        <div class="storyboard-ops-panel__list">
          <template v-for="item in items" :key="item.key">
            <a-tooltip
              v-if="item.disabled && item.disabledTooltip"
              :title="item.disabledTooltip"
              placement="left"
              :mouse-enter-delay="0.2"
            >
              <span class="storyboard-ops-panel__item-wrap">
                <button
                  type="button"
                  class="storyboard-ops-panel__item storyboard-ops-panel__item--disabled"
                  :class="{ 'storyboard-ops-panel__item--danger': item.danger }"
                  disabled
                  role="menuitem"
                >
                  <component :is="item.icon" v-if="item.icon" />
                  <span>{{ item.label }}</span>
                </button>
              </span>
            </a-tooltip>
            <button
              v-else
              type="button"
              class="storyboard-ops-panel__item"
              :class="{ 'storyboard-ops-panel__item--danger': item.danger }"
              role="menuitem"
              :disabled="item.disabled"
              @click="onItemClick(item)"
            >
              <component :is="item.icon" v-if="item.icon" />
              <span>{{ item.label }}</span>
            </button>
          </template>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { type Component } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'

export interface StoryboardOpsMenuItem {
  key: string
  label: string
  icon?: Component
  danger?: boolean
  disabled?: boolean
  disabledTooltip?: string
}

const props = withDefaults(
  defineProps<{
    items: StoryboardOpsMenuItem[]
    loading?: boolean
    disabled?: boolean
    ariaLabel?: string
  }>(),
  {
    loading: false,
    disabled: false,
    ariaLabel: '批量操作'
  }
)

const emit = defineEmits<{
  select: [key: string]
}>()

const localOpen = defineModel<boolean>('open', { default: false })

function onItemClick(item: StoryboardOpsMenuItem) {
  if (item.disabled) return
  localOpen.value = false
  emit('select', item.key)
}
</script>
