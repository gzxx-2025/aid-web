<template>
  <a-modal
    v-model:open="modalOpen"
    title="多机位"
    :width="1000"
    :footer="null"
    wrap-class-name="create-flow-modal"
    class="multi-angle-modal"
  >
    <div class="multi-angle-layout">
      <section class="viewport-panel">
        <div class="three-canvas-stage">
          <div ref="canvasRootRef" class="three-canvas-root" />
          <div v-if="showFlatOverlay" class="image-overlay">
            <img v-if="activeImageUrl" :src="activeImageUrl" alt="" class="center-image-overlay" />
          </div>
        </div>
        <p v-if="fixedNineGrid" class="nine-grid-fixed-hint">
          <span class="nine-grid-fixed-hint__icon" aria-hidden="true">✓</span>
          固定九宫格机位
        </p>
      </section>

      <aside class="control-panel" :class="{ 'control-panel--disabled': fixedNineGrid }">
        <h4 class="panel-title">调整摄像机机位</h4>
        <div class="slider-block">
          <div class="label-row">
            <span class="label">水平旋转</span>
            <a-input-number
              v-model:value="horizontalRotation"
              :min="0"
              :max="315"
              :controls="false"
              :disabled="fixedNineGrid"
              size="small"
              class="value-input"
            />
          </div>
          <a-slider
            v-model:value="horizontalRotation"
            :min="0"
            :max="315"
            :disabled="fixedNineGrid"
          />
        </div>

        <div class="slider-block">
          <div class="label-row">
            <span class="label">垂直角度</span>
            <a-input-number
              v-model:value="verticalAngle"
              :min="-30"
              :max="60"
              :controls="false"
              :disabled="fixedNineGrid"
              size="small"
              class="value-input"
            />
          </div>
          <a-slider v-model:value="verticalAngle" :min="-30" :max="60" :disabled="fixedNineGrid" />
        </div>

        <div class="slider-block">
          <div class="label">焦距</div>
          <a-slider
            v-model:value="focalLength"
            :min="0"
            :max="10"
            class="focal-slider"
            :disabled="fixedNineGrid"
          />
          <div class="focal-presets">
            <button
              type="button"
              class="focal-preset"
              :disabled="fixedNineGrid"
              @click="focalLength = 0"
            >
              0(远景)
            </button>
            <button
              type="button"
              class="focal-preset"
              :disabled="fixedNineGrid"
              @click="focalLength = 5"
            >
              5(中景)
            </button>
            <button
              type="button"
              class="focal-preset"
              :disabled="fixedNineGrid"
              @click="focalLength = 10"
            >
              10(特写)
            </button>
          </div>
        </div>
      </aside>
    </div>

    <div class="footer-actions">
      <div class="footer-left">
        <a-button v-if="!fixedNineGrid" class="import-btn-dashed" @click="handleUploadImage">
          <template #icon><UploadOutlined /></template>
          <EllipsisTooltip title="选择本地文件" />
        </a-button>
        <ModelSelectDropdown
          v-if="showModelSelect"
          class="footer-model-select"
          :value="modelValue"
          :options="modelOptions"
          :expanded="modelExpanded"
          @toggle="$emit('update:modelExpanded', !modelExpanded)"
          @close="$emit('update:modelExpanded', false)"
          @select="$emit('select-model', $event)"
        />
      </div>
      <div class="right-actions">
        <a-button class="cancel-btn" @click="modalOpen = false">取消</a-button>
        <a-button type="primary" class="gen-btn" @click="handleGenerateAngles"> 开始生图 </a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { UploadOutlined } from '@ant-design/icons-vue'
import EllipsisTooltip from '~/components/common/EllipsisTooltip.vue'
import ModelSelectDropdown, { type ModelOption } from './ModelSelectDropdown.vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  buildMultiAnglePromptParts,
  type MultiAngleGeneratePayload
} from '~/utils/multiAngleCameraPrompt'
import {
  DEFAULT_NINE_GRID_ANGLE_PROMPTS,
  NINE_GRID_SPHERE_CAMERA_POSITIONS
} from '~/utils/nineGridCameraAngles'

