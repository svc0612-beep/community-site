import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ROLE_TAG = {
  admin: 'AI 팀장',
  manager: '담당 선생님',
  instructor: '강사',
}

const emptyForm = {
  title: '',
  links: [{ url: '', label: '' }],
}

function fullDate(value) {
  return new Date(value).toLocaleDateString('ko-KR')
}

function shortDate(value) {
  const d = new Date(value)
  return (d.getMonth() + 1) + '.' + d.getDate() + '.'
}

function LinkRow({ link }) {
  return React.createElement(
    'a',
    {
      className: 'file-row',
      href: link.url,
      target: '_blank',
      rel: 'noreferrer',
    },
    React.createElement('span', { className: 'file-name' }, link.label || link.url),
    React.createElement('span', { className: 'muted' }, '열기')
  )
}

export default function Jobs() {
  const { profile } = useAuth()

  const [tab, setTab] = useState('official')
  const [items, setItems] = useState([])
  const [members, setMembers] = useState(new Map())
  const [open, setOpen] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [keyword, setKeyword] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const isStaff = profile?.role === 'manager' || profile?.role === 'admin'
  const canWrite = tab === 'shared' || isStaff

  async function fetchJobs(category) {
    return await supabase
      .from('jobs')
      .select('id, title, author_id, created_at, links:job_links(id, url, label, sort_order)')
      .eq('category', category)
      .order('created_at', { ascending: false })
  }

  const load = useCallback(async () => {
    setLoading(true)

    const [j, mem] = await Promise.all([
      fetchJobs(tab),
      supabase.from('member_public').select('id, nickname, role'),
    ])

    if (j.error) setError(j.error.message)
    else setItems(j.data ?? [])

    setMembers(new Map((mem.data ?? []).map((m) => [m.id, m])))
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  function toggleOpen(id) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function switchTab(next) {
    setTab(next)
    setShowForm(false)
    setOpen(new Set())
  }

  function setLink(index, key, value) {
    setForm((prev) => ({
      ...prev,
      links: prev.links.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
    }))
  }

  function addLinkRow() {
    setForm((prev) => ({ ...prev, links: [...prev.links, { url: '', label: '' }] }))
  }

  function removeLinkRow(index) {
    setForm((prev) => ({ ...prev, links: prev.links.filter((_, i) => i !== index) }))
  }

  function handlePasteLink(index, e) {
    const text = e.clipboardData?.getData('text') ?? ''
    const urls = text.split(/\s+/).filter((t) => /^https?:\/\//i.test(t))

    if (urls.length <= 1) return

    e.preventDefault()
    setForm((prev) => {
      const next = [...prev.links]
      next.splice(index, 1, ...urls.map((u) => ({ url: u, label: '' })))
      return { ...prev, links: next }
    })
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(item) {
    const sorted = [...(item.links ?? [])].sort((a, b) => a.sort_order - b.sort_order)

    setEditingId(item.id)
    setForm({
      title: item.title,
      links: sorted.length
        ? sorted.map((l) => ({ url: l.url, label: l.label ?? '' }))
        : [{ url: '', label: '' }],
    })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.title.trim()) {
      setError('제목을 입력하세요.')
      return
    }

    const rows = form.links.filter((l) => l.url.trim())

    if (rows.length === 0) {
      setError('링크를 하나 이상 입력하세요.')
      return
    }

    setBusy(true)

    let jobId = editingId

    if (editingId) {
      const res = await supabase
        .from('jobs')
        .update({ title: form.title.trim() })
        .eq('id', editingId)

      if (res.error) {
        setBusy(false)
        setError('수정 실패: ' + res.error.message)
        return
      }

      await supabase.from('job_links').delete().eq('job_id', editingId)
    } else {
      const res = await supabase
        .from('jobs')
        .insert({ category: tab, author_id: profile.id, title: form.title.trim() })
        .select('id')
        .single()

      if (res.error) {
        setBusy(false)
        setError('등록 실패: ' + res.error.message)
        return
      }
      jobId = res.data.id
    }

    const payload = rows.map((l, i) => ({
      job_id: jobId,
      url: l.url.trim(),
      label: l.label.trim() || null,
      sort_order: i,
    }))

    const linkRes = await supabase.from('job_links').insert(payload)

    if (linkRes.error) {
      setBusy(false)
      setError('링크 저장 실패: ' + linkRes.error.message)
      return
    }

    const refreshed = await fetchJobs(tab)

    setItems(refreshed.data ?? [])
    setBusy(false)
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  async function remove(item) {
    if (!confirm(item.title + ' 글을 삭제할까요?')) return

    const res = await supabase.from('jobs').delete().eq('id', item.id)

    if (res.error) {
      setError('삭제 실패: ' + res.error.message)
      return
    }

    const refreshed = await fetchJobs(tab)
    setItems(refreshed.data ?? [])
  }

  const visible = items.filter((j) => {
    if (!keyword.trim()) return true

    const k = keyword.trim().toLowerCase()
    const author = members.get(j.author_id)?.nickname ?? ''
    const labels = (j.links ?? []).map((l) => (l.label ?? '') + ' ' + l.url).join(' ')
    return (j.title + ' ' + author + ' ' + labels).toLowerCase().includes(k)
  })

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">취업 정보</span>
        <h1 className="page-title">{tab === 'official' ? '채용 공고' : '교육생 공유'}</h1>
        <p className="page-sub">
          {tab === 'official'
            ? '담당 선생님이 등록한 공식 채용 정보입니다.'
            : '교육생끼리 자유롭게 정보를 나누는 공간입니다.'}
        </p>
      </div>

      <div className="tabs">
        <button
          className={tab === 'official' ? 'tab tab-on' : 'tab'}
          onClick={() => switchTab('official')}
        >
          공식 채용공고
        </button>
        <button
          className={tab === 'shared' ? 'tab tab-on' : 'tab'}
          onClick={() => switchTab('shared')}
        >
          교육생 공유
        </button>
      </div>

      <div className="filters">
        <input
          className="input"
          type="search"
          placeholder="제목·링크·작성자 검색"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        {canWrite && (
          <button
            className="btn btn-primary"
            onClick={() => (showForm ? setShowForm(false) : openNew())}
          >
            {showForm ? '취소' : '＋ 글쓰기'}
          </button>
        )}
      </div>

      {showForm && (
        <form className="tile form-block" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="title">제목</label>
            <input
              id="title"
              className="input"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="예: 삼성SDS 데이터분석 신입 공채"
              required
            />
          </div>

          <div className="field">
            <span className="field-label">링크</span>

            {form.links.map((link, i) => (
              <div className="link-row" key={i}>
                <input
                  className="input"
                  type="url"
                  placeholder="https://"
                  value={link.url}
                  onChange={(e) => setLink(i, 'url', e.target.value)}
                  onPaste={(e) => handlePasteLink(i, e)}
                />
                <input
                  className="input link-label"
                  placeholder="설명 (선택)"
                  value={link.label}
                  onChange={(e) => setLink(i, 'label', e.target.value)}
                />
                {form.links.length > 1 && (
                  <button className="btn btn-sm" type="button" onClick={() => removeLinkRow(i)}>
                    삭제
                  </button>
                )}
              </div>
            ))}

            <button className="btn btn-sm" type="button" onClick={addLinkRow}>
              ＋ 링크 추가
            </button>
            <p className="note">링크를 여러 개 한 번에 붙여넣으면 자동으로 나뉩니다.</p>
          </div>

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? '저장 중…' : editingId ? '수정' : '등록'}
          </button>
        </form>
      )}

      {error && <p className="alert">{error}</p>}

      {loading && <p className="page-sub">불러오는 중…</p>}

      {!loading && visible.length === 0 && (
        <p className="page-sub">
          {keyword.trim() ? '검색 결과가 없습니다.' : '아직 등록된 글이 없습니다.'}
        </p>
      )}

      {!loading && visible.length > 0 && (
        <div className="job-list">
          {visible.map((item) => {
            const author = members.get(item.author_id)
            const mine = item.author_id === profile?.id
            const links = [...(item.links ?? [])].sort((a, b) => a.sort_order - b.sort_order)
            const isOpen = open.has(item.id)
            const roleTag = ROLE_TAG[author?.role]

            return (
              <div className={isOpen ? 'tile job-card job-card-on' : 'tile job-card'} key={item.id}>
                <button
                  className="job-head"
                  type="button"
                  onClick={() => toggleOpen(item.id)}
                  aria-expanded={isOpen}
                >
                  <span className="job-title">{item.title}</span>
                  <span className="muted job-date">{shortDate(item.created_at)}</span>
                  <span className="job-toggle">
                    링크 {links.length}개 {isOpen ? '닫기' : '보기'}
                    <span className={isOpen ? 'job-chev job-chev-on' : 'job-chev'}>⌄</span>
                  </span>
                </button>

                {isOpen && (
                  <div className="job-body-wrap">
                    <div className="file-list">
                      {links.map((l) => (
                        <LinkRow key={l.id} link={l} />
                      ))}
                    </div>

                    <div className="job-foot">
                      <span>{author?.nickname ?? '탈퇴한 회원'}</span>
                      {roleTag && <span className="tag">{roleTag}</span>}
                      <span className="muted">{fullDate(item.created_at)}</span>

                      {(mine || isStaff) && (
                        <span className="job-actions">
                          {mine && (
                            <button className="btn btn-sm" onClick={() => openEdit(item)}>
                              수정
                            </button>
                          )}
                          <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>
                            삭제
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}