<template>
  <div class="generate-model-config-block" :class="[`generate-model-config-block--${density}`]">
    <div v-if="showTitle" class="model-config-title">
      <SettingOutlined />
      <span>{{ title }}</span>
    </div>

    <div class="generate-settings-stacked">
      <div class="setting-item setting-item--model">
        <label v-if="showFieldLabels">{{ modelLabel }}</label>
        <slot name="model" />
      </div>

      <div :class="['generate-settings-params', `generate-settings-params--cols-${paramColumns}`]">
        <template v-if="mode === 'video'">
          <div class="setting-item">
            <label v-if="showFieldLabels">分辨率</label>
            <a-select
              v-model:value="aspectRatio"
              :class="selectClass"
              :popup-class-name="selectPopupClassName"
              :disabled="!videoAspectRatioSelectOptions.length"
            >
              <a-select-option
                v-for="opt in videoAspectRatioSelectOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </div>
          <div v-if="showDuration" class="setting-item">
            <label v-if="showFieldLabels">时长</label>
            <a-select
              v-model:value="duration"
              :class="selectClass"
              :popup-class-name="selectPopupClassName"
              :disabled="!videoDurationSelectOptions.length"
            >
              <a-select-option
                v-for="opt in videoDurationSelectOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </div>
          <div class="setting-item">
            <label v-if="showFieldLabels">数量</label>
            <a-select
              v-model:value="count"
              :class="selectClass"
              :popup-class-name="selectPopupClassName"
              :disabled="!videoCountSelectOptions.length"
            >
              <a-select-option
                v-for="opt in videoCountSelectOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </div>
          <div class="setting-item">
            <label v-if="showFieldLabels">画质</label>
            <a-select
              v-model:value="quality"
              :class="selectClass"
              :popup-class-name="selectPopupClassName"
              :disabled="!videoQualitySelectOptions.length"
            >
              <a-select-option
                v-for="opt in videoQualitySelectOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </div>
          <div class="setting-item">
            <label v-if="showFieldLabels">音频</label>
            <a-select
              v-model:value="audio"
              :class="selectClass"
              :popup-class-name="selectPopupClassName"
              :disabled="!videoAudioSelectOptions.length"
            >
              <a-select-option
                v-for="opt in videoAudioSelectOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </div>
        </template>
        <template v-else>
          <div class="setting-item">
            <label v-if="showFieldLabels">分辨率</label>
            <a-select
              v-model:value="aspectRatio"
              :class="selectClass"
              :popup-class-name="selectPopupClassName"
              :disabled="!aspectRatioSelectOptions.length"
            >
              <a-select-option
                v-for="opt in aspectRatioSelectOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </div>
          <div class="setting-item">
            <label v-if="showFieldLabels">张数</label>
            <a-select
              v-model:value="count"
              :class="selectClass"
              :popup-class-name="selectPopupClassName"
              :disabled="!countSelectOptions.length"
            >
              <a-select-option
                v-for="opt in countSelectOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </div>
          <div class="setting-item">
            <label v-if="showFieldLabels">画质</label>
            <a-select
              v-model:value="quality"
              :class="selectClass"
              :popup-class-name="selectPopupClassName"
              :disabled="!qualitySelectOptions.length"
            >
              <a-select-option
                v-for="opt in qualitySelectOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </div>
        </template>
      </div>
    </div>

    <div v-if="showAction" class="generate-model-config-block__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SettingOutlined } from '@ant-design/icons-vue'
import type { SelectOption } from '~/utils/modelCapability'

