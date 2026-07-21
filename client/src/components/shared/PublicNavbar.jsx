import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button, Dropdown } from 'antd';
import { UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons';
import NotificationBell from './NotificationBell';

export default function PublicNavbar() {
  const { user, isAuthenticated, logout, isCustomer, isTechnician, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardLink = () => {
    if (isAdmin) return '/admin';
    if (isTechnician) return '/technician';
    return '/customer';
  };

  const userMenuItems = [
    {
      key: 'dashboard',
      icon: isCustomer ? <UserOutlined /> : <SettingOutlined />,
      label: <Link to={getDashboardLink()}>{isCustomer ? 'Tài khoản của tôi' : 'Bảng điều khiển'}</Link>,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <nav className="homefix-navbar">
      <Link to="/" className="logo" style={{ display: 'flex', alignItems: 'center' }}>
        <img src="/logo.png" alt="HomeFix Logo" style={{ height: 40, objectFit: 'contain' }} />
      </Link>
      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 15 }}>Trang chủ</Link>
        <Link to="/services" style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 15 }}>Dịch vụ</Link>
        <Link to="/blogs" style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 15 }}>Tin tức</Link>
        {isAuthenticated ? (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <NotificationBell />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button type="text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserOutlined /> {user?.full_name}
              </Button>
            </Dropdown>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link to="/login">
              <Button type="default">Đăng nhập</Button>
            </Link>
            <Link to="/register">
              <Button type="primary">Đăng ký</Button>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
