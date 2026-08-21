'use client'

import { useEffect } from 'react'
import aboutCard from '~/assets/img/about/about-card.svg'
import VideoCameraOutlined from '~/assets/img/about/about-cp.svg'
import aboutHx from '~/assets/img/about/about-hx.png'
import aboutIconProject from '~/assets/img/about/about-icon-project.svg'
import EditOutlined from '~/assets/img/about/about-jb.svg'
import aboutProcess from '~/assets/img/about/about-porcess.svg'
import aboutXb from '~/assets/img/about/about-xb.svg'
import AppstoreOutlined from '~/assets/img/about/about-zc.svg'
import { useAuthPublicConfig } from '~/composables/useAuthPublicConfig'
import { assetUrl } from '~/utils/assetUrl'
import './AboutPanel.css'

/** 原约 5.5MB SVG 已栅格化为 webp 并外置 static */
const aboutBanner = '/media/about/about-banner.webp'

const capabilityTags = [
  { label: 'AI 出片', top: '43%', left: '49%', transform: 'translate(-50%, -50%)' },
  { label: '智能剧本', top: '30%', left: '22%', transform: 'translate(-50%, -50%)' },
  { label: '作品管理', top: '76%', left: '7%', transform: 'translate(0, -50%)' },
  { label: '资产与分镜', top: '44%', left: '82%', transform: 'translate(-50%, -50%)' },
  { label: '音画同步', top: '75%', left: '54%', transform: 'translate(-50%, -50%)' },
  { label: '持续进化', top: '80%', left: '89%', transform: 'translate(-100%, -50%)' }
]

const workflowSteps = [
  {
    title: '创建项目',
    description: '选择电影或剧集类型\n配置画幅、剧本类型与模型策略',
    icon: aboutIconProject
  },
  {
    title: '编写剧本',
    description: '撰写或导入故事内容\n作为后续资产与分镜的基础',
    icon: EditOutlined
  },
  {
    title: '搭建资产',
    description: '提取并完善场景、角色、道具\n生成形态图与设定素材',
    icon: AppstoreOutlined
  },
  {
    title: '分镜与出片',
    description: '生成分镜脚本与画面\n完成视频生成与预览导出',
    icon: VideoCameraOutlined
  }
]

export default function AboutPanel() {
  const { serviceEmail, contactPhone, exchangeImageUrl, loadPublicConfig } = useAuthPublicConfig()
  const currentYear = new Date().getFullYear()

  /** tel: 链接去掉常见分隔符，保留数字与 + */
  const contactPhoneTelHref = contactPhone.replace(/[^\d+]/g, '')

  useEffect(() => {
    void loadPublicConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="home-new-sub-page about-page">
      <div className="about-page__inner">
        {/* 顶部 Banner + 平台介绍 + 使命 */}
        <section className="about-page__hero">
          <img className="about-page__hero-bg" src={aboutBanner} alt="" aria-hidden="true" />
          <div className="about-page__hero-content">
            <p className="about-page__intro">AID 漫剧工坊面向创作者与团队,</p>
            <p className="about-page__intro">提供从剧本创作、素材准备、分镜设计到视频生成、音画同步与成品输出的完整链路。</p>
            <p className="about-page__intro">通过多模型协同与可视化工作流，降低视频制作门槛，让创意更快落地。</p>
            <div className="about-page__mission">
              <h2 className="about-page__mission-label">我们的使命</h2>
              <p className="about-page__mission-quote">「让专业级视频创作变得简单、高效、可协作。」</p>
            </div>
          </div>
        </section>

        {/* 核心能力 */}
        <section
          className="about-page__section about-page__capabilities"
          style={{ backgroundImage: `url("${assetUrl(aboutHx)}")` }}
        >
          <div className="about-page__section-content">
            <h2 className="about-page__section-title">核心能力</h2>
            <div className="about-page__cap-tags" aria-label="核心能力列表">
              {capabilityTags.map((tag) => (
                <span
                  key={tag.label}
                  className="about-page__cap-tag"
                  style={{ top: tag.top, left: tag.left, transform: tag.transform }}
                >
                  <img className="about-page__cap-tag-icon" src={assetUrl(aboutXb)} alt="" aria-hidden="true" />
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 创作流程 */}
        <section className="about-page__section about-page__flow">
          <img className="about-page__section-bg" src={assetUrl(aboutProcess)} alt="" aria-hidden="true" />
          <div className="about-page__section-content">
            <h2 className="about-page__section-title">创作流程</h2>
            <div className="about-page__flow-grid">
              {workflowSteps.map((step) => (
                <article key={step.title} className="about-page__flow-item">
                  <div className="about-page__flow-stack">
                    <img className="about-page__flow-icon" src={assetUrl(step.icon)} alt={step.title} />
                    <div className="about-page__flow-card">
                      <img className="about-page__flow-card-bg" src={assetUrl(aboutCard)} alt="" aria-hidden="true" />
                      <h3 className="about-page__flow-title">{step.title}</h3>
                      <p className="about-page__flow-desc">{step.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 联系我们：服务邮箱 / 商务合作电话 / 二维码来自 POST /auth/public-config → basic */}
        <section className="about-page__section about-page__contact">
          <div className=" about-page__contact-inner">
            <div className="about-page__contact-main">
              <h2 className="about-page__section-title about-page__section-title--left">联系我们</h2>
              <dl className="about-page__contact-list">
                <div className="about-page__contact-row">
                  <dt>服务邮箱</dt>
                  <dd>
                    {serviceEmail ? (
                      <a href={`mailto:${serviceEmail}`}>{serviceEmail}</a>
                    ) : (
                      <span className="about-page__contact-empty">暂未配置</span>
                    )}
                  </dd>
                </div>
                <div className="about-page__contact-row">
                  <dt>商务合作</dt>
                  <dd>
                    {contactPhone ? (
                      <a href={`tel:${contactPhoneTelHref}`}>{contactPhone}</a>
                    ) : (
                      <span className="about-page__contact-empty">暂未配置</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="about-page__qrcode">
              {exchangeImageUrl ? (
                <img
                  className="about-page__qrcode-box about-page__qrcode-img"
                  src={exchangeImageUrl}
                  alt="交流二维码"
                />
              ) : (
                <div className="about-page__qrcode-box" aria-hidden="true" />
              )}
              <span className="about-page__qrcode-label">二维码</span>
            </div>
          </div>
        </section>

        <footer className="about-page__footer">
          <span>© {currentYear} AID 漫剧工坊</span>
        </footer>
      </div>
    </div>
  )
}
