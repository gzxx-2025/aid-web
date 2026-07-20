import type { CreationStep } from '~/types'

/** 创作流程步骤元数据（与路由 `/create/<key>`、流程条一致） */
export interface CreationFlowStepMeta {
  key: CreationStep
  title: string
  description: string
  guide: string
}

export const CREATION_FLOW_STEPS: CreationFlowStepMeta[] = [
  {
    key: 'global-setting',
    title: '全局设定',
    description: '设定作品的基本信息和风格',
    guide: '请填写作品标题、类型和简介，这些信息将用于后续的创作流程'
  },
  {
    key: 'story-script',
    title: '故事剧本',
    description: '编写你的精彩故事',
    guide: '在文本框中输入你的故事剧本，可以是对话、场景描述等'
  },
  {
    key: 'scene-character',
    title: '场景角色道具',
    description: '设计你的角色、场景和道具',
    guide: '添加角色、场景和道具，这些将用于生成视频内容'
  },
  {
    key: 'storyboard-script',
    title: '分镜脚本',
    description: '绘制专业的分镜脚本',
    guide: '根据故事剧本创建分镜脚本，规划每个场景的视觉呈现'
  },
  {
    key: 'storyboard-video',
    title: '分镜视频',
    description: '将分镜转换为动态视频',
    guide: '将分镜脚本转换为动态视频，预览视觉效果'
  },
  {
    key: 'dubbing',
    title: '配音对口型',
    description: '添加专业配音和自动对口型',
    guide: '为视频添加配音，系统将自动匹配口型'
  },
  {
    key: 'preview',
    title: '视频预览',
    description: '预览和导出你的作品',
    guide: '预览最终作品，确认无误后可以提交'
  }
]