interface Props {
  open: boolean
  imageUrl?: string
  /** 编辑分镜图：固定九宫格机位，禁用旋转与右侧调节 */
  fixedNineGrid?: boolean
  modelValue?: ModelOption
  modelOptions?: ModelOption[]
  modelExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  imageUrl: '',
  fixedNineGrid: false,
  modelValue: () => ({
    id: '',
    name: '请选择模型',
    iconBg: '#10B981',
    prices: []
  }),
  modelOptions: () => [],
  modelExpanded: false
})

const showModelSelect = computed(() => props.modelOptions.length > 0)

const fixedNineGrid = computed(() => props.fixedNineGrid)

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:modelExpanded': [value: boolean]
  'select-model': [model: ModelOption]
  generate: [payload: MultiAngleGeneratePayload]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const horizontalRotation = ref(0)
const verticalAngle = ref(0)
const focalLength = ref(0)
const activeImageUrl = ref(props.imageUrl || '')
const canvasRootRef = ref<HTMLElement | null>(null)
const hasInteracted = ref(false)
const textureReady = ref(false)
const showFlatOverlay = computed(
  () =>
    !!activeImageUrl.value &&
    // 仅在 Three 贴图未就绪时显示兜底图层
    !textureReady.value
)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let viewCamera: THREE.PerspectiveCamera | null = null
let orbitControls: OrbitControls | null = null
let frameId = 0
let rigGroup: THREE.Group | null = null
let sphereGroup: THREE.Group | null = null
let sphereLatLinesGroup: THREE.Group | null = null
let sphereLonLinesGroup: THREE.Group | null = null
let markerGroup: THREE.Group | null = null
let nineGridMarkersGroup: THREE.Group | null = null
let nineGridLinesGroup: THREE.Group | null = null
let beamMesh: THREE.Mesh | null = null
let texturedSphereMesh: THREE.Mesh | null = null
let texturedSphereMaterial: THREE.ShaderMaterial | null = null
let currentSphereTexture: THREE.Texture | null = null
let resizeObserver: ResizeObserver | null = null
let objectUrlToRevoke = ''

const applyTexture = (url: string) => {
  if (!scene || !texturedSphereMaterial) return
  const uniforms = texturedSphereMaterial.uniforms as Record<string, { value: any }>
  if (currentSphereTexture) {
    currentSphereTexture.dispose()
    currentSphereTexture = null
  }
  if (!url) {
    uniforms.uMap.value = null
    uniforms.uHasMap.value = 0
    textureReady.value = false
    return
  }
  textureReady.value = false
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')
  loader.load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.wrapS = THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
      currentSphereTexture = tex
      uniforms.uMap.value = tex
      uniforms.uHasMap.value = 1
      textureReady.value = true
    },
    undefined,
    () => {
      uniforms.uMap.value = null
      uniforms.uHasMap.value = 0
      textureReady.value = false
    }
  )
}

const createCameraMarkerMesh = () => {
  const bodyGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42)
  const bodyMat = new THREE.MeshPhongMaterial({
    color: '#16b955',
    depthTest: false,
    depthWrite: false
  })
  const lensBarrelGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.14, 28)
  lensBarrelGeo.rotateX(Math.PI / 2)
  const lensBarrelMat = new THREE.MeshPhongMaterial({
    color: '#5adf8b',
    depthTest: false,
    depthWrite: false
  })
  const lensRingGeo = new THREE.TorusGeometry(0.1, 0.018, 18, 40)
  const lensRingMat = new THREE.MeshPhongMaterial({
    color: '#7cf5a5',
    emissive: '#2bcf66',
    emissiveIntensity: 0.45,
    depthTest: false,
    depthWrite: false
  })
  const lensCenterGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.02, 20)
  lensCenterGeo.rotateX(Math.PI / 2)
  const lensCenterMat = new THREE.MeshPhongMaterial({
    color: '#0f7f3e',
    depthTest: false,
    depthWrite: false
  })
  const redDotGeo = new THREE.SphereGeometry(0.02, 16, 12)
  const redDotMat = new THREE.MeshBasicMaterial({ color: '#ff3b58' })
  const markerBody = new THREE.Mesh(bodyGeo, bodyMat)
  const markerLensBarrel = new THREE.Mesh(lensBarrelGeo, lensBarrelMat)
  const markerLensRing = new THREE.Mesh(lensRingGeo, lensRingMat)
  const markerLensCenter = new THREE.Mesh(lensCenterGeo, lensCenterMat)
  const markerRedDot = new THREE.Mesh(redDotGeo, redDotMat)
  markerLensBarrel.position.set(0, 0, -0.28)
  markerLensRing.position.set(0, 0, -0.36)
  markerLensCenter.position.set(0, 0, -0.37)
  markerRedDot.position.set(-0.13, 0.03, -0.12)
  ;[markerBody, markerLensBarrel, markerLensRing, markerLensCenter, markerRedDot].forEach((m) => {
    m.renderOrder = 20
  })
  const group = new THREE.Group()
  group.add(markerBody, markerLensBarrel, markerLensRing, markerLensCenter, markerRedDot)
  return group
}