const props = withDefaults(
  defineProps<{
    /** listByFunc capability 驱动的比例选项；未传则使用默认三项 */
    aspectRatioOptions?: SelectOption<string>[]
    /** 张数选项 */
    countOptions?: SelectOption<number>[]
    /** 画质选项 */
    qualityOptions?: SelectOption<string>[]
    /** 视频模式：比例 / 时长 / 数量 / 画质 / 音频（由 capability + 字典驱动） */
    videoAspectRatioOptions?: SelectOption<string>[]
    videoDurationOptions?: SelectOption<string>[]
    videoCountOptions?: SelectOption<number>[]
    videoQualityOptions?: SelectOption<string>[]
    videoAudioOptions?: SelectOption<string>[]
    /** 为 false 时不展示时长（模型不支持） */
    showDuration?: boolean
    /** 为 false 时不渲染底部操作区，由父级固定在右栏底部（低分辨率下主按钮始终可见） */
    showAction?: boolean
    /** 是否展示区块标题「模型配置」 */
    showTitle?: boolean
    /** 是否展示各字段 label */
    showFieldLabels?: boolean
    /** 区块标题 */
    title?: string
    modelLabel?: string
    /** 参数行栅格列数（模型独占首行，其余参数按此列数换行） */
    paramColumns?: 2 | 3 | 4
    /** @deprecated 兼容旧用法，等同于 paramColumns */
    columns?: 2 | 3 | 4
    /** a-select 类名，与父级原样式一致 */
    selectClass?: string
    /**
     * scene：编辑场景图（下拉略高）
     * storyboard：编辑分镜图（紧凑下拉 + 模型槽位高度）
     */
    density?: 'scene' | 'storyboard'
    /** 配置模式：image 为生图；video 为生视频 */
    mode?: 'image' | 'video'
    /** 下拉菜单 popup class */
    selectPopupClassName?: string
    /** 是否展示 3K（分镜图消耗配置里有 3K） */
    showQuality3k?: boolean
  }>(),
  {
    showAction: true,
    showTitle: false,
    showFieldLabels: false,
    title: '模型配置',
    modelLabel: '模型版本',
    paramColumns: 3,
    columns: 3,
    selectClass: 'setting-select',
    density: 'scene',
    mode: 'image',
    selectPopupClassName: '',
    showQuality3k: false,
    showDuration: true
  }
)

const paramColumns = computed(() => props.paramColumns ?? props.columns ?? 3)

const DEFAULT_ASPECT_RATIO_OPTIONS: SelectOption<string>[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' }
]
const DEFAULT_COUNT_OPTIONS: SelectOption<number>[] = [
  { value: 1, label: '1张' },
  { value: 2, label: '2张' },
  { value: 3, label: '3张' },
  { value: 4, label: '4张' }
]
const DEFAULT_QUALITY_OPTIONS: SelectOption<string>[] = [
  { value: '1k', label: '1K' },
  { value: '2k', label: '2K' },
  { value: '4k', label: '4K' }
]

const aspectRatioSelectOptions = computed(() =>
  props.aspectRatioOptions?.length ? props.aspectRatioOptions : DEFAULT_ASPECT_RATIO_OPTIONS
)
const countSelectOptions = computed(() =>
  props.countOptions?.length ? props.countOptions : DEFAULT_COUNT_OPTIONS
)
const qualitySelectOptions = computed(() => {
  const base = props.qualityOptions?.length ? props.qualityOptions : DEFAULT_QUALITY_OPTIONS
  if (props.showQuality3k && !base.some((o) => o.value === '3k')) {
    return [...base, { value: '3k', label: '3K' }]
  }
  if (!props.showQuality3k) {
    return base.filter((o) => o.value !== '3k')
  }
  return base
})

const DEFAULT_VIDEO_ASPECT_OPTIONS: SelectOption<string>[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' }
]
const DEFAULT_VIDEO_DURATION_OPTIONS: SelectOption<string>[] = [
  { value: '5', label: '5 s' },
  { value: '10', label: '10 s' }
]
const DEFAULT_VIDEO_COUNT_OPTIONS: SelectOption<number>[] = [
  { value: 1, label: '1个' },
  { value: 2, label: '2个' },
  { value: 3, label: '3个' },
  { value: 4, label: '4个' }
]
const DEFAULT_VIDEO_QUALITY_OPTIONS: SelectOption<string>[] = [
  { value: '1080p', label: '1080P' },
  { value: '720p', label: '720P' }
]
const DEFAULT_VIDEO_AUDIO_OPTIONS: SelectOption<string>[] = [
  { value: 'silent', label: '无声视频' },
  { value: 'with_audio', label: '带音频' }
]

const videoAspectRatioSelectOptions = computed(() =>
  props.videoAspectRatioOptions?.length
    ? props.videoAspectRatioOptions
    : DEFAULT_VIDEO_ASPECT_OPTIONS
)
const videoDurationSelectOptions = computed(() =>
  props.videoDurationOptions?.length ? props.videoDurationOptions : DEFAULT_VIDEO_DURATION_OPTIONS
)
const videoCountSelectOptions = computed(() =>
  props.videoCountOptions?.length ? props.videoCountOptions : DEFAULT_VIDEO_COUNT_OPTIONS
)
const videoQualitySelectOptions = computed(() =>
  props.videoQualityOptions?.length ? props.videoQualityOptions : DEFAULT_VIDEO_QUALITY_OPTIONS
)
const videoAudioSelectOptions = computed(() =>
  props.videoAudioOptions?.length ? props.videoAudioOptions : DEFAULT_VIDEO_AUDIO_OPTIONS
)

