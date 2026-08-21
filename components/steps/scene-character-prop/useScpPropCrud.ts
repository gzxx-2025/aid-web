'use client'

import { message, Modal } from 'antd'
import {
  userAssetRpsCreate,
  userAssetRpsFormCreate,
  userAssetRpsUpdateForm,
  rpsRowToUserAssetRow
} from '~/utils/businessApi'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import {
  buildImagesFromAssetRow,
  getCharacterPrefix,
  getPropFormName,
  getPropFormPrefix,
  getPropName,
  getPropPrefix,
  getScenePrefix,
  reindexAssetIdMap,
  reindexFormGenerationStatusMap,
  reindexFormIdsByIndexMap
} from './scpRowUtils'
import { rpsDeleteOrphanFormsOnly, rpsDeleteSingleForm, rpsDeleteWholeAsset } from './useScpRpsOps'
import { createScpPropAssetCrudOps } from './scpPropAssetCrudOps'
import type { PendingFormCardItem, PropFormItem, ScpCtx } from './types'
import { saveRpsSettingPrompt } from './scpSettingPromptUtils'

export interface ScpPropCrudApi {
  addProp: () => Promise<void>
  removeProp: (idx: number) => void
  startEditPropName: (index: number, currentName: string) => void
  handlePropNameBlur: (index: number) => Promise<void>
  startEditPendingFormCardTitle: (card: PendingFormCardItem) => void
  handlePendingFormCardTitleBlur: (card: PendingFormCardItem) => Promise<void>
  handleEditPropSetting: (index: number) => void
  handleSavePropSetting: (content: string) => Promise<void>
  startEditPropFormName: (propIndex: number, formIndex: number, currentName: string) => void
  handlePropFormNameBlur: (propIndex: number, formIndex: number) => Promise<void>
  handleAddPropForm: (propIndex: number) => Promise<void>
  handleCopyPropForm: (propIndex: number, formIndex: number) => void
  handleDeletePropForm: (propIndex: number, formIndex: number) => void
}

