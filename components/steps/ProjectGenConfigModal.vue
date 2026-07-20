<template>
  <a-modal
    v-model:open="localOpen"
    width="58%"
    :footer="null"
    centered
    class="project-gen-config-modal"
    wrap-class-name="create-flow-modal project-gen-config-modal-wrap"
    destroy-on-close
    @cancel="handleCancel"
  >
    <template #title>
      <ModalTitleWatermark title="生成配置" watermark="GEN CONFIG" />
    </template>

    <div class="pgc-shell">
      <div class="pgc-body">
        <p class="pgc-desc">
          为当前作品配置各业务场景的默认智能体与模型。自动提取、批量生成未手动选模型时将使用此处配置（经济/性能模式跟随作品「模型策略」）。
        </p>

        <div v-if="loading" class="pgc-loading" role="status" aria-live="polite" aria-busy="true">
          <LoadingOutlined spin class="pgc-loading__icon" />
          <p class="pgc-loading__text">正在加载生成配置…</p>
        </div>

        <template v-else>
          <div class="header-tabs">
            <div class="import-tab-bar__inner">
              <nav class="import-tab-inner" aria-label="生成配置分类">
                <button
                  v-for="(group, index) in visibleSceneGroups"
                  :key="group.title"
                  type="button"
                  :class="['import-tab', { 'import-tab--active': activeTabIndex === index }]"
                  @click="activeTabIndex = index"
                >
                  {{ tabLabel(group.title) }}
                </button>
              </nav>
            </div>
          </div>

          <div class="pgc-scenes-scroll">
            <div class="pgc-scenes">
              <section
                v-for="scene in activeGroup.scenes"
                :key="scene.sceneCode"
                class="pgc-scene-panel"
              >
                <div class="pgc-scene-label">
                  <span
                    v-for="(line, lineIndex) in sceneLabelLines(scene.label)"
                    :key="lineIndex"
                    class="pgc-scene-label__line"
                  >
                    {{ line }}
                  </span>
                </div>

                <div
                  class="pgc-scene-config"
                  :class="{ 'pgc-scene-config--image': scene.kind === 'image' }"
                >
                  <div class="pgc-config-head-row">
                    <div class="pgc-config-head">
                      <span class="pgc-config-head__text">智能体/模型</span>
                      <span class="pgc-config-head__ico" aria-hidden="true">
                        <img src="/assets/img/icon/Subtract.svg" alt="" />
                      </span>
                    </div>
                    <template v-if="scene.kind === 'image'">
                      <div class="pgc-config-head pgc-config-head--param">
                        <span class="pgc-config-head__text">清晰度</span>
                      </div>
                      <div class="pgc-config-head pgc-config-head--param">
                        <span class="pgc-config-head__text">比例</span>
                      </div>
                    </template>
                  </div>

                  <div class="pgc-config-row">
                    <button
                      type="button"
                      class="pgc-agent-model-card"
                      @click="openAgentPicker(scene.sceneCode)"
                    >
                      <div class="pgc-agent-model-card__agent">
                        <div class="pgc-agent-model-card__avatar">
                          <img
                            v-if="agentThumbnail(scene.sceneCode)"
                            :src="agentThumbnail(scene.sceneCode)"
                            :alt="agentDisplayName(scene.sceneCode)"
                            class="pgc-agent-model-card__avatar-img"
                          />
                          <AppstoreOutlined v-else class="pgc-agent-model-card__avatar-ico" />
                        </div>
                        <div class="pgc-agent-model-card__info">
                          <div class="pgc-agent-model-card__name">{{ agentDisplayName(scene.sceneCode) }}</div>
                          <div class="pgc-agent-model-card__desc">{{ agentDisplayDesc(scene.sceneCode) }}</div>
                        </div>
                      </div>

                      <span class="pgc-agent-model-card__sep" aria-hidden="true">/</span>

                      <div class="pgc-agent-model-card__model">
                        <div class="pgc-agent-model-card__avatar pgc-agent-model-card__avatar--model">
                          {{ modelDisplayInitial(scene.sceneCode) }}
                        </div>
                        <div class="pgc-agent-model-card__info">
                          <div class="pgc-agent-model-card__name">{{ modelDisplayName(scene.sceneCode) }}</div>
                          <div class="pgc-agent-model-card__desc">{{ modelDisplayProvider(scene.sceneCode) }}</div>
                        </div>
                      </div>
                    </button>

                    <template v-if="scene.kind === 'image'">
                      <div class="pgc-param-field">
                        <a-select
                          class="pgc-select pgc-select--param"
                          :value="rowValue(scene.sceneCode).resolution || undefined"
                          placeholder="清晰度"
                          :options="resolutionOptionsFor(scene.sceneCode)"
                          :disabled="!resolutionOptionsFor(scene.sceneCode).length"
                          popup-class-name="pgc-select-popup"
                          @change="(v: string) => onResolutionChange(scene.sceneCode, v)"
                        />
                      </div>
                      <div class="pgc-param-field">
                        <a-select
                          class="pgc-select pgc-select--param"
                          :value="rowValue(scene.sceneCode).aspectRatio || undefined"
                          placeholder="比例"
                          :options="aspectRatioOptionsFor(scene.sceneCode)"
                          :disabled="!aspectRatioOptionsFor(scene.sceneCode).length"
                          popup-class-name="pgc-select-popup"
                          @change="(v: string) => onAspectRatioChange(scene.sceneCode, v)"
                        />
                      </div>
                    </template>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </template>
      </div>

      <div class="pgc-footer">
      <a-button size="large" class="pgc-btn-cancel" :disabled="loading" @click="handleCancel">
        <div class="text-gradient">取消</div>
      </a-button>
      <a-button
        type="primary"
        size="large"
        class="pgc-btn-save"
        :loading="saving"
        :disabled="loading"
        @click="handleSave"
      >
        确定
      </a-button>
      </div>
    </div>

    <AgentPickerModal
      v-model:open="agentPickerOpen"
      :agents="pickerAgents"
      :models="pickerAvailableModels"
      :initial-model-code="pickerInitialModelCode"
      @select="onAgentPicked"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  AppstoreOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import AgentPickerModal, { type AgentOption } from '~/components/steps/AgentPickerModal.vue'
