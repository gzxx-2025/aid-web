<template>
  <div class="sb-left">
    <div class="sb-left-tabs">
      <button
        type="button"
        :class="['sb-left-tab', { active: activeTab === 'generate' }]"
        @click="activeTab = 'generate'"
      >
        生成分镜图
      </button>
      <button
        type="button"
        :class="['sb-left-tab', { active: activeTab === 'dialogue' }]"
        @click="activeTab = 'dialogue'"
      >
        对话作图
      </button>
      <button
        type="button"
        :class="['sb-left-tab', { active: activeTab === 'grid' }]"
        @click="activeTab = 'grid'"
      >
        九宫格
      </button>
    </div>

    <div class="sb-left-section">
      <div class="sb-left-header">
        <div class="sb-left-title">
          <span class="sb-badge">@分镜脚本1：</span>
          <span class="sb-name">未命名</span>
        </div>
        <a-button size="small" type="primary" class="sb-generate-prompt">
          <template #icon><ThunderboltOutlined /></template>
          生成提示词
        </a-button>
      </div>

      <div class="sb-left-grid">
        <div class="sb-left-grid-col sb-left-grid-col-labels">
          <div class="sb-left-label">场景</div>
          <div class="sb-left-label">角色</div>
          <div class="sb-left-label">道具</div>
          <div class="sb-left-label">其他</div>
        </div>

        <div class="sb-left-grid-col">
          <button type="button" class="sb-import-card">
            <div class="sb-import-icon">+</div>
            <div class="sb-import-text">导入场景</div>
          </button>
          <button type="button" class="sb-import-card">
            <div class="sb-import-icon">+</div>
            <div class="sb-import-text">导入角色</div>
          </button>
          <button type="button" class="sb-import-card">
            <div class="sb-import-icon">+</div>
            <div class="sb-import-text">导入道具</div>
          </button>
          <div class="sb-other-row">
            <button type="button" class="sb-other-card">
              <div class="sb-import-icon">+</div>
              <div class="sb-import-text">姿态图</div>
            </button>
            <button type="button" class="sb-other-card">
              <div class="sb-import-icon">+</div>
              <div class="sb-import-text">表情图</div>
            </button>
            <button type="button" class="sb-other-card">
              <div class="sb-import-icon">+</div>
              <div class="sb-import-text">特效图</div>
            </button>
            <button type="button" class="sb-other-card">
              <div class="sb-import-icon">+</div>
              <div class="sb-import-text">手绘稿</div>
            </button>
          </div>
        </div>

        <div class="sb-left-grid-col sb-left-side sb-left-side--dict">
          <div class="sb-select">
            <div class="sb-select-label">构图</div>
            <SettingSelectField
              :model-value="selectedComposition"
              :options="compositionOptions"
              placeholder="请选择构图"
              panel-title="选择构图"
              :open="activeSettingKey === 'composition'"
              @update:open="(v: boolean) => (activeSettingKey = v ? 'composition' : null)"
              @update:model-value="selectedComposition = $event"
            />
            <a-textarea
              v-model:value="compositionDesc"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              placeholder="请输入构图描述"
              class="sb-composition-desc"
            />
            <div class="sb-select-actions">
              <a-button size="small" type="text" @click="copyCompositionDesc">复制</a-button>
              <a-button size="small" type="text" danger @click="compositionDesc = ''">删除</a-button>
            </div>
          </div>

          <div class="sb-select">
            <div class="sb-select-label">景别</div>
            <SettingSelectField
              :model-value="selectedShotSize"
              :options="shotSizeOptions"
              placeholder="请选择景别"
              panel-title="选择景别"
              :open="activeSettingKey === 'shotSize'"
              @update:open="(v: boolean) => (activeSettingKey = v ? 'shotSize' : null)"
              @update:model-value="selectedShotSize = $event"
            />
          </div>

          <template v-if="settingsExpanded">
            <div class="sb-select">
              <div class="sb-select-label">拍摄角度</div>
              <SettingSelectField
                :model-value="selectedCameraAngle"
                :options="cameraAngleOptions"
                placeholder="请选择拍摄角度"
                panel-title="选择拍摄角度"
                :open="activeSettingKey === 'cameraAngle'"
                @update:open="(v: boolean) => (activeSettingKey = v ? 'cameraAngle' : null)"
                @update:model-value="selectedCameraAngle = $event"
              />
            </div>
            <div class="sb-select">
              <div class="sb-select-label">镜头焦距</div>
              <SettingSelectField
                :model-value="selectedFocalLength"
                :options="focalLengthOptions"
                placeholder="请选择镜头焦距"
                panel-title="选择镜头焦距"
                :open="activeSettingKey === 'focalLength'"
                @update:open="(v: boolean) => (activeSettingKey = v ? 'focalLength' : null)"
                @update:model-value="selectedFocalLength = $event"
              />
            </div>
            <div class="sb-select">
              <div class="sb-select-label">色彩倾向</div>
              <SettingSelectField
                :model-value="selectedColorTone"
                :options="colorToneOptions"
                placeholder="请选择色彩倾向"
                panel-title="选择色彩倾向"
                :open="activeSettingKey === 'colorTone'"
                @update:open="(v: boolean) => (activeSettingKey = v ? 'colorTone' : null)"
                @update:model-value="selectedColorTone = $event"
              />
            </div>
            <div class="sb-select">
              <div class="sb-select-label">光线</div>
              <SettingSelectField
                :model-value="selectedLighting"
                :options="lightingOptions"
                placeholder="请选择光线"
                panel-title="选择光线"
                :open="activeSettingKey === 'lighting'"
                @update:open="(v: boolean) => (activeSettingKey = v ? 'lighting' : null)"
                @update:model-value="selectedLighting = $event"
              />
            </div>
            <div class="sb-select">
              <div class="sb-select-label">摄影技法</div>
              <SettingSelectField
                :model-value="selectedTechnique"
                :options="techniqueOptions"
                placeholder="请选择摄影技法"
                panel-title="选择摄影技法"
                :open="activeSettingKey === 'technique'"
                @update:open="(v: boolean) => (activeSettingKey = v ? 'technique' : null)"
                @update:model-value="selectedTechnique = $event"
              />
            </div>
          </template>

          <button type="button" class="sb-expand" @click="settingsExpanded = !settingsExpanded">
            <span>{{ settingsExpanded ? '收起' : '展开' }}</span>
            <DownOutlined :class="{ 'sb-expand-icon--open': settingsExpanded }" />
          </button>
        </div>
      </div>

      <div class="sb-prompt">
        <RichTextEditor
          v-model="sbPrompt"
          min-height="160px"
          :max-length="3000"
          placeholder="描述想要生成的画面，如：一只可爱的猫咪"
        />
        <div class="sb-char-count">{{ sbPromptPlainLen }}/3000</div>
      </div>

      <div class="sb-bottom">
        <div class="sb-bottom-row">
          <div class="sb-pill">即梦5.0lite</div>
          <div class="sb-pill">16:9</div>
          <div class="sb-pill">1张</div>
          <div class="sb-pill">3k</div>
        </div>
        <a-button type="primary" block class="sb-generate-btn">开始生图</a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ThunderboltOutlined, DownOutlined } from '@ant-design/icons-vue'
