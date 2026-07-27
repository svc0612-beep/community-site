import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const MAX_IMG = 10 * 1024 * 1024

export default function Questions() {
  const { profile } = useAuth()

  const [modules, setModules] = useState([])
  const [activeModule, setActiveModule] = useState('')
  const [items, setItems] = useState([])
  const [members, setMembers] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [keyword, setKeyword] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [onlyOpen, setOnlyOpen] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [images, setImages] = useState([])

  const isStaff = profile?.role === 'manager' || profile?.role === 'admin'
  const current = modules.find((m) => m.id === activeModule)

  useEffect(() => {
    async function loadModules() {
      if (isStaff) {
        const { data } = await supabase
          .from('modules')
          .select('id, order_no, name')
          .order('order_no')

        setModules(data ?? [])
        setActiveModule(data?.[0]?.id ?? '')
        return
      }

      if (profile?.role === 'instructor') {
        const { data } = await supabase
          .from('module_instructors')
          .select('module:modules(id, order_no, name)')
          .eq('instructor_id', profile.id)
          .eq('is_active', true)

        const list = (data ?? [])
          .map((r) => r.module)
          .filter(Boolean)
          .sort((a, b) => a.order_no - b.order_no)

        setModules(list)
        setActiveModule(list[0]?.id ?? '')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('module:modules(id, order_no, name)')
        .eq('id', profile.id)
        .maybeSingle()

      if (data?.module) {
        setModules([data.module])
        setActiveModule(data.module.id)
      } else {
        setModules([])
      }
    }

    if (profile) loadModules()
  }, [profile, isStaff])

  const load = useCallback(async () => {
    if (!activeModule) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)

    const [q, mem] = await Promise.all([
      supabase
        .from('questions')
        .select('id, title, body, author_id, is_resolved, view_count, created_at, comments(count)')
        .eq('module_id', activeModule)
        .order('created_at', { ascending: false }),
      supabase.from('member_public').select('id, nickname, role'),
    ])

    if (q.error) setError(q.error.message)
    else setItems(q.data ?? [])

    setMembers(new Map((mem.data ?? []).map((m) => [m.id, m])))
    setLoading(false)
  }, [activeModule])

  useEffect(() => { load() }, [load])

  function addImages(list) {
    const ok = list.filter((f) => f.type.startsWith('image/') && f.size <= MAX_IMG)
    if (ok.length < list.length) setError('10MB를 넘는 이미지는 제외되었습니다.')
    setImages((prev) => [...prev, ...ok])
  }

  function handlePaste(e) {
    const files = [...(e.clipboardData?.files ?? [])]
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    e.preventDefault()
    addImages(imgs)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')

    if (!title.trim() || !body.trim()) {
      setError('제목과 내용을 입력하세요.')
      return
    }

    setBusy(true)

    const { data: created, error: insErr } = await supabase
      .from('questions')
      .insert({
        module_id: activeModule,
        author_id: profile.id,
        title: title.trim(),
        body: body.trim(),
      })
      .select('id')
      .single()

    if (insErr) {
      setBusy(false)
      setError(`등록 실패: ${insErr.message}`)
      return
    }

    for (const file of images) {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${created.id}/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('question-images')
        .upload(path, file)

      if (upErr) {
        setBusy(false)
        setError(`이미지 업로드 실패: ${upErr.message}`)
        return
      }

      await supabase.from('question_images').insert({
        question_id: created.id,
        author_id: profile.id,
        storage_path: path,
        file_name: file.name || '캡처.png',
        size_bytes: file.size,
      })
    }

    setBusy(false)
    setTitle('')
    setBody('')
    setImages([])
    setShowForm(false)
    await load()
  }

  let visible = items.filter((q) => {
    if (onlyOpen && q.is_resolved) return false

    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase()
      const author = members.get(q.author_id)?.nickname ?? ''
      const hay = `${q.title} ${q.body} ${author}`.toLowerCase()
      if (!hay.includes(k)) return false
    }
    return true
  })

  visible = [...visible].sort((a, b) => {
    if (sortBy === 'views') return b.view_count - a.view_count
    if (sortBy === 'comments') {
      return (b.comments?.[0]?.count ?? 0) - (a.comments?.[0]?.count ?? 0)
    }
    if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
    return new Date(b.created_at) - new Date(a.created_at)
  })

  if (modules.length === 0) {
    return (
      <div className="page-head">
        <span className="eyebrow">질문 게시판</span>
        <h1 className="page-title">배정된 모듈이 없습니다</h1>
        <p className="page-sub">담당 선생님께 문의해 주세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">질문 게시판</span>
        {profile?.role === 'student' ? (
          <>
            <h1 className="page-title">{current?.order_no}모듈 · {current?.name}</h1>
            <p className="page-sub">같은 모듈 교육생과 강사가 함께 봅니다.</p>
          </>
        ) : (
          <>
            <h1 className="page-title">질문 게시판</h1>
            <p className="page-sub">모듈을 선택해 질문을 확인합니다.</p>
          </>
        )}
      </div>

      {modules.length > 1 && (
        <div className="tabs">
          {modules.map((m) => (
            <button
              key={m.id}
              className={m.id === activeModule ? 'tab tab-on' : 'tab'}
              onClick={() => setActiveModule(m.id)}
            >
              {m.order_no}모듈 · {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="filters">
        <input
          className="input"
          type="search"
          placeholder="제목·내용·작성자 검색"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="recent">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="views">조회순</option>
          <option value="comments">댓글순</option>
        </select>

        <button
          className={onlyOpen ? 'btn tab-on' : 'btn'}
          onClick={() => setOnlyOpen((v) => !v)}
        >
          미해결만
        </button>
      </div>

      <div className="quick">
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '취소' : '＋ 질문하기'}
        </button>
      </div>

      {showForm && (
        <form className="tile form-block" onSubmit={handleCreate}>
          <div className="field">
            <label className="field-label" htmlFor="title">제목</label>
            <input
              id="title"
              className="input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="어떤 점이 궁금하신가요?"
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="body">내용</label>
            <textarea
              id="body"
              className="input"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onPaste={handlePaste}
              placeholder="에러 메시지나 코드를 함께 적어주세요. 캡처는 Ctrl+V로 바로 붙여넣을 수 있습니다."
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="images">이미지 첨부</label>
            <input
              id="images"
              className="input"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => { addImages([...e.target.files]); e.target.value = '' }}
            />
            <p className="note">
              캡처는 <b>Ctrl+V</b>로 내용 칸에 바로 붙여넣기 · 장당 10MB 이하
            </p>
          </div>

          {images.length > 0 && (
            <div className="chips">
              {images.map((f, i) => (
                <span className="chip" key={i}>
                  {f.name || '캡처 이미지'}
                  <button
                    className="chip-x"
                    type="button"
                    onClick={() => setImages(images.filter((_, x) => x !== i))}
                    aria-label="첨부 제거"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? '등록 중…' : '등록'}
          </button>
        </form>
      )}

      {error && <p className="alert">{error}</p>}

      {loading ? (
        <p className="page-sub">불러오는 중…</p>
      ) : visible.length === 0 ? (
        <p className="page-sub">
          {keyword.trim()
            ? '검색 결과가 없습니다.'
            : onlyOpen
              ? '미해결 질문이 없습니다.'
              : '아직 등록된 질문이 없습니다.'}
        </p>
      ) : (
        <div className="stack-list">
          {visible.map((q) => (
            <Link className="tile tile-link" key={q.id} to={`/questions/${q.id}`}>
              <div className="tile-head">
                <h2 className="tile-title">{q.title}</h2>
                <span className={q.is_resolved ? 'badge badge-done' : 'badge badge-act'}>
                  {q.is_resolved ? '해결' : '미해결'}
                </span>
              </div>
              <p className="tile-foot">
                {members.get(q.author_id)?.nickname ?? '탈퇴한 회원'}
                {' · '}댓글 {q.comments?.[0]?.count ?? 0}
                {' · '}조회 {q.view_count}
                {' · '}{new Date(q.created_at).toLocaleDateString('ko-KR')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}