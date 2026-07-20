import { computed } from 'vue'
import type { EnumDictGroup, OfficialPromptItem } from '~/types/business-api'
import { userDictEnumList, userPromptOfficialCategoryList, userPromptOfficialItemList } from '~/utils/businessApi'
import type { SettingSelectOption } from '~/components/steps/SettingSelectField.vue'

const NONE: SettingSelectOption = { key: 'none', value: '无', image: '' }

/** 与接口文档 `promptType` 一致；UI「摄影技法」对应 exposure_blur，「特殊拍摄手法」对应 shooting_technique */
export const PROMPT_TYPE = {
  style: 'style',
  composition: 'composition',
  shot_size: 'shot_size',
  camera_angle: 'camera_angle',
  focal_length: 'focal_length',
  color_tone: 'color_tone',
  lighting: 'lighting',
  exposure_blur: 'exposure_blur',
  camera_movement: 'camera_movement',
  shooting_technique: 'shooting_technique'
} as const

/**
 * 仅用于旧数据迁移：根据旧版英文 key 得到展示名，再与接口返回的 promptName 匹配。
 * 不在 UI 中作为选项列表展示。
 */
const LEGACY_LABEL_BY_PROMPT_TYPE: Record<string, Record<string, string>> = {
  [PROMPT_TYPE.composition]: {
    none: '无',
    rule_of_thirds: '三分法构图',
    centered: '居中构图',
    diagonal: '对角线构图',
    framing: '框架构图',
    leading_lines: '引导线构图',
    symmetrical: '对称构图',
    golden_ratio: '黄金分割构图',
    triangular: '三角形构图'
  },
  [PROMPT_TYPE.shot_size]: {
    none: '无',
    extreme_close_up: '大特写',
    close_up: '特写',
    medium_close_up: '近景',
    medium_shot: '中景',
    medium_full: '中全景',
    full_shot: '全景',
    long_shot: '远景',
    extreme_long_shot: '大远景'
  },
  [PROMPT_TYPE.camera_angle]: {
    none: '无',
    eye_level: '平视',
    high_angle: '俯拍',
    low_angle: '仰拍',
    bird_eye: '鸟瞰',
    worm_eye: '虫视',
    over_shoulder: '过肩',
    side_shot: '侧拍',
    dutch_angle: '荷兰角',
    third_person: '第三人称'
  },
  [PROMPT_TYPE.focal_length]: {
    none: '无',
    fish_eye: '鱼眼',
    wide: '广角',
    standard: '标准',
    portrait: '人像',
    telephoto: '长焦',
    super_telephoto: '超长焦',
    macro: '微距',
    zoom: '变焦'
  },
  [PROMPT_TYPE.color_tone]: {
    none: '无',
    warm: '暖色',
    cool: '冷色',
    neutral: '中性',
    high_saturation: '高饱和',
    low_saturation: '低饱和',
    monochrome: '单色',
    complementary: '互补色',
    analogous: '类似色'
  },
  [PROMPT_TYPE.lighting]: {
    none: '无',
    natural: '自然光',
    soft: '柔光',
    hard: '硬光',
    backlight: '逆光',
    side_light: '侧光',
    rim_light: '轮廓光',
    dramatic: '戏剧光',
    golden_hour: '黄金时刻'
  },
  [PROMPT_TYPE.exposure_blur]: {
    none: '无',
    long_exposure: '长曝光',
    multiple_exposure: '多重曝光',
    macro: '微距摄影',
    tilt_shift: '移轴摄影',
    high_speed: '高速快门定格',
    shallow_dof: '浅景深虚化',
    reflection: '反射/镜面拍摄',
    silhouette: '剪影拍摄'
  },
  [PROMPT_TYPE.camera_movement]: {
    none: '无',
    fixed: '固定机位',
    follow: '跟拍',
    orbit: '环绕',
    zoom_in: '变焦拉近',
    zoom_out: '变焦拉远',
    pan_left: '镜头左摇',
    pan_right: '镜头右摇',
    tilt_up: '镜头上仰',
    tilt_down: '镜头下俯',
    dolly_in: '镜头前移',
    dolly_out: '镜头后移'
  },
  [PROMPT_TYPE.shooting_technique]: {
    none: '无',
    hitchcock_zoom: '希区柯克变焦',
    time_lapse: '延时摄影',
    quick_push: '急推镜头',
    quick_pull: '急拉镜头',
    whip_pan: '快速甩镜',
    bullet_time: '子弹时间',
    fpv: 'FPV 穿梭',
    macro: '微距特写',
    first_person: '第一人称',
    slow_motion: '慢镜头',
    probe: '探针镜头',
    dutch_roll: '旋转倾斜镜头'
  }
}

