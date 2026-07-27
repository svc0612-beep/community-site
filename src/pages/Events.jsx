import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Calendar, { KIND_LABEL, spreadByDate, toDate, toKey } from '../components/Calendar'

const emptyForm = {
  kind: 'event',
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  start_time: '',
  location: '',
}

function formatRange(ev) {
  const start = toDate(ev.start_date)
  const text = `${start.getMonth() + 1}월 ${start.getDate()}일`

  if (!ev.end_date || ev.end_date === ev.start_date) return text

  const end = toDate(ev.end_date)
  return `${text} ~ ${end.getMonth() + 1}월 ${end.getDate()}일`
}

function dDay(ev) {
  const start = toDate(ev.start_date)
  const today = new Date(new Date().toDateString())
  const diff = Math.round((start - today) / 86400000)

  if (diff === 0) return '오늘'
  if (diff > 0) return 'D-' + diff
  return null
}

export default function Events() {
  const { profile } = useAuth()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(toKey(today))

  const [events, setEvents] = useState([])
  const [members, setMembers] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const canEdit = profile?.role === 'manager' || profile?.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)

    const [ev, mem] = await Promise.all([
      supabase.from('events').select('*').order('start_date'),
      supabase.from('member_public').select('id, nickname, role'),
    ])

    if (ev.error) setError(ev.error.message)
    else setEvents(ev.data ?? [])

    setMembers(new Map((mem.data ?? []).map((m) => [m.id, m])))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const byDate = useMemo(() => spreadByDate(events), [events])

  const selectedList = byDate.get(selected) ?? []

  const upcoming = useMemo(() => {
    const todayKey = toKey(new Date())

    return events
      .filter((ev) => (ev.end_date || ev.start_date) >= todayKey)
      .slice(0, 5)
  }, [events])

  // 캘린더에서 날짜를 클릭했을 때
  function handleSelect(key) {
    setSelected(key)

    if (!canEdit) return

    // 기존 일정을 수정 중이면 방해하지 않는다
    if (editingId) return

    setForm((prev) => ({ ...prev, start_date: key, end_date: '' }))
    setShowForm(true)
  }

  function moveMonth(delta) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  function goToday() {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth())
    setSelected(toKey(now))
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openNew() {
    setEditingId(null)
    setForm({ ...emptyForm, start_date: selected })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function openEdit(ev) {
    setEditingId(ev.id)
    setForm({
      kind: ev.kind,
      title: ev.title,
      description: ev.description ?? '',
      start_date: ev.start_date,
      end_date: ev.end_date ?? '',
      start_time: ev.start_time ?? '',
      location: ev.location ?? '',
    })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.title.trim() || !form.start_date) {
      setError('제목과 날짜를 입력하세요.')
      return
    }

    setBusy(true)

    const payload = {
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      start_time: form.start_time.trim() || null,
      location: form.location.trim() || null,
    }

    const res = editingId
      ? await supabase.from('events').update(payload).eq('id', editingId)
      : await supabase.from('events').insert({ ...payload, author_id: profile.id })

    setBusy(false)

    if (res.error) {
      setError((editingId ? '수정' : '등록') + ' 실패: ' + res.error.message)
      return
    }

    closeForm()
    await load()
  }

  async function remove(ev) {
    if (!confirm(ev.title + ' 일정을 삭제할까요?')) return

    const res = await supabase.from('events').delete().eq('id', ev.id)

    if (res.error) {
      setError('삭제 실패: ' + res.error.message)
      return
    }
    await load()
  }

  function EventCard({ ev, showDday }) {
    const author = members.get(ev.author_id)
    const d = showDday ? dDay(ev) : null

    return (
      <div className="tile ev-card">
        <div className="ev-main">
          <div className="ev-top">
            <span className={'kind kind-' + ev.kind}>{KIND_LABEL[ev.kind]}</span>
            <span className="ev-title">{ev.title}</span>
            {d && <span className="badge badge-act">{d}</span>}
          </div>

          <p className="ev-meta">
            {formatRange(ev)}
            {ev.start_time ? ' · ' + ev.start_time : ''}
            {ev.location ? ' · ' + ev.location : ''}
          </p>

          {ev.description && <p className="ev-desc">{ev.description}</p>}

          <p className="ev-foot">{author?.nickname ?? '탈퇴한 회원'} 등록</p>
        </div>

        {canEdit && (
          <div className="ev-actions">
            <button className="btn btn-sm" onClick={() => openEdit(ev)}>수정</button>
            <button className="btn btn-sm btn-danger" onClick={() => remove(ev)}>삭제</button>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <p className="page-sub">불러오는 중…</p>

  const selDate = toDate(selected)
  const formDate = form.start_date ? toDate(form.start_date) : null

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">일정</span>
        <h1 className="page-title">직능원 일정</h1>
        <p className="page-sub">
          {canEdit
            ? '날짜를 클릭하면 그 날짜로 일정을 등록할 수 있습니다.'
            : '휴무일과 행사 일정을 확인합니다.'}
        </p>
      </div>

      <div className="cal-bar">
        <button className="btn btn-sm" onClick={() => moveMonth(-1)}>이전</button>
        <span className="cal-month">{year}년 {month + 1}월</span>
        <button className="btn btn-sm" onClick={() => moveMonth(1)}>다음</button>
        <button className="btn btn-sm" onClick={goToday}>오늘</button>

        {canEdit && (
          <button
            className="btn btn-primary btn-sm cal-add"
            onClick={() => (showForm ? closeForm() : openNew())}
          >
            {showForm ? '닫기' : '＋ 일정 등록'}
          </button>
        )}
      </div>

      <Calendar
        year={year}
        month={month}
        byDate={byDate}
        selected={selected}
        onSelect={handleSelect}
      />

      {error && <p className="alert">{error}</p>}

      {showForm && (
        <form className="tile form-block cal-form" onSubmit={handleSubmit}>
          <div className="form-head">
            <span className="eyebrow">
              {editingId ? '일정 수정' : '일정 등록'}
            </span>
            {formDate && (
              <span className="form-date">
                {formDate.getFullYear()}년 {formDate.getMonth() + 1}월 {formDate.getDate()}일
              </span>
            )}
            <button className="btn btn-sm" type="button" onClick={closeForm}>취소</button>
          </div>

          <div className="row-2">
            <div className="field">
              <label className="field-label" htmlFor="kind">종류</label>
              <select
                id="kind"
                className="select"
                value={form.kind}
                onChange={(e) => setField('kind', e.target.value)}
              >
                <option value="holiday">휴무</option>
                <option value="event">행사</option>
                <option value="exam">평가</option>
                <option value="etc">기타</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="title">제목</label>
              <input
                id="title"
                className="input"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="예: 직능원 체육대회"
                required
              />
            </div>
          </div>

          <div className="row-2">
            <div className="field">
              <label className="field-label" htmlFor="start">시작일</label>
              <input
                id="start"
                className="input"
                type="date"
                value={form.start_date}
                onChange={(e) => setField('start_date', e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="end">종료일</label>
              <input
                id="end"
                className="input"
                type="date"
                value={form.end_date}
                min={form.start_date}
                onChange={(e) => setField('end_date', e.target.value)}
              />
              <p className="note">하루짜리면 비워두세요.</p>
            </div>
          </div>

          <div className="row-2">
            <div className="field">
              <label className="field-label" htmlFor="time">시간</label>
              <input
                id="time"
                className="input"
                value={form.start_time}
                onChange={(e) => setField('start_time', e.target.value)}
                placeholder="09:00 또는 오전 중"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="place">장소</label>
              <input
                id="place"
                className="input"
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                placeholder="본관 체육관"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="desc">안내 사항</label>
            <textarea
              id="desc"
              className="input"
              rows={3}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="준비물, 집합 방법 등"
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? '저장 중…' : editingId ? '수정' : '등록'}
          </button>
        </form>
      )}

      <h2 className="section-title">
        {selDate.getMonth() + 1}월 {selDate.getDate()}일 일정
      </h2>

      {selectedList.length === 0 ? (
        <p className="page-sub">등록된 일정이 없습니다.</p>
      ) : (
        <div className="stack-list">
          {selectedList.map((ev) => (
            <EventCard key={ev.id} ev={ev} />
          ))}
        </div>
      )}

      <h2 className="section-title">다가오는 일정</h2>

      {upcoming.length === 0 ? (
        <p className="page-sub">예정된 일정이 없습니다.</p>
      ) : (
        <div className="stack-list">
          {upcoming.map((ev) => (
            <EventCard key={ev.id} ev={ev} showDday />
          ))}
        </div>
      )}
    </>
  )
}