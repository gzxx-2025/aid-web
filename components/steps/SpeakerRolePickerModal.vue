<template>
  <a-modal
    v-model:open="localOpen"
    :width="472"
    :footer="null"
    :destroy-on-close="true"
    class="speaker-role-picker-modal"
    wrap-class-name="create-flow-modal speaker-role-picker-wrap"
    centered
    :z-index="11000"
    @cancel="handleCancel"
  >
    <template #closeIcon>
      <CloseOutlined class="speaker-picker-close" />
    </template>

    <div class="speaker-picker-shell">
      <h2 class="speaker-picker-title">发言角色</h2>

      <div class="speaker-picker-list">
        <button
          v-for="(name, idx) in displayCharacters"
          :key="`${name}-${idx}`"
          type="button"
          :class="['speaker-picker-item', { 'is-selected': selectedName === name }]"
          @click="selectName(name)"
        >
          <img
            v-if="hasAvatar(name)"
            class="speaker-picker-cover"
            :src="getAvatarUrl(name)"
            :alt="name"
          />
          <div v-else class="speaker-picker-cover speaker-picker-cover--placeholder">
            <img :src="characterPlaceholderUrl" alt="" />
          </div>
          <span class="speaker-picker-name">{{ name || '未命名' }}</span>
        </button>
        <div v-if="displayCharacters.length === 0" class="speaker-picker-empty">
          <p>暂无角色，请先在「场景角色道具」中添加角色</p>
        </div>
      </div>

      <div class="speaker-picker-footer">
        <a-button class="speaker-picker-btn-cancel" @click="handleCancel">
          <div class="text-gradient">取消</div>
        </a-button>
        <a-button
          type="primary"
          class="speaker-picker-btn-ok"
          :disabled="selectedName === null"
          @click="handleConfirm"
        >
          确定
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import characterPlaceholderUrl from '~/assets/img/icon/character-nor.svg'

const props = withDefaults(
  defineProps<{
    open: boolean
    characters: string[]
    initialName?: string
    /** 角色名 → 头像 URL，可选 */
    characterAvatars?: Record<string, string>
  }>(),
  { characters: () => [], initialName: '', characterAvatars: () => ({}) }
)

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm', name: string): void
}>()

const localOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const displayCharacters = computed(() => {
  const list = props.characters && props.characters.length ? props.characters : ['旁白', '陌生人']
  return [...new Set(list.map((s) => (s || '').trim()).filter(Boolean))]
})

const selectedName = ref<string | null>(null)

watch(
  () => [props.open, props.initialName],
  () => {
    if (props.open) {
      const initial = (props.initialName || '').trim()
      selectedName.value = displayCharacters.value.includes(initial)
        ? initial
        : (displayCharacters.value[0] ?? null)
    }
  },
  { immediate: true }
)

function hasAvatar(name: string) {
  return !!props.characterAvatars?.[name]?.trim()
}

function getAvatarUrl(name: string) {
  return props.characterAvatars?.[name]?.trim() || ''
}

function selectName(name: string) {
  selectedName.value = name
}

function handleCancel() {
  localOpen.value = false
}

function handleConfirm() {
  if (selectedName.value !== null) {
    emit('confirm', selectedName.value)
    localOpen.value = false
  }
}
</script>

<style>
.speaker-role-picker-wrap .ant-modal-content {
  background: #191a1d !important;
  border-radius: 4px !important;
  padding: 0 !important;
  overflow: hidden;
}

.speaker-role-picker-wrap .ant-modal-header {
  display: none !important;
}

.speaker-role-picker-wrap .ant-modal-close {
  color: #8e97a5 !important;
  top: 12px !important;
  right: 12px !important;
}

.speaker-role-picker-wrap .ant-modal-close:hover {
  color: #4ae7fd !important;
}

.speaker-role-picker-wrap .ant-modal-body {
  padding: 0 !important;
  background: #191a1d !important;
}
</style>

<style scoped>
.speaker-picker-close {
  font-size: 14px;
}

.speaker-picker-shell {
  display: flex;
  flex-direction: column;
  min-height: 197px;
  padding: 12px 16px 16px;
  color: #e6edf3;
  background: #27282d;
}

.speaker-picker-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  color: #fff;
}

.speaker-picker-list {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  min-height: 80px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.speaker-picker-list::-webkit-scrollbar {
  display: none;
}

.speaker-picker-item {
  position: relative;
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  padding: 0;
  border: 3px solid transparent;
  border-radius: 12px;
  overflow: hidden;
  background: #121212;
  cursor: pointer;
  color: inherit;
  transition: border-color 0.2s ease;
}

.speaker-picker-item.is-selected {
  border-color: #56e3ff;
}

.speaker-picker-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #121212;
}

.speaker-picker-cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.speaker-picker-cover--placeholder img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  opacity: 0.85;
}

.speaker-picker-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 2px 4px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  text-align: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.speaker-picker-empty {
  width: 100%;
  padding: 16px 0;
  text-align: center;
  color: #8e97a5;
  font-size: 14px;
}

.speaker-picker-empty p {
  margin: 0;
}

.speaker-picker-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: auto;
  padding-top: 16px;
}

.speaker-picker-btn-cancel {
  background: transparent !important;
  border-color: rgba(96, 124, 158, 0.35) !important;
  color: #e6edf3 !important;
  min-width: 72px;
  height: 32px;
  padding: 0 16px;
  border-radius: 4px !important;
}

.speaker-picker-btn-cancel:hover {
  border-color: #4ae7fd !important;
  color: #4ae7fd !important;
}

.speaker-picker-btn-ok {
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  border-color: transparent !important;
  color: #fff !important;
  font-weight: 500;
  min-width: 72px;
  height: 32px;
  padding: 0 16px;
  border-radius: 4px !important;
}

.speaker-picker-btn-ok:hover:not(:disabled) {
  filter: brightness(1.08);
  border-color: transparent !important;
  color: #fff !important;
}

.speaker-picker-btn-ok:disabled {
  opacity: 0.45;
}
</style>
