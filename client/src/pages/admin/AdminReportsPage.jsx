import React, { useState, useMemo } from 'react';
import { Card, DatePicker, Button, Table, Typography, Statistic, Row, Col, message, Tabs, Space, Alert } from 'antd';
import { 
  DownloadOutlined, 
  BarChartOutlined, 
  WalletOutlined, 
  CreditCardOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined,
  UserOutlined,
  ToolOutlined,
  MoneyCollectOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatVND, formatDate } from '../../utils/helpers';
import dayjs from 'dayjs';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Bảng màu đẹp cho biểu đồ tròn
const PIE_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', 
  '#82ca9d', '#ffc658', '#a4de6c', '#d0ed57', '#83a6ed'
];

// ==========================================
// CÁC HELPER ĐỂ TỔNG HỢP THÊM DỮ LIỆU FRONTEND (CÓ THỂ DÙNG THÊM NẾU CẦN)
// ==========================================

const getPaymentStatusStats = (payments) => {
  let vnpayAmount = 0;
  let vnpayCount = 0;
  let cashSettledAmount = 0;
  let cashSettledCount = 0;
  let cashPendingAmount = 0;
  let cashPendingCount = 0;

  payments.forEach(p => {
    const amount = Number(p.amount || 0);
    if (p.method === 'VNPAY') {
      vnpayAmount += amount;
      vnpayCount += 1;
    } else if (p.method === 'CASH') {
      if (p.settlement_status === 'SETTLED') {
        cashSettledAmount += amount;
        cashSettledCount += 1;
      } else {
        cashPendingAmount += amount;
        cashPendingCount += 1;
      }
    }
  });

  const total = vnpayAmount + cashSettledAmount + cashPendingAmount;

  return [
    { 
      name: 'VNPAY đã nhận', 
      value: vnpayAmount, 
      count: vnpayCount, 
      percentage: total > 0 ? ((vnpayAmount / total) * 100).toFixed(1) : 0,
      color: '#1677ff' 
    },
    { 
      name: 'Tiền mặt đã đối soát (Settled)', 
      value: cashSettledAmount, 
      count: cashSettledCount, 
      percentage: total > 0 ? ((cashSettledAmount / total) * 100).toFixed(1) : 0,
      color: '#52c41a' 
    },
    { 
      name: 'Tiền thợ đang giữ (Pending)', 
      value: cashPendingAmount, 
      count: cashPendingCount, 
      percentage: total > 0 ? ((cashPendingAmount / total) * 100).toFixed(1) : 0,
      color: '#fa8c16' 
    },
  ].filter(item => item.value > 0);
};

