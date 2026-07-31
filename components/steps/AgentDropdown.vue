<template>
  <div class="agent-dropdown">
    <!-- 当前选中的智能体（可点击展开） -->
    <div
      class="selected-agent"
      :class="{ expanded: expanded }"
      @click="$emit('toggle')"
    >
      <div class="agent-preview">
        <img
          v-if="value.thumbnail"
          :src="value.thumbnail"
          :alt="value.name"
          class="agent-thumbnail"
        />
        <div v-else class="agent-thumbnail placeholder">
          {{ value.name?.slice(0, 1) || '?' }}
        </div>
        <div class="agent-info">
          <div class="agent-name">{{ value.name || '请选择智能体' }}</div>
          <div v-if="expanded && value.desc" class="agent-desc">{{ value.desc }}</div>
        </div>
      </div>
      <UpOutlined v-if="expanded" class="expand-icon" />
      <DownOutlined v-else class="expand-icon" />
    </div>

    <!-- 下拉选项列表 -->
    <Transition name="dropdown">
      <div v-if="expanded" class="options-list">
        <div
          v-for="option in options"
          :key="option.id"
          class="option-item"
          :class="{ selected: value.id === option.id }"
          @click="$emit('select', option)"
        >
          <img
            v-if="option.thumbnail"
            :src="option.thumbnail"
            :alt="option.name"
            class="option-thumbnail"
          />
          <div v-else class="option-thumbnail placeholder">
            {{ option.name?.slice(0, 1) || '?' }}
          </div>
          <div class="option-info">
            <div class="option-name">{{ option.name }}</div>
            <div v-if="option.desc" class="option-desc">{{ option.desc }}</div>
          </div>
          <CheckCircleFilled v-if="value.id === option.id" class="check-icon" />
        </div>

        <!-- 选择更多模式 -->
        <div class="option-item more-option" @click="$emit('more')">
          <div class="more-icon">
            <MoreOutlined />
          </div>
          <div class="option-info">
            <div class="option-name">选择更多模式</div>
          </div>
          <RightOutlined class="arrow-icon" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { DownOutlined, UpOutlined, CheckCircleFilled, MoreOutlined, RightOutlined } from '@ant-design/icons-vue'
import type { AgentOption } from './AgentPickerModal.vue'

interface Props {
  value: AgentOption
  options: AgentOption[]
  expanded: boolean
}

defineProps<Props>()

defineEmits<{
  toggle: []
  select: [agent: AgentOption]
  more: []
}>()
</script>

<style scoped>
.agent-dropdown {
  position: relative;
  width: 100%;
}

.selected-agent {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: var(--create-surface-input, rgba(28, 38, 54, 0.92));
  border: 1px solid var(--gray-200, rgba(96, 124, 158, 0.22));
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.selected-agent:hover {
  border-color: var(--accent-400, #4ae7fd);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}

.selected-agent.expanded {
  border-color: var(--accent-500, #4ae7fd);
  background: var(--create-surface-panel, rgba(38, 50, 72, 0.94));
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.agent-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.agent-thumbnail {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: rgba(6, 10, 18, 0.55);
}

.agent-thumbnail.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: white;
  font-weight: 600;
  font-size: 1.125rem;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  margin-bottom: 0.25rem;
}

.agent-desc {
  font-size: 0.8125rem;
  color: var(--home-muted, #8e97a5);
  line-height: 1.5;
}

.expand-icon {
  font-size: 0.875rem;
  color: var(--home-muted, #8e97a5);
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.options-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--create-surface-modal, rgba(34, 44, 64, 0.98));
  border: 1px solid var(--gray-200, rgba(96, 124, 158, 0.22));
  border-top: none;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  box-shadow: 0 12px 32px rgba(8, 12, 24, 0.45);
  z-index: 100;
  max-height: 400px;
  overflow-y: auto;
  padding-top: 0;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  border-bottom: 1px solid var(--gray-200);
  border-left: 3px solid transparent;
}

.option-item:last-child {
  border-bottom: none;
}

.option-item:hover {
  background: rgba(74, 231, 253, 0.06);
}

.option-item.selected {
  background: rgba(74, 231, 253, 0.12);
  border-left-color: var(--accent-500, #4ae7fd);
}

.option-item.selected:first-child {
  border-top: none;
}

.option-thumbnail {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: rgba(6, 10, 18, 0.55);
}

.option-thumbnail.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  color: var(--home-text, #e6edf3);
  font-weight: 600;
  font-size: 1.125rem;
}

.option-info {
  flex: 1;
  min-width: 0;
}

.option-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  margin-bottom: 0.25rem;
}

.option-desc {
  font-size: 0.8125rem;
  color: var(--home-muted, #8e97a5);
  line-height: 1.5;
}

.check-icon {
  font-size: 1.125rem;
  color: var(--accent-500, #4ae7fd);
  flex-shrink: 0;
}

.more-option {
  border-top: 1px solid var(--gray-200);
  border-left: 3px solid transparent;
  margin-top: 0.5rem;
  padding-top: 1rem;
}

.more-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(6, 10, 18, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--home-muted, #8e97a5);
  font-size: 1.25rem;
}

.arrow-icon {
  font-size: 0.875rem;
  color: var(--home-muted, #8e97a5);
  flex-shrink: 0;
}

/* 下拉动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
  transform-origin: top;
}

.dropdown-enter-from {
  opacity: 0;
  transform: scaleY(0.95);
}

.dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.95);
}
</style>