import type { ProjectGenConfigVO, UserModelListItem } from '~/types/business-api'
import {
  agentOptionsFromGenConfigVo,
  pickFirstAgentOption
} from '~/utils/extractAgentBiz'
import {
  fetchProjectGenConfigList,
  saveProjectGenConfigItems
} from '~/utils/projectGenConfig'
import {
  PROJECT_GEN_CONFIG_SCENE_GROUPS,
  type ProjectGenConfigSceneKind
} from '~/utils/projectGenConfigScenes'

interface SceneRowDraft {
  agentCode: string
  agentName: string
  modelCode: string
  resolution: string
  aspectRatio: string
  availableModels: UserModelListItem[]
}

const TAB_LABEL_MAP: Record<string, string> = {
  '资产提取（文字）': '资产提取(文字)',
  '形态文案（文字）': '形态提取(文字)',
  '形态生图（图片）': '形态生图(图片)',
  '分镜（文字）': '分镜脚本(文字)',
  '分镜生图（图片）': '分镜生图(图片)'
}

const props = defineProps<{
  open: boolean
  projectId: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const localOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const loading = ref(false)
const saving = ref(false)
const activeTabIndex = ref(0)
const rows = reactive<Record<string, SceneRowDraft>>({})
const agentOptionsByScene = reactive<Record<string, AgentOption[]>>({})
const applicableSceneCodes = ref<Set<string>>(new Set())

const visibleSceneGroups = computed(() => {
  const codes = applicableSceneCodes.value
  if (!codes.size) return PROJECT_GEN_CONFIG_SCENE_GROUPS
  return PROJECT_GEN_CONFIG_SCENE_GROUPS.map((group) => ({
    ...group,
    scenes: group.scenes.filter((scene) => codes.has(String(scene.sceneCode)))
  })).filter((group) => group.scenes.length > 0)
})

const agentPickerOpen = ref(false)
const pickerSceneCode = ref('')
const pickerAgents = ref<AgentOption[]>([])
const pickerAvailableModels = ref<UserModelListItem[]>([])
const pickerInitialModelCode = ref('')

const activeGroup = computed(() =>
  visibleSceneGroups.value[activeTabIndex.value] ?? visibleSceneGroups.value[0]
)

function tabLabel(title: string): string {
  return TAB_LABEL_MAP[title] ?? title
}

function sceneLabelLines(label: string): string[] {
  const text = String(label || '').trim()
  if (!text) return ['']
  if (text.length <= 3) return [text]
  const lines: string[] = []
  for (let i = 0; i < text.length; i += 2) {
    lines.push(text.slice(i, i + 2))
  }
  return lines
}

function emptyRow(): SceneRowDraft {
  return {
    agentCode: '',
    agentName: '',
    modelCode: '',
    resolution: '',
    aspectRatio: '',
    availableModels: []
  }
}

function rowValue(sceneCode: string): SceneRowDraft {
  return rows[sceneCode] ?? emptyRow()
}

function selectedAgent(sceneCode: string): AgentOption | undefined {
  const r = rowValue(sceneCode)
  const code = String(r.agentCode || '').trim()
  if (!code) return undefined
  return (agentOptionsByScene[sceneCode] ?? []).find((a) => a.id === code)
}

function selectedModelItem(sceneCode: string): UserModelListItem | undefined {
  const r = rowValue(sceneCode)
  const code = String(r.modelCode || '').trim()
  if (!code) return undefined
  return r.availableModels.find((m) => String(m.modelCode || '').trim() === code)
}

function agentDisplayName(sceneCode: string): string {
  const r = rowValue(sceneCode)
  return r.agentName || r.agentCode || '选择智能体'
}

function agentDisplayDesc(sceneCode: string): string {
  const agent = selectedAgent(sceneCode)
  if (agent?.desc) return agent.desc
  if (rowValue(sceneCode).agentCode) return '已配置默认智能体'
  return '点击选择默认智能体'
}

function agentThumbnail(sceneCode: string): string {
  return String(selectedAgent(sceneCode)?.thumbnail || '').trim()
}

function modelDisplayName(sceneCode: string): string {
  const hit = selectedModelItem(sceneCode)
  if (hit?.modelName) return String(hit.modelName)
  const code = rowValue(sceneCode).modelCode
  return code || '选择模型'
}

function modelDisplayProvider(sceneCode: string): string {
  const hit = selectedModelItem(sceneCode)
  const provider = String(hit?.providerName || '').trim()
  if (provider) return provider
  const type = String(hit?.modelType || '').trim()
  return type || '—'
}

function modelDisplayInitial(sceneCode: string): string {
  const name = modelDisplayName(sceneCode)
  if (!name || name === '选择模型') return 'M'
  return name.slice(0, 1).toUpperCase()
}

function modelOptionsFor(sceneCode: string) {
  const r = rowValue(sceneCode)
  return (r.availableModels ?? []).map((m) => ({
    label: m.modelName || m.modelCode || '未命名',
    value: String(m.modelCode || '').trim()
  })).filter((o) => o.value)
}

function selectedModelCapability(sceneCode: string) {
  const hit = selectedModelItem(sceneCode)
  return hit?.capability ?? null
}

function resolutionOptionsFor(sceneCode: string) {
  const cap = selectedModelCapability(sceneCode)
  const opts = cap?.sizeOptions ?? []
  return opts.map((v) => ({ label: v, value: v }))
}

function aspectRatioOptionsFor(sceneCode: string) {
  const cap = selectedModelCapability(sceneCode)
  const opts = cap?.aspectRatioOptions ?? []
  return opts.map((v) => ({ label: v, value: v }))
}

function applyVoToRow(vo: ProjectGenConfigVO) {
  const code = String(vo.sceneCode || '').trim()
  if (!code) return
  const agentCode = String(vo.agentCode || '').trim()
  const agents = agentOptionsByScene[code] ?? []
  const agentHit = agents.find((a) => a.id === agentCode)
  rows[code] = {
    agentCode,
    agentName: agentHit?.name || agentCode,
    modelCode: String(vo.modelCode || '').trim(),
    resolution: String(vo.resolution || '').trim(),
    aspectRatio: String(vo.aspectRatio || '').trim(),
    availableModels: Array.isArray(vo.availableModels) ? vo.availableModels : []
  }
}

function pickDefaultModelCode(
  sceneCode: string,
  agentCode: string,
  availableModels: UserModelListItem[],
  preferredModelCode?: string
): string {
  const preferred = String(preferredModelCode || '').trim()
  if (
    preferred &&
    availableModels.some((m) => String(m.modelCode || '').trim() === preferred)
  ) {
    return preferred
  }

  const agent = (agentOptionsByScene[sceneCode] ?? []).find((a) => a.id === agentCode)
  const agentDefault = String(agent?.defaultModelCode || '').trim()
  if (
    agentDefault &&
    availableModels.some((m) => String(m.modelCode || '').trim() === agentDefault)
  ) {
    return agentDefault
  }

  const sorted = [...availableModels].sort(
    (a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0)
  )
  return String(sorted[0]?.modelCode || '').trim()
}

function applyImageParamDefaults(
  sceneCode: string,
  kind: ProjectGenConfigSceneKind,
  draft: SceneRowDraft
): SceneRowDraft {
  if (kind !== 'image') return draft

  const modelCode = String(draft.modelCode || '').trim()
  const hit = draft.availableModels.find((m) => String(m.modelCode || '').trim() === modelCode)
  const cap = hit?.capability ?? null
  const next = { ...draft }

  if (!next.resolution) {
    next.resolution = String(cap?.defaultSize || hit?.defaultSizeCode || '').trim()
  }
  if (!next.aspectRatio) {
    next.aspectRatio = String(cap?.defaultAspectRatio || hit?.defaultAspectRatio || '').trim()
  }
  return next
}

async function seedSceneRowDefaults(sceneCode: string, kind: ProjectGenConfigSceneKind) {
  const cur = rowValue(sceneCode)
  const agents = agentOptionsByScene[sceneCode] ?? []

  let agentCode = String(cur.agentCode || '').trim()
  let agentName = String(cur.agentName || '').trim()

  if (!agentCode) {
    const first = pickFirstAgentOption(agents)
    if (first) {
      agentCode = first.id
      agentName = first.name
    }
  } else {
    const hit = agents.find((a) => a.id === agentCode)
    if (hit) {
      agentName = hit.name
    } else {
      const first = pickFirstAgentOption(agents)
      if (first) {
        agentCode = first.id
        agentName = first.name
      } else if (!agentName) {
        agentName = agentCode
      }
    }
  }

  let availableModels = Array.isArray(cur.availableModels) ? [...cur.availableModels] : []

  let modelCode = String(cur.modelCode || '').trim()
  if (!modelCode) {
    modelCode = pickDefaultModelCode(sceneCode, agentCode, availableModels)
  }
  if (
    modelCode &&
    availableModels.length &&
    !availableModels.some((m) => String(m.modelCode || '').trim() === modelCode)
  ) {
    modelCode = pickDefaultModelCode(sceneCode, agentCode, availableModels)
  }

  rows[sceneCode] = applyImageParamDefaults(sceneCode, kind, {
    agentCode,
    agentName,
    modelCode,
    resolution: cur.resolution,
    aspectRatio: cur.aspectRatio,
    availableModels
  })
}

async function loadAll() {
  const pid = Number(props.projectId)
  if (!Number.isFinite(pid) || pid <= 0) {
    message.warning('请先选择作品后再配置')
    return
  }

  loading.value = true
  activeTabIndex.value = 0
  try {
    for (const key of Object.keys(agentOptionsByScene)) {
      delete agentOptionsByScene[key]
    }
    for (const key of Object.keys(rows)) {
      delete rows[key]
    }
    applicableSceneCodes.value = new Set()

    const list = await fetchProjectGenConfigList(pid)
    const sceneCodeSet = new Set<string>()

    for (const vo of list) {
      const code = String(vo.sceneCode || '').trim()
      if (!code) continue
      sceneCodeSet.add(code)
      agentOptionsByScene[code] = agentOptionsFromGenConfigVo(vo)
      applyVoToRow(vo)
    }
    applicableSceneCodes.value = sceneCodeSet

    const scenes = visibleSceneGroups.value.flatMap((g) => g.scenes)
    await Promise.all(
      scenes.map((scene) => {
        const code = String(scene.sceneCode)
        if (!rows[code]) rows[code] = emptyRow()
        return seedSceneRowDefaults(code, scene.kind)
      })
    )
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载生成配置失败')
  } finally {
    loading.value = false
  }
}

function openAgentPicker(sceneCode: string) {
  pickerSceneCode.value = sceneCode
  pickerInitialModelCode.value = rowValue(sceneCode).modelCode
  pickerAgents.value = agentOptionsByScene[sceneCode] ?? []
  pickerAvailableModels.value = [...(rowValue(sceneCode).availableModels ?? [])]
  if (!pickerAgents.value.length) {
    message.warning('暂无可用智能体')
    return
  }
  agentPickerOpen.value = true
}

function sceneKindFor(sceneCode: string): ProjectGenConfigSceneKind {
  const hit = visibleSceneGroups.value
    .flatMap((g) => g.scenes)
    .find((s) => String(s.sceneCode) === sceneCode)
  return hit?.kind ?? 'text'
}

function onAgentPicked(payload: { agent?: AgentOption; modelCode?: string }) {
  const sceneCode = pickerSceneCode.value
  if (!sceneCode) return
  const cur = rowValue(sceneCode)
  const agent = payload.agent
  if (agent) {
    cur.agentCode = agent.id
    cur.agentName = agent.name
  }
  const pickedModel = String(payload.modelCode || agent?.defaultModelCode || '').trim()
  if (pickedModel) {
    cur.modelCode = pickedModel
  }
  rows[sceneCode] = applyImageParamDefaults(sceneCode, sceneKindFor(sceneCode), { ...cur })
}

function onResolutionChange(sceneCode: string, v: string) {
  const cur = rowValue(sceneCode)
  cur.resolution = String(v || '').trim()
  rows[sceneCode] = { ...cur }
}

function onAspectRatioChange(sceneCode: string, v: string) {
  const cur = rowValue(sceneCode)
  cur.aspectRatio = String(v || '').trim()
  rows[sceneCode] = { ...cur }
}

async function handleSave() {
  const pid = Number(props.projectId)
  if (!Number.isFinite(pid) || pid <= 0) {
    message.warning('项目无效')
    return
  }

  const configs = visibleSceneGroups.value.flatMap((g) => g.scenes)
    .map((scene) => {
      const r = rowValue(String(scene.sceneCode))
      if (!r.agentCode || !r.modelCode) return null
      return {
        sceneCode: scene.sceneCode,
        agentCode: r.agentCode,
        modelCode: r.modelCode,
        ...(scene.kind === 'image' && r.resolution ? { resolution: r.resolution } : {}),
        ...(scene.kind === 'image' && r.aspectRatio ? { aspectRatio: r.aspectRatio } : {})
      }
    })
    .filter(Boolean) as Array<{
      sceneCode: string
      agentCode: string
      modelCode: string
      resolution?: string
      aspectRatio?: string
    }>

  if (!configs.length) {
    message.warning('请至少完成一项场景的智能体与模型配置')
    return
  }

  saving.value = true
  try {
    await saveProjectGenConfigItems(pid, configs)
    message.success('生成配置已保存')
    emit('saved')
    localOpen.value = false
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  localOpen.value = false
}

watch(
  () => [props.open, props.projectId] as const,
  ([open]) => {
    if (open) void loadAll()
  }
)
</script>

<style scoped lang="scss">
.project-gen-config-modal :deep(.ant-modal-content) {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(74, 231, 253, 0.35);
  background: #13161c;
  height: min(780px, calc(100dvh - 48px));
  max-height: calc(100dvh - 48px);
}

.project-gen-config-modal :deep(.ant-modal-header) {
  margin: 0;
  padding: 1.25rem 1.5rem 0.75rem;
  background: #13161c;
  border-bottom: none;
  flex-shrink: 0;
}

.project-gen-config-modal :deep(.ant-modal-body) {
  padding: 0;
  background: #13161c;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pgc-shell {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.pgc-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pgc-desc {
  flex-shrink: 0;
  margin: 0 0 16px;
  font-size: 12px;
  line-height: 1.6;
  color: #8E97A5!important;
  text-align: center;
}

.pgc-loading {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}

.pgc-loading__icon {
  font-size: 28px;
  color: var(--home-accent, #4ae7fd);
}

.pgc-loading__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.75);
}

.header-tabs {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  width: 100%;
  margin-bottom: 0.875rem;
}

.import-tab-bar__inner {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 6px 16px;
  background: #202434;
  border-radius: 8px;

  .import-tab-inner {
    display: inline-flex;
    flex-shrink: 0;
    max-width: 100%;
    background: #294b5d;
    border-radius: 8px;

    .import-tab--active {
      background: #4ae7fd;
      color: #121212 !important;
    }
  }
}

.import-tab {
  position: relative;
  margin: 0;
  padding: 0.25rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #d9e6f2;
  cursor: pointer;
  background: transparent;
  flex-shrink: 0;
  white-space: nowrap;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.import-tab:hover:not(.import-tab--active) {
  color: #ffffff;
}

.pgc-scenes-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 1rem;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.pgc-scenes {
  display: flex;
  flex-direction: column;
  gap:24px;
}

.pgc-scene-panel {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 0;
  align-items: stretch;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 0.30);
  background: rgba(8, 12, 20, 0.55);
  overflow: hidden;
}

.pgc-scene-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 100%;
  padding: 12px 6px;
  background: #202434;
  font-size: 16px;
  font-weight: 500;
  color: rgba(230, 237, 243, 0.92);
  line-height: 1.25;
  text-align: center;
  border-right:1px solid rgba(74, 231, 253, 0.30) ;
}

