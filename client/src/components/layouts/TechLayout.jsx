import { Layout, Menu, Avatar, Dropdown } from 'antd';
import { 
  DashboardOutlined,
  ToolOutlined,
  HistoryOutlined,
  CalendarOutlined,
  StarOutlined,
  UserOutlined,
  LogoutOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from '../shared/NotificationBell';
import { getInitials } from '../../utils/helpers';

const { Header, Sider, Content } = Layout;

export default function TechLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/technician',
      icon: <DashboardOutlined />,
      label: <Link to="/technician">Tổng quan</Link>,
    },
    {
      key: '/technician/jobs',
      icon: <ToolOutlined />,
      label: <Link to="/technician/jobs">Công việc hiện tại</Link>,
    },
    {
      key: '/technician/schedule',
      icon: <CalendarOutlined />,
      label: <Link to="/technician/schedule">Lịch trình</Link>,
    },
    {
      key: '/technician/history',
      icon: <HistoryOutlined />,
      label: <Link to="/technician/history">Lịch sử</Link>,
    },
    {
      key: '/technician/rating',
      icon: <StarOutlined />,
      label: <Link to="/technician/rating">Đánh giá</Link>,
    },
    {
      key: '/technician/wallet',
      icon: <WalletOutlined />,
      label: <Link to="/technician/wallet">Ví tiền mặt</Link>,
    },
  ];

  const userDropdown = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Link to="/technician/profile">Hồ sơ cá nhân</Link>,
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

  const selectedKey = menuItems.find(item => location.pathname === item.key || (location.pathname.startsWith(`${item.key}/`) && item.key !== '/technician'))?.key || '/technician';

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider 
        theme="dark" 
        width={260} 
        breakpoint="lg"
        collapsedWidth="0"
        style={{ overflowY: 'auto', height: '100vh' }}
        className="hide-scrollbar"
      >
        <div className="sidebar-header">
          <div className="logo-text">
            HomeFix
          </div>
        </div>
        <div className="sidebar-user">
          <Avatar style={{ backgroundColor: 'var(--orange)' }}>
            {getInitials(user?.full_name)}
          </Avatar>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.full_name}</div>
            <div className="sidebar-user-role">Kỹ thuật viên</div>
          </div>
        </div>
        <Menu 
          theme="dark"
          mode="inline" 
          selectedKeys={[selectedKey]} 
          items={menuItems}
        />
      </Sider>
      
      <Layout style={{ overflowY: 'auto', height: '100vh' }}>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--navy)' }}>
            Bảng Kỹ thuật viên
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
        
        <Content style={{ padding: '24px 32px' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
