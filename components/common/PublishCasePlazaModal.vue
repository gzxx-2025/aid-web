<template>
  <a-modal
    :open="open"
    title="发布至案例广场"
    :width="560"
    centered
    destroy-on-close
    :mask-closable="!busy"
    :closable="!busy"
    wrap-class-name="create-flow-modal publish-case-plaza-modal-wrap"
    class="publish-case-plaza-modal"
    :ok-text="okText"
    cancel-text="取消"
    :ok-button-props="{ loading: submitting, disabled: busy && !submitting }"
    :cancel-button-props="{ disabled: busy }"
    @ok="handleConfirm"
    @cancel="handleCancel"
  >
    <div v-if="hydrating" class="publish-case-plaza__loading">加载中…</div>
    <div v-else class="publish-case-plaza">
      <p class="publish-case-plaza__tip">请上传作品封面并填写介绍，发布后将在案例广场展示。</p>

      <div class="publish-case-plaza__field">
        <label class="publish-case-plaza__label">
          作品封面<span class="publish-case-plaza__required">*</span>
        </label>
        <div class="publish-case-plaza__cover">
          <!-- 已有封面：预览；悬停显示删除，删后可重新上传 -->
          <div
            v-if="coverUrl"
            class="publish-case-plaza__cover-preview"
          >
            <PreviewableImageThumb
              :src="coverUrl"
              alt="作品封面"
              title="作品封面"
              object-fit="cover"
            />
            <button
              type="button"
              class="publish-case-plaza__cover-delete"
              :disabled="busy"
              aria-label="删除封面"
              title="删除封面"
              @click.stop="clearCover"
            >
              <img :src="deleteWhiteIcon" alt="" width="14" height="14" />
            </button>
          </div>
          <!-- 无封面：才走上传 -->
          <button
            v-else
            type="button"
            class="publish-case-plaza__cover-btn"
            :disabled="busy"
            aria-label="上传封面"
            @click="triggerPickCover"
          >
            <span class="publish-case-plaza__cover-empty">
              <PlusOutlined />
              <span>{{ uploading ? '上传中…' : '上传封面' }}</span>
            </span>
          </button>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          tabindex="-1"
          aria-hidden="true"
          class="publish-case-plaza__file"
          @change="onFilePicked"
        />
      </div>

      <div class="publish-case-plaza__field">
        <label class="publish-case-plaza__label" for="publish-case-plaza-desc">
          作品描述<span class="publish-case-plaza__required">*</span>
        </label>
        <a-textarea
          id="publish-case-plaza-desc"
          v-model:value="projectDesc"
          :rows="4"
          :maxlength="500"
          show-count
          :disabled="busy"
          placeholder="介绍一下你的作品（最多 500 字）"
        />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import deleteWhiteIcon from '~/assets/img/home/delete-white.svg'
import PreviewableImageThumb from '~/components/common/PreviewableImageThumb.vue'
import { userProjectUpdate } from '~/utils/businessApi'
import { isProjectPublicLockError, projectPublicLockUserHint } from '~/utils/projectAudit'
import { uploadImageToOssWithToast } from '~/utils/ossUpload'
import {
  fetchUserProjectDetailOnce,
  invalidateUserProjectDetailCache
} from '~/utils/userProjectDetailOnce'

const DESC_MAX = 500

