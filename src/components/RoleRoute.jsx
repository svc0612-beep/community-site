import { Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RoleRoute({ allow = [] }) {
  const { profile } = useAuth()

  if (!allow.includes(profile?.role)) {
    return (
      <div className="page-head">
        <h1 className="page-title">접근 권한이 없습니다</h1>
        <p className="page-sub">이 페이지는 운영진만 볼 수 있습니다.</p>
      </div>
    )
  }

  return <Outlet />
}