export default function AdminReportsPage() {
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  const startDate = dateRange?.[0]?.toISOString();
  const endDate = dateRange?.[1]?.toISOString();

  // Gọi API Báo cáo đã tối ưu hoá từ Backend
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['admin-revenue-report', startDate, endDate],
    queryFn: () => adminApi.getRevenueReport({ startDate, endDate }),
  });

  const { 
    summary = {}, 
    dailyStats = [], 
    serviceStats = [], 
    districtStats = [], 
    technicianStats = [], 
    customerStats = [], 
    quotationItemStats = [], 
    payments = [] 
  } = reportData?.data || {};

  // Tính tỷ trọng trực tiếp cho các báo cáo phục vụ hiển thị
  const serviceStatsParsed = useMemo(() => {
    const total = summary.total_revenue || 1;
    return serviceStats.map(item => ({
      ...item,
      percentage: ((item.revenue / total) * 100).toFixed(1)
    }));
  }, [serviceStats, summary.total_revenue]);

  const districtStatsParsed = useMemo(() => {
    const total = summary.total_revenue || 1;
    return districtStats.map(item => ({
      ...item,
      percentage: ((item.revenue / total) * 100).toFixed(1)
    }));
  }, [districtStats, summary.total_revenue]);

  const technicianStatsParsed = useMemo(() => {
    const total = summary.total_revenue || 1;
    return technicianStats.map(item => ({
      ...item,
      percentage: ((item.revenue / total) * 100).toFixed(1)
    }));
  }, [technicianStats, summary.total_revenue]);

  const customerStatsParsed = useMemo(() => {
    const total = summary.total_revenue || 1;
    return customerStats.map(item => ({
      ...item,
      percentage: ((item.revenue / total) * 100).toFixed(1)
    }));
  }, [customerStats, summary.total_revenue]);

  const quotationStatsParsed = useMemo(() => {
    const totalQuotationRev = quotationItemStats.reduce((sum, item) => sum + (item.revenue || 0), 0) || 1;
    const totalQuotationQty = quotationItemStats.reduce((sum, item) => sum + (item.quantity || 0), 0) || 1;
    return quotationItemStats.map(item => ({
      ...item,
      percentage: ((item.revenue / totalQuotationRev) * 100).toFixed(1),
      qtyPercentage: ((item.quantity / totalQuotationQty) * 100).toFixed(1),
    }));
  }, [quotationItemStats]);

  const paymentStatusData = useMemo(() => getPaymentStatusStats(payments), [payments]);

  // Lọc lịch sử đặt lịch của khách hàng được chọn (UC-17.6)
  const selectedCustomerBookings = useMemo(() => {
    if (!selectedCustomerId) return [];
    return payments.filter(p => p.booking?.customer?.id === selectedCustomerId);
  }, [selectedCustomerId, payments]);

  // Xuất file CSV báo cáo chi tiết
  const handleExportCSV = () => {
    if (!payments.length) {
      message.warning('Không có dữ liệu để xuất!');
      return;
    }

    let csvContent = 'Mã đơn,Ngày thanh toán,Khách hàng,Dịch vụ,Thợ phụ trách,Phương thức,Trạng thái,Số tiền\n';
    const techRevenue = {};

    payments.forEach((p) => {
      const id = p.booking?.id || 'N/A';
      const dateStr = p.paid_at ? formatDate(p.paid_at) : 'N/A';
      const date = p.paid_at ? `="${dateStr}"` : 'N/A';
      const customer = p.booking?.customer?.full_name ? `"${p.booking.customer.full_name}"` : 'N/A';
      const service = p.booking?.service?.name ? `"${p.booking.service.name}"` : 'N/A';
      const techName = p.booking?.technicianProfile?.user?.full_name || 'N/A';
      const tech = `"${techName}"`;
      const method = p.method || 'N/A';
      const status = p.status || 'N/A';
      const amount = p.amount || 0;

      if (techName !== 'N/A') {
        techRevenue[techName] = (techRevenue[techName] || 0) + Number(amount);
      }

      csvContent += `${id},${date},${customer},${service},${tech},${method},${status},${amount}\n`;
    });

    csvContent += `\n`;
    csvContent += `TỔNG QUAN DOANH THU\n`;
    csvContent += `Tổng doanh thu,,,,,,,${summary.total_revenue || 0}\n`;
    csvContent += `Doanh thu VNPAY,,,,,,,${summary.vnpay_received || 0}\n`;
    csvContent += `Doanh thu Tiền mặt,,,,,,,${summary.cash_collected || 0}\n`;
    csvContent += `Tiền mặt thợ giữ (Pending),,,,,,,${summary.cash_pending || 0}\n`;
    csvContent += `Tiền mặt đã thu (Settled),,,,,,,${summary.cash_settled || 0}\n`;

    csvContent += `\n`;

    if (Object.keys(techRevenue).length > 0) {
      csvContent += `THỐNG KÊ THEO KỸ THUẬT VIÊN\n`;
      csvContent += `Kỹ thuật viên,Tổng doanh thu\n`;
      Object.entries(techRevenue).sort((a, b) => b[1] - a[1]).forEach(([name, rev]) => {
        csvContent += `"${name}",${rev}\n`;
      });
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bao_cao_doanh_thu_${dayjs().format('YYYYMMDD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Cấu hình cột bảng giao dịch chi tiết
  const transactionColumns = [
    {
      title: 'Mã đơn',
      dataIndex: ['booking', 'id'],
      key: 'id',
      render: (id) => <b>#{id}</b>,
      width: 100,
    },
    {
      title: 'Ngày thanh toán',
      dataIndex: 'paid_at',
      key: 'paid_at',
      render: (val) => (val ? formatDate(val) : 'N/A'),
      width: 140,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, r) => r.booking?.customer?.full_name || 'N/A',
    },
    {
      title: 'Dịch vụ',
      key: 'service',
      render: (_, r) => r.booking?.service?.name || 'N/A',
    },
    {
      title: 'Kỹ thuật viên',
      key: 'technician',
      render: (_, r) => r.booking?.technicianProfile?.user?.full_name || 'N/A',
    },
    {
      title: 'Phương thức',
      dataIndex: 'method',
      key: 'method',
      render: (method) => (
        <span style={{ fontWeight: 500 }}>
          {method === 'VNPAY' ? '💳 VNPAY' : '💵 Tiền mặt'}
        </span>
      ),
      width: 130,
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (val) => <b style={{ color: 'var(--orange)' }}>{formatVND(val)}</b>,
      align: 'right',
      width: 140,
    },
  ];

  // Định nghĩa các Phân hệ Tab Báo cáo
  const tabItems = [
    // TAB 1: TỔNG QUAN DOANH THU & GIAO DỊCH
    {
      key: 'overview',
      label: (
        <span>
          <BarChartOutlined /> Tổng quan Doanh thu
        </span>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row gutter={[24, 24]}>
            {/* Biểu đồ Cột: Doanh thu ngày */}
            <Col xs={24} lg={15}>
              <Card title="Xu hướng doanh thu & số đơn hàng theo ngày" className="glass-card" style={{ height: '100%' }}>
                {dailyStats.length > 0 ? (
                  <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyStats} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `${val / 1000}k`} />
                        <RechartsTooltip 
                          formatter={(value, name) => [name === 'revenue' ? formatVND(value) : `${value} đơn`, name === 'revenue' ? 'Doanh thu' : 'Số đơn']}
                          labelStyle={{ fontWeight: 600, color: 'var(--navy)' }} 
                        />
                        <Legend verticalAlign="top" height={36} />
                        <Bar name="revenue" dataKey="revenue" fill="#1890ff" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Không có dữ liệu biểu đồ</div>
                )}
              </Card>
            </Col>
            
            {/* Biểu đồ Tròn: Cơ cấu dòng tiền */}
            <Col xs={24} lg={9}>
              <Card title="Cơ cấu dòng tiền thực tế" className="glass-card" style={{ height: '100%' }}>
                {paymentStatusData.length > 0 ? (
                  <div style={{ width: '100%', height: 320, display: 'flex', flexDirection: 'column', justifyItems: 'center' }}>
                    <div style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {paymentStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value) => formatVND(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ padding: '10px 0 0 10px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {paymentStatusData.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, marginRight: 8 }} />
                            {item.name} ({item.count} đơn)
                          </span>
                          <b style={{ color: item.color }}>{item.percentage}%</b>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Không có dữ liệu dòng tiền</div>
                )}
              </Card>
            </Col>
          </Row>

          <Card title="Danh sách chi tiết giao dịch thành công" className="glass-card">
            <Table
              dataSource={payments}
              columns={transactionColumns}
              rowKey="id"
              loading={isLoading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 900 }}
              size="middle"
            />
          </Card>
        </Space>
      )
    },
    // TAB 2: THEO DỊCH VỤ
    {
      key: 'services',
      label: (
        <span>
          <WalletOutlined /> Theo Dịch vụ
        </span>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row gutter={[24, 24]}>
            {/* Cột: Doanh thu dịch vụ */}
            <Col xs={24} lg={14}>
              <Card title="Doanh thu chi tiết theo từng dịch vụ" className="glass-card" style={{ height: '100%' }}>
                {serviceStatsParsed.length > 0 ? (
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={serviceStatsParsed} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(val) => `${val / 1000}k`} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                        <RechartsTooltip formatter={(value) => formatVND(value)} labelStyle={{ color: 'var(--navy)' }} />
                        <Bar dataKey="revenue" fill="#36cfc9" radius={[0, 4, 4, 0]} maxBarSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Không có dữ liệu dịch vụ</div>
                )}
              </Card>
            </Col>

            {/* Tròn: Tỷ trọng doanh thu */}
            <Col xs={24} lg={10}>
              <Card title="Tỉ trọng doanh thu theo Dịch vụ" className="glass-card" style={{ height: '100%' }}>
                {serviceStatsParsed.length > 0 ? (
                  <div style={{ width: '100%', height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={serviceStatsParsed}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="revenue"
                          >
                            {serviceStatsParsed.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value) => formatVND(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {serviceStatsParsed.slice(0, 4).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: PIE_COLORS[idx % PIE_COLORS.length], marginRight: 6 }} />
                            {item.name}
                          </span>
                          <b>{item.percentage}%</b>
                        </div>
                      ))}
                      {serviceStatsParsed.length > 4 && (
                        <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          Và {serviceStatsParsed.length - 4} dịch vụ khác...
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Không có dữ liệu tỷ trọng</div>
                )}
              </Card>
            </Col>
          </Row>

          <Card title="Bảng tổng hợp hiệu suất Dịch vụ" className="glass-card">
            <Table
              dataSource={serviceStatsParsed}
              rowKey="name"
              pagination={{ pageSize: 10 }}
              size="middle"
              columns={[
                { title: 'Tên dịch vụ', dataIndex: 'name', key: 'name', render: (val) => <b>{val}</b> },
                { title: 'Số lượng đơn đặt', dataIndex: 'bookings', key: 'bookings', align: 'center', render: (val) => `${val} đơn` },
                { title: 'Doanh thu mang lại', dataIndex: 'revenue', key: 'revenue', align: 'right', render: (val) => <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{formatVND(val)}</span> },
                { title: 'Tỷ trọng đóng góp', dataIndex: 'percentage', key: 'percentage', align: 'right', render: (val) => <b>{val}%</b> },
              ]}
            />
          </Card>
        </Space>
      )
    },
    // TAB 3: THEO KHU VỰC
    {
      key: 'districts',
      label: (
        <span>
          <MoneyCollectOutlined /> Theo Khu vực
        </span>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row gutter={[24, 24]}>
            {/* Cột: Số đơn khu vực */}
            <Col xs={24} lg={14}>
              <Card title="Số đơn hoàn thành theo từng Khu vực" className="glass-card" style={{ height: '100%' }}>
                {districtStatsParsed.length > 0 ? (
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={districtStatsParsed} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip formatter={(value, name) => [value, name === 'bookings' ? 'Số đơn hàng' : 'Doanh thu']} />
                        <Bar dataKey="bookings" fill="#95de64" radius={[4, 4, 0, 0]} maxBarSize={45} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Không có dữ liệu khu vực</div>
                )}
              </Card>
            </Col>

            {/* Tròn: Tỉ trọng doanh thu khu vực */}
            <Col xs={24} lg={10}>
              <Card title="Tỉ trọng doanh thu theo Khu vực" className="glass-card" style={{ height: '100%' }}>
                {districtStatsParsed.length > 0 ? (
                  <div style={{ width: '100%', height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={districtStatsParsed}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="revenue"
                          >
                            {districtStatsParsed.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value) => formatVND(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {districtStatsParsed.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: PIE_COLORS[idx % PIE_COLORS.length], marginRight: 6 }} />
                            {item.name} ({item.bookings} đơn)
                          </span>
                          <b>{item.percentage}%</b>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Không có dữ liệu tỷ trọng</div>
                )}
              </Card>
            </Col>
          </Row>

          <Card title="Bảng tổng hợp hiệu suất Khu vực phục vụ" className="glass-card">
            <Table
              dataSource={districtStatsParsed}
              rowKey="name"
              pagination={false}
              size="middle"
              columns={[
                { title: 'Khu vực hoạt động', dataIndex: 'name', key: 'name', render: (val) => <b>{val}</b> },
                { title: 'Tổng số đơn hoàn thành', dataIndex: 'bookings', key: 'bookings', align: 'center', render: (val) => `${val} đơn` },
                { title: 'Doanh thu thu về', dataIndex: 'revenue', key: 'revenue', align: 'right', render: (val) => <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{formatVND(val)}</span> },
                { title: 'Tỷ trọng đóng góp doanh thu', dataIndex: 'percentage', key: 'percentage', align: 'right', render: (val) => <b>{val}%</b> },
              ]}
            />
          </Card>
        </Space>
      )
    },
    // TAB 4: THEO KỸ THUẬT VIÊN
    {
      key: 'technicians',
      label: (
        <span>
          <ClockCircleOutlined /> Theo Kỹ thuật viên
        </span>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row gutter={[24, 24]}>
            {/* Cột: Doanh thu thợ mang lại */}
            <Col xs={24} lg={14}>
              <Card title="Doanh thu mang lại bởi từng Kỹ thuật viên" className="glass-card" style={{ height: '100%' }}>
                {technicianStatsParsed.length > 0 ? (
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={technicianStatsParsed} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `${val / 1000}k`} />
                        <RechartsTooltip formatter={(value) => formatVND(value)} labelStyle={{ color: 'var(--navy)' }} />
                        <Bar dataKey="revenue" fill="#ff7875" radius={[4, 4, 0, 0]} maxBarSize={45} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Không có dữ liệu kỹ thuật viên</div>
                )}
              </Card>
            </Col>

            {/* Tròn: Tỷ trọng số đơn thợ sửa */}
            <Col xs={24} lg={10}>
              <Card title="Tỉ trọng đóng góp số lượng đơn hàng" className="glass-card" style={{ height: '100%' }}>
                {technicianStatsParsed.length > 0 ? (
                  <div style={{ width: '100%', height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={technicianStatsParsed}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="bookings"
                          >
                            {technicianStatsParsed.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value) => `${value} đơn`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {technicianStatsParsed.slice(0, 4).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: PIE_COLORS[idx % PIE_COLORS.length], marginRight: 6 }} />
                            {item.name} ({item.bookings} đơn)
                          </span>
                          <b>{payments.length > 0 ? ((item.bookings / payments.length) * 100).toFixed(1) : 0}%</b>
                        </div>
                      ))}
                      {technicianStatsParsed.length > 4 && (
                        <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          Và {technicianStatsParsed.length - 4} kỹ thuật viên khác...
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Không có dữ liệu tỷ trọng đơn</div>
                )}
              </Card>
            </Col>
          </Row>

          <Card title="Bảng tổng hợp hiệu suất Kỹ thuật viên" className="glass-card">
            <Table
              dataSource={technicianStatsParsed}
              rowKey="name"
              pagination={{ pageSize: 10 }}
              size="middle"
              columns={[
                { title: 'Tên kỹ thuật viên', dataIndex: 'name', key: 'name', render: (val) => <b>{val}</b> },
                { title: 'Số lượng đơn hoàn thành', dataIndex: 'bookings', key: 'bookings', align: 'center', render: (val) => `${val} đơn` },
                { title: 'Doanh thu mang lại', dataIndex: 'revenue', key: 'revenue', align: 'right', render: (val) => <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{formatVND(val)}</span> },
                { title: 'Tỷ lệ đóng góp doanh thu', dataIndex: 'percentage', key: 'percentage', align: 'right', render: (val) => <b>{val}%</b> },
              ]}
            />
          </Card>
        </Space>
      )
    },
    // TAB 5: KHÁCH HÀNG THÂN THIẾT & LỊCH SỬ ĐẶT (UC-17.7 & UC-17.6)
    {
      key: 'customers',
      label: (
        <span>
          <UserOutlined /> Khách hàng & Lịch sử đặt
        </span>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row gutter={[24, 24]}>
            {/* Cột Trái: Bảng danh sách Top khách hàng (UC-17.7) */}
            <Col xs={24} lg={11}>
              <Card title="Top Khách hàng chi tiêu nhiều nhất (Spenders)" className="glass-card">
                <Table
                  dataSource={customerStatsParsed}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  size="small"
                  rowClassName={(record) => record.id === selectedCustomerId ? 'ant-table-row-selected' : ''}
                  onRow={(record) => ({
                    onClick: () => {
                      setSelectedCustomerId(record.id);
                      setSelectedCustomerName(record.name);
                    },
                    style: { cursor: 'pointer' }
                  })}
                  columns={[
                    { 
                      title: 'Khách hàng', 
                      key: 'name',
                      render: (_, r) => (
                        <div>
                          <b style={{ color: r.id === selectedCustomerId ? '#1890ff' : 'inherit' }}>{r.name}</b>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>SĐT: {r.phone || 'N/A'}</div>
                        </div>
                      )
                    },
                    { title: 'Số đơn', dataIndex: 'bookings', key: 'bookings', align: 'center', render: (val) => `${val} đơn` },
                    { 
                      title: 'Chi tiêu', 
                      dataIndex: 'revenue', 
                      key: 'revenue', 
                      align: 'right', 
                      render: (val, r) => (
                        <span style={{ color: r.id === selectedCustomerId ? '#1890ff' : 'var(--orange)', fontWeight: 600 }}>
                          {formatVND(val)}
                        </span>
                      ) 
                    },
                  ]}
                />
                <div style={{ marginTop: 12 }}>
                  <Alert message="💡 Click chuột vào dòng khách hàng bất kỳ để xem lịch sử sửa chữa chi tiết của họ ở bảng bên phải." type="info" showIcon />
                </div>
              </Card>
            </Col>

            {/* Cột Phải: Lịch sử đơn hàng của khách đã chọn (UC-17.6) */}
            <Col xs={24} lg={13}>
              <Card 
                title={selectedCustomerId ? `Lịch sử đặt dịch vụ của: ${selectedCustomerName}` : "Lịch sử chi tiết khách hàng"} 
                className="glass-card"
                style={{ height: '100%' }}
              >
                {selectedCustomerId ? (
                  selectedCustomerBookings.length > 0 ? (
                    <Table
                      dataSource={selectedCustomerBookings}
                      rowKey="id"
                      pagination={{ pageSize: 8 }}
                      size="small"
                      columns={[
                        { title: 'Mã đơn', dataIndex: ['booking', 'id'], key: 'id', render: (val) => <b>#{val}</b> },
                        { title: 'Ngày sửa', dataIndex: 'paid_at', key: 'paid_at', render: (val) => formatDate(val) },
                        { title: 'Dịch vụ', key: 'service', render: (_, r) => r.booking?.service?.name || 'N/A' },
                        { title: 'KTV phụ trách', key: 'tech', render: (_, r) => r.booking?.technicianProfile?.user?.full_name || 'N/A' },
                        { title: 'Thanh toán', dataIndex: 'amount', key: 'amount', align: 'right', render: (val) => <span style={{ fontWeight: 600, color: 'var(--orange)' }}>{formatVND(val)}</span> }
                      ]}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>Không tìm thấy đơn hàng nào trong khoảng thời gian đã chọn</div>
                  )
                ) : (
                  <div style={{ textAlign: 'center', padding: '120px 0', color: 'var(--text-secondary)' }}>
                    <UserOutlined style={{ fontSize: 40, color: '#bfbfbf', marginBottom: 16 }} />
                    <p style={{ fontSize: 14 }}>Vui lòng nhấp chọn một khách hàng ở bảng bên trái để hiển thị lịch sử đơn sửa chữa.</p>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </Space>
      )
    },
    // TAB 6: LINH KIỆN & VẬT TƯ PHÁT SINH (UC-17.2 & UC-17.8)
    {
      key: 'parts',
      label: (
        <span>
          <ToolOutlined /> Linh kiện phụ trợ
        </span>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row gutter={[24, 24]}>
            {/* Cột: Doanh thu linh kiện bán ra */}
            <Col xs={24} lg={14}>
              <Card title="Doanh thu bán linh kiện/vật tư chi tiết" className="glass-card" style={{ height: '100%' }}>
                {quotationStatsParsed.length > 0 ? (
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={quotationStatsParsed} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `${val / 1000}k`} />
                        <RechartsTooltip formatter={(value) => formatVND(value)} labelStyle={{ color: 'var(--navy)' }} />
                        <Bar dataKey="revenue" fill="#ffa940" radius={[4, 4, 0, 0]} maxBarSize={45} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Chưa ghi nhận vật tư/linh kiện bán ra trong khoảng ngày này</div>
                )}
              </Card>
            </Col>

            {/* Tròn: Tỷ lệ số lượng linh kiện tiêu thụ */}
            <Col xs={24} lg={10}>
              <Card title="Tỉ trọng số lượng tiêu thụ" className="glass-card" style={{ height: '100%' }}>
                {quotationStatsParsed.length > 0 ? (
                  <div style={{ width: '100%', height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={quotationStatsParsed}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="quantity"
                          >
                            {quotationStatsParsed.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value) => `${value} đơn vị`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {quotationStatsParsed.slice(0, 4).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: PIE_COLORS[idx % PIE_COLORS.length], marginRight: 6 }} />
                            {item.name} ({item.quantity} cái)
                          </span>
                          <b>{item.qtyPercentage}%</b>
                        </div>
                      ))}
                      {quotationStatsParsed.length > 4 && (
                        <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          Và {quotationStatsParsed.length - 4} loại vật tư khác...
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Không có dữ liệu tỷ trọng số lượng</div>
                )}
              </Card>
            </Col>
          </Row>

          <Card title="Danh sách chi tiết linh kiện & dịch vụ phát sinh đã cung cấp (UC-17.8)" className="glass-card">
            <Table
              dataSource={quotationStatsParsed}
              rowKey="name"
              pagination={{ pageSize: 10 }}
              size="middle"
              columns={[
                { title: 'Tên linh kiện/Vật tư/Hạng mục phụ', dataIndex: 'name', key: 'name', render: (val) => <b>{val}</b> },
                { title: 'Số lượng đã bán', dataIndex: 'quantity', key: 'quantity', align: 'center', render: (val) => `${val} cái/lần` },
                { title: 'Tổng doanh thu mang lại', dataIndex: 'revenue', key: 'revenue', align: 'right', render: (val) => <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{formatVND(val)}</span> },
                { title: 'Tỷ trọng đóng góp doanh thu', dataIndex: 'percentage', key: 'percentage', align: 'right', render: (val) => <b>{val}%</b> },
              ]}
            />
          </Card>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>
            <BarChartOutlined style={{ marginRight: 12 }} />
            Báo cáo Phân tích Hệ thống
          </Title>
          <p>Thống kê chi tiết, trực quan hóa doanh thu và hiệu suất hoạt động</p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              setDateRange(dates);
              setSelectedCustomerId(null); // Reset khách hàng được chọn khi đổi ngày
            }}
            format="DD/MM/YYYY"
            allowClear={false}
            style={{ minWidth: 260 }}
          />
          <Button 
            type="primary" 
            style={{ background: '#107c41', borderColor: '#107c41' }} 
            icon={<DownloadOutlined />} 
            onClick={handleExportCSV}
          >
            Xuất file Excel
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-card" style={{ borderLeft: '4px solid var(--orange)', height: '100%' }}>
            <Statistic
              title="Tổng doanh thu khách trả"
              value={formatVND(summary.total_revenue || 0)}
              prefix={<WalletOutlined style={{ color: 'var(--orange)' }} />}
              valueStyle={{ fontSize: 22, fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>Tổng tiền mặt + cổng VNPAY</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-card" style={{ borderLeft: '4px solid #1677ff', height: '100%' }}>
            <Statistic
              title="Doanh thu qua VNPAY"
              value={formatVND(summary.vnpay_received || 0)}
              prefix={<CreditCardOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>Tiền đã cộng trực tiếp vào tài khoản</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-card" style={{ borderLeft: '4px solid #fa8c16', height: '100%' }}>
            <Statistic
              title="Tiền thợ đang giữ"
              value={formatVND(summary.cash_pending || 0)}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ fontSize: 22, fontWeight: 700, color: '#fa8c16' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>Tiền thợ đã thu hộ - chờ bàn giao</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-card" style={{ borderLeft: '4px solid #52c41a', height: '100%' }}>
            <Statistic
              title="Tiền mặt đã đối soát"
              value={formatVND(summary.cash_settled || 0)}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>Tiền mặt thợ đã nộp đầy đủ về công ty</Text>
          </Card>
        </Col>
      </Row>

      {/* Tabs Phân tích Báo cáo */}
      <Tabs
        type="card"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        items={tabItems}
        style={{ marginBottom: 24 }}
      />
    </div>
  );
}
