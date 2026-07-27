import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ROLE = {
  admin: 'AI 팀장',
  manager: '담당 선생님',
  instructor: '강사',
  student: '교육생',
}

export default function MyPage() {
  const { profile, session, signOut } = useAuth()

  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [nickCheck, setNickCheck] = useState('same')
  const [infoMsg, setInfoMsg] = useState('')
  const [infoErr, setInfoErr] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    if (!profile) return
    setNickname(profile.nickname ?? '')
    setPhone(profile.phone ?? '')
  }, [profile])

  function changeNickname(value) {
    setNickname(value)
    setInfoMsg('')
    setNickCheck(value.trim() === (profile?.nickname ?? '') ? 'same' : 'idle')
  }

  async function checkNickname() {
    const value = nickname.trim()

    if (value.length < 2 || value.length > 12) {
      setNickCheck('length')
      return
    }

    setNickCheck('checking')

    const { data, error } = await supabase.rpc('nickname_exists', {
      check_nickname: value,
    })

    if (error) {
      setInfoErr('확인 실패: ' + error.message)
      setNickCheck('idle')
      return
    }
    setNickCheck(data ? 'taken' : 'available')
  }

  async function saveInfo(e) {
    e.preventDefault()
    setInfoErr('')
    setInfoMsg('')

    if (nickCheck !== 'same' && nickCheck !== 'available') {
      setInfoErr('닉네임 중복확인을 해주세요.')
      return
    }

    setSavingInfo(true)

    const { error } = await supabase
      .from('profiles')
      .update({ nickname: nickname.trim(), phone: phone.trim() })
      .eq('id', profile.id)

    setSavingInfo(false)

    if (error) {
      setInfoErr('저장 실패: ' + error.message)
      return
    }

    setNickCheck('same')
    setInfoMsg('저장되었습니다. 화면에 반영하려면 새로고침하세요.')
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwErr('')
    setPwMsg('')

    if (password.length < 8) {
      setPwErr('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setPwErr('비밀번호가 서로 다릅니다.')
      return
    }

    setSavingPw(true)

    const { error } = await supabase.auth.updateUser({ password })

    setSavingPw(false)

    if (error) {
      setPwErr('변경 실패: ' + error.message)
      return
    }

    setPassword('')
    setConfirm('')
    setPwMsg('비밀번호가 변경되었습니다.')
  }

  if (!profile) return <p className="page-sub">불러오는 중…</p>

  const belong = profile.cohort
    ? `${profile.cohort.program?.name ?? ''} ${profile.cohort.name}`.trim()
    : '소속 미지정'

  const moduleLabel = profile.module
    ? `${profile.module.order_no}모듈 · ${profile.module.name}`
    : '미배정'

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">내 정보</span>
        <h1 className="page-title">{profile.name}님</h1>
        <p className="page-sub">{ROLE[profile.role]} · {belong}</p>
      </div>

      <div className="tile">
        <dl className="summary">
          <dt>이메일</dt>
          <dd>{session?.user?.email}</dd>
          <dt>이름</dt>
          <dd>{profile.name}</dd>
          <dt>소속</dt>
          <dd>{belong}</dd>
          {profile.role === 'student' && (
            <>
              <dt>모듈</dt>
              <dd>{moduleLabel}</dd>
            </>
          )}
          <dt>등급</dt>
          <dd>{ROLE[profile.role]}</dd>
        </dl>
        <p className="note">
          이름·소속·모듈·등급은 담당 선생님만 변경할 수 있습니다.
        </p>
      </div>

      <h2 className="section-title">정보 수정</h2>

      <form className="tile form-block" onSubmit={saveInfo}>
        <div className="field">
          <label className="field-label" htmlFor="nickname">닉네임</label>
          <div className="inline">
            <input
              id="nickname"
              className="input"
              value={nickname}
              onChange={(e) => changeNickname(e.target.value)}
              maxLength={12}
              required
            />
            <button
              className="btn"
              type="button"
              onClick={checkNickname}
              disabled={nickCheck === 'same'}
            >
              중복확인
            </button>
          </div>
          {nickCheck === 'idle' && <p className="note">변경하려면 중복확인을 해주세요. 2~12자</p>}
          {nickCheck === 'length' && <p className="note note-err">2자 이상 12자 이하로 입력하세요.</p>}
          {nickCheck === 'checking' && <p className="note">확인 중…</p>}
          {nickCheck === 'available' && <p className="note note-ok">사용 가능한 닉네임입니다.</p>}
          {nickCheck === 'taken' && <p className="note note-err">이미 사용 중인 닉네임입니다.</p>}
          {nickCheck === 'same' && <p className="note">게시판에 표시되는 이름입니다.</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="phone">휴대폰번호</label>
          <input
            id="phone"
            className="input"
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setInfoMsg('') }}
            placeholder="010-0000-0000"
            required
          />
          <p className="note">비밀번호를 잊었을 때 본인 확인에 사용됩니다.</p>
        </div>

        {infoErr && <p className="alert">{infoErr}</p>}
        {infoMsg && <p className="alert alert-ok">{infoMsg}</p>}

        <button className="btn btn-primary" type="submit" disabled={savingInfo}>
          {savingInfo ? '저장 중…' : '저장'}
        </button>
      </form>

      <h2 className="section-title">비밀번호 변경</h2>

      <form className="tile form-block" onSubmit={changePassword}>
        <div className="field">
          <label className="field-label" htmlFor="pw">새 비밀번호</label>
          <input
            id="pw"
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
          <label className="field-label" htmlFor="pw2">새 비밀번호 확인</label>
          <input
            id="pw2"
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {pwErr && <p className="alert">{pwErr}</p>}
        {pwMsg && <p className="alert alert-ok">{pwMsg}</p>}

        <button className="btn btn-primary" type="submit" disabled={savingPw}>
          {savingPw ? '변경 중…' : '비밀번호 변경'}
        </button>
      </form>

      <h2 className="section-title">계정</h2>

      <div className="tile">
        <button className="btn" onClick={signOut}>로그아웃</button>
      </div>
    </>
  )
}