.pgc-scene-label__line {
  display: block;
  white-space: nowrap;
}

.pgc-scene-config {
  min-width: 0;
  padding: 0.875rem 1rem;
}

.pgc-scene-config--image {
  .pgc-config-head-row,
  .pgc-config-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 108px 108px;
    gap: 0.625rem;
    align-items: end;
  }

  .pgc-config-row {
    align-items: stretch;
  }
}

.pgc-config-head-row {
  margin-bottom: 0.5rem;
}

.pgc-config-head {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.pgc-config-head--param {
  justify-content: flex-start;
}

.pgc-config-head__text {
  font-size: 16px;
  color: rgba(142, 151, 165, 0.95);
}

.pgc-config-head__ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 14px;
  height: 14px;

  img {
    display: block;
    width: 12px;
    height: 12px;
  }
}

.pgc-config-row {
  min-width: 0;
}

.pgc-param-field {
  min-width: 0;
  display: flex;
  align-items: stretch;
}

.pgc-agent-model-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  min-height: 72px;
  padding: 0.75rem 0.875rem;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 0.30);
  background:rgba(18, 18, 18, 1);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;

  &:hover {
    border-color: rgba(74, 231, 253, 0.45);
    background: rgba(74, 231, 253, 0.04);
  }
}

.pgc-agent-model-card__agent,
.pgc-agent-model-card__model {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
}

