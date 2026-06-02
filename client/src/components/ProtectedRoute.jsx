import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spin } from 'antd';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Nếu đã login nhưng không đúng role, redirect về trang chủ tương ứng
    if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user?.role === 'TECHNICIAN') return <Navigate to="/technician" replace />;
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
