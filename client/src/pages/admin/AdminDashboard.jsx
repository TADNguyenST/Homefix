import { Row, Col, Card, Typography, Statistic, Spin, Table, Tag, Space } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import {
  CalendarOutlined, WalletOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExclamationCircleOutlined, TeamOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatVND, formatDate } from '../../utils/helpers';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../../utils/constants';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;

export default function AdminDashboard() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: adminApi.getDashboard,
  });

  const stats = dashboardData?.data || {};

  if (isLoading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;

  // Tính toán pending + confirmed từ bookingsByStatus
  const pendingCount = (stats.bookingsByStatus?.PENDING || 0) + (stats.bookingsByStatus?.CONFIRMED || 0);

  // Recent bookings table columns
  const recentColumns = [
    {
      title: 'Mã đơn',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <span style={{ fontWeight: 600 }}>#{id}</span>,
      width: 80,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, r) => r.customer?.full_name || 'N/A',
    },
    {
      title: 'Dịch vụ',
      key: 'service',
      render: (_, r) => r.service?.name || 'N/A',
    },
    {
      title: 'Khu vực',
      key: 'district',
      render: (_, r) => r.district?.name || 'N/A',
    },
    {
      title: 'Ngày tạo',
      key: 'created_at',
      render: (_, r) => formatDate(r.created_at),
      width: 110,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const cfg = BOOKING_STATUS_COLORS[status] || {};
        return <Tag color={cfg.bg} style={{ color: cfg.color, border: 'none', fontWeight: 600 }}>{BOOKING_STATUS_LABELS[status]}</Tag>;
      },
      width: 140,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Tổng quan Hệ thống</Title>
        <p>Báo cáo hoạt động và doanh thu của HomeFix</p>
      </div>

      {/* Stat Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-card" style={{ height: '100%', borderLeft: '4px solid var(--orange)' }}>
            <Statistic
              title="Tổng doanh thu"
              value={formatVND(stats.totalRevenue || 0)}
              prefix={<WalletOutlined style={{ color: 'var(--orange)' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-card" style={{ height: '100%', borderLeft: '4px solid var(--success)' }}>
            <Statistic
              title="Tổng đơn đặt lịch"
              value={stats.totalBookings || 0}
              prefix={<CalendarOutlined style={{ color: 'var(--success)' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-card" style={{ height: '100%', borderLeft: '4px solid var(--navy)' }}>
            <Statistic
              title="Đơn hoàn thành"
              value={stats.totalCompleted || 0}
              prefix={<CheckCircleOutlined style={{ color: 'var(--navy)' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}
              suffix={stats.totalBookings > 0 ? <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}> ({Math.round((stats.totalCompleted / stats.totalBookings) * 100)}%)</span> : null}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-card" style={{ height: '100%', borderLeft: '4px solid var(--error)' }}>
            <Statistic
              title="Đơn đã hủy"
              value={stats.totalCancelled || 0}
              prefix={<CloseCircleOutlined style={{ color: 'var(--error)' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {/* Việc cần làm */}
        <Col xs={24} lg={12}>
          <Card title="Việc cần làm" className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 16 }}>Đơn hàng chờ điều phối thợ</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--error)' }}>{pendingCount}</span>
                <Link to="/admin/bookings">Xử lý ngay</Link>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 16 }}>Đang thi công</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--info)' }}>{(stats.bookingsByStatus?.IN_PROGRESS || 0) + (stats.bookingsByStatus?.INSPECTING || 0) + (stats.bookingsByStatus?.COMPLETING || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <span style={{ fontSize: 16 }}>Đã gán thợ / Đang báo giá</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning)' }}>{(stats.bookingsByStatus?.ASSIGNED || 0) + (stats.bookingsByStatus?.QUOTED || 0)}</span>
            </div>
          </Card>
        </Col>

        {/* Top dịch vụ */}
        <Col xs={24} lg={12}>
          <Card title="Top dịch vụ phổ biến" className="glass-card">
            {(stats.topServices || []).length > 0 ? (
              <div style={{ height: 200, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topServices || []} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="service_name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val) => `${val} đơn`} />
                    <Bar dataKey="booking_count" fill="var(--orange)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Chưa có dữ liệu</div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {/* Biểu đồ doanh thu */}
        <Col xs={24} lg={12}>
          <Card title="Biểu đồ doanh thu theo tháng" className="glass-card">
            <div style={{ height: 250, width: '100%' }}>
              {(stats.revenueByMonth || []).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.revenueByMonth || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <Line type="monotone" dataKey="revenue" stroke="var(--orange)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <CartesianGrid stroke="#ccc" strokeDasharray="5 5" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => `${val / 1000000}M`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => formatVND(value)} labelStyle={{ color: 'var(--navy)' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Chưa có dữ liệu doanh thu</div>
              )}
            </div>
          </Card>
        </Col>

        {/* Top Kỹ thuật viên */}
        <Col xs={24} lg={12}>
          <Card title={<><TeamOutlined /> Top Kỹ thuật viên</>} className="glass-card">
            {(stats.topTechnicians || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stats.topTechnicians.map((tech, idx) => (
                  <div key={tech.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: idx === 0 ? '#fef3c7' : 'var(--bg-primary)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 700, color: idx === 0 ? 'var(--orange)' : 'var(--text-secondary)', fontSize: 16 }}>#{idx + 1}</span>
                      <div>
                        <Text strong>{tech.user?.full_name || 'N/A'}</Text>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Hoàn thành: {tech.total_completed_jobs || 0} đơn</div>
                      </div>
                    </div>
                    <Tag color="gold" style={{ border: 'none', fontWeight: 600 }}>⭐ {tech.avg_rating ? Number(tech.avg_rating).toFixed(1) : 'N/A'}</Tag>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Chưa có dữ liệu kỹ thuật viên</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Bookings */}
      <Card title="Đơn hàng gần nhất" className="glass-card">
        <Table
          columns={recentColumns}
          dataSource={stats.recentBookings || []}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
        />
      </Card>
    </div>
  );
}
