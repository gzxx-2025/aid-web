1. 核心实现思路
坐标捕获：用户点击图片时，通过 @click 获取鼠标相对于图片容器的 (x, y) 坐标。
视觉反馈：立即在 (x, y) 处渲染一个标记点（蓝色圆圈）和一个 Tooltip 提示。
局部裁剪/发送：
为了实现图2中的效果（缩略图+名称），我们需要让后端知道用户选了哪里。
方案：利用前端 Canvas 将点击周围的一小块区域（例如 100x100 像素）裁剪出来，转成 Base64。
AI 识别：将原图和裁剪的小图发给后端（使用图像识别 API，如阿里云视觉、GPT-4o 或 SAM 模型），后端返回物体名称（如“空调”）。
状态更新：
收到返回结果后，更新下方的 tags 数组。
Tag 包含：名称、缩略图（刚才裁剪的那块）、放大图链接。
加载完成后，显示名称，隐藏 Loading 动画。
2. 代码实现
你可以新建一个组件 ImageEditor.vue
<template>
  <div class="editor-container">
    <!-- 1. 图片展示与点击区域 -->
    <div 
      class="canvas-wrapper" 
      @click="handleImageClick"
    >
      <img 
        ref="mainImage" 
        src="/demo-image.jpg" 
        alt="Editable Image" 
        class="main-image"
      />

      <!-- 标记点 (图1效果) -->
      <div 
        v-if="markPos"
        class="mark-point"
        :style="{ left: markPos.x + 'px', top: markPos.y + 'px' }"
      >
        <span class="num">1</span>
      </div>

      <!-- 提示框 (图1效果) -->
      <div 
        v-if="showTooltip"
        class="tooltip"
        :style="{ left: markPos.x + 'px', top: markPos.y + 'px' }"
      >
        点击区域进行编辑
      </div>
    </div>

    <!-- 2. 底部操作栏 -->
    <div class="toolbar">
      <!-- 标签列表区 -->
      <div class="tags-area">
        <div 
          v-for="tag in tags" 
          :key="tag.id" 
          class="tag-pill"
          @mouseenter="hoverTag = tag"
          @mouseleave="hoverTag = null"
        >
          <!-- 缩略图 -->
          <div class="tag-thumb-wrap">
            <img :src="tag.thumb" class="tag-thumb" />
          </div>
          
          <!-- 文本名称 (Loading 完成后显示) -->
          <span v-if="!tag.loading" class="tag-name">{{ tag.name }}</span>
          
          <!-- Loading 状态 -->
          <div v-else class="tag-loading">
            <div class="spinner"></div>
          </div>

          <!-- 悬浮放大预览 (图2效果) -->
          <Teleport to="body">
            <div 
              v-if="hoverTag?.id === tag.id && tag.fullImage"
              class="hover-preview"
              :style="previewStyle"
            >
              <img :src="tag.fullImage" />
            </div>
          </Teleport>
        </div>
      </div>

      <!-- 输入框 -->
      <input 
        type="text" 
        class="prompt-input"
        placeholder="描述你想修改的画面内容。如：将画面中男子的头发改成白色"
      />
    </div>
  </div>
</template>
<style scoped>
.editor-container {
  max-width: 1000px;
  margin: 0 auto;
}

/* 图片容器 */
.canvas-wrapper {
  position: relative;
  cursor: crosshair; /* 十字光标 */
  display: inline-block;
}

.main-image {
  display: block;
  width: 100%;
  border-radius: 12px;
}

/* 标记点 */
.mark-point {
  position: absolute;
  width: 24px;
  height: 24px;
  background: #007aff;
  border: 2px solid #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%); /* 中心对齐 */
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  z-index: 10;
}

.mark-point .num {
  color: white;
  font-size: 12px;
  font-weight: bold;
}

/* 提示框 */
.tooltip {
  position: absolute;
  left: 40px;
  top: -40px;
  background: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  z-index: 11;
}

/* 底部栏 */
.toolbar {
  display: flex;
  align-items: center;
  background: #1e1e1e; /* 深色背景 */
  padding: 8px;
  border-radius: 12px;
  margin-top: 20px;
  gap: 10px;
}

.tags-area {
  display: flex;
  gap: 8px;
  padding-left: 10px;
  overflow-x: auto;
}

