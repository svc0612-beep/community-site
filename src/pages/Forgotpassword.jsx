import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const navigate = useNavigate()

  const [step, setStep] = useState('verify')
  const [token, setToken] = useState('')

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleVerify(e) {
    e.preventDefault()
    setMessage('')
    setBusy(true)

    const { data, error } = await supabase.rpc('verify_reset_identity', {
      p_email: email,
      p_phone: phone,
    })

    setBusy(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setToken(data)
    setStep('reset')
  }

  async function handleReset(e) {
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

    const { error } = await supabase.rpc('reset_password_with_token', {
      p_token: token,
      p_new_password: password,
    })

    setBusy(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setStep('done')
    setTimeout(() => navigate('/login'), 1500)
  }

  if (step === 'done') {
    return (
      <div className="auth">
        <div className="auth-card">
          <span className="auth-eyebrow">완료</span>
          <h1 className="auth-title">비밀번호가 변경되었습니다</h1>
          <p className="auth-sub">로그인 화면으로 이동합니다…</p>
        </div>
      </div>
    )
  }

  if (step === 'reset') {
    return (
      <div className="auth">
        <form className="auth-card" onSubmit={handleReset}>
          <span className="auth-eyebrow">2단계 · 비밀번호 재설정</span>
          <h1 className="auth-title">새 비밀번호 설정</h1>
          <p className="auth-sub">본인 확인이 완료되었습니다.</p>

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

          <p className="note" style={{ marginTop: 12 }}>
            10분 안에 완료해 주세요. 시간이 지나면 처음부터 다시 진행해야 합니다.
          </p>
        </form>
      </div>
    )
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={handleVerify}>
        <span className="auth-eyebrow">1단계 · 본인 확인</span>
        <h1 className="auth-title">비밀번호를 잊으셨나요?</h1>
        <p className="auth-sub">가입할 때 입력한 이메일과 휴대폰번호를 입력해 주세요.</p>

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
          <label className="field-label" htmlFor="phone">휴대폰번호</label>
          <input
            id="phone"
            className="input"
            type="tel"
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <p className="note">하이픈은 넣어도 되고 빼도 됩니다.</p>
        </div>

        {message && <p className="alert">{message}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? '확인 중…' : '본인 확인'}
        </button>

        <p className="auth-foot">
          <Link to="/login">로그인으로 돌아가기</Link>
        </p>
      </form>
    </div>
  )
}