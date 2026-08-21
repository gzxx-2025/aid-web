'use client'

import { useState } from 'react'
import {
  UndoOutlined,
  RedoOutlined,
  CopyOutlined,
  DeleteOutlined,
  UploadOutlined,
  HistoryOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { Button, Drawer, message, Modal } from 'antd'
import RichTextEditor from '~/components/common/RichTextEditor'
import ImportScriptModal from './ImportScriptModal'
import {
  htmlToPlainText,
  htmlPureTextCharCount,
  isHtmlContentEmpty,
  STORY_SCRIPT_MAX_CHARS_MOVIE,
  STORY_SCRIPT_MAX_CHARS_SERIES
} from '~/utils/htmlPlain'
import { useStoryScriptAutoSave } from '~/hooks/useStoryScriptAutoSave'
import { useCreationStore } from '~/stores/creation'
import './story-script.css'

interface Props {
  value: string
  description?: string
  onChange: (value: string) => void
}

interface HistoryVersion {
  id: string
  content: string
  createdAt: string
}

const maxHistorySize = 50

export function StoryScript({ value = '', description: _description = '撰写或导入剧本内容', onChange }: Props) {
  const currentProjectType = useCreationStore((s) => s.currentProjectType)

  /** 电影 1 万字 / 剧集 10 万字（纯文字，不含空格与标点） */
  const scriptMaxLength =
    currentProjectType === 'series' ? STORY_SCRIPT_MAX_CHARS_SERIES : STORY_SCRIPT_MAX_CHARS_MOVIE

  const [localContent, setLocalContent] = useState(value)
  const [lastExternalValue, setLastExternalValue] = useState(value)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)

  // 撤销/重做历史
  const [history, setHistory] = useState<{ stack: string[]; index: number }>({
    stack: [],
    index: -1
  })

  // 历史版本列表
  const [historyVersions, setHistoryVersions] = useState<HistoryVersion[]>([])

  // 计算是否可以撤销/重做
  const canUndo = history.index > 0
  const canRedo = history.index < history.stack.length - 1

  /** 输入框有非空内容时，左侧工具栏图标使用主题青色 */
  const hasEditorText = !isHtmlContentEmpty(localContent)

  /** 30 秒无编辑且内容与已同步版本不一致时静默保存 */
  useStoryScriptAutoSave(localContent)

  // 外部切换作品/剧集时同步编辑内容；在渲染期调整派生状态，避免 effect 级联渲染。
  if (lastExternalValue !== value) {
    setLastExternalValue(value)
    if (localContent !== value) {
      setLocalContent(value)
      // 初始化时不保存到历史栈
      setHistory((h) => (h.stack.length === 0 ? { stack: [value], index: 0 } : h))
    }
  }

  // 保存到历史栈
  const saveToHistory = (content: string) => {
    setHistory((h) => {
      // 如果内容与当前历史栈顶部相同，不保存
      if (h.stack[h.index] === content) {
        return h
      }

      // 删除当前位置之后的历史
      const stack = h.stack.slice(0, h.index + 1)

      // 添加新内容
      stack.push(content)

      // 限制历史栈大小
      if (stack.length > maxHistorySize) {
        stack.shift()
        return { stack, index: h.index }
      }
      return { stack, index: stack.length - 1 }
    })
  }

  // 内容变化处理
  const handleContentChange = (html: string) => {
    setLocalContent(html)
    onChange(html)
    // 延迟保存到历史栈，避免频繁触发
    if (history.stack.length === 0 || history.stack[history.index] !== html) {
      saveToHistory(html)
    }
  }

  // 撤销
  const handleUndo = () => {
    if (canUndo) {
      const newIndex = history.index - 1
      const content = history.stack[newIndex]
      setHistory({ stack: history.stack, index: newIndex })
      setLocalContent(content)
      onChange(content)
    }
  }

  // 重做
  const handleRedo = () => {
    if (canRedo) {
      const newIndex = history.index + 1
      const content = history.stack[newIndex]
      setHistory({ stack: history.stack, index: newIndex })
      setLocalContent(content)
      onChange(content)
    }
  }

  // 复制
  const handleCopy = async () => {
    if (isHtmlContentEmpty(localContent)) {
      message.warning('没有内容可复制')
      return
    }

    try {
      await navigator.clipboard.writeText(htmlToPlainText(localContent))
      message.success('已复制到剪贴板')
    } catch {
      message.error('复制失败')
    }
  }

  // 清空
  const handleClear = () => {
    if (isHtmlContentEmpty(localContent)) {
      return
    }

    Modal.confirm({
      title: '确认清空',
      content: '确定要清空所有内容吗？此操作不可撤销。',
      onOk: () => {
        setLocalContent('')
        onChange('')
        setHistory({ stack: [''], index: 0 })
        message.success('已清空')
      }
    })
  }

  // 选择历史版本
  const selectHistoryVersion = (version: HistoryVersion) => {
    setSelectedHistoryId(version.id)
  }

  // 恢复版本
  const restoreVersion = (version: HistoryVersion) => {
    setLocalContent(version.content)
    onChange(version.content)
    saveToHistory(version.content)
    message.success('已恢复此版本')
    setShowHistoryPanel(false)
  }

  // 删除版本
  const deleteVersion = (id: string) => {
    setHistoryVersions((list) => list.filter((v) => v.id !== id))
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null)
    }
    message.success('已删除')
  }

  // 格式化时间
  const formatTime = (time: string) => {
    const date = new Date(time)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 获取预览文本
  const getPreview = (content: string) => {
    const plain = htmlToPlainText(content)
    if (!plain) return '空内容'
    return plain.length > 100 ? plain.substring(0, 100) + '...' : plain
  }

  // 导入剧本前确认覆盖
  function beforeScriptImport(): Promise<boolean> {
    if (isHtmlContentEmpty(localContent)) return Promise.resolve(true)
    return new Promise((resolve) => {
      Modal.confirm({
        title: '覆盖确认',
        content: '确定要覆盖当前剧本内容吗？',
        okText: '确定',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
  }

  // 导入剧本
  const handleImport = (content: string) => {
    const pureLen = htmlPureTextCharCount(content)
    if (pureLen > scriptMaxLength) {
      message.warning(
        `导入内容已超过字数上限（${scriptMaxLength.toLocaleString('zh-CN')}字），请删减后再导入`
      )
      return
    }
    setLocalContent(content)
    onChange(content)
    saveToHistory(content)
    message.success('导入成功')
    setShowImportModal(false)
  }

  // 保存历史版本
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const saveVersion = () => {
    if (isHtmlContentEmpty(localContent)) {
      message.warning('内容为空，无法保存版本')
      return
    }

    const version: HistoryVersion = {
      id: `version-${Date.now()}`,
      content: localContent,
      createdAt: new Date().toISOString()
    }

    setHistoryVersions((list) => {
      const next = [version, ...list]
      // 限制历史版本数量
      return next.length > 20 ? next.slice(0, 20) : next
    })

    message.success('已保存为历史版本')
  }

  return (
    <div className="story-script create-step-story-script">
      {/* 工具栏 */}
      <div className="toolbar">
        <div className={`toolbar-left${hasEditorText ? ' toolbar-left--has-text' : ''}`}>
          <button className="toolbar-btn" onClick={handleUndo} disabled={!canUndo} title="撤销">
            <UndoOutlined />
            <span>撤销</span>
          </button>
          <button className="toolbar-btn" onClick={handleRedo} disabled={!canRedo} title="重做">
            <RedoOutlined />
            <span>重做</span>
          </button>
          <button className="toolbar-btn" onClick={handleCopy} title="复制">
            <CopyOutlined />
            <span>复制</span>
          </button>
          <button className="toolbar-btn" onClick={handleClear} title="清空">
            <DeleteOutlined />
            <span>清空</span>
          </button>
        </div>
        <div className="toolbar-right">
          <Button
            onClick={() => setShowImportModal(true)}
            className="import-btn"
            icon={<UploadOutlined />}
          >
            导入剧本(单集)
          </Button>
          <Button
            onClick={() => setShowHistoryPanel(true)}
            className="history-btn"
            icon={<HistoryOutlined />}
          >
            历史版本
          </Button>
        </div>
      </div>

      {/* 文本编辑器（Quill 无工具栏，存 HTML） */}
      <div className="editor-container">
        <RichTextEditor
          value={localContent}
          onChange={handleContentChange}
          className="script-editor"
          placeholder={`请输入本集剧本内容，或点击右上角「导入剧本(单集)」

提示:若为全集/多集内容,请按集拆分后分别创建作品导入`}
          minHeight="500px"
          maxLength={scriptMaxLength}
          countPureTextOnly
          showCount
        />
      </div>

      {/* 历史版本侧边栏 */}
      <Drawer
        open={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        placement="right"
        size={400}
        rootClassName="create-theme-drawer"
        className="history-drawer"
        title={
          <div className="drawer-title">
            <HistoryOutlined />
            <span>历史版本</span>
          </div>
        }
      >
        {historyVersions.length === 0 ? (
          <div className="empty-history">
            <FileTextOutlined className="empty-icon" />
            <p>暂无历史记录</p>
          </div>
        ) : (
          <div className="history-list">
            {historyVersions.map((version, index) => (
              <div
                key={version.id}
                className={`history-item${selectedHistoryId === version.id ? ' active' : ''}`}
                onClick={() => selectHistoryVersion(version)}
              >
                <div className="history-header">
                  <span className="history-title">版本 {historyVersions.length - index}</span>
                  <span className="history-time">{formatTime(version.createdAt)}</span>
                </div>
                <div className="history-preview">{getPreview(version.content)}</div>
                <div className="history-actions">
                  <Button
                    size="small"
                    type="link"
                    onClick={(e) => {
                      e.stopPropagation()
                      restoreVersion(version)
                    }}
                  >
                    恢复此版本
                  </Button>
                  <Button
                    size="small"
                    type="link"
                    danger
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteVersion(version.id)
                    }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* 导入剧本弹窗 */}
      <ImportScriptModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        beforeScriptImport={beforeScriptImport}
        onImport={handleImport}
      />
    </div>
  )
}

export default StoryScript
