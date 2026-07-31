<template>
  <a-modal
    v-model:open="modalOpen"
    title="导入参考图"
    :width="600"
    wrap-class-name="create-flow-modal"
    @ok="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="import-reference-content">
      <a-upload
        v-model:file-list="fileList"
        :before-upload="beforeUpload"
        list-type="picture-card"
        :max-count="1"
        accept="image/*"
      >
        <div v-if="fileList.length < 1">
          <PlusOutlined />
          <div style="margin-top: 8px">上传</div>
        </div>
      </a-upload>
      <p class="upload-tip">支持 JPG、PNG 格式，最大 10MB</p>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

interface Props {
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'import': [file: File]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const fileList = ref<any[]>([])

const beforeUpload = (file: File) => {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    message.error('只能上传图片文件')
    return false
  }
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    message.error('图片大小不能超过 10MB')
    return false
  }
  fileList.value = [file]
  return false // 阻止自动上传
}

const handleConfirm = () => {
  if (fileList.value.length === 0) {
    message.warning('请选择要上传的图片')
    return
  }
  emit('import', fileList.value[0].originFileObj || fileList.value[0])
  modalOpen.value = false
  fileList.value = []
}

const handleCancel = () => {
  modalOpen.value = false
  fileList.value = []
}
</script>

<style scoped>
.import-reference-content {
  padding: 1rem 0;
}

.upload-tip {
  margin-top: 1rem;
  color: var(--gray-500);
  font-size: 0.875rem;
  text-align: center;
}
</style>
