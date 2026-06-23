import { Row, Col, Card, Typography, Statistic, Spin, Button, Tag, Space, Avatar } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, WalletOutlined, ArrowRightOutlined, CompassOutlined, CrownOutlined, SettingOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { bookingApi } from '../../api/bookingApi';
import { useAuth } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { formatVND, getInitials } from '../../utils/helpers';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export default function CustomerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['my-bookings-stats'],
    queryFn: () => bookingApi.getMyBookings(),
  });

  const bookings = bookingsData?.data || [];

  const activeBookings = bookings.filter(b => ['PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'INSPECTING', 'QUOTED', 'COMPLETING'].includes(b.status));
  const completedBookings = bookings.filter(b => b.status === 'COMPLETED');
  const totalSpent = completedBookings.filter(b => b.payment_status === 'PAID' || b.payment?.status === 'PAID').reduce((sum, b) => sum + (b.final_price || b.total_price || 0), 0);

  if (isLoading) return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;

  return (
    <div className="fade-in-up" style={{ paddingBottom: 40 }}>
      {/* Banner */}
      <div className="glass-card" style={{ background: 'linear-gradient(135deg, var(--navy-dark) 0%, var(--navy) 100%)', padding: '32px', borderRadius: 'var(--radius-xl)', marginBottom: 32, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -20, width: 200, height: 200, background: 'radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, transparent 70%)', borderRadius: '50%' }}></div>
        <Row align="middle" gutter={24}>
          <Col>
            <Avatar size={72} style={{ backgroundColor: 'var(--orange)', fontSize: 28, fontWeight: 'bold' }}>
              {getInitials(user?.full_name)}
            </Avatar>
          </Col>
          <Col flex="auto">
            <Title level={3} style={{ color: 'black', margin: 0, fontWeight: 700 }}>Chào mừng trở lại, {user?.full_name}!</Title>
            <Text style={{ color: 'var(--text-muted)', fontSize: 15 }}>HomeFix luôn sẵn sàng hỗ trợ sửa chữa ngôi nhà của bạn mọi lúc mọi nơi.</Text>
          </Col>
          <Col>
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate('/customer/booking')}
              style={{ background: 'var(--orange)', borderColor: 'var(--orange)', fontWeight: 600, padding: '0 24px' }}
            >
              Đặt thợ ngay
            </Button>
          </Col>
        </Row>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
        <Col xs={24} md={8}>
          <Card className="hover-card glass-card" styles={{ body: { padding: 24 } }} style={{ borderTop: '4px solid var(--orange)', height: '100%' }}>
            <Statistic
              title={<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Đơn đang xử lý</span>}
              value={activeBookings.length}
              prefix={<CalendarOutlined style={{ color: 'var(--orange)' }} />}
              valueStyle={{ fontSize: 36, fontWeight: 700, marginTop: 8, color: 'var(--navy)' }}
            />
            <div style={{ marginTop: 24 }}>
              <Link to="/customer/bookings" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                Theo dõi tiến độ <ArrowRightOutlined />
              </Link>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="hover-card glass-card" styles={{ body: { padding: 24 } }} style={{ borderTop: '4px solid var(--success)', height: '100%' }}>
            <Statistic
              title={<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Đơn hoàn thành</span>}
              value={completedBookings.length}
              prefix={<CheckCircleOutlined style={{ color: 'var(--success)' }} />}
              valueStyle={{ fontSize: 36, fontWeight: 700, marginTop: 8, color: 'var(--navy)' }}
            />
            <div style={{ marginTop: 24 }}>
              <Link to="/customer/bookings" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                Xem lịch sử <ArrowRightOutlined />
              </Link>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="hover-card glass-card" styles={{ body: { padding: 24 } }} style={{ borderTop: '4px solid var(--info)', height: '100%' }}>
            <Statistic
              title={<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tổng chi tiêu</span>}
              value={formatVND(totalSpent)}
              prefix={<WalletOutlined style={{ color: 'var(--info)' }} />}
              valueStyle={{ fontSize: 28, fontWeight: 700, marginTop: 14, color: 'var(--navy)' }}
            />
            <div style={{ marginTop: 24 }}>
              <Link to="/customer/vouchers" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                Ưu đãi của tôi <ArrowRightOutlined />
              </Link>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title={<Space><CalendarOutlined /> Hoạt động gần đây</Space>} className="glass-card" styles={{ header: { borderBottom: '1px solid #f1f5f9' }, body: { padding: '16px 24px' } }}>
            {bookings.slice(0, 3).map(booking => (
              <div key={booking.id} style={{ padding: '16px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 12 }}>
                    <SettingOutlined style={{ fontSize: 24, color: 'var(--navy)' }} />
                  </div>
                  <div>
                    <Title level={5} style={{ margin: 0, color: 'var(--navy)' }}>{booking.service?.name}</Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>{dayjs(booking.booking_date).format('DD/MM/YYYY')} - {booking.time_slot_start}</Text>
                  </div>
                </div>
                <div>
                  <Link to={`/customer/bookings/${booking.id}`}>
                    <Button type="default" shape="round">Xem chi tiết</Button>
                  </Link>
                </div>
              </div>
            ))}
            {bookings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Text type="secondary">Chưa có hoạt động nào gần đây.</Text>
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link to="/customer/bookings" style={{ fontWeight: 600 }}>Xem toàn bộ lịch sử</Link>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.05) 0%, rgba(249, 115, 22, 0.15) 100%)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 64, height: 64, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: 'var(--shadow-sm)' }}>
                <CrownOutlined style={{ fontSize: 32, color: 'var(--orange)' }} />
              </div>
              <Title level={4} style={{ color: 'var(--orange-dark)' }}>Ưu đãi thành viên</Title>
              <Paragraph style={{ color: 'var(--text-secondary)' }}>
                Tích điểm qua mỗi lần đặt lịch sửa chữa để nhận mã giảm giá lên đến 200.000đ cho lần kế tiếp.
              </Paragraph>
              <Button type="primary" style={{ background: 'var(--orange)', borderColor: 'var(--orange)', marginTop: 8 }} block>
                Khám phá Voucher
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
