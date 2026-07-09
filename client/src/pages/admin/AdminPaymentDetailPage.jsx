import { Card, Typography, Tag, Space, Spin, Descriptions, Table, Timeline, Button, Divider, Row, Col, Avatar, Modal, message } from 'antd';
import {
  ArrowLeftOutlined, UserOutlined, ToolOutlined, EnvironmentOutlined,
  WalletOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { formatVND, formatDateTime, formatDate } from '../../utils/helpers';

const { Title, Text } = Typography;

const PAYMENT_STATUS = {
  PAID:    { label: 'Đã thanh toán', color: 'success',    icon: <CheckCircleOutlined /> },
  PENDING: { label: 'Đang xử lý',   color: 'processing', icon: <ClockCircleOutlined /> },
  UNPAID:  { label: 'Chưa thanh toán', color: 'warning', icon: <ClockCircleOutlined /> },
  FAILED:  { label: 'Thất bại',     color: 'error',      icon: <CloseCircleOutlined /> },
};

const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận',
  ASSIGNED: 'Đã gán thợ', IN_PROGRESS: 'Đang thực hiện',
  INSPECTING: 'Đang khảo sát', QUOTED: 'Chờ duyệt báo giá',
  COMPLETING: 'Đang sửa chữa', AWAITING_PAYMENT: 'Chờ thanh toán',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

const getSettlementConfig = (payment) => {
  if (payment.method === 'VNPAY' && payment.status === 'PAID') {
    return { label: 'HomeFix đã nhận qua VNPAY', color: 'cyan' };
  }
  if (payment.method !== 'CASH' || payment.status !== 'PAID') {
    return { label: 'Chưa phát sinh đối soát', color: 'default' };
  }
  if (payment.settlement_status === 'SETTLED') {
    return { label: 'Đã bàn giao cho HomeFix', color: 'success' };
  }
  return { label: 'Kỹ thuật viên đang giữ tiền', color: 'warning' };
};

export default function AdminPaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payment-detail', id],
    queryFn: () => adminApi.getPaymentById(id),
  });

  const settlementMutation = useMutation({
    mutationFn: () => adminApi.confirmCashSettlement(id),
    onSuccess: () => {
      message.success('Đã xác nhận HomeFix nhận đủ tiền mặt');
      queryClient.invalidateQueries({ queryKey: ['admin-payment-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err) => message.error(err.message || 'Không thể xác nhận bàn giao tiền mặt'),
  });

  const payment = data?.data;

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Text type="secondary">Không tìm thấy giao dịch</Text>
      </div>
    );
  }

  const booking = payment.booking;
  const customer = booking?.customer;
  const technician = booking?.technicianProfile?.user;
  const statusCfg = PAYMENT_STATUS[payment.status] || { label: payment.status, color: 'default' };
  const acceptedQuotation = booking?.quotations?.[0];
  const settlementCfg = getSettlementConfig(payment);
  const canConfirmCashSettlement = payment.method === 'CASH'
    && payment.status === 'PAID'
    && payment.settlement_status === 'PENDING';

  const handleConfirmCashSettlement = () => {
    Modal.confirm({
      title: 'Xác nhận đã nhận tiền mặt?',
      content: `HomeFix xác nhận đã nhận đủ ${formatVND(payment.amount)} do kỹ thuật viên bàn giao. Thao tác này không thể thực hiện lại.`,
      okText: 'Xác nhận đã nhận',
      cancelText: 'Kiểm tra lại',
      onOk: () => settlementMutation.mutateAsync(),
    });
  };

  const quotationColumns = [
    { title: 'Hạng mục', dataIndex: 'item_name', key: 'item_name' },
    { title: 'SL', dataIndex: 'quantity', key: 'quantity', align: 'center', width: 60 },
    { title: 'Đơn giá', dataIndex: 'unit_price', key: 'unit_price', render: (v) => formatVND(v) },
    {
      title: 'Thành tiền',
      key: 'total',
      render: (_, r) => <Text strong style={{ color: 'var(--orange)' }}>{formatVND(r.quantity * r.unit_price)}</Text>,
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/admin/payments')}
          type="text"
          size="large"
        />
        <div>
          <Title level={2} style={{ color: 'var(--navy)', margin: 0 }}>
            Chi tiết giao dịch #{payment.id}
          </Title>
          <Text type="secondary">Đơn hàng #{payment.booking_id} · {formatDateTime(payment.created_at)}</Text>
        </div>
        <Tag
          color={statusCfg.color}
          icon={statusCfg.icon}
          style={{ fontSize: 14, padding: '6px 14px', borderRadius: 20, marginLeft: 'auto' }}
        >
          {statusCfg.label}
        </Tag>
      </div>

      <Row gutter={[20, 20]}>
        {/* Left column */}
        <Col xs={24} lg={14}>
          {/* Payment Summary Card */}
          <Card
            style={{
              borderRadius: 16,
              background: 'linear-gradient(135deg, var(--navy) 0%, #1a3a6e 100%)',
              color: '#fff',
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <WalletOutlined style={{ fontSize: 22, color: '#fff' }} />
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Tổng thanh toán</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{formatVND(payment.amount)}</div>
              </div>
            </div>
            <Divider style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>Phương thức</div>
                <Tag color={payment.method === 'CASH' ? 'green' : 'cyan'} style={{ fontWeight: 600 }}>
                  {payment.method === 'CASH' ? '💵 Tiền mặt' : '💳 VNPAY'}
                </Tag>
              </Col>
              <Col span={12}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>Thanh toán lúc</div>
                <div style={{ color: '#fff', fontSize: 13 }}>{payment.paid_at ? formatDateTime(payment.paid_at) : '---'}</div>
              </Col>
            </Row>
            {payment.transaction_code && (
              <>
                <Divider style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '12px 0' }} />
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>Mã giao dịch</div>
                <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>
                  {payment.transaction_code}
                </div>
              </>
            )}
            {payment.vnpay_txn_ref && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>VNPAY Ref</div>
                <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: 13 }}>{payment.vnpay_txn_ref}</div>
              </div>
            )}
            {payment.failed_reason && (
              <div style={{ marginTop: 12, background: 'rgba(255,77,79,0.2)', padding: '8px 12px', borderRadius: 8 }}>
                <Text style={{ color: '#ff7875', fontSize: 13 }}>❌ {payment.failed_reason}</Text>
              </div>
            )}
          </Card>

          {/* Booking Info */}
          <Card title="Thông tin đơn hàng" style={{ borderRadius: 16, marginBottom: 20 }}>
            <Descriptions column={2} size="small" labelStyle={{ color: '#888', fontWeight: 500 }}>
              <Descriptions.Item label="Mã đơn" span={1}>
                <Text strong style={{ color: 'var(--navy)' }}>#{booking?.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái đơn" span={1}>
                <Tag color={booking?.status === 'COMPLETED' ? 'success' : booking?.status === 'CANCELLED' ? 'error' : booking?.status === 'AWAITING_PAYMENT' ? 'warning' : 'processing'}>
                  {BOOKING_STATUS_LABELS[booking?.status] || booking?.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Dịch vụ" span={2}>
                <Text strong>{booking?.service?.name}</Text>
                {booking?.service?.category && (
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>({booking.service.category.name})</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày đặt" span={1}>
                <Space>
                  <CalendarOutlined style={{ color: 'var(--orange)' }} />
                  {booking?.booking_date ? formatDate(booking.booking_date) : '---'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Giờ" span={1}>
                {booking?.time_slot_start} - {booking?.time_slot_end}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ" span={2}>
                <Space>
                  <EnvironmentOutlined style={{ color: 'var(--orange)' }} />
                  <Text>{booking?.address_detail}, {booking?.ward?.name}, {booking?.district?.name}</Text>
                </Space>
              </Descriptions.Item>
              {booking?.voucher && (
                <Descriptions.Item label="Voucher dùng" span={2}>
                  <Tag color="orange" style={{ fontWeight: 700 }}>{booking.voucher.code}</Tag>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Price Breakdown */}
          <Card title="Chi tiết thanh toán" style={{ borderRadius: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Text>{acceptedQuotation ? 'Tạm tính báo giá đã duyệt' : 'Giá dịch vụ dự kiến'}</Text>
              <Text strong>{formatVND(acceptedQuotation?.total_extra_price || Number(booking?.estimated_price || 0) + Number(booking?.discount_amount || 0))}</Text>
            </div>
            {booking?.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Text style={{ color: '#52c41a' }}>Giảm giá (voucher)</Text>
                <Text strong style={{ color: '#52c41a' }}>- {formatVND(booking.discount_amount)}</Text>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px' }}>
              <Title level={5} style={{ margin: 0 }}>Tổng cộng</Title>
              <Title level={4} style={{ margin: 0, color: 'var(--orange)' }}>{formatVND(payment.amount)}</Title>
            </div>
          </Card>

          {/* Quotation Items */}
          {acceptedQuotation?.items?.length > 0 && (
            <Card title="Hạng mục báo giá được duyệt" style={{ borderRadius: 16, marginBottom: 20 }}>
              <Table
                columns={quotationColumns}
                dataSource={acceptedQuotation.items}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </Col>

        {/* Right column */}
        <Col xs={24} lg={10}>
          {/* Customer */}
          <Card title={<Space><UserOutlined /> Khách hàng</Space>} style={{ borderRadius: 16, marginBottom: 20 }}>
            <Space style={{ width: '100%' }} direction="vertical" size={12}>
              <Space>
                <Avatar
                  src={customer?.avatar_url}
                  icon={<UserOutlined />}
                  size={48}
                  style={{ background: 'var(--navy)' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{customer?.full_name}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{customer?.email}</Text>
                </div>
              </Space>
              <Divider style={{ margin: '4px 0' }} />
              <div>📞 <Text>{customer?.phone || 'Chưa có số điện thoại'}</Text></div>
            </Space>
          </Card>

          {/* Technician */}
          {technician && (
            <Card title={<Space><ToolOutlined /> Kỹ thuật viên</Space>} style={{ borderRadius: 16, marginBottom: 20 }}>
              <Space style={{ width: '100%' }} direction="vertical" size={12}>
                <Space>
                  <Avatar
                    icon={<UserOutlined />}
                    size={48}
                    style={{ background: '#1677ff' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{technician.full_name}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{technician.email}</Text>
                  </div>
                </Space>
                <Divider style={{ margin: '4px 0' }} />
                <div>📞 <Text>{technician.phone || 'N/A'}</Text></div>
                {payment.confirmer && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ✅ Xác nhận thu tiền bởi: <Text strong>{payment.confirmer.full_name}</Text>
                    </Text>
                  </div>
                )}
              </Space>
            </Card>
          )}

          <Card title="Đối soát dòng tiền" style={{ borderRadius: 16, marginBottom: 20 }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <Text type="secondary">Tình trạng tiền</Text>
                <Tag color={settlementCfg.color}>{settlementCfg.label}</Tag>
              </div>
              {payment.method === 'CASH' && payment.confirmer && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <Text type="secondary">Người thu từ khách</Text>
                  <Text strong>{payment.confirmer.full_name}</Text>
                </div>
              )}
              {payment.method === 'CASH' && payment.paid_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <Text type="secondary">Thu từ khách lúc</Text>
                  <Text>{formatDateTime(payment.paid_at)}</Text>
                </div>
              )}
              {payment.settlement_status === 'SETTLED' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <Text type="secondary">Admin nhận tiền</Text>
                    <Text strong>{payment.settler?.full_name || 'Admin'}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <Text type="secondary">Bàn giao lúc</Text>
                    <Text>{payment.settled_at ? formatDateTime(payment.settled_at) : '---'}</Text>
                  </div>
                  {payment.settlement_note && <Text type="secondary">{payment.settlement_note}</Text>}
                </>
              )}
              {canConfirmCashSettlement && (
                <Button
                  type="primary"
                  block
                  icon={<CheckCircleOutlined />}
                  loading={settlementMutation.isPending}
                  onClick={handleConfirmCashSettlement}
                >
                  Xác nhận HomeFix đã nhận tiền
                </Button>
              )}
            </Space>
          </Card>

          {/* Status History */}
          {booking?.statusHistories?.length > 0 && (
            <Card title="Lịch sử trạng thái đơn" style={{ borderRadius: 16 }}>
              <Timeline
                mode="left"
                items={booking.statusHistories.map((h, i) => ({
                  key: i,
                  color: h.to_status === 'COMPLETED' ? 'green' : h.to_status === 'CANCELLED' ? 'red' : 'blue',
                  label: <Text type="secondary" style={{ fontSize: 11 }}>{formatDateTime(h.created_at)}</Text>,
                  children: (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {BOOKING_STATUS_LABELS[h.to_status] || h.to_status}
                      </div>
                      {h.note && <Text type="secondary" style={{ fontSize: 12 }}>{h.note}</Text>}
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                        bởi: {h.user?.full_name} ({h.user?.role})
                      </div>
                    </div>
                  ),
                }))}
              />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
