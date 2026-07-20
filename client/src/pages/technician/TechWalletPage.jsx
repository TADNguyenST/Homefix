import { Card, Col, Row, Statistic, Table, Tag, Typography, Space, Spin, Tooltip } from 'antd';
import {
  WalletOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { technicianApi } from '../../api/technicianApi';
import { formatVND, formatDateTime, formatDate } from '../../utils/helpers';

const { Title, Text } = Typography;

export default function TechWalletPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tech-cash-wallet'],
    queryFn: () => technicianApi.getMyCashWallet(),
  });

  const wallet = data?.data;
  const payments = wallet?.payments || [];

  const columns = [
    {
      title: 'Đơn #',
      dataIndex: 'booking_id',
      key: 'booking_id',
      width: 70,
      render: (id) => <strong style={{ color: 'var(--navy)' }}>#{id}</strong>,
    },
    {
      title: 'Dịch vụ',
      dataIndex: 'service_name',
      key: 'service_name',
      ellipsis: true,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{record.customer_name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.customer_phone}</Text>
        </Space>
      ),
    },
    {
      title: 'Ngày sửa',
      dataIndex: 'booking_date',
      key: 'booking_date',
      render: (val) => formatDate(val),
    },
    {
      title: 'Số tiền thu hộ',
      dataIndex: 'amount',
      key: 'amount',
      render: (val) => (
        <Text strong style={{ color: 'var(--orange)', fontSize: 14 }}>{formatVND(val)}</Text>
      ),
      sorter: (a, b) => a.amount - b.amount,
      defaultSortOrder: 'descend',
    },
    {
      title: 'Ngày thanh toán',
      dataIndex: 'paid_at',
      key: 'paid_at',
      render: (val) => formatDateTime(val),
    },
    {
      title: 'Trạng thái bàn giao',
      dataIndex: 'settlement_status',
      key: 'settlement_status',
      render: (status, record) => {
        if (status === 'SETTLED') {
          return (
            <Tooltip title={record.settlement_note ? `Ghi chú: ${record.settlement_note}` : 'Đã bàn giao'}>
              <Tag color="success" icon={<CheckCircleOutlined />}>Đã bàn giao HomeFix</Tag>
            </Tooltip>
          );
        }
        return <Tag color="warning" icon={<ClockCircleOutlined />}>Chờ bàn giao</Tag>;
      },
    },
  ];

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  const pendingCount = payments.filter(p => p.settlement_status === 'PENDING').length;

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 4 }}>
          <WalletOutlined style={{ marginRight: 10 }} />
          Ví tiền mặt của tôi
        </Title>
        <Text type="secondary">
          Theo dõi tiền mặt thu hộ từ khách và trạng thái bàn giao về HomeFix
        </Text>
      </div>

      {/* Summary Cards */}
      <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
        <Col xs={24} sm={8}>
          <Card
            style={{
              borderRadius: 16,
              borderTop: '4px solid var(--navy)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}
          >
            <Statistic
              title={
                <Space>
                  <Text style={{ color: 'var(--text-secondary)' }}>Tổng đã thu hộ</Text>
                  <Tooltip title="Tổng tiền mặt đã nhận từ khách hàng (cả đã và chưa bàn giao HomeFix)">
                    <InfoCircleOutlined style={{ color: '#bbb' }} />
                  </Tooltip>
                </Space>
              }
              value={formatVND(wallet?.total_collected || 0)}
              prefix={<DollarOutlined style={{ color: 'var(--navy)' }} />}
              valueStyle={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card
            style={{
              borderRadius: 16,
              borderTop: '4px solid #52c41a',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}
          >
            <Statistic
              title={
                <Space>
                  <Text style={{ color: 'var(--text-secondary)' }}>Đã bàn giao HomeFix</Text>
                  <Tooltip title="Số tiền bạn đã bàn giao về cho HomeFix và đã được xác nhận">
                    <InfoCircleOutlined style={{ color: '#bbb' }} />
                  </Tooltip>
                </Space>
              }
              value={formatVND(wallet?.total_settled || 0)}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card
            style={{
              borderRadius: 16,
              borderTop: '4px solid var(--orange)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {(wallet?.total_pending || 0) > 0 && (
              <div style={{
                position: 'absolute',
                top: 0, right: 0,
                background: 'linear-gradient(135deg, var(--orange), #ff7a00)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderBottomLeftRadius: 8,
              }}>
                {pendingCount} đơn chờ bàn giao
              </div>
            )}
            <Statistic
              title={
                <Space>
                  <Text style={{ color: 'var(--text-secondary)' }}>Đang giữ (chờ bàn giao)</Text>
                  <Tooltip title="Số tiền bạn đang giữ hộ, cần bàn giao về HomeFix">
                    <InfoCircleOutlined style={{ color: '#bbb' }} />
                  </Tooltip>
                </Space>
              }
              value={formatVND(wallet?.total_pending || 0)}
              prefix={<ClockCircleOutlined style={{ color: 'var(--orange)' }} />}
              valueStyle={{ fontSize: 22, fontWeight: 700, color: 'var(--orange)' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Notice Banner */}
      {(wallet?.total_pending || 0) > 0 && (
        <Card
          style={{
            background: 'linear-gradient(135deg, #fff7e6 0%, #fff3e0 100%)',
            border: '1px solid #ffd591',
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          <Space>
            <ClockCircleOutlined style={{ color: 'var(--orange)', fontSize: 20 }} />
            <div>
              <Text strong style={{ color: '#d46b08' }}>
                Bạn đang giữ {formatVND(wallet?.total_pending || 0)} chưa bàn giao
              </Text>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Vui lòng liên hệ HomeFix hoặc đến văn phòng để bàn giao tiền mặt. 
                  Admin sẽ xác nhận sau khi nhận đủ tiền.
                </Text>
              </div>
            </div>
          </Space>
        </Card>
      )}

      {/* Transaction History */}
      <Card
        title={
          <Space>
            <WalletOutlined style={{ color: 'var(--navy)' }} />
            <span>Lịch sử giao dịch tiền mặt</span>
          </Space>
        }
        style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        {payments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <WalletOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block', opacity: 0.3 }} />
            <Text type="secondary">Bạn chưa có giao dịch tiền mặt nào</Text>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={payments}
            rowKey="id"
            pagination={{ pageSize: 10, showTotal: (total) => `Tổng ${total} giao dịch` }}
            rowClassName={(record) => record.settlement_status === 'PENDING' ? 'pending-row' : ''}
          />
        )}
      </Card>
    </div>
  );
}