.pgc-agent-model-card__avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(74, 231, 253, 0.1);
  overflow: hidden;
}

.pgc-agent-model-card__avatar--model {
  background: linear-gradient(135deg, #0e59fa 0%, #2563eb 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.pgc-agent-model-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pgc-agent-model-card__avatar-ico {
  font-size: 18px;
  color: #4ae7fd;
}

.pgc-agent-model-card__info {
  min-width: 0;
  flex: 1;
}

.pgc-agent-model-card__name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pgc-agent-model-card__desc {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  line-height: 1.45;
  color: rgba(142, 151, 165, 0.95) !important;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pgc-agent-model-card__sep {
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 0.125rem;
  font-size: 1.375rem;
  font-weight: 400;
  line-height: 1;
  color: rgba(142, 151, 165, 0.65);
}

.pgc-select {
  width: 100%;
}

.pgc-select--param :deep(.ant-select-selector) {
  position: relative;
  height: 72px !important;
  min-height: 72px !important;
  padding: 0 28px 0 12px !important;
  border-radius: 8px !important;
  background: rgba(13, 16, 24, 0.95) !important;
  border: 1px solid rgba(7, 63, 86, 0.85) !important;
  box-shadow: none !important;
  display: flex !important;
  align-items: center !important;
}

.pgc-select--param :deep(.ant-select-selection-search) {
  inset-inline-start: 12px !important;
  inset-inline-end: 28px !important;
}

.pgc-select--param :deep(.ant-select-selection-item),
.pgc-select--param.ant-select-open :deep(.ant-select-selection-item) {
  line-height: 1.35 !important;
  font-size: 0.875rem;
  font-weight: 500;
  color: #f1f5f9 !important;
}

.pgc-select--param :deep(.ant-select-selection-placeholder) {
  line-height: 1.35 !important;
  font-size: 0.875rem;
  color: #8e97a5 !important;
}

.pgc-select--param :deep(.ant-select-arrow),
.pgc-select--param :deep(.ant-select-clear) {
  position: absolute;
  top: 50%;
  inset-inline-end: 10px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  margin: 0;
  line-height: 1;
  color: rgba(255, 255, 255, 0.45) !important;
  pointer-events: auto;

  .anticon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
    color: inherit;
  }

  svg {
    display: block;
    width: 12px;
    height: 12px;
  }
}

.pgc-select--param:hover :deep(.ant-select-arrow),
.pgc-select--param.ant-select-open :deep(.ant-select-arrow) {
  color: rgba(255, 255, 255, 0.65) !important;
}

.pgc-select--param :deep(.ant-select-clear) {
  background: transparent !important;
}

.pgc-select--param:hover :deep(.ant-select-selector),
.pgc-select--param.ant-select-focused :deep(.ant-select-selector),
.pgc-select--param.ant-select-open :deep(.ant-select-selector) {
  border-color: rgba(74, 231, 253, 0.45) !important;
}

.pgc-select--param.ant-select-disabled :deep(.ant-select-selector) {
  background: rgba(13, 16, 24, 0.6) !important;
  opacity: 0.65;
}

.pgc-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.25rem;
}

