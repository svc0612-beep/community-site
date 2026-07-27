import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const MAX_SIZE = 50 * 1024 * 1024

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function Materials() {
  const { profile } = useAuth()

  const [modules, setModules] = useState([])
  const [activeModule, setActiveModule] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])

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

      if (profile?.module) {
        setModules([profile.module])
        setActiveModule(profile.module.id)
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

    const { data, error } = await supabase
      .from('materials')
      .select('id, title, description, created_at, author_id, author:profiles(nickname), files:material_files(id, file_name, storage_path, size_bytes)')
      .eq('module_id', activeModule)
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setItems(data ?? [])

    setLoading(false)
  }, [activeModule])

  useEffect(() => { load() }, [load])

  const canUpload = isStaff || (profile?.role === 'instructor' && modules.length > 0)

  async function handleUpload(e) {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('제목을 입력하세요.')
      return
    }
    if (files.length === 0) {
      setError('파일을 선택하세요.')
      return
    }
    if (files.some((f) => f.size > MAX_SIZE)) {
      setError('50MB를 넘는 파일이 있습니다.')
      return
    }

    setBusy(true)

    const { data: material, error: insErr } = await supabase
      .from('materials')
      .insert({
        module_id: activeModule,
        author_id: profile.id,
        title: title.trim(),
        description: description.trim() || null,
      })
      .select('id')
      .single()

    if (insErr) {
      setBusy(false)
      setError(`자료 등록 실패: ${insErr.message}`)
      return
    }

    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${activeModule}/${material.id}/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('materials')
        .upload(path, file)

      if (upErr) {
        setBusy(false)
        setError(`파일 업로드 실패: ${upErr.message}`)
        return
      }

      await supabase.from('material_files').insert({
        material_id: material.id,
        file_name: file.name,
        storage_path: path,
        size_bytes: file.size,
        mime_type: file.type || null,
      })
    }

    setBusy(false)
    setTitle('')
    setDescription('')
    setFiles([])
    setShowForm(false)
    await load()
  }

  async function download(file) {
    const { data, error } = await supabase.storage
      .from('materials')
      .createSignedUrl(file.storage_path, 60)

    if (error) {
      setError(`다운로드 실패: ${error.message}`)
      return
    }

    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = file.file_name
    a.click()
  }

  async function remove(item) {
    if (!confirm(`"${item.title}" 자료를 삭제할까요?\n첨부 파일도 함께 삭제됩니다.`)) return

    setBusy(true)
    setError('')

    const paths = (item.files ?? []).map((f) => f.storage_path)
    if (paths.length > 0) {
      await supabase.storage.from('materials').remove(paths)
    }

    const { error } = await supabase.from('materials').delete().eq('id', item.id)

    setBusy(false)

    if (error) {
      setError(`삭제 실패: ${error.message}`)
      return
    }
    await load()
  }

  if (modules.length === 0) {
    return (
      <div className="page-head">
        <span className="eyebrow">수업 자료</span>
        <h1 className="page-title">배정된 모듈이 없습니다</h1>
        <p className="page-sub">담당 선생님께 문의해 주세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">수업 자료</span>

        {profile?.role === 'student' ? (
          <>
            <h1 className="page-title">
              {current?.order_no}모듈 · {current?.name}
            </h1>
            <p className="page-sub">
              현재 배정된 모듈의 강의 자료입니다.
            </p>
          </>
        ) : (
          <>
            <h1 className="page-title">강의 자료</h1>
            <p className="page-sub">모듈을 선택해 자료를 관리합니다.</p>
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

      {canUpload && (
        <div className="quick">
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? '취소' : '＋ 자료 올리기'}
          </button>
        </div>
      )}

      {showForm && (
        <form className="tile form-block" onSubmit={handleUpload}>
          <p className="note">
            {current?.order_no}모듈 · {current?.name} 에 등록됩니다.
          </p>

          <div className="field">
            <label className="field-label" htmlFor="title">제목</label>
            <input
              id="title"
              className="input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="desc">설명</label>
            <textarea
              id="desc"
              className="input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="files">파일</label>
            <input
              id="files"
              className="input"
              type="file"
              multiple
              onChange={(e) => setFiles([...e.target.files])}
            />
            <p className="note">PDF, PPT, Word, Excel, 이미지 · 파일당 50MB 이하</p>
          </div>

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? '올리는 중…' : '올리기'}
          </button>
        </form>
      )}

      {error && <p className="alert">{error}</p>}

      {loading ? (
        <p className="page-sub">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="page-sub">아직 등록된 자료가 없습니다.</p>
      ) : (
        <div className="stack-list">
          {items.map((item) => {
            const mine = item.author_id === profile?.id
            const canDelete = mine || isStaff

            return (
              <div className="tile" key={item.id}>
                <div className="tile-head">
                  <h2 className="tile-title">{item.title}</h2>
                  {canDelete && (
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={busy}
                      onClick={() => remove(item)}
                    >
                      삭제
                    </button>
                  )}
                </div>

                {item.description && <p className="tile-desc">{item.description}</p>}

                <div className="file-list">
                  {(item.files ?? []).map((f) => (
                    <button
                      key={f.id}
                      className="file-row"
                      type="button"
                      onClick={() => download(f)}
                    >
                      <span className="file-name">{f.file_name}</span>
                      <span className="muted">{formatSize(f.size_bytes)}</span>
                    </button>
                  ))}
                </div>

                <p className="tile-foot">
                  {item.author?.nickname ?? '알 수 없음'} ·{' '}
                  {new Date(item.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}