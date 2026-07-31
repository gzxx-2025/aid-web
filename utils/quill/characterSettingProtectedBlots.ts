/**
 * 角色设定弹窗内不可编辑片段：小节标题、基本信息字段名（原子 Embed）。
 */
import type QuillType from 'quill'
import { EmbedBlot } from 'parchment'

let registered = false

export function registerCharacterSettingProtectedBlots(Quill: typeof QuillType): void {
  if (registered) return

  class CharacterSettingKeyBlot extends EmbedBlot {
    static blotName = 'characterSettingKey'
    static className = 'scp-char-setting-key'
    static tagName = 'SPAN'

    static create(value: unknown) {
      const node = super.create()
      node.textContent = typeof value === 'string' ? value : ''
      return node
    }

    static value(domNode: HTMLElement): string {
      return domNode.textContent ?? ''
    }
  }

  class CharacterSettingSectionBlot extends EmbedBlot {
    static blotName = 'characterSettingSection'
    static className = 'scp-char-setting-section'
    static tagName = 'SPAN'

    static create(value: unknown) {
      const node = super.create()
      node.textContent = typeof value === 'string' ? value : ''
      return node
    }

    static value(domNode: HTMLElement): string {
      return domNode.textContent ?? ''
    }
  }

  Quill.register(CharacterSettingKeyBlot)
  Quill.register(CharacterSettingSectionBlot)
  registered = true
}

/** @deprecated 使用 registerCharacterSettingProtectedBlots */
export function registerCharacterSettingKeyBlot(Quill: typeof QuillType): void {
  registerCharacterSettingProtectedBlots(Quill)
}
