import React, { useState } from 'react';
import { Card, DatePicker, Button, Table, Typography, Statistic, Row, Col, message } from 'antd';
import { DownloadOutlined, BarChartOutlined, WalletOutlined, CreditCardOutlined, MoneyCollectOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatVND, formatDate } from '../../utils/helpers';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function AdminReportsPage() {
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);

  const startDate = dateRange?.[0]?.toISOString();
  const endDate = dateRange?.[1]?.toISOString();

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['admin-revenue-report', startDate, endDate],
    queryFn: () => adminApi.getRevenueReport({ startDate, endDate }),
  });

  const { summary = {}, payments = [] } = reportData?.data || {};

  const handleExportCSV = () => {
    if (!payments.length) {
      message.warning('Không có dữ liệu để xuất!');
      return;
    }

    // Header
    let csvContent = 'Mã đơn,Ngày thanh toán,Khách hàng,Dịch vụ,Thợ phụ trách,Phương thức,Trạng thái,Số tiền\n';

    // Tech grouping for summary
    const techRevenue = {};

    // Rows
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

      // Add to tech summary
      if (techName !== 'N/A') {
        techRevenue[techName] = (techRevenue[techName] || 0) + Number(amount);
      }

      csvContent += `${id},${date},${customer},${service},${tech},${method},${status},${amount}\n`;
    });

    // Add empty row for spacing
    csvContent += `\n`;
    
    // Add Summary Section
    csvContent += `TỔNG QUAN DOANH THU\n`;
    csvContent += `Tổng doanh thu,,,,,,,${summary.total_revenue || 0}\n`;
    csvContent += `Doanh thu VNPAY,,,,,,,${summary.vnpay_received || 0}\n`;
    csvContent += `Doanh thu Tiền mặt,,,,,,,${summary.cash_collected || 0}\n`;

    // Add empty row for spacing
    csvContent += `\n`;

    // Add Tech Revenue Section
    if (Object.keys(techRevenue).length > 0) {
      csvContent += `THỐNG KÊ THEO KỸ THUẬT VIÊN\n`;
      csvContent += `Kỹ thuật viên,Tổng doanh thu\n`;
      Object.entries(techRevenue).sort((a, b) => b[1] - a[1]).forEach(([name, rev]) => {
        csvContent += `"${name}",${rev}\n`;
      });
    }

    // Create Blob and download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for Excel UTF-8 BOM
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bao_cao_doanh_thu_${dayjs().format('YYYYMMDD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: ['booking', 'id'],
      key: 'id',
      render: (id) => <b>#{id}</b>,
    },
    {
      title: 'Ngày thanh toán',
      dataIndex: 'paid_at',
      key: 'paid_at',
      render: (val) => (val ? formatDate(val) : 'N/A'),
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
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (val) => <b style={{ color: 'var(--orange)' }}>{formatVND(val)}</b>,
      align: 'right',
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>
            <BarChartOutlined style={{ marginRight: 12 }} />
            Báo cáo Doanh thu
          </Title>
          <p>Thống kê và xuất dữ liệu doanh thu theo khoảng thời gian</p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            format="DD/MM/YYYY"
            allowClear={false}
          />
          <Button type="primary" style={{ background: '#107c41', borderColor: '#107c41' }} icon={<DownloadOutlined />} onClick={handleExportCSV}>
            Xuất file Excel
          </Button>
        </div>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <Card className="glass-card" style={{ borderLeft: '4px solid var(--orange)' }}>
            <Statistic
              title="Tổng doanh thu"
              value={formatVND(summary.total_revenue || 0)}
              prefix={<WalletOutlined style={{ color: 'var(--orange)' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="glass-card" style={{ borderLeft: '4px solid #1677ff' }}>
            <Statistic
              title="Doanh thu VNPAY"
              value={formatVND(summary.vnpay_received || 0)}
              prefix={<CreditCardOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="glass-card" style={{ borderLeft: '4px solid #52c41a' }}>
            <Statistic
              title="Doanh thu Tiền mặt"
              value={formatVND(summary.cash_collected || 0)}
              prefix={<MoneyCollectOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Danh sách chi tiết giao dịch" className="glass-card">
        <Table
          dataSource={payments}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}
