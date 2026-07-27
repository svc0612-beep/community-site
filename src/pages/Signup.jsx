import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [emailCheck, setEmailCheck] = useState('idle')
  const [nickCheck, setNickCheck] = useState('idle')
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirm: '',
    name: '',
    nickname: '',
    phone: '',
    programId: '',
    cohortId: '',
  })
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('programs')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        const list = data ?? []
        setPrograms(list)
        if (list.length === 1) {
          setForm((prev) => ({ ...prev, programId: list[0].id }))
        }
      })
  }, [])

  useEffect(() => {
    if (!form.programId) {
      setCohorts([])
      return
    }

    const today = new Date().toISOString().slice(0, 10)

    supabase
      .from('cohorts')
      .select('id, name')
      .eq('program_id', form.programId)
      .eq('is_active', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .then(({ data }) => setCohorts(data ?? []))
  }, [form.programId])

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'email') setEmailCheck('idle')
    if (key === 'nickname') setNickCheck('idle')
  }

  function setProgram(value) {
    setForm((prev) => ({ ...prev, programId: value, cohortId: '' }))
  }

  async function checkEmail() {
    if (!form.email.trim()) return

    setEmailCheck('checking')
    const { data, error } = await supabase.rpc('email_exists', {
      check_email: form.email,
    })

    if (error) {
      setMessage(`확인 실패: ${error.message}`)
      setEmailCheck('idle')
      return
    }
    setEmailCheck(data ? 'taken' : 'available')
  }

  async function checkNickname() {
    const value = form.nickname.trim()

    if (value.length < 2 || value.length > 12) {
      setNickCheck('length')
      return
    }

    setNickCheck('checking')
    const { data, error } = await supabase.rpc('nickname_exists', {
      check_nickname: value,
    })

    if (error) {
      setMessage(`확인 실패: ${error.message}`)
      setNickCheck('idle')
      return
    }
    setNickCheck(data ? 'taken' : 'available')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    if (emailCheck !== 'available') {
      setMessage('이메일 중복확인을 해주세요.')
      return
    }
    if (nickCheck !== 'available') {
      setMessage('닉네임 중복확인을 해주세요.')
      return
    }
    if (form.password.length < 8) {
      setMessage('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (form.password !== form.confirm) {
      setMessage('비밀번호가 서로 다릅니다.')
      return
    }
    if (!form.cohortId) {
      setMessage('과정과 기수를 선택하세요.')
      return
    }

    setBusy(true)

    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          name: form.name.trim(),
          nickname: form.nickname.trim(),
          phone: form.phone.trim(),
          cohort_id: form.cohortId,
        },
      },
    })

    if (error) {
      setBusy(false)
      setMessage(`에러: ${error.message}`)
      return
    }

    await supabase.auth.signOut()

    setDone(true)
    setMessage('가입이 완료되었습니다. 로그인 화면으로 이동합니다…')
    setTimeout(() => navigate('/login'), 1500)
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={handleSubmit}>
        <button className="btn-back" type="button" onClick={() => navigate(-1)}>
          ← 뒤로
        </button>

        <span className="auth-eyebrow">가입 신청</span>
        <h1 className="auth-title">교육생 계정 만들기</h1>
        <p className="auth-sub">출석부에 적힌 실명으로 입력해 주세요.</p>

        <div className="field">
          <label className="field-label" htmlFor="email">이메일</label>
          <div className="inline">
            <input
              id="email"
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="email"
              required
            />
            <button className="btn" type="button" onClick={checkEmail}>
              중복확인
            </button>
          </div>
          {emailCheck === 'checking' && <p className="note">확인 중…</p>}
          {emailCheck === 'available' && <p className="note note-ok">사용 가능한 이메일입니다.</p>}
          {emailCheck === 'taken' && <p className="note note-err">이미 가입된 이메일입니다.</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="name">이름</label>
          <input
            id="name"
            className="input"
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            autoComplete="name"
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="nickname">닉네임</label>
          <div className="inline">
            <input
              id="nickname"
              className="input"
              type="text"
              value={form.nickname}
              onChange={(e) => set('nickname', e.target.value)}
              maxLength={12}
              required
            />
            <button className="btn" type="button" onClick={checkNickname}>
              중복확인
            </button>
          </div>
          {nickCheck === 'idle' && <p className="note">게시판에 표시되는 이름입니다. 2~12자</p>}
          {nickCheck === 'length' && <p className="note note-err">2자 이상 12자 이하로 입력하세요.</p>}
          {nickCheck === 'checking' && <p className="note">확인 중…</p>}
          {nickCheck === 'available' && <p className="note note-ok">사용 가능한 닉네임입니다.</p>}
          {nickCheck === 'taken' && <p className="note note-err">이미 사용 중인 닉네임입니다.</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="phone">휴대폰번호</label>
          <input
            id="phone"
            className="input"
            type="tel"
            placeholder="010-0000-0000"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            required
          />
          <p className="note">비밀번호를 잊었을 때 본인 확인에 사용됩니다.</p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="program">훈련 과정</label>
          <select
            id="program"
            className="select"
            value={form.programId}
            onChange={(e) => setProgram(e.target.value)}
            required
          >
            <option value="">선택하세요</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cohort">기수</label>
          <select
            id="cohort"
            className="select"
            value={form.cohortId}
            onChange={(e) => set('cohortId', e.target.value)}
            disabled={!form.programId}
            required
          >
            <option value="">
              {form.programId ? '선택하세요' : '과정을 먼저 선택하세요'}
            </option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {form.programId && cohorts.length === 0 && (
            <p className="note note-err">현재 모집 중인 기수가 없습니다.</p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">비밀번호</label>
          <input
            id="password"
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            autoComplete="new-password"
            required
          />
          <p className="note">8자 이상</p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="confirm">비밀번호 확인</label>
          <input
            id="confirm"
            className="input"
            type="password"
            value={form.confirm}
            onChange={(e) => set('confirm', e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {message && (
          <p className={done ? 'alert alert-ok' : 'alert'}>{message}</p>
        )}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy || done}>
          {busy ? '처리 중…' : '가입하기'}
        </button>

        <p className="auth-foot">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </form>
    </div>
  )
}