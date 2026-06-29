import { Row, Col, Card, Typography, Statistic, Spin, Table, Tag, Space, Divider } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
  CalendarOutlined, WalletOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExclamationCircleOutlined, TeamOutlined, UsergroupAddOutlined, MessageOutlined
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

  // Dữ liệu cho PieChart trạng thái booking
  const pieData = Object.entries(stats.bookingsByStatus || {}).map(([key, value]) => ({
    name: BOOKING_STATUS_LABELS[key] || key,
    value: value,
    color: BOOKING_STATUS_COLORS[key]?.color || '#cbd5e1'
  }));

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
        <p>Báo cáo hoạt động, người dùng và doanh thu của HomeFix</p>
      </div>

      {/* [UC-89] Expanded Stat Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
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
          <Card className="glass-card" style={{ height: '100%', borderLeft: '4px solid #3b82f6' }}>
            <Statistic
              title="Tổng khách hàng"
              value={stats.totalCustomers || 0}
              prefix={<UsergroupAddOutlined style={{ color: '#3b82f6' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-card" style={{ height: '100%', borderLeft: '4px solid #8b5cf6' }}>
            <Statistic
              title="Kỹ thuật viên"
              value={stats.totalTechnicians || 0}
              prefix={<TeamOutlined style={{ color: '#8b5cf6' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}
              suffix={<span style={{ fontSize: 14, color: 'var(--text-secondary)' }}> ({stats.totalActiveTechnicians || 0} đang ON)</span>}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {/* Việc cần làm & Khiếu nại */}
        <Col xs={24} lg={8}>
          <Card title="Việc cần làm" className="glass-card" style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 15 }}>Đơn chờ điều phối thợ</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--error)' }}>{pendingCount}</span>
                <Link to="/admin/bookings">Xử lý ngay</Link>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 15 }}>Đang thi công</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--info)' }}>{(stats.bookingsByStatus?.IN_PROGRESS || 0) + (stats.bookingsByStatus?.INSPECTING || 0) + (stats.bookingsByStatus?.COMPLETING || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 15 }}>Chờ thanh toán</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>{stats.bookingsByStatus?.AWAITING_PAYMENT || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 15 }}>Đã gán thợ / Chờ báo giá</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>{(stats.bookingsByStatus?.ASSIGNED || 0) + (stats.bookingsByStatus?.QUOTED || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <span style={{ fontSize: 15 }}>Khiếu nại chờ giải quyết</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--error)' }}>{stats.complaintStats?.open || 0}</span>
                <Link to="/admin/complaints">Xem</Link>
              </div>
            </div>
          </Card>
        </Col>

        {/* Trạng thái đơn hàng (Pie Chart) */}
        <Col xs={24} lg={8}>
          <Card title="Phân bổ trạng thái đơn" className="glass-card" style={{ height: '100%' }}>
             {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Chưa có dữ liệu</div>
              )}
          </Card>
        </Col>

        {/* Top dịch vụ */}
        <Col xs={24} lg={8}>
          <Card title="Top dịch vụ phổ biến" className="glass-card" style={{ height: '100%' }}>
            {(stats.topServices || []).length > 0 ? (
              <div style={{ height: 220, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topServices || []} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="service_name" width={120} tick={{ fontSize: 11 }} />
                    <RechartsTooltip formatter={(val) => `${val} đơn`} />
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
        {/* Biểu đồ xu hướng Booking 30 ngày */}
        <Col xs={24} lg={12}>
          <Card title="Xu hướng lượng đơn hàng (30 ngày gần đây)" className="glass-card">
            <div style={{ height: 250, width: '100%' }}>
              {(stats.bookingTrend || []).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.bookingTrend || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(val) => val.substring(5)} axisLine={false} tickLine={false} minTickGap={20} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip labelStyle={{ color: 'var(--navy)' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Chưa có dữ liệu</div>
              )}
            </div>
          </Card>
        </Col>

        {/* Biểu đồ doanh thu theo tháng */}
        <Col xs={24} lg={12}>
          <Card title="Doanh thu theo tháng (6 tháng)" className="glass-card">
            <div style={{ height: 250, width: '100%' }}>
              {(stats.revenueByMonth || []).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.revenueByMonth || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <Bar dataKey="revenue" fill="var(--orange)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => `${val / 1000000}M`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip formatter={(value) => formatVND(value)} labelStyle={{ color: 'var(--navy)' }} cursor={{fill: '#f1f5f9'}} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Chưa có dữ liệu</div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {/* Doanh thu theo khu vực */}
        <Col xs={24} lg={12}>
          <Card title="Doanh thu theo khu vực" className="glass-card" style={{ height: '100%' }}>
             {(stats.revenueByDistrict || []).length > 0 ? (
              <div style={{ height: 250, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.revenueByDistrict || []} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(val) => `${val / 1000000}M`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="district_name" width={100} tick={{ fontSize: 11 }} />
                    <RechartsTooltip formatter={(val) => formatVND(val)} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Chưa có dữ liệu</div>
            )}
          </Card>
        </Col>

        {/* Top Kỹ thuật viên */}
        <Col xs={24} lg={12}>
          <Card title={<><TeamOutlined /> Top Kỹ thuật viên (Rating)</>} className="glass-card" style={{ height: '100%' }}>
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
      <Card title="Đơn hàng gần nhất" className="glass-card" extra={<Link to="/admin/bookings">Xem tất cả</Link>}>
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
