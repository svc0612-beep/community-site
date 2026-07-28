import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    setBusy(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setBusy(false)

    if (error) {
      setMessage('이메일 또는 비밀번호가 맞지 않습니다.')
      return
    }
    navigate('/')
  }

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="auth-eyebrow">경기남부직업능력개발원</span>
        <h1 className="auth-title">AI 데이터분석 커뮤니티</h1>
        <p className="auth-sub">교육생 계정으로 로그인하세요.</p>

        <div className="field">
          <label className="field-label" htmlFor="email">이메일</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">비밀번호</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {message && <p className="alert">{message}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>

        <div className="auth-foot">
          <Link to="/forgot-password">비밀번호 찾기</Link>
          {' · '}
          <Link to="/signup">가입하기</Link>
          <p className="note">
            가입한 이메일이 기억나지 않으면 담당 선생님께 문의해 주세요.
          </p>
        </div>
      </form>
    </div>
  )
}