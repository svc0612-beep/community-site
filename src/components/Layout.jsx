import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { profile, isStaff, signOut } = useAuth()

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">AI 데이터분석 커뮤니티</Link>

        <nav className="nav">
          <NavLink to="/" end>홈</NavLink>
          <NavLink to="/materials">수업 자료</NavLink>
          <NavLink to="/questions">질문 게시판</NavLink>
          <NavLink to="/jobs">취업 정보</NavLink>
          <NavLink to="/events">일정</NavLink>
          {isStaff && <NavLink to="/members">회원 관리</NavLink>}
          {isStaff && <NavLink to="/modules">강사 배정</NavLink>}
        </nav>

        <div className="topbar-right">
          <NavLink to="/mypage" className="topbar-name">
            {profile?.name}
          </NavLink>
          <button className="btn btn-sm" onClick={signOut}>로그아웃</button>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}