export function useScpPropCrud(ctx: ScpCtx): ScpPropCrudApi {
  const {
    addProp,
    removeProp,
    startEditPropName,
    handlePropNameBlur,
    startEditPendingFormCardTitle,
    handlePendingFormCardTitleBlur
  } = createScpPropAssetCrudOps(ctx)

  const handleEditPropSetting = (index: number) => {
    ctx.currentPropIndex.set(index)
    const propName = ctx.localValue.get().props[index]
    if (!ctx.propSettings.get()[propName]) {
      ctx.propSettings.set({ ...ctx.propSettings.get(), [propName]: { content: '', isNew: true } })
    }
    ctx.showPropSettingModal.set(true)
  }

  const handleSavePropSetting = async (content: string) => {
    const propName = ctx.currentPropName()
    if (!propName) return
    try {
      const updatedSetting = await saveRpsSettingPrompt(
        'prop',
        ctx.propSettings.get()[propName],
        content
      )
      ctx.propSettings.set({
        ...ctx.propSettings.get(),
        [propName]: updatedSetting
      })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '道具提示词同步失败')
      return
    }
    ctx.showPropSettingModal.set(false)
    message.success('道具提示词已保存并同步')
  }

  const startEditPropFormName = (propIndex: number, formIndex: number, currentName: string) => {
    ctx.editingPropFormIndex.set(`${propIndex}-${formIndex}`)
    ctx.editingPropFormName.set(getPropFormName(currentName))
  }

  const handlePropFormNameBlur = async (propIndex: number, formIndex: number) => {
    if (
      ctx.editingPropFormIndex.get() !== `${propIndex}-${formIndex}` ||
      !ctx.editingPropFormName.get().trim()
    ) {
      ctx.editingPropFormIndex.set(null)
      ctx.editingPropFormName.set('')
      return
    }
    const prev = ctx.propForms.get()[propIndex][formIndex].name
    const prefix = getPropFormPrefix(prev)
    const newName = prefix
      ? `${prefix} ${ctx.editingPropFormName.get().trim()}`
      : ctx.editingPropFormName.get().trim()
    if (newName === prev) {
      ctx.editingPropFormIndex.set(null)
      ctx.editingPropFormName.set('')
      return
    }

    const assetId = ctx.propAssetIds.get()[propIndex]
    if (assetId != null) {
      const formId = ctx.ensureFormIdForRpsUpdate('prop', propIndex, formIndex)
      if (formId == null) {
        message.error(
          '无法同步形态名称：请先在「编辑形态图」弹窗中上传、从资产库导入或通过 AI 生成图片以创建形态'
        )
        ctx.editingPropFormIndex.set(null)
        ctx.editingPropFormName.set('')
        return
      }
      try {
        await userAssetRpsUpdateForm({ id: formId, name: newName })
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '形态名称同步失败')
        ctx.editingPropFormIndex.set(null)
        ctx.editingPropFormName.set('')
        return
      }
    }

    const nextForms = { ...ctx.propForms.get() }
    nextForms[propIndex] = nextForms[propIndex].map((f, i) =>
      i === formIndex ? { ...f, name: newName } : f
    )
    ctx.propForms.set(nextForms)
    message.success(assetId != null ? '形态名称已更新' : '形态名称已更新（仅本地）')
    ctx.editingPropFormIndex.set(null)
    ctx.editingPropFormName.set('')
  }

  const handleAddPropForm = async (propIndex: number) => {
    const curForms = ctx.propForms.get()[propIndex] ?? []
    const formCount = curForms.length + 1
    const formName = `形态${formCount}: 未命名`
    const aid = ctx.propAssetIds.get()[propIndex]
    if (aid != null && Number.isFinite(Number(aid))) {
      const saveCtx = await resolveStoryScriptSaveContext(ctx.store(), ctx.route())
      if (saveCtx) {
        try {
          const row = await userAssetRpsFormCreate({
            projectId: saveCtx.projectId,
            episodeId: saveCtx.episodeId,
            assetId: Number(aid),
            imageUrl: '',
            name: formName,
            sourceType: 'official'
          })
          ctx.applyRpsRowFormIds('prop', propIndex, row)
          if (aid != null) await ctx.syncAssetFormIdsFromServer('prop', propIndex, Number(aid), row)
        } catch (e: unknown) {
          const err = e as { msg?: string; message?: string }
          message.error(err?.msg || err?.message || '新增形态失败')
          return
        }
      }
    }
    const fi = (ctx.propForms.get()[propIndex] ?? []).length
    ctx.propForms.set({
      ...ctx.propForms.get(),
      [propIndex]: [
        ...(ctx.propForms.get()[propIndex] ?? []),
        {
          name: formName,
          canAutoGenerateImage: false,
          createSource: 'manual'
        }
      ]
    })
    const formKey = `${propIndex}-${fi}`
    ctx.propFormGenerationStatus.set({ ...ctx.propFormGenerationStatus.get(), [formKey]: 'idle' })
    ctx.store().setPropFormGenerationStatus(formKey, 'idle')
    message.success('形态已添加')
  }

  const handleCopyPropForm = (propIndex: number, formIndex: number) => {
    const form = ctx.propForms.get()[propIndex][formIndex]
    const newForm = {
      name: form.name.replace(/形态\d+/, () => {
        return `形态${ctx.propForms.get()[propIndex].length + 1}`
      })
    }
    ctx.propForms.set({
      ...ctx.propForms.get(),
      [propIndex]: [...ctx.propForms.get()[propIndex], newForm]
    })
    message.success('形态已复制')
  }

  const handleDeletePropForm = (propIndex: number, formIndex: number) => {
    Modal.confirm({
      title: '确认删除形态?',
      content: '删除后将无法恢复。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const aid = ctx.propAssetIds.get()[propIndex]
        const formIds = ctx.propFormIdsByIndex.get()[propIndex] ?? []
        const fid = formIds[formIndex]
        try {
          if (aid != null && fid != null) {
            await rpsDeleteSingleForm(aid, fid)
          } else if (aid != null) {
            message.warning('未找到服务端形态 ID，已仅从界面移除')
          }
        } catch (e: unknown) {
          const err = e as { msg?: string; message?: string }
          message.error(err?.msg || err?.message || '删除形态失败')
          throw e
        }

        const nextList = [...ctx.propForms.get()[propIndex]]
        nextList.splice(formIndex, 1)
        const renamed = nextList.map((form, index) => {
          const match = form.name.match(/^(形态\d+):\s*(.+)$/)
          if (match) {
            return { ...form, name: `形态${index + 1}: ${match[2]}` }
          }
          return form
        })
        ctx.propForms.set({ ...ctx.propForms.get(), [propIndex]: renamed })

        const newIds = [...formIds]
        newIds.splice(formIndex, 1)
        ctx.propFormIdsByIndex.set({ ...ctx.propFormIdsByIndex.get(), [propIndex]: newIds })

        const next: Record<string, any[]> = {}
        for (const k of Object.keys(ctx.propFormImages.get())) {
          const [c, f] = k.split('-').map(Number)
          if (c !== propIndex) {
            next[k] = ctx.propFormImages.get()[k]
          } else if (f === formIndex) {
            continue
          } else if (f > formIndex) {
            next[`${c}-${f - 1}`] = ctx.propFormImages.get()[k]
          } else {
            next[k] = ctx.propFormImages.get()[k]
          }
        }
        ctx.propFormImages.set(next)

        message.success('形态已删除')
      }
    })
  }

  return {
    addProp,
    removeProp,
    startEditPropName,
    handlePropNameBlur,
    startEditPendingFormCardTitle,
    handlePendingFormCardTitleBlur,
    handleEditPropSetting,
    handleSavePropSetting,
    startEditPropFormName,
    handlePropFormNameBlur,
    handleAddPropForm,
    handleCopyPropForm,
    handleDeletePropForm
  }
}
