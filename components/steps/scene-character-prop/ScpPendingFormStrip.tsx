'use client'

import type { ComponentType, ReactNode } from 'react'
import { Button, Dropdown, Input } from 'antd'
import { DeleteOutlined, MoreOutlined } from '@ant-design/icons'
import type { PendingFormCardItem, ScpCtx } from './types'

/**
 * 提取完成、尚未生成形态：小卡片横滑列表（场景/角色/道具三个 Tab 共用同一 UI，
 * 仅标题图标 / key 前缀 / 提示文案不同，对应原模板三段重复结构）。
 */
export function ScpPendingFormStrip(props: {
  ctx: ScpCtx
  cards: PendingFormCardItem[]
  keyPrefix: 'pending-scene' | 'pending-character' | 'pending-prop'
  hint: string
  titleIcon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
}) {
  const { ctx, cards, keyPrefix, hint, titleIcon: TitleIcon } = props
  if (cards.length === 0) return null

  const renderCard = (card: PendingFormCardItem): ReactNode => (
    <div
      key={`${keyPrefix}-${card.assetId}`}
      className="scp-pending-form-card character-form-card"
      role="listitem"
    >
      <div className="scp-pending-form-card__head">
        <span className="scp-pending-form-card__title">
          <TitleIcon className="scp-pending-form-card__title-ico" aria-hidden="true" />
          {ctx.pendingFormCardPrefix(card) ? (
            <span className="scp-pending-form-card__title-prefix">
              {ctx.pendingFormCardPrefix(card)}
            </span>
          ) : null}
          {ctx.editingPendingFormCardKey.value === ctx.pendingFormCardEditKey(card) ? (
            <Input
              value={ctx.editingPendingFormTitle.value}
              onChange={(e) => ctx.editingPendingFormTitle.set(e.target.value)}
              size="small"
              className="scp-pending-form-card__title-input"
              onBlur={() => ctx.handlePendingFormCardTitleBlur(card)}
              onPressEnter={() => ctx.handlePendingFormCardTitleBlur(card)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="scp-pending-form-card__title-text scp-pending-form-card__title-editable"
              onClick={() => ctx.startEditPendingFormCardTitle(card)}
            >
              {ctx.pendingFormCardEditableSuffix(card)}
            </span>
          )}
        </span>
        <Dropdown
          trigger={['hover']}
          placement="bottomRight"
          menu={{
            items: [
              {
                key: 'delete',
                danger: true,
                label: (
                  <span>
                    <DeleteOutlined /> 删除
                  </span>
                ),
                onClick: () => ctx.handleDeletePendingFormCard(card)
              }
            ]
          }}
        >
          <span
            className="scp-pending-form-card__more"
            role="button"
            tabIndex={0}
            onClick={(e) => e.preventDefault()}
          >
            <MoreOutlined />
          </span>
        </Dropdown>
      </div>
      <div className="scp-pending-form-card__body">
        <Button
          type="primary"
          className="scp-pending-form-card__gen-btn"
          loading={!!ctx.pendingFormGenBusy.value[card.assetId]}
          disabled={!!ctx.pendingFormGenBusy.value[card.assetId]}
          onClick={() => ctx.runPendingExtractFormGenerate(card)}
        >
          <div className="text-gradient">生成形态</div>
        </Button>
      </div>
    </div>
  )

  return (
    <div className="scp-pending-form-strip-wrap">
      <p className="scp-pending-form-strip-hint">{hint}</p>
      <div className="scp-pending-form-strip" role="list">
        {cards.map(renderCard)}
      </div>
    </div>
  )
}
