import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ROLE = {
  admin: 'AI 팀장',
  manager: '담당 선생님',
  instructor: '강사',
  student: '교육생',
}

export default function Members() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [cohortFilter, setCohortFilter] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')

  const isAdmin = profile?.role === 'admin'
  const canAssign = isAdmin
    ? ['student', 'instructor', 'manager', 'admin']
    : ['student', 'instructor']

  const load = useCallback(async () => {
    setLoading(true)

    const [res, mod] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, nickname, email, phone, role, status, cohort:cohorts(id, name), module:modules(id, order_no, name)')
        .order('created_at', { ascending: false }),
      supabase.from('modules').select('id, order_no, name').order('order_no'),
    ])

    if (res.error) setError(res.error.message)
    else setRows(res.data ?? [])

    setModules(mod.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const cohortOptions = useMemo(() => {
    const map = new Map()
    rows.forEach((r) => { if (r.cohort) map.set(r.cohort.id, r.cohort.name) })
    return [...map.entries()]
  }, [rows])

  const visible = rows.filter((r) => {
    if (roleFilter && r.role !== roleFilter) return false
    if (cohortFilter && r.cohort?.id !== cohortFilter) return false
    if (moduleFilter && r.module?.id !== moduleFilter) return false

    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase()
      const hay = `${r.name ?? ''}${r.nickname ?? ''}${r.email ?? ''}`.toLowerCase()
      if (!hay.includes(k)) return false
    }
    return true
  })

  async function update(id, patch) {
    setBusyId(id)
    setError('')

    const { error } = await supabase.from('profiles').update(patch).eq('id', id)

    setBusyId(null)

    if (error) {
      setError(error.message)
      return
    }
    await load()
  }

  function toggleBan(row) {
    const next = row.status === 'rejected' ? 'approved' : 'rejected'

    if (next === 'rejected' && !confirm(`${row.name}님의 이용을 제한할까요?\n작성한 글은 그대로 남습니다.`)) {
      return
    }
    update(row.id, { status: next })
  }

  if (loading) return <p className="page-sub">불러오는 중…</p>

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">회원 관리</span>
        <h1 className="page-title">회원 {visible.length}명</h1>
        <p className="page-sub">
          {isAdmin
            ? '모든 회원의 등급·모듈·이용 상태를 관리할 수 있습니다.'
            : '강사와 교육생을 관리할 수 있습니다.'}
        </p>
      </div>

      <div className="filters">
        <input
          className="input"
          type="search"
          placeholder="이름·닉네임·이메일 검색"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">전체 등급</option>
          {Object.entries(ROLE).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select className="select" value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)}>
          <option value="">전체 기수</option>
          {cohortOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <select className="select" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          <option value="">전체 모듈</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.order_no}모듈</option>
          ))}
        </select>
      </div>

      {error && <p className="alert">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>이름</th>
              <th>닉네임</th>
              <th>이메일</th>
              <th>기수</th>
              <th>모듈</th>
              <th>등급</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const isMe = r.id === profile?.id
              const banned = r.status === 'rejected'

              return (
                <tr key={r.id} className={banned ? 'row-off' : ''}>
                  <td>{r.name}</td>
                  <td>{r.nickname}</td>
                  <td className="muted">{r.email}</td>
                  <td>{r.cohort?.name ?? '-'}</td>
                  <td>
                    {r.role === 'student' ? (
                      <select
                        className="select select-sm"
                        value={r.module?.id ?? ''}
                        disabled={busyId === r.id}
                        onChange={(e) => update(r.id, { module_id: e.target.value || null })}
                      >
                        <option value="">미배정</option>
                        {modules.map((m) => (
                          <option key={m.id} value={m.id}>{m.order_no}모듈</option>
                        ))}
                      </select>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    {isMe ? (
                      <span className="tag">{ROLE[r.role]} (본인)</span>
                    ) : (
                      <select
                        className="select select-sm"
                        value={r.role}
                        disabled={busyId === r.id || !canAssign.includes(r.role)}
                        onChange={(e) => update(r.id, { role: e.target.value })}
                      >
                        {canAssign.map((k) => (
                          <option key={k} value={k}>{ROLE[k]}</option>
                        ))}
                        {!canAssign.includes(r.role) && (
                          <option value={r.role}>{ROLE[r.role]}</option>
                        )}
                      </select>
                    )}
                  </td>
                  <td>
                    {isMe ? (
                      <span className="muted">-</span>
                    ) : (
                      <button
                        className={banned ? 'btn btn-sm' : 'btn btn-sm btn-danger'}
                        disabled={busyId === r.id}
                        onClick={() => toggleBan(r)}
                      >
                        {banned ? '차단 해제' : '차단'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {visible.length === 0 && <p className="page-sub">조건에 맞는 회원이 없습니다.</p>}
      </div>
    </>
  )
}