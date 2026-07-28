import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { profile, isStaff, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // 페이지가 바뀌면 메뉴를 닫는다
  useEffect(() => { setOpen(false) }, [location.pathname])

  return (
    <div className="shell">
      <header className="topbar">
        <button
          className="menu-btn"
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="메뉴"
          aria-expanded={open}
        >
          {open ? '✕' : '☰'}
        </button>

        <Link to="/" className="brand">AI 데이터분석 커뮤니티</Link>

        <nav className={open ? 'nav nav-open' : 'nav'}>
          <NavLink to="/" end>홈</NavLink>
          <NavLink to="/materials">수업 자료</NavLink>
          <NavLink to="/questions">질문 게시판</NavLink>
          <NavLink to="/jobs">취업 정보</NavLink>
          <NavLink to="/events">일정</NavLink>
          {isStaff && <NavLink to="/members">회원 관리</NavLink>}
          {isStaff && <NavLink to="/modules">강사 배정</NavLink>}

          <div className="nav-foot">
            <NavLink to="/mypage">내 정보</NavLink>
            <button className="btn btn-sm" onClick={signOut}>로그아웃</button>
          </div>
        </nav>

        <div className="topbar-right">
          <NavLink to="/mypage" className="topbar-name">{profile?.name}</NavLink>
          <button className="btn btn-sm" onClick={signOut}>로그아웃</button>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}