function legacyLabelForKey(promptType: string, key: string): string | undefined {
  return LEGACY_LABEL_BY_PROMPT_TYPE[promptType]?.[key]
}

let loadInflight: Promise<void> | null = null

function mapRowsToOptions(rows: OfficialPromptItem[]): SettingSelectOption[] {
  return [...rows]
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
    .map((row) => ({
      key: String(row.id),
      value: (row.itemName ?? '').trim() || `项${row.id}`,
      image: (row.coverUrl ?? '').trim() || ''
    }))
}

/** 接口有数据时带「无」；无数据时返回空数组（由 UI 展示「暂无数据」） */
function optionsForType(all: OfficialPromptItem[], promptType: string): SettingSelectOption[] {
  const mapped = mapRowsToOptions(all.filter((p) => p.categoryCode === promptType))
  if (mapped.length > 0) return [NONE, ...mapped]
  return []
}

/** 与接口文档「枚举类型」白名单一致（POST /api/user/dict/enum/list，大小写敏感） */
export const DICT_ENUM = {
  AspectRatioEnum: 'AspectRatioEnum',
  ScriptTypeEnum: 'ScriptTypeEnum',
  StoryboardShotDensityEnum: 'StoryboardShotDensityEnum',
  CreationModeEnum: 'CreationModeEnum',
  ModelTypeEnum: 'ModelTypeEnum',
  GenModeEnum: 'GenModeEnum',
  AudioSourceEnum: 'AudioSourceEnum'
} as const

/** 接口未返回 StoryboardShotDensityEnum 时的兜底（与接口文档枚举值一致） */
export const FALLBACK_SHOT_DENSITY_ENUM_OPTIONS: { value: string; label: string }[] = [
  { value: '精简模式', label: '密度低/节奏紧凑' },
  { value: '标准模式', label: '默认' },
  { value: '细拆模式', label: '密度高/重点戏份' }
]

const ENUM_TYPE_CANDIDATES = [
  DICT_ENUM.ModelTypeEnum,
  DICT_ENUM.AspectRatioEnum,
  DICT_ENUM.ScriptTypeEnum,
  DICT_ENUM.StoryboardShotDensityEnum,
  DICT_ENUM.CreationModeEnum,
  DICT_ENUM.GenModeEnum,
  DICT_ENUM.AudioSourceEnum
] as const

/** 旧版英文 key → 接口 StoryboardShotDensityEnum.value */
const LEGACY_SHOT_DENSITY_TO_MODE: Record<string, string> = {
  concise: '精简模式',
  standard: '标准模式',
  detailed: '细拆模式'
}

/** 将 store/本地缓存中的镜头密度对齐到字典枚举 value（供 generate/script 的 mode 入参） */
export function resolveShotDensityValue(
  current: string | undefined,
  options: { value: string; label: string }[]
): string {
  const values = options.map((o) => o.value)
  const fallback = values.includes('标准模式') ? '标准模式' : (values[0] ?? '标准模式')
  if (!current) return fallback
  if (values.includes(current)) return current
  const migrated = LEGACY_SHOT_DENSITY_TO_MODE[current]
  if (migrated && values.includes(migrated)) return migrated
  return fallback
}

export function buildEnumOptionsList(
  list: EnumDictGroup[],
  enumType: string
): { value: string; label: string }[] {
  const group = list.find((e) => e.enumType === enumType)
  const items = group?.items ?? []
  return items.map((e) => ({ value: e.value, label: e.desc || e.value }))
}

