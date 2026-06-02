import { Table, Tag, Typography, Card, Row, Col, Statistic } from 'antd';
import { WalletOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatVND, formatDateTime } from '../../utils/helpers';

const { Title } = Typography;

const PAYMENT_STATUS = {
  PAID: { label: 'Đã thanh toán', color: 'success' },
  PENDING: { label: 'Đang xử lý', color: 'processing' },
  UNPAID: { label: 'Chưa thanh toán', color: 'warning' },
  FAILED: { label: 'Thất bại', color: 'error' },
};

const PAYMENT_METHOD = {
  CASH: { label: 'Tiền mặt', color: 'green' },
  VNPAY: { label: 'VNPAY', color: 'cyan' },
};

export default function AdminPaymentsPage() {
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => adminApi.getPayments(),
  });

  const payments = paymentsData?.data?.data || paymentsData?.data || [];

  const totalPaidAmount = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paidCount = payments.filter(p => p.status === 'PAID').length;
  const pendingCount = payments.filter(p => p.status === 'PENDING').length;
  const unpaidCount = payments.filter(p => ['UNPAID', 'FAILED'].includes(p.status)).length;

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
      title: 'Đơn',
      dataIndex: 'booking_id',
      key: 'booking_id',
      render: (id) => <strong style={{ color: 'var(--navy)' }}>#{id}</strong>,
      width: 90,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, record) => record.booking?.customer?.full_name || 'N/A',
    },
    {
      title: 'Dịch vụ',
      key: 'service',
      render: (_, record) => record.booking?.service?.name || 'N/A',
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => <strong style={{ color: 'var(--orange)' }}>{formatVND(amount)}</strong>,
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
      filters: Object.entries(PAYMENT_STATUS).map(([key, val]) => ({ text: val.label, value: key })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => formatDateTime(time),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: 'descend',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Lịch sử thanh toán</Title>
        <p>Quản lý các khoản thanh toán từ khách hàng</p>
      </div>

      <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid var(--orange)' }}>
            <Statistic title="Doanh thu đã thanh toán" value={formatVND(totalPaidAmount)} prefix={<WalletOutlined style={{ color: 'var(--orange)' }} />} valueStyle={{ fontSize: 20, fontWeight: 700, color: 'var(--orange)' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #52c41a' }}>
            <Statistic title="Đã thanh toán" value={paidCount} suffix="giao dịch" prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #1677ff' }}>
            <Statistic title="Đang xử lý" value={pendingCount} suffix="giao dịch" prefix={<ClockCircleOutlined style={{ color: '#1677ff' }} />} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #ff4d4f' }}>
            <Statistic title="Chưa thanh toán / lỗi" value={unpaidCount} suffix="giao dịch" prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Table
          columns={columns}
          dataSource={payments}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng ${total} giao dịch` }}
        />
      </Card>
    </div>
  );
}