.pgc-btn-cancel {
  min-width: 96px;
  height: 40px;
  border-radius: 6px !important;
  border: 1px solid rgba(74, 231, 253, 0.3) !important;
  background: #0d1018 !important;
}

.pgc-btn-save {
  min-width: 96px;
  height: 40px;
  border-radius: 6px !important;
  border: none !important;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
}

@media (max-width: 900px) {
  .import-tab-bar__inner {
    padding: 6px 8px;
  }

  .import-tab-bar__inner .import-tab-inner {
    flex-wrap: wrap;
    justify-content: center;
  }

  .import-tab {
    padding: 0.25rem 0.75rem;
    font-size: 13px;
  }

  .pgc-scene-panel {
    grid-template-columns: 1fr;
  }

  .pgc-scene-label {
    min-height: auto;
    padding: 0.625rem 0.75rem;
  }

  .pgc-scene-config {
    padding-top: 0.75rem;
  }

  .pgc-scene-config--image {
    .pgc-config-head-row,
    .pgc-config-row {
      grid-template-columns: 1fr;
    }

    .pgc-config-head--param {
      display: none;
    }
  }

  .pgc-agent-model-card {
    grid-template-columns: 1fr;
  }

  .pgc-agent-model-card__sep {
    display: none;
  }

  .pgc-agent-model-card__model {
    padding-left: 0;
  }

  .pgc-select--param :deep(.ant-select-selector) {
    height: 44px !important;
    min-height: 44px !important;
  }
}
</style>

<style>
html.app-shell-create .ant-modal-wrap.project-gen-config-modal-wrap .ant-modal-content,
html.app-shell-create .ant-modal.project-gen-config-modal .ant-modal-content {
  display: flex;
  flex-direction: column;
  height: min(740px, calc(100dvh - 48px));
  max-height: calc(100dvh - 48px);
  overflow: hidden;
}

html.app-shell-create .ant-modal-wrap.project-gen-config-modal-wrap .ant-modal-body,
html.app-shell-create .ant-modal.project-gen-config-modal .ant-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pgc-select-popup.ant-select-dropdown {
  background: #111621 !important;
  border: 1px solid rgba(74, 231, 253, 0.28) !important;
}

.pgc-select-popup .ant-select-item {
  color: #e6edf3 !important;
}

.pgc-select-popup .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  background: rgba(74, 231, 253, 0.2) !important;
  color: #4ae7fd !important;
}

.pgc-select-popup .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
  background: rgba(74, 231, 253, 0.12) !important;
}
</style>