/** 生视频弹窗用：仅保留常见比例 */
export function filterAspectRatiosForVideoModal(
  rows: { value: string; label: string }[]
): { value: string; label: string }[] {
  const allow = new Set(['16:9', '9:16', '4:3', '1:1'])
  return rows.filter((r) => allow.has(r.value))
}

/**
 * 字典项使用数字 id 为 key 后，将旧版英文 key 映射到当前 options 中的项（按展示名匹配）。
 */
export function resolvePromptSelection(
  current: { key: string; value: string } | null | undefined,
  options: SettingSelectOption[],
  promptType: string
): { key: string; value: string } | null {
  if (!current) return null
  if (!options.length) return current
  if (current.key === 'none') return current
  if (options.some((o) => o.key === current.key)) return current
  const label = legacyLabelForKey(promptType, current.key) ?? current.value
  const byLabel = options.find((o) => o.value === label)
  if (byLabel) return { key: byLabel.key, value: byLabel.value }
  const byValueOnly = options.find((o) => o.value === current.value)
  if (byValueOnly) return { key: byValueOnly.key, value: byValueOnly.value }
  return current
}

export type StyleLibraryCard = {
  id: string
  name: string
  thumbnail: string
  featured: boolean
  /** official/query 原始 assetName（与 name 通常一致） */
  assetName?: string
  /** official/query 的 promptText，提交作品时映射为 videoStyleValue */
  promptText?: string | null
}

export function buildStyleCardsFromPromptLib(list: OfficialPromptItem[]): StyleLibraryCard[] {
  const rows = mapRowsToOptions(list.filter((p) => p.categoryCode === PROMPT_TYPE.style))
  return rows.map((r, i) => ({
    id: r.key,
    name: r.value,
    thumbnail: r.image || '',
    featured: i < 3
  }))
}

/** 精选风格 id 从资产库切到提示词库 id 时，按名称对齐 */
export function resolveSelectedStyle(
  current: { id: string; name: string; thumbnail: string; assetName?: string; promptText?: string | null } | null,
  list: StyleLibraryCard[]
): { id: string; name: string; thumbnail: string; assetName?: string; promptText?: string | null } | null {
  if (!current) return null
  if (!list.length) return current
  const byId = list.find((s) => s.id === current.id)
  if (byId) {
    return {
      id: byId.id,
      name: byId.name,
      thumbnail: byId.thumbnail,
      ...(byId.assetName != null && byId.assetName !== '' ? { assetName: byId.assetName } : {}),
      ...(byId.promptText != null ? { promptText: byId.promptText } : {})
    }
  }
  const byName = list.find((s) => s.name === current.name)
  if (byName) {
    return {
      id: byName.id,
      name: byName.name,
      thumbnail: byName.thumbnail,
      ...(byName.assetName != null && byName.assetName !== '' ? { assetName: byName.assetName } : {}),
      ...(byName.promptText != null ? { promptText: byName.promptText } : {})
    }
  }
  return current
}

/**
 * 拉取官方只读参数词库与枚举字典；无数据时不回退静态选项，由页面展示「暂无数据」。
 */
