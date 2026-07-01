import { Layout, Menu, Avatar, Dropdown } from 'antd';
import { 
  DashboardOutlined,
  CalendarOutlined,
  TeamOutlined,
  UserOutlined,
  AppstoreOutlined,
  SettingOutlined,
  CreditCardOutlined,
  MessageOutlined,
  LogoutOutlined,
  EnvironmentOutlined,
  GiftOutlined
} from '@ant-design/icons';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from '../shared/NotificationBell';
import { getInitials } from '../../utils/helpers';

const { Header, Sider, Content } = Layout;

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/admin',
      icon: <DashboardOutlined />,
      label: <Link to="/admin">Tổng quan</Link>,
    },
    {
      key: '/admin/bookings',
      icon: <CalendarOutlined />,
      label: <Link to="/admin/bookings">Đơn đặt lịch</Link>,
    },
    {
      key: 'users_group',
      icon: <TeamOutlined />,
      label: 'Người dùng',
      children: [
        {
          key: '/admin/users',
          label: <Link to="/admin/users">Khách hàng</Link>,
        },
        {
          key: '/admin/technicians',
          label: <Link to="/admin/technicians">Kỹ thuật viên</Link>,
        },
      ]
    },
    {
      key: 'catalog_group',
      icon: <AppstoreOutlined />,
      label: 'Danh mục',
      children: [
        {
          key: '/admin/categories',
          label: <Link to="/admin/categories">Nhóm dịch vụ</Link>,
        },
        {
          key: '/admin/services',
          label: <Link to="/admin/services">Dịch vụ & Giá</Link>,
        },
        {
          key: '/admin/device-types',
          label: <Link to="/admin/device-types">Loại thiết bị</Link>,
        },
      ]
    },
    {
      key: '/admin/districts',
      icon: <EnvironmentOutlined />,
      label: <Link to="/admin/districts">Khu vực</Link>,
    },
    {
      key: '/admin/vouchers',
      icon: <GiftOutlined />,
      label: <Link to="/admin/vouchers">Khuyến mãi</Link>,
    },
    {
      key: '/admin/payments',
      icon: <CreditCardOutlined />,
      label: <Link to="/admin/payments">Thanh toán</Link>,
    },
    {
      key: '/admin/complaints',
      icon: <MessageOutlined />,
      label: <Link to="/admin/complaints">Khiếu nại</Link>,
    },
  ];

  const userDropdown = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Link to="/admin/profile">Hồ sơ cá nhân</Link>,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    }
  ];

  let selectedKey = location.pathname;
  if (selectedKey !== '/admin' && selectedKey.endsWith('/')) {
    selectedKey = selectedKey.slice(0, -1);
  }
  // Simplified active state matcher
  const activeKey = selectedKey;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        theme="dark" 
        width={260} 
        breakpoint="lg"
        collapsedWidth="0"
      >
        <div className="sidebar-header">
          <div className="logo-text">
            HomeFix Admin
          </div>
        </div>
        <div className="sidebar-user">
          <Avatar style={{ backgroundColor: 'var(--orange)' }}>
            {getInitials(user?.full_name)}
          </Avatar>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.full_name}</div>
            <div className="sidebar-user-role">Quản trị viên</div>
          </div>
        </div>
        <Menu 
          theme="dark"
          mode="inline" 
          selectedKeys={[activeKey]}
          defaultOpenKeys={['users_group', 'catalog_group']}
          items={menuItems}
        />
      </Sider>
      
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--navy)' }}>
            Bảng điều khiển Quản trị
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <NotificationBell />
            <Dropdown menu={{ items: userDropdown }} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: 'var(--orange)' }}>
                  {getInitials(user?.full_name)}
                </Avatar>
              </div>
            </Dropdown>
          </div>
        </Header>
        
        <Content className="page-container">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
