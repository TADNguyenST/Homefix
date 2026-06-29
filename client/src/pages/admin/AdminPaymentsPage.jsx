import { useState } from 'react';
import { Table, Tag, Typography, Card, Row, Col, Statistic, Select, Space, Button } from 'antd';
import {
  WalletOutlined, CheckCircleOutlined, ClockCircleOutlined,
  EyeOutlined, FilterOutlined, CreditCardOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { formatVND, formatDateTime } from '../../utils/helpers';

const { Title, Text } = Typography;
const { Option } = Select;

const PAYMENT_STATUS = {
  PAID:    { label: 'Đã thanh toán', color: 'success' },
  PENDING: { label: 'Đang xử lý',   color: 'processing' },
  UNPAID:  { label: 'Chưa thanh toán', color: 'warning' },
  FAILED:  { label: 'Thất bại',     color: 'error' },
};

const PAYMENT_METHOD = {
  CASH:  { label: 'Tiền mặt', color: 'green' },
  VNPAY: { label: 'VNPAY',    color: 'cyan' },
};

const getSettlementConfig = (payment) => {
  if (payment.method === 'VNPAY' && payment.status === 'PAID') {
    return { label: 'HomeFix nhận qua VNPAY', color: 'cyan' };
  }
  if (payment.method !== 'CASH' || payment.status !== 'PAID') {
    return { label: 'Chưa phát sinh', color: 'default' };
  }
  if (payment.settlement_status === 'SETTLED') {
    return { label: 'Đã bàn giao HomeFix', color: 'success' };
  }
  return { label: 'Kỹ thuật viên đang giữ', color: 'warning' };
};

export default function AdminPaymentsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    method: undefined,
    status: undefined,
    settlement_status: undefined,
    page: 1,
    limit: 12,
  });

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['admin-payments', filters],
    queryFn: () => adminApi.getPayments(filters),
  });

  const payments = Array.isArray(paymentsData?.data) ? paymentsData.data : [];
  const summary = paymentsData?.summary || {};

  const columns = [
    {
      title: 'Mã giao dịch',
      dataIndex: 'transaction_code',
      key: 'transaction_code',
      render: (id) => (
        <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 13 }}>
          {id || <span style={{ color: '#bbb' }}>---</span>}
        </span>
      ),
    },
    {
      title: 'Đơn #',
      dataIndex: 'booking_id',
      key: 'booking_id',
      render: (id) => <strong style={{ color: 'var(--navy)' }}>#{id}</strong>,
      width: 80,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{record.booking?.customer?.full_name || 'N/A'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.booking?.customer?.phone || ''}</Text>
        </Space>
      ),
    },
    {
      title: 'Dịch vụ',
      key: 'service',
      render: (_, record) => record.booking?.service?.name || 'N/A',
      ellipsis: true,
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => <strong style={{ color: 'var(--orange)', fontSize: 14 }}>{formatVND(amount)}</strong>,
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
    },
    {
      title: 'Phương thức',
      dataIndex: 'method',
      key: 'method',
      render: (method) => {
        const cfg = PAYMENT_METHOD[method] || { label: method || '---', color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const cfg = PAYMENT_STATUS[status] || { label: status, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Dòng tiền',
      key: 'settlement_status',
      render: (_, record) => {
        const cfg = getSettlementConfig(record);
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => <Text style={{ fontSize: 12 }}>{formatDateTime(time)}</Text>,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: 'descend',
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          style={{ color: '#1677ff' }}
          onClick={(e) => { e.stopPropagation(); navigate(`/admin/payments/${record.id}`); }}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 4 }}>Thanh toán</Title>
        <Text type="secondary">Quản lý tất cả giao dịch thanh toán từ khách hàng</Text>
      </div>

      <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid var(--orange)' }}>
            <Statistic
              title="Tổng doanh thu đã thanh toán"
              value={formatVND(summary.total_revenue || 0)}
              prefix={<WalletOutlined style={{ color: 'var(--orange)' }} />}
              valueStyle={{ fontSize: 18, fontWeight: 700, color: 'var(--orange)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #52c41a' }}>
            <Statistic
              title="HomeFix đã thực nhận"
              value={formatVND(summary.homefix_received || 0)}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #1677ff' }}>
            <Statistic
              title="VNPAY đã nhận"
              value={formatVND(summary.vnpay_received || 0)}
              prefix={<CreditCardOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #ff4d4f' }}>
            <Statistic
              title="Tiền mặt chờ bàn giao"
              value={formatVND(summary.cash_pending || 0)}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ fontSize: 18, fontWeight: 700, color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {/* Filters */}
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            allowClear
            placeholder="Phương thức"
            style={{ width: 140 }}
            onChange={(val) => setFilters(f => ({ ...f, method: val, page: 1 }))}
            suffixIcon={<FilterOutlined />}
          >
            <Option value="CASH">Tiền mặt</Option>
            <Option value="VNPAY">VNPAY</Option>
          </Select>
          <Select
            allowClear
            placeholder="Trạng thái"
            style={{ width: 160 }}
            onChange={(val) => setFilters(f => ({ ...f, status: val, page: 1 }))}
          >
            {Object.entries(PAYMENT_STATUS).map(([key, val]) => (
              <Option key={key} value={key}>{val.label}</Option>
            ))}
          </Select>
          <Select
            allowClear
            placeholder="Đối soát tiền mặt"
            style={{ width: 190 }}
            onChange={(val) => setFilters(f => ({ ...f, settlement_status: val, page: 1 }))}
          >
            <Option value="PENDING">Chờ bàn giao</Option>
            <Option value="SETTLED">Đã bàn giao</Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={payments}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: paymentsData?.pagination?.total || 0,
            showSizeChanger: false,
            showTotal: (total) => `Tổng ${total} giao dịch`,
            onChange: (page) => setFilters(f => ({ ...f, page })),
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/admin/payments/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          rowClassName={() => 'clickable-row'}
        />
      </Card>
    </div>
  );
}