const updateCameraRig = () => {
  if (!rigGroup || !viewCamera || !texturedSphereMesh || !sphereGroup) return

  if (fixedNineGrid.value) {
    texturedSphereMesh.scale.set(1, 1, 1)
    sphereGroup.scale.set(1, 1, 1)
    rigGroup.rotation.set(0, 0, 0)
    if (markerGroup) markerGroup.visible = false
    if (nineGridMarkersGroup) nineGridMarkersGroup.visible = true
    if (nineGridLinesGroup) nineGridLinesGroup.visible = true
    if (sphereLatLinesGroup) sphereLatLinesGroup.visible = true
    if (sphereLonLinesGroup) sphereLonLinesGroup.visible = true
    viewCamera.fov = 48
    viewCamera.updateProjectionMatrix()
    return
  }

  if (!markerGroup) return
  const radius = 2.95
  const theta = THREE.MathUtils.degToRad(horizontalRotation.value)
  const phi = THREE.MathUtils.degToRad(verticalAngle.value)
  const isFlatPreview =
    !hasInteracted.value &&
    Math.abs(horizontalRotation.value) < 0.1 &&
    Math.abs(verticalAngle.value) < 0.1
  markerGroup.position.set(0, 0, radius)
  markerGroup.lookAt(0, 0, 0)
  markerGroup.rotateY(Math.PI)

  if (isFlatPreview) {
    texturedSphereMesh.scale.set(1, 1, 0.02)
    sphereGroup.scale.set(1, 1, 0.02)
    markerGroup.visible = false
    rigGroup.rotation.set(0, 0, 0)
  } else {
    texturedSphereMesh.scale.set(1, 1, 1)
    sphereGroup.scale.set(1, 1, 1)
    markerGroup.visible = true
    rigGroup.rotation.set(-phi * 0.65, theta, 0)
  }

  if (sphereLatLinesGroup) sphereLatLinesGroup.visible = true
  if (sphereLonLinesGroup) sphereLonLinesGroup.visible = true

  viewCamera.fov = THREE.MathUtils.mapLinear(focalLength.value, 0, 10, 50, 28)
  viewCamera.updateProjectionMatrix()
  if (beamMesh) {
    beamMesh.visible = Math.abs(verticalAngle.value) > 0.1 || hasInteracted.value
  }
}

const buildNineGridMarkers = () => {
  const markers = new THREE.Group()
  const lines = new THREE.Group()
  const lineMat = new THREE.LineBasicMaterial({
    color: '#6a7088',
    transparent: true,
    opacity: 0.45
  })
  const radius = 2.95
  for (const pos of NINE_GRID_SPHERE_CAMERA_POSITIONS) {
    const yaw = THREE.MathUtils.degToRad(pos.yaw)
    const pitch = THREE.MathUtils.degToRad(pos.pitch)
    const x = radius * Math.cos(pitch) * Math.sin(yaw)
    const y = radius * Math.sin(pitch)
    const z = radius * Math.cos(pitch) * Math.cos(yaw)
    const marker = createCameraMarkerMesh()
    marker.position.set(x, y, z)
    marker.lookAt(0, 0, 0)
    marker.rotateY(Math.PI)
    markers.add(marker)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(0, 0, 0)
    ])
    lines.add(new THREE.Line(lineGeo, lineMat))
  }
  return { markers, lines }
}

const resizeRenderer = () => {
  if (!renderer || !viewCamera || !canvasRootRef.value) return
  const { clientWidth, clientHeight } = canvasRootRef.value
  if (!clientWidth || !clientHeight) return
  renderer.setSize(clientWidth, clientHeight, false)
  viewCamera.aspect = clientWidth / clientHeight
  viewCamera.updateProjectionMatrix()
}

