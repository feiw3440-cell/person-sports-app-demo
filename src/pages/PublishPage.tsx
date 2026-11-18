// 发布页 v1：创作者发布中心（高保真设计页）
// 结构：返回栏 → 身份提示 → 发布类型三卡（教学内容按身份加锁） → 表单（标题/正文/媒体/关联项目/话题） → 发布按钮
// API 模式：POST /v1/contents 创建草稿 → 作者 submit_review → 平台（PC）审核发布 → 通过后出现在发现页
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PROJECTS, ROLE_LABEL, DATA_SOURCE } from '../data/db'
import { currentRole, useApp } from '../store/store'
import Icon from '../components/Icon'
import { MockFooter } from '../components/ui'
import { api, ApiError } from '../services/apiClient'

type PubType = 'post' | 'video' | 'teach'

const TOPICS = ['#摔跤日常', '#训练打卡', '#赛事见闻', '#初学者提问', '#教练心得', '#减脂塑形']

export default function PublishPage() {
  const nav = useNavigate()
  const role = currentRole()
  const pushToast = useApp((s) => s.pushToast)
  const [type, setType] = useState<PubType>('post')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [project, setProject] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const canTeach = role.type === 'coach' || role.type === 'mentor'

  const TYPE_CARDS: { key: PubType; label: string; desc: string; icon: string }[] = [
    { key: 'post', label: '动态图文', desc: '训练日常 · 心得 · 见闻', icon: 'doc' },
    { key: 'video', label: '视频作品', desc: '训练片段 · 技术拆解', icon: 'play' },
    { key: 'teach', label: '教学内容', desc: '教学课件 · 课程·训练计划', icon: 'grad' },
  ]

  /** API 模式：创建草稿 + 作者提审（服务端权威；通过平台审核后进入发现页） */
  const publish = async () => {
    if (!title.trim()) return pushToast('先给内容起个标题吧')
    setSubmitting(true)
    setSubmitErr('')
    try {
      // 话题并入正文开头（服务端无独立话题字段；不丢弃用户输入）
      const topicsHead = topics.length ? topics.join(' ') + '\n' : ''
      const d = await api<{ data: { id: string; status: string; version: number } }>(
        'POST',
        '/contents',
        {
          type: type === 'video' ? 'video' : 'article', // post/teach 落库为 article（图文形态）
          title: title.trim(),
          summary: topicsHead + body.trim() || undefined,
          project_id: DATA_SOURCE === 'api' && project ? project : undefined,
        },
        { idempotency: true },
      )
      await api('POST', `/contents/${d.data.id}/actions`, { action: 'submit_review', version: d.data.version })
      pushToast('已提交平台审核，通过后在发现页展示')
      setTitle('')
      setBody('')
      setProject('')
      setTopics([])
      setType('post')
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.code === 'FORBIDDEN')) {
        setSubmitErr('当前身份无发布权限：内容发布需教练 / 导师身份（可在「身份管理」中切换）')
      } else {
        setSubmitErr(e instanceof Error ? e.message : '发布失败（网络异常）')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* 返回栏 */}
      <div className="v2-top" style={{ justifyContent: 'space-between' }}>
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="返回">
          <Icon name="back" size={19} />
        </button>
        <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)' }}>发布</div>
        <button className="btn btn-ghost-gray btn-sm" onClick={() => pushToast('草稿箱为演示原型入口')}>
          草稿箱
        </button>
      </div>

      <div className="page page-nofoot" style={{ paddingTop: 0 }}>
        {/* 身份提示 */}
        <div className="pub-identity">
          <span className="pub-identity-badge">
            <Icon name="user" size={11} /> {ROLE_LABEL[role.type] || role.label}
          </span>
          当前身份可发布「动态图文 / 视频作品」；教学内容需
          <b> 教练 / 导师 </b>身份（可在身份管理中切换）
        </div>

        {/* 发布类型 */}
        <div className="pub-type-grid">
          {TYPE_CARDS.map((t) => {
            const locked = t.key === 'teach' && !canTeach
            return (
              <button
                key={t.key}
                className={`pub-type-card ${type === t.key ? 'active' : ''} ${locked ? 'locked' : ''}`}
                onClick={() => {
                  if (locked) {
                    pushToast('教学内容发布需教练 / 导师身份，可在「身份管理」中切换（演示）')
                    return
                  }
                  setType(t.key)
                }}
              >
                <span className="pt-ic">
                  {locked ? <Icon name="lock" size={20} /> : <Icon name={t.icon} size={20} />}
                </span>
                <span className="pt-label">{t.label}</span>
                <span className="pt-desc">{locked ? '身份受限' : t.desc}</span>
              </button>
            )
          })}
        </div>

        {/* 表单 */}
        <div className="pub-form">
          <div className="pub-field">
            <input
              className="pub-input"
              placeholder={type === 'teach' ? '课程 / 训练计划标题（演示）' : '给内容起个吸引人的标题（演示）'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="pub-field">
            <textarea
              className="pub-textarea"
              rows={4}
              placeholder={
                type === 'teach'
                  ? '介绍教学大纲、适用对象与课程安排…'
                  : type === 'video'
                    ? '说说这段视频的训练背景与技术要点…'
                    : '分享你的训练日常、心得或提问…'
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {/* 媒体占位 */}
          <button className="pub-media" onClick={() => pushToast('图片 / 视频上传为演示原型（未接入存储）')}>
            <Icon name="plus" size={22} style={{ color: 'var(--blue-strong)' }} />
            <span>
              {type === 'video' ? '添加视频封面与片段' : type === 'teach' ? '添加课件截图' : '添加图片（最多 9 张）'}
            </span>
          </button>

          {/* 关联体育项目 */}
          <div className="pub-label">关联体育项目（单选）</div>
          <div className="pub-chips">
            {PROJECTS.map((p) => (
              <button key={p.id} className={`pub-chip ${project === p.id ? 'active' : ''}`} onClick={() => setProject(project === p.id ? '' : p.id)}>
                {p.name}
              </button>
            ))}
          </div>

          {/* 话题 */}
          <div className="pub-label">添加话题（可多选）</div>
          <div className="pub-chips">
            {TOPICS.map((t) => (
              <button
                key={t}
                className={`pub-chip ${topics.includes(t) ? 'active' : ''}`}
                onClick={() => setTopics(topics.includes(t) ? topics.filter((x) => x !== t) : [...topics, t])}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 发布按钮 */}
        <button className="pub-submit" disabled={submitting} onClick={() => void publish()}>
          <Icon name="flash" size={18} /> {submitting ? '提交中…' : '发布'}
        </button>
        {submitErr && (
          <div className="t-mini center mt8" style={{ color: '#c0392b' }}>
            {submitErr}
          </div>
        )}
        <div className="t-mini center mt8">
          {DATA_SOURCE === 'api'
            ? `发布后进入平台审核（PC 管理端），通过后在发现页展示 · ${ROLE_LABEL[role.type] || role.label}身份`
            : `演示环境：发布不会真实上传或保存 · ${ROLE_LABEL[role.type] || role.label}身份`}
        </div>

        {DATA_SOURCE === 'mock' && <MockFooter text="发布功能为交互原型：类型权限与身份体系对应 PRD §7；不含任何交易能力" />}
      </div>
    </>
  )
}
