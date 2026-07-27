import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) return <div className="auth"><p>불러오는 중…</p></div>
  if (!session) return <Navigate to="/login" replace />

  if (!profile) {
    return (
      <div className="auth">
        <div className="auth-card">
          <h1 className="auth-title">프로필을 찾을 수 없습니다</h1>
          <p className="auth-sub">담당 선생님께 문의해 주세요.</p>
          <button className="btn btn-block" onClick={signOut}>로그아웃</button>
        </div>
      </div>
    )
  }

  if (profile.status === 'rejected') {
    return (
      <div className="auth">
        <div className="auth-card">
          <span className="auth-eyebrow">이용 제한</span>
          <h1 className="auth-title">이용이 제한된 계정입니다</h1>
          <p className="auth-sub">담당 선생님께 문의해 주세요.</p>
          <button className="btn btn-block" onClick={signOut}>로그아웃</button>
        </div>
      </div>
    )
  }

  return <Outlet />
}