import RichTextEditor from '~/components/common/RichTextEditor.vue'
import { htmlPlainTextLength } from '~/utils/htmlPlain'
import SettingSelectField from '~/components/steps/SettingSelectField.vue'
import {
  usePromptDictionary,
  PROMPT_TYPE,
  resolvePromptSelection
} from '~/composables/usePromptDictionary'

const activeTab = ref<'generate' | 'dialogue' | 'grid'>('generate')
const sbPrompt = ref('')
const sbPromptPlainLen = computed(() => htmlPlainTextLength(sbPrompt.value))

const settingsExpanded = ref(false)
type SideSettingKey =
  | 'composition'
  | 'shotSize'
  | 'cameraAngle'
  | 'focalLength'
  | 'colorTone'
  | 'lighting'
  | 'technique'
const activeSettingKey = ref<SideSettingKey | null>(null)
const compositionDesc = ref('')
const selectedComposition = ref<{ key: string; value: string } | null>(null)
const selectedShotSize = ref<{ key: string; value: string } | null>(null)
const selectedCameraAngle = ref<{ key: string; value: string } | null>(null)
const selectedFocalLength = ref<{ key: string; value: string } | null>(null)
const selectedColorTone = ref<{ key: string; value: string } | null>(null)
const selectedLighting = ref<{ key: string; value: string } | null>(null)
const selectedTechnique = ref<{ key: string; value: string } | null>(null)

const {
  ensureLoaded,
  compositionOptions,
  shotSizeOptions,
  cameraAngleOptions,
  focalLengthOptions,
  colorToneOptions,
  lightingOptions,
  techniqueOptions
} = usePromptDictionary()

onMounted(() => {
  void ensureLoaded()
})

function copyCompositionDesc() {
  const t = compositionDesc.value?.trim()
  if (!t) return
  void navigator.clipboard.writeText(t)
}

