import { Menu, Row, Col, Card, Typography } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  UserOutlined,
  EnvironmentOutlined,
  MessageOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { Outlet, Link, useLocation } from 'react-router-dom';
import PublicNavbar from '../shared/PublicNavbar';
import PublicFooter from '../shared/PublicFooter';

export default function CustomerLayout() {
  const location = useLocation();

  const menuItems = [
    {
      key: '/customer',
      icon: <HomeOutlined />,
      label: <Link to="/customer">Tổng quan</Link>,
    },
    {
      key: '/customer/bookings',
      icon: <CalendarOutlined />,
      label: <Link to="/customer/bookings">Đơn đặt lịch</Link>,
    },
    {
      key: '/customer/addresses',
      icon: <EnvironmentOutlined />,
      label: <Link to="/customer/addresses">Địa chỉ</Link>,
    },
    {
      key: '/customer/vouchers',
      icon: <GiftOutlined />,
      label: <Link to="/customer/vouchers">Voucher</Link>,
    },
    {
      key: '/customer/complaints',
      icon: <MessageOutlined />,
      label: <Link to="/customer/complaints">Khiếu nại</Link>,
    },
    {
      key: '/customer/profile',
      icon: <UserOutlined />,
      label: <Link to="/customer/profile">Tài khoản</Link>,
    },
  ];

  const selectedKey = menuItems.find(item => location.pathname === item.key || location.pathname.startsWith(`${item.key}/`))?.key || '/customer';

  return (
    <div className="public-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNavbar />

      <main className="page-container" style={{ flex: 1, width: '100%' }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={6} lg={5}>
            <Card className="glass-card" styles={{ body: { padding: '16px 0' } }} style={{ position: 'sticky', top: 88 }}>
              <Typography.Title level={5} style={{ padding: '0 24px', marginBottom: 16, color: 'var(--navy)' }}>
                Tài khoản của tôi
              </Typography.Title>
              <Menu
                mode="inline"
                selectedKeys={[selectedKey]}
                items={menuItems}
                style={{ borderRight: 0, background: 'transparent' }}
              />
            </Card>
          </Col>

          <Col xs={24} md={18} lg={19}>
            <Outlet />
          </Col>
        </Row>
      </main>

      <PublicFooter />
    </div>
  );
}
