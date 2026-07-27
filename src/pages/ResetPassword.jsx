import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true)
    })

    const code = new URLSearchParams(window.location.search).get('code')

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setExpired(true)
      })
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true)
        else setTimeout(() => setExpired(true), 2000)
      })
    }

    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    if (password.length < 8) {
      setMessage('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setMessage('비밀번호가 서로 다릅니다.')
      return
    }

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (error) {
      setMessage(`변경 실패: ${error.message}`)
      return
    }

    await supabase.auth.signOut()
    navigate('/login')
  }

  if (expired) {
    return (
      <div className="auth">
        <div className="auth-card">
          <span className="auth-eyebrow">링크 오류</span>
          <h1 className="auth-title">링크가 만료되었습니다</h1>
          <p className="auth-sub">
            링크는 1시간 동안만 쓸 수 있고, 한 번 사용하면 무효가 됩니다.
          </p>
          <p className="auth-foot">
            <Link to="/forgot-password">다시 요청하기</Link>
          </p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="auth">
        <div className="auth-card">
          <p className="auth-sub" style={{ margin: 0 }}>확인 중…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="auth-eyebrow">비밀번호 재설정</span>
        <h1 className="auth-title">새 비밀번호 설정</h1>
        <p className="auth-sub">변경 후 다시 로그인해 주세요.</p>

        <div className="field">
          <label className="field-label" htmlFor="password">새 비밀번호</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <p className="note">8자 이상</p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="confirm">새 비밀번호 확인</label>
          <input
            id="confirm"
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {message && <p className="alert">{message}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? '변경 중…' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  )
}