function migrate(
  cur: { key: string; value: string } | null,
  opts: { key: string; value: string; image?: string }[],
  type: string,
  set: (v: { key: string; value: string } | null) => void
) {
  if (!cur) return
  const n = resolvePromptSelection(cur, opts, type)
  if (n && (n.key !== cur.key || n.value !== cur.value)) set(n)
}

watch(
  [compositionOptions, () => selectedComposition.value],
  () => migrate(selectedComposition.value, compositionOptions.value, PROMPT_TYPE.composition, (v) => {
    selectedComposition.value = v
  }),
  { flush: 'post' }
)
watch(
  [shotSizeOptions, () => selectedShotSize.value],
  () => migrate(selectedShotSize.value, shotSizeOptions.value, PROMPT_TYPE.shot_size, (v) => {
    selectedShotSize.value = v
  }),
  { flush: 'post' }
)
watch(
  [cameraAngleOptions, () => selectedCameraAngle.value],
  () => migrate(selectedCameraAngle.value, cameraAngleOptions.value, PROMPT_TYPE.camera_angle, (v) => {
    selectedCameraAngle.value = v
  }),
  { flush: 'post' }
)
watch(
  [focalLengthOptions, () => selectedFocalLength.value],
  () => migrate(selectedFocalLength.value, focalLengthOptions.value, PROMPT_TYPE.focal_length, (v) => {
    selectedFocalLength.value = v
  }),
  { flush: 'post' }
)
watch(
  [colorToneOptions, () => selectedColorTone.value],
  () => migrate(selectedColorTone.value, colorToneOptions.value, PROMPT_TYPE.color_tone, (v) => {
    selectedColorTone.value = v
  }),
  { flush: 'post' }
)
watch(
  [lightingOptions, () => selectedLighting.value],
  () => migrate(selectedLighting.value, lightingOptions.value, PROMPT_TYPE.lighting, (v) => {
    selectedLighting.value = v
  }),
  { flush: 'post' }
)
watch(
  [techniqueOptions, () => selectedTechnique.value],
  () => migrate(selectedTechnique.value, techniqueOptions.value, PROMPT_TYPE.exposure_blur, (v) => {
    selectedTechnique.value = v
  }),
  { flush: 'post' }
)
</script>

<style scoped>
.sb-left {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  color: rgba(255, 255, 255, 0.85);
}

.sb-left-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 0.35rem;
}

.sb-left-tab {
  height: 34px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 600;
  cursor: pointer;
}

.sb-left-tab.active {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.35);
  color: rgba(226, 255, 237, 0.95);
}

.sb-left-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sb-left-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.10);
}

.sb-left-title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: rgba(255, 255, 255, 0.88);
  font-weight: 700;
}

.sb-badge {
  opacity: 0.9;
}

.sb-generate-prompt {
  height: 30px;
  border-radius: 10px;
}

.sb-left-grid {
  display: grid;
  grid-template-columns: 42px 1fr 1fr;
  gap: 0.75rem;
}

.sb-left-grid-col-labels {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.4rem;
}

.sb-left-label {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 700;
  font-size: 0.82rem;
  line-height: 42px;
}

.sb-import-card {
  width: 100%;
  height: 46px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.sb-import-icon {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  font-weight: 800;
}

.sb-import-text {
  font-weight: 700;
  font-size: 0.85rem;
}

.sb-other-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.sb-other-card {
  height: 40px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.sb-left-side {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sb-select {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.sb-select-label {
  font-size: 0.8rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.75);
}

.sb-select-btn {
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.10);
  color: rgba(255, 255, 255, 0.88);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.7rem;
  cursor: pointer;
}

.sb-select-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.25rem;
}

.sb-expand {
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.sb-expand-icon--open {
  transform: rotate(180deg);
}

.sb-composition-desc :deep(textarea) {
  background: rgba(0, 0, 0, 0.12) !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
  color: rgba(255, 255, 255, 0.88) !important;
}

.sb-left-side--dict :deep(.setting-select) {
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.1);
  color: rgba(255, 255, 255, 0.88);
}

.sb-left-side--dict :deep(.setting-select span) {
  color: rgba(255, 255, 255, 0.88);
}

.sb-prompt {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.10);
  padding: 0.6rem;
}

.sb-char-count {
  text-align: right;
  margin-top: 0.4rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
}

.sb-bottom {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sb-bottom-row {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 0.7fr 0.6fr;
  gap: 0.5rem;
}

.sb-pill {
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.82rem;
}

.sb-generate-btn {
  height: 44px;
  border-radius: 12px;
  font-weight: 800;
}
</style>