export function usePromptDictionary() {
  const promptLibList = useState<OfficialPromptItem[]>('prompt-dictionary-lib', () => [])
  const enumList = useState<EnumDictGroup[]>('prompt-dictionary-enum', () => [])
  const loaded = useState<boolean>('prompt-dictionary-loaded', () => false)
  const loadError = useState<boolean>('prompt-dictionary-error', () => false)

  async function ensureLoaded() {
    if (loaded.value && !loadError.value) return
    if (loadInflight) {
      await loadInflight
      return
    }
    loadInflight = (async () => {
      let enumOk = false
      let promptOk = false
      try {
        const [enumResult, promptResult] = await Promise.allSettled([
          userDictEnumList({ enumTypes: [...ENUM_TYPE_CANDIDATES] }),
          (async () => {
            const categories = await userPromptOfficialCategoryList()
            const categoryCodes = categories.map((item) => item.categoryCode).filter(Boolean)
            if (!categoryCodes.length) return [] as OfficialPromptItem[]
            return userPromptOfficialItemList({ categoryCodes })
          })()
        ])

        if (enumResult.status === 'fulfilled') {
          enumList.value = enumResult.value
          enumOk = true
        } else {
          enumList.value = []
        }

        if (promptResult.status === 'fulfilled') {
          promptLibList.value = promptResult.value
          promptOk = true
        } else {
          promptLibList.value = []
        }

        loadError.value = !enumOk && !promptOk
      } catch {
        loadError.value = true
        promptLibList.value = []
        enumList.value = []
      } finally {
        loaded.value = true
        loadInflight = null
      }
    })()
    await loadInflight
  }

  const cameraMovementOptions = computed(() =>
    optionsForType(promptLibList.value, PROMPT_TYPE.camera_movement)
  )
  const shootingTechniqueOptions = computed(() =>
    optionsForType(promptLibList.value, PROMPT_TYPE.shooting_technique)
  )
  const compositionOptions = computed(() => optionsForType(promptLibList.value, PROMPT_TYPE.composition))
  const shotSizeOptions = computed(() => optionsForType(promptLibList.value, PROMPT_TYPE.shot_size))
  const cameraAngleOptions = computed(() => optionsForType(promptLibList.value, PROMPT_TYPE.camera_angle))
  const focalLengthOptions = computed(() => optionsForType(promptLibList.value, PROMPT_TYPE.focal_length))
  const colorToneOptions = computed(() => optionsForType(promptLibList.value, PROMPT_TYPE.color_tone))
  const lightingOptions = computed(() => optionsForType(promptLibList.value, PROMPT_TYPE.lighting))
  const techniqueOptions = computed(() => optionsForType(promptLibList.value, PROMPT_TYPE.exposure_blur))

  const aspectRatioEnumOptions = computed(() =>
    buildEnumOptionsList(enumList.value, DICT_ENUM.AspectRatioEnum)
  )

  const scriptTypeEnumOptions = computed(() =>
    buildEnumOptionsList(enumList.value, DICT_ENUM.ScriptTypeEnum)
  )

  const creationModeEnumOptions = computed(() =>
    buildEnumOptionsList(enumList.value, DICT_ENUM.CreationModeEnum)
  )

  const storyboardShotDensityEnumOptions = computed(() => {
    const fromApi = buildEnumOptionsList(enumList.value, DICT_ENUM.StoryboardShotDensityEnum)
    return fromApi.length ? fromApi : FALLBACK_SHOT_DENSITY_ENUM_OPTIONS
  })

  const modelTypeEnumOptions = computed(() => buildEnumOptionsList(enumList.value, DICT_ENUM.ModelTypeEnum))

  const genModeEnumOptions = computed(() => buildEnumOptionsList(enumList.value, DICT_ENUM.GenModeEnum))

  const audioSourceEnumOptions = computed(() =>
    buildEnumOptionsList(enumList.value, DICT_ENUM.AudioSourceEnum)
  )

  const styleLibraryCards = computed(() => buildStyleCardsFromPromptLib(promptLibList.value))

  function enumsByType(enumType: string) {
    return computed(() => enumList.value.find((e) => e.enumType === enumType)?.items ?? [])
  }

  return {
    ensureLoaded,
    loaded,
    loadError,
    promptLibList,
    enumList,
    cameraMovementOptions,
    shootingTechniqueOptions,
    compositionOptions,
    shotSizeOptions,
    cameraAngleOptions,
    focalLengthOptions,
    colorToneOptions,
    lightingOptions,
    techniqueOptions,
    aspectRatioEnumOptions,
    scriptTypeEnumOptions,
    creationModeEnumOptions,
    storyboardShotDensityEnumOptions,
    modelTypeEnumOptions,
    genModeEnumOptions,
    audioSourceEnumOptions,
    styleLibraryCards,
    enumsByType
  }
}