/* 标签胶囊 */
.tag-pill {
  display: flex;
  align-items: center;
  background: #2c2c2c;
  border-radius: 20px;
  padding: 4px;
  height: 32px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-thumb-wrap {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.tag-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tag-name {
  color: #fff;
  font-size: 12px;
  margin: 0 8px 0 4px;
  white-space: nowrap;
}

/* 悬浮放大框 */
.hover-preview {
  position: fixed; /* 使用 fixed 配合 JS 计算位置 */
  bottom: 80px; /* 默认在标签上方 */
  width: 160px;
  height: 160px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  z-index: 9999;
  pointer-events: none;
  border: 1px solid #444;
}
.hover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.prompt-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #ccc;
  outline: none;
  padding: 8px;
  font-size: 14px;
}
</style>
<script setup>
import { ref, computed } from 'vue'

const mainImage = ref(null)
const markPos = ref(null)
const showTooltip = ref(false)
const tags = ref([])
const hoverTag = ref(null)

// 计算预览图位置
const previewStyle = computed(() => {
  if (!hoverTag.value) return {}
  // 在实际项目中可以通过获取 DOM 元素位置来精确计算
  // 这里简单返回一个静态样式演示
  return {} 
})

const handleImageClick = async (e) => {
  const rect = mainImage.value.getBoundingClientRect()
  
  // 1. 计算相对坐标
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  markPos.value = { x, y }
  showTooltip.value = true

  // 2. 前端裁剪 100x100 的小图用于展示和识别
  // 注意：需要处理边界溢出，这里简化处理
  const cropSize = 100
  const canvas = document.createElement('canvas')
  canvas.width = cropSize
  canvas.height = cropSize
  const ctx = canvas.getContext('2d')
  
  // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
  ctx.drawImage(mainImage.value, x - 50, y - 50, 100, 100, 0, 0, 100, 100)
  
  const base64Thumb = canvas.toDataURL('image/jpeg')

  // 3. 添加 Loading 状态的 Tag
  const tempId = Date.now()
  const newTag = {
    id: tempId,
    name: '',
    thumb: base64Thumb,
    fullImage: base64Thumb, // 实际项目中这里应该是高清裁剪图 URL
    loading: true
  }
  
  // 放入数组的最前面
  tags.value.unshift(newTag)

  try {
    // 4. 模拟后端 AI 识别请求
    // 这里替换为你真实的 API 调用
    // API 应该接收坐标 (x, y) 或 裁剪后的 base64
    const aiResult = await mockIdentifyObject(x, y, base64Thumb)
    
    // 5. 更新 Tag 数据
    const index = tags.value.findIndex(t => t.id === tempId)
    if (index !== -1) {
      tags.value[index].name = aiResult.name
      tags.value[index].loading = false
      tags.value[index].fullImage = aiResult.highResCropUrl || base64Thumb
    }
    
    showTooltip.value = false // 识别成功后隐藏 Tooltip

  } catch (err) {
    console.error("识别失败", err)
    // 移除失败的 tag 或标记为失败
    tags.value = tags.value.filter(t => t.id !== tempId)
  }
}

// 模拟 API
const mockIdentifyObject = (x, y, base64) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        name: '空调', // 识别结果
        highResCropUrl: base64 // 如果有更高清的裁剪图链接
      })
    }, 1000) // 模拟 1s 网络延迟
  })
}
</script>
要实现这个效果，你需要一个后端接口，通常有两种做法：
使用 SAM (Segment Anything Model): 这是目前最精准的方法。将原图和点 (x,y) 发给 SAM，它能输出该物体的精确蒙版（Mask）。然后你可以根据 Mask 裁剪图片。
使用多模态大模型 (如 GPT-4o):
将原图 Base64 发送给 GPT-4o。
Prompt: "用户点击了图片坐标 x,y 处。请识别该处是什么物体，并给出一个简短名称。"
注意: 这种方案虽然能给出名称（“空调”），但 GPT-4o 无法帮你把“空调”单独抠出来作为缩略图。
推荐方案: 结合两者。前端 Canvas 裁剪小图 -> 发给视觉识别 API 获取名称 -> 前端直接使用 Canvas 裁剪的小图作为缩略图。
4. 交互细节完善
Teleport: 代码中使用了 <Teleport to="body">，这是为了防止放大预览图被父容器的 overflow: hidden 遮挡，保证预览图能显示在整个屏幕最上层。
Loading 状态: 图2中的 Tag 后面有一个 Loading 动画，代码中通过 tag.loading 字段控制，Loading 时隐藏文字，显示 Spinner。