const animate = () => {
  if (!renderer || !scene || !viewCamera) return
  frameId = requestAnimationFrame(animate)
  orbitControls?.update()
  renderer.render(scene, viewCamera)
}

const initThreeScene = async () => {
  await nextTick()
  if (!canvasRootRef.value || renderer) return

  const root = canvasRootRef.value
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#121212')

  viewCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)
  viewCamera.position.set(0, 0, 6.8)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  root.appendChild(renderer.domElement)

  orbitControls = new OrbitControls(viewCamera, renderer.domElement)
  orbitControls.enablePan = false
  orbitControls.enableDamping = true
  orbitControls.enabled = true
  orbitControls.enableRotate = !fixedNineGrid.value
  orbitControls.enableZoom = !fixedNineGrid.value
  orbitControls.minDistance = 3.8
  orbitControls.maxDistance = 9
  if (!fixedNineGrid.value) {
    renderer.domElement.addEventListener('pointerdown', () => {
      hasInteracted.value = true
      updateCameraRig()
    })
  }

  const ambient = new THREE.AmbientLight('#9bb8ff', 0.5)
  scene.add(ambient)
  const dirLight = new THREE.DirectionalLight('#ffffff', 0.8)
  dirLight.position.set(5, 5, 6)
  scene.add(dirLight)

  const buildLatLonSphere = () => {
    const radius = 2.45
    const latCount = 10
    const lonCount = 14
    const segments = 100
    const material = new THREE.LineBasicMaterial({
      color: '#4c5366',
      transparent: true,
      opacity: 0.24
    })
    const group = new THREE.Group()
    const latGroup = new THREE.Group()
    const lonGroup = new THREE.Group()

    // horizontal circles (latitude)
    for (let i = 1; i <= latCount; i++) {
      const phi = (i / (latCount + 1)) * Math.PI - Math.PI / 2
      const ringRadius = Math.cos(phi) * radius
      const y = Math.sin(phi) * radius
      const points: THREE.Vector3[] = []
      for (let s = 0; s <= segments; s++) {
        const t = (s / segments) * Math.PI * 2
        points.push(new THREE.Vector3(Math.cos(t) * ringRadius, y, Math.sin(t) * ringRadius))
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      latGroup.add(new THREE.Line(geo, material))
    }

    // vertical circles (longitude)
    for (let i = 0; i < lonCount; i++) {
      const theta = (i / lonCount) * Math.PI * 2
      const points: THREE.Vector3[] = []
      for (let s = 0; s <= segments; s++) {
        const v = (s / segments) * Math.PI - Math.PI / 2
        const r = Math.cos(v) * radius
        const y = Math.sin(v) * radius
        points.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r))
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      lonGroup.add(new THREE.Line(geo, material))
    }
    sphereLatLinesGroup = latGroup
    sphereLonLinesGroup = lonGroup
    group.add(latGroup)
    group.add(lonGroup)
    return group
  }
  sphereGroup = buildLatLonSphere()

  const sphereGeo = new THREE.SphereGeometry(2.42, 80, 80)
  texturedSphereMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: null },
      uHasMap: { value: 0 },
      uRectMin: { value: new THREE.Vector2(0.35, 0.37) },
      uRectMax: { value: new THREE.Vector2(0.65, 0.63) },
      uOuterColor: { value: new THREE.Color('#3a4155') },
      uOuterAlpha: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uHasMap;
      uniform vec2 uRectMin;
      uniform vec2 uRectMax;
      uniform vec3 uOuterColor;
      uniform float uOuterAlpha;
      varying vec2 vUv;
      void main() {
        float inRectX = step(uRectMin.x, vUv.x) * step(vUv.x, uRectMax.x);
        float inRectY = step(uRectMin.y, vUv.y) * step(vUv.y, uRectMax.y);
        float mask = inRectX * inRectY * uHasMap;
        vec3 texColor = texture2D(uMap, vUv).rgb;
        vec3 finalColor = mix(uOuterColor, texColor, mask);
        float finalAlpha = mix(uOuterAlpha, 1.0, mask);
        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `
  })
  texturedSphereMesh = new THREE.Mesh(sphereGeo, texturedSphereMaterial)
  texturedSphereMesh.renderOrder = 5

  markerGroup = createCameraMarkerMesh()
  const beamLength = 1.35
  const beamGeo = new THREE.CylinderGeometry(0.02, 0.22, beamLength, 28, 1, true)
  beamGeo.translate(0, -beamLength / 2, 0)
  beamGeo.rotateX(-Math.PI / 2)
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#f2f6ff',
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  })
  beamMesh = new THREE.Mesh(beamGeo, beamMat)
  beamMesh.position.set(0, 0, -0.37)
  beamMesh.rotation.y = Math.PI
  beamMesh.renderOrder = 15
  beamMesh.visible = false
  markerGroup.add(beamMesh)

  if (fixedNineGrid.value) {
    const built = buildNineGridMarkers()
    nineGridMarkersGroup = built.markers
    nineGridLinesGroup = built.lines
  }

  rigGroup = new THREE.Group()
  rigGroup.add(texturedSphereMesh)
  rigGroup.add(sphereGroup)
  if (fixedNineGrid.value && nineGridMarkersGroup && nineGridLinesGroup) {
    rigGroup.add(nineGridLinesGroup)
    rigGroup.add(nineGridMarkersGroup)
    markerGroup.visible = false
  } else {
    rigGroup.add(markerGroup)
  }
  scene.add(rigGroup)
  updateCameraRig()

  resizeRenderer()
  resizeObserver = new ResizeObserver(resizeRenderer)
  resizeObserver.observe(root)
  applyTexture(activeImageUrl.value)
  animate()
}

const destroyThreeScene = () => {
  if (frameId) cancelAnimationFrame(frameId)
  frameId = 0
  resizeObserver?.disconnect()
  resizeObserver = null
  orbitControls?.dispose()
  orbitControls = null
  renderer?.dispose()
  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
  scene = null
  renderer = null
  viewCamera = null
  sphereGroup = null
  sphereLatLinesGroup = null
  sphereLonLinesGroup = null
  rigGroup = null
  markerGroup = null
  nineGridMarkersGroup = null
  nineGridLinesGroup = null
  beamMesh = null
  if (currentSphereTexture) {
    currentSphereTexture.dispose()
    currentSphereTexture = null
  }
  texturedSphereMaterial?.dispose()
  texturedSphereMaterial = null
  texturedSphereMesh = null
}

const handleUploadImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke)
    objectUrlToRevoke = URL.createObjectURL(file)
    activeImageUrl.value = objectUrlToRevoke
  }
  input.click()
}

const handleGenerateAngles = () => {
  const source = activeImageUrl.value || props.imageUrl || ''
  if (!source) {
    message.warning('请先选择或加载一张参考图后再开始生图')
    return
  }

  if (fixedNineGrid.value) {
    const nineGridAngles = [...DEFAULT_NINE_GRID_ANGLE_PROMPTS]
    emit('generate', {
      mode: 'nineGridFixed',
      horizontalRotation: 0,
      verticalAngle: 0,
      focalLength: 0,
      imageUrl: source,
      angles: nineGridAngles.map((angle, idx) => ({
        angle: `格${idx + 1}`,
        url: source
      })),
      multiAnglePromptConcat: nineGridAngles.join(' | '),
      multiAnglePromptParts: {
        yawTags: '',
        pitchTags: '',
        focalTags: '',
        concat: nineGridAngles.join(' | ')
      },
      nineGridAngles
    })
    modalOpen.value = false
    return
  }

  const base = horizontalRotation.value
  const angleLabels = ['主视角', '左视角', '右视角', '俯视角']
  const angles = angleLabels.map((angle, idx) => ({
    angle: `${angle}(${(base + idx * 45) % 360}°)`,
    url: source
  }))
  const multiAnglePromptParts = buildMultiAnglePromptParts(
    horizontalRotation.value,
    verticalAngle.value,
    focalLength.value
  )
  emit('generate', {
    mode: 'single',
    horizontalRotation: horizontalRotation.value,
    verticalAngle: verticalAngle.value,
    focalLength: focalLength.value,
    imageUrl: source,
    angles,
    multiAnglePromptConcat: multiAnglePromptParts.concat,
    multiAnglePromptParts
  })
  modalOpen.value = false
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      hasInteracted.value = false
      horizontalRotation.value = 0
      verticalAngle.value = 0
      focalLength.value = 0
      activeImageUrl.value = props.imageUrl || activeImageUrl.value
      textureReady.value = false
      await initThreeScene()
      if (activeImageUrl.value) applyTexture(activeImageUrl.value)
      if (orbitControls) {
        orbitControls.enableRotate = !fixedNineGrid.value
        orbitControls.enableZoom = !fixedNineGrid.value
      }
      return
    }
    destroyThreeScene()
  }
)

watch(fixedNineGrid, async (isGrid) => {
  if (!props.open) return
  destroyThreeScene()
  hasInteracted.value = false
  await initThreeScene()
  if (activeImageUrl.value) applyTexture(activeImageUrl.value)
  if (orbitControls) {
    orbitControls.enableRotate = !isGrid
    orbitControls.enableZoom = !isGrid
  }
})

watch(
  () => props.imageUrl,
  (nextUrl) => {
    if (!nextUrl) return
    activeImageUrl.value = nextUrl
  }
)
watch(activeImageUrl, (url) => applyTexture(url))
watch([horizontalRotation, verticalAngle, focalLength], () => {
  if (fixedNineGrid.value) return
  hasInteracted.value = true
  if (orbitControls) orbitControls.enabled = true
  updateCameraRig()
})

onBeforeUnmount(() => {
  destroyThreeScene()
  if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke)
})
</script>

<style lang="scss" scoped>
:deep(.selected-model) {
  background: #0a0d12 ;
}
.multi-angle-modal :deep(.ant-modal-content) {
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(74, 231, 253, 0.45);
  background: #191a1d;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
}

.multi-angle-modal :deep(.ant-modal-header) {
  margin: 0;
  padding: 1.25rem 1.5rem 0.75rem;
  border-bottom: none !important;
  background: #191a1d;
}

.multi-angle-modal :deep(.ant-modal-title) {
  color: #fff;
  font-size: 20px;
  font-weight: 600;
}

.multi-angle-modal :deep(.ant-modal-close) {
  top: 1rem;
  inset-inline-end: 1rem;
  color: rgba(255, 255, 255, 0.75);
}

.multi-angle-modal :deep(.ant-modal-close:hover) {
  color: #4ae7fd;
}

.multi-angle-modal :deep(.ant-modal-body) {
  padding: 0 1.5rem 1.25rem;
  background: #191a1d;
}

.multi-angle-layout {
  display: flex;
  min-height: 520px;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 14px;
  gap: 24px;
  padding-top: 2px;
}

.control-panel {
  width: 320px;
  padding: 10px 18px 18px;
  border: 1px solid rgba(142, 151, 165, 0.2);
  border-radius: 8px;
}

.control-panel--disabled {
  opacity: 0.45;
  pointer-events: none;
  user-select: none;
}

.nine-grid-fixed-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 10px 0 0;
  color: #5adf8b;
  font-size: 14px;
  line-height: 1.4;
}

.nine-grid-fixed-hint__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #16b955;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.panel-title {
  margin: 0 0 14px;
  color: #f4f7ff;
  font-size: 14px;
  line-height: 1.45;
}

.slider-block {
  margin-bottom: 22px;
}

.label {
  color: #8e97a5 !important;
  font-size: 12px;
  font-weight: 500;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.value-input {
  width: 56px;
}

.control-panel :deep(.value-input .ant-input-number-input) {
  height: 22px;
  padding: 0 8px;
  text-align: center;
}

.control-panel :deep(.value-input.ant-input-number) {
  border-radius: 4px;
  border: 1px solid rgba(142, 151, 165, 0.35);
  background: rgba(12, 16, 24, 0.9);
}

.control-panel :deep(.value-input.ant-input-number .ant-input-number-input-wrap) {
  color: #e6edf3;
}

.focal-presets {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 14px;
}

.focal-preset {
  min-width: 82px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid rgba(142, 151, 165, 0.35);
  background: rgba(12, 16, 24, 0.9);
  color: #8e97a5;
  font-size: 12px;
  cursor: pointer;
}

.focal-preset:hover {
  color: #dce6f2;
  border-color: rgba(74, 231, 253, 0.45);
}

.viewport-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.three-canvas-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  background: rgba(18, 18, 18, 1);
}

.three-canvas-root {
  width: 100%;
  height: 100%;
}

.image-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.center-image-overlay {
  width: 140px;
  max-width: 28%;
  object-fit: cover;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(120, 130, 166, 0.08);
}

.footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 0 0 0.25rem;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.footer-model-select {
  flex: 1;
  max-width: 360px;
  min-width: 200px;
}

/* 与编辑弹窗 GenerateModelConfigBlock 内模型下拉保持一致 */
.footer-model-select :deep(.model-select-dropdown .selected-model) {
  height: 40px !important;
  min-height: 40px;
  padding: 0 10px !important;
  border-radius: 10px !important;
  background: #0a0d12 !important;
  border: 1px solid rgba(78, 94, 122, 0.42) !important;
  box-shadow: none !important;
}

.footer-model-select :deep(.model-select-dropdown .selected-model:hover) {
  border-color: rgba(120, 140, 170, 0.45) !important;
  background: #0a0d12 !important;
}

.footer-model-select :deep(.model-select-dropdown .selected-model.expanded) {
  background: #0a0d12 !important;
  border-color: rgba(78, 94, 122, 0.42) !important;
}

.footer-model-select :deep(.model-select-dropdown .selected-model.expanded.is-open-down) {
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.footer-model-select :deep(.model-select-dropdown .selected-model.expanded.is-open-up) {
  border-top-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
}

.footer-model-select :deep(.model-select-dropdown .model-name) {
  font-size: 13px;
  color: rgba(225, 239, 255, 0.92);
}

.footer-model-select :deep(.model-select-dropdown .expand-icon) {
  color: rgba(225, 239, 255, 0.72);
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.import-btn-dashed {
  min-width: 9.25rem;
  max-width: 100%;
  height: 1.75rem;
  border-radius: 0.5rem !important;
  border: 1px dashed rgba(74, 231, 253, 0.35) !important;
  background: #121212 !important;
  color: #ffffff !important;
  padding: 0 0.625rem !important;
  font-size: 0.875rem !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.import-btn-dashed :deep(.ant-btn-icon) {
  flex-shrink: 0;
  margin-inline-end: 0 !important;
}

.import-btn-dashed :deep(> span:not(.ant-btn-icon)) {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.import-btn-dashed :deep(.ellipsis-tooltip-text) {
  display: block;
  width: 100%;
  max-width: 100%;
}

.import-btn-dashed:hover {
  border-color: rgba(74, 231, 253, 0.55) !important;
  color: #4ae7fd !important;
}

.cancel-btn {
  min-width: 96px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 0.3) !important;
  background: rgba(12, 16, 24, 0.9) !important;
  color: #fff !important;
}

.gen-btn {
  min-width: 112px;
  height: 40px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
}

.gen-btn:hover {
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%);
}

/* 设计稿：滑块 thumb 使用 Polygon-nor / Polygon-sel 图标 */
.control-panel :deep(.ant-slider) {
  margin: 0;
}

.control-panel :deep(.ant-slider-rail) {
  height: 2px;
  background: rgba(142, 151, 165, 1);
}

.control-panel :deep(.ant-slider-track) {
  height: 2px;
  background: rgba(74, 231, 253, 0.95);
}

.control-panel :deep(.ant-slider-handle) {
  inset-block-start: calc(50%);
  width: 10px;
  height: 10px;
  border: none !important;
  box-shadow: none !important;
  border-radius: 0;
  background: url('/assets/img/icon/Polygon-nor.svg') no-repeat center / 100% 100% !important;
  transform: none !important;
}

.control-panel :deep(.ant-slider-handle::after) {
  display: none !important;
}

.control-panel :deep(.ant-slider:hover .ant-slider-handle),
.control-panel :deep(.ant-slider-handle:focus),
.control-panel :deep(.ant-slider-handle:active),
.control-panel :deep(.ant-slider-handle-dragging) {
  background: url('/assets/img/icon/Polygon-sel.svg') no-repeat center / 100% 100% !important;
}

/* 焦距滑块中线分割标记 */
.control-panel :deep(.focal-slider.ant-slider) {
  position: relative;
}

.control-panel :deep(.focal-slider.ant-slider::before) {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 10px;
  transform: translate(-50%, -50%);
  border-radius: 1px;
  background: rgba(142, 151, 165, 0.75);
  pointer-events: none;
}
</style>