const props = withDefaults(
  defineProps<{
    open: boolean
    projectId: number | null
    /** 打开时优先回显，避免多余 detail 请求 */
    initialCoverUrl?: string | null
    initialProjectDesc?: string | null
    okText?: string
  }>(),
  {
    initialCoverUrl: '',
    initialProjectDesc: '',
    okText: '确认发布'
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** 项目更新成功后抛出，由入口继续提审/发布 */
  success: [payload: { projectId: number; coverUrl: string; projectDesc: string }]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const coverUrl = ref('')
const projectDesc = ref('')
const hydrating = ref(false)
const uploading = ref(false)
const submitting = ref(false)

const busy = computed(() => hydrating.value || uploading.value || submitting.value)

watch(
  () => [props.open, props.projectId] as const,
  ([open]) => {
    if (!open) {
      resetForm()
      return
    }
    void hydrateForm()
  }
)

function resetForm() {
  coverUrl.value = ''
  projectDesc.value = ''
  hydrating.value = false
  uploading.value = false
  submitting.value = false
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function hydrateForm() {
  const pid = Number(props.projectId)
  if (!Number.isFinite(pid) || pid <= 0) {
    message.error('缺少项目信息')
    emit('update:open', false)
    return
  }

  const initialCover = String(props.initialCoverUrl || '').trim()
  const initialDesc = String(props.initialProjectDesc || '').trim()

  // 入口已带齐字段则不再请求 detail
  if (initialCover || initialDesc) {
    coverUrl.value = initialCover
    projectDesc.value = initialDesc.slice(0, DESC_MAX)
    if (initialCover && initialDesc) return
  }

  hydrating.value = true
  try {
    const detail = await fetchUserProjectDetailOnce(pid)
    if (!coverUrl.value) {
      coverUrl.value = String(detail.coverUrl || '').trim()
    }
    if (!projectDesc.value) {
      projectDesc.value = String(detail.projectDesc || '').trim().slice(0, DESC_MAX)
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    // 有局部 initial 时详情失败不阻断编辑
    if (!coverUrl.value && !projectDesc.value) {
      message.error(err?.msg || err?.message || '加载项目信息失败')
      emit('update:open', false)
    }
  } finally {
    hydrating.value = false
  }
}

function triggerPickCover() {
  if (busy.value) return
  fileInputRef.value?.click()
}

function clearCover() {
  if (busy.value) return
  coverUrl.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || busy.value) return

  if (!file.type.startsWith('image/')) {
    message.error('只能上传图片文件')
    return
  }

  uploading.value = true
  try {
    const url = await uploadImageToOssWithToast(file)
    if (!url) return
    coverUrl.value = url
  } finally {
    uploading.value = false
  }
}

function handleCancel() {
  if (busy.value) return
  emit('update:open', false)
}

async function handleConfirm(e: Event) {
  e?.preventDefault?.()
  if (busy.value) return

  const pid = Number(props.projectId)
  if (!Number.isFinite(pid) || pid <= 0) {
    message.error('缺少项目信息')
    return
  }

  const nextCover = coverUrl.value.trim()
  const nextDesc = projectDesc.value.trim()
  if (!nextCover) {
    message.warning('请上传作品封面')
    return
  }
  if (!nextDesc) {
    message.warning('请填写作品描述')
    return
  }
  if (nextDesc.length > DESC_MAX) {
    message.warning(`作品描述最多 ${DESC_MAX} 字`)
    return
  }

  submitting.value = true
  try {
    await userProjectUpdate({
      id: pid,
      coverUrl: nextCover,
      projectDesc: nextDesc
    })
    invalidateUserProjectDetailCache(pid)
    emit('update:open', false)
    emit('success', { projectId: pid, coverUrl: nextCover, projectDesc: nextDesc })
  } catch (err: unknown) {
    if (isProjectPublicLockError(err)) {
      message.error(projectPublicLockUserHint())
      return
    }
    const e2 = err as { msg?: string; message?: string }
    message.error(e2?.msg || e2?.message || '更新项目失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.publish-case-plaza__loading {
  padding: 2rem 0;
  text-align: center;
  color: var(--home-muted, #8b95a8);
}

.publish-case-plaza__tip {
  margin: 0 0 1.25rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--home-muted, #8b95a8);
}

.publish-case-plaza__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.publish-case-plaza__field + .publish-case-plaza__field {
  margin-top: 1.25rem;
}

.publish-case-plaza__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--home-text, #e8ecf4);
}

.publish-case-plaza__required {
  margin-left: 0.15rem;
  color: #ff6b6b;
}

.publish-case-plaza__cover {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.publish-case-plaza__cover-btn,
.publish-case-plaza__cover-preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 160px;
  height: 90px;
  padding: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--create-surface-1, rgba(255, 255, 255, 0.04));
}

.publish-case-plaza__cover-btn {
  border: 1px dashed var(--create-border-dashed, rgba(255, 255, 255, 0.28));
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.publish-case-plaza__cover-preview {
  border: 1px solid var(--create-border-dashed, rgba(255, 255, 255, 0.28));
  cursor: zoom-in;
}

.publish-case-plaza__cover-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.62);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.publish-case-plaza__cover-preview:hover .publish-case-plaza__cover-delete,
.publish-case-plaza__cover-delete:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

.publish-case-plaza__cover-delete:hover:not(:disabled) {
  background: rgba(255, 77, 79, 0.9);
}

.publish-case-plaza__cover-delete:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.publish-case-plaza__cover-btn:hover:not(:disabled) {
  border-color: var(--accent-400, #4fd1c5);
  background: rgba(79, 209, 197, 0.08);
}

.publish-case-plaza__cover-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.publish-case-plaza__cover-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: var(--home-muted, #8b95a8);
}

.publish-case-plaza__file {
  display: none;
}
</style>
