import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Modules() {
  const [modules, setModules] = useState([])
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    const [mod, ins] = await Promise.all([
      supabase
        .from('modules')
        .select('id, order_no, name, module_instructors(id, is_active, instructor:profiles(id, name, nickname))')
        .order('order_no'),
      supabase
        .from('profiles')
        .select('id, name, nickname')
        .eq('role', 'instructor')
        .order('name'),
    ])

    if (mod.error) setError(mod.error.message)
    else setModules(mod.data ?? [])

    setInstructors(ins.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function assign(moduleId, instructorId) {
    if (!instructorId) return

    setBusy(true)
    setError('')

    const { error } = await supabase
      .from('module_instructors')
      .upsert(
        { module_id: moduleId, instructor_id: instructorId, is_active: true },
        { onConflict: 'module_id,instructor_id' }
      )

    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    await load()
  }

  async function unassign(rowId) {
    setBusy(true)
    setError('')

    const { error } = await supabase
      .from('module_instructors')
      .update({ is_active: false })
      .eq('id', rowId)

    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    await load()
  }

  if (loading) return <p className="page-sub">불러오는 중…</p>

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">강사 배정</span>
        <h1 className="page-title">모듈별 담당 강사</h1>
        <p className="page-sub">
          모듈마다 담당 강사를 지정합니다. 기수와 무관하게 모듈 단위로 배정됩니다.
        </p>
      </div>

      {error && <p className="alert">{error}</p>}

      {instructors.length === 0 && (
        <p className="alert">
          강사 등급인 회원이 없습니다. 회원 관리에서 먼저 강사로 지정해 주세요.
        </p>
      )}

      <div className="stack-list">
        {modules.map((m) => {
          const active = (m.module_instructors ?? []).filter((r) => r.is_active)
          const assignedIds = active.map((r) => r.instructor?.id)

          return (
            <div className="tile" key={m.id}>
              <div className="tile-head">
                <h2 className="tile-title">{m.order_no}모듈 · {m.name}</h2>
                <span className="badge">{active.length}명</span>
              </div>

              <div className="chips">
                {active.length === 0 && <span className="muted">배정된 강사 없음</span>}

                {active.map((r) => (
                  <span className="chip" key={r.id}>
                    {r.instructor?.name}
                    <button
                      className="chip-x"
                      type="button"
                      disabled={busy}
                      onClick={() => unassign(r.id)}
                      aria-label="배정 해제"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <select
                className="select select-sm"
                value=""
                disabled={busy}
                onChange={(e) => assign(m.id, e.target.value)}
              >
                <option value="">＋ 강사 추가</option>
                {instructors
                  .filter((i) => !assignedIds.includes(i.id))
                  .map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.nickname})</option>
                  ))}
              </select>
            </div>
          )
        })}
      </div>
    </>
  )
}