const aspectRatio = defineModel<string>('aspectRatio', { required: true })
const count = defineModel<number>('count', { required: true })
const quality = defineModel<string>('quality', { required: true })
const duration = defineModel<string>('duration', { default: '5' })
const audio = defineModel<string>('audio', { default: 'silent' })
</script>

<style scoped lang="scss">
.model-config-title {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(218, 233, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
}

.model-config-title :deep(.anticon) {
  font-size: 14px;
  color: rgba(188, 205, 228, 0.92);
}

.generate-settings-stacked {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 0;
  margin-bottom: 0;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.setting-item--model {
  width: 100%;
}

.setting-item--model :deep(.model-select-dropdown),
.setting-item--model :deep(.ant-select) {
  width: 100%;
}

.setting-item label {
  margin-bottom: 2px;
  color: rgba(188, 205, 228, 0.72);
  font-size: 12px;
  line-height: 18px;
}

.generate-model-config-block--scene .setting-item label {
  font-size: 13px;
  color: #8e97a5 !important;
}

.generate-settings-params {
  display: grid;
  gap: 10px;
  width: 100%;
}

.generate-settings-params--cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.generate-settings-params--cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.generate-settings-params--cols-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.setting-select :deep(.ant-select-selector),
.setting-select-inline :deep(.ant-select-selector) {
  height: 44px !important;
  border-radius: 10px !important;
  background: #0a0d12 !important;
  border: 1px solid rgba(78, 94, 122, 0.42) !important;
  box-shadow: none !important;
}

.setting-select :deep(.ant-select-selection-item),
.setting-select-inline :deep(.ant-select-selection-item) {
  line-height: 42px !important;
  font-size: 13px;
  color: rgba(225, 239, 255, 0.92) !important;
}

.setting-select :deep(.ant-select-selection-placeholder),
.setting-select-inline :deep(.ant-select-selection-placeholder) {
  line-height: 42px !important;
  font-size: 13px;
}

.generate-model-config-block--storyboard .setting-select-inline :deep(.ant-select-selector) {
  height: 40px !important;
}

.generate-model-config-block--storyboard .setting-select-inline :deep(.ant-select-selection-item),
.generate-model-config-block--storyboard
  .setting-select-inline
  :deep(.ant-select-selection-placeholder) {
  line-height: 38px !important;
}

.generate-model-config-block--storyboard :deep(.model-select-dropdown .selected-model) {
  height: 40px !important;
  min-height: 40px;
  padding: 0 10px !important;
  border-radius: 10px !important;
  background: #0a0d12 !important;
  border: 1px solid rgba(78, 94, 122, 0.42) !important;
  box-shadow: none !important;
}

.generate-model-config-block--scene :deep(.model-select-dropdown .selected-model) {
  height: 44px !important;
  min-height: 44px;
  padding: 0 10px !important;
  border-radius: 10px !important;
  background: #0a0d12 !important;
  border: 1px solid rgba(78, 94, 122, 0.42) !important;
  box-shadow: none !important;
}

.generate-model-config-block--scene :deep(.model-select-dropdown .selected-model.expanded.is-open-down) {
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.generate-model-config-block--scene :deep(.model-select-dropdown .selected-model.expanded.is-open-up) {
  border-top-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
}

.generate-model-config-block--scene :deep(.model-select-dropdown .selected-model:hover) {
  border-color: rgba(120, 140, 170, 0.45) !important;
}

.generate-model-config-block__action {
  width: 100%;
}

.generate-model-config-block--storyboard .generate-model-config-block__action :deep(.generate-btn) {
  margin: 1rem 1rem 0;
  flex-shrink: 0;
  height: 46px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%) !important;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
  border: none !important;
}

.generate-model-config-block--storyboard .generate-model-config-block__action :deep(.generate-btn:hover) {
  filter: brightness(1.06);
}

.generate-model-config-block--scene .generate-model-config-block__action :deep(.generate-btn) {
  margin-top: auto;
  height: 46px;
  border: 0;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
}

.generate-model-config-block--scene .generate-model-config-block__action :deep(.generate-btn:hover) {
  filter: brightness(1.06);
}

.generate-model-config-block--scene .generate-model-config-block__action :deep(.ant-btn-primary) {
  border: none !important;
}
</style>
