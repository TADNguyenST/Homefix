import { useState } from 'react';
import { Card, Steps, Button, Typography, Tag, Descriptions, Space, Spin, message, Modal, Divider } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { bookingApi, quotationApi } from '../../api/bookingApi';
import { paymentApi } from '../../api/paymentApi';
import { useParams, useNavigate } from 'react-router-dom';
import { formatVND, formatDateTime, formatDate } from '../../utils/helpers';
import { BOOKING_STATUS_STEPS, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, CUSTOMER_CANCELLABLE } from '../../utils/constants';
import { UserOutlined, PhoneOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const { data: bookingData, isLoading, refetch } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingApi.getById(id),
  });

  const { data: quotationData } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationApi.getByBooking(id),
    enabled: bookingData?.data?.status === 'QUOTED' || bookingData?.data?.status === 'COMPLETING' || bookingData?.data?.status === 'COMPLETED',
  });

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  const booking = bookingData?.data;
  if (!booking) return <div>Không tìm thấy đơn hàng</div>;

  const currentStepIndex = BOOKING_STATUS_STEPS.indexOf(booking.status);
  
  const handleCancel = () => {
    Modal.confirm({
      title: 'Hủy đơn đặt lịch?',
      content: 'Bạn có chắc chắn muốn hủy đơn này không? Hành động này không thể hoàn tác.',
      okText: 'Xác nhận hủy',
      okType: 'danger',
      cancelText: 'Quay lại',
      onOk: async () => {
        try {
          setIsCancelling(true);
          await bookingApi.cancel(id, { reason: 'Khách hàng đổi ý' });
          message.success('Đã hủy đơn thành công');
          refetch();
        } catch (err) {
          message.error(err.message || 'Lỗi khi hủy đơn');
        } finally {
          setIsCancelling(false);
        }
      }
    });
  };

  const handlePayment = async () => {
    try {
      setIsPaying(true);
      const res = await paymentApi.createVnpay(id);
      if (res.data?.payment_url) {
        window.location.href = res.data.payment_url;
      }
    } catch (err) {
      message.error(err.message || 'Lỗi khi tạo thanh toán');
    } finally {
      setIsPaying(false);
    }
  };

  const colorCfg = BOOKING_STATUS_COLORS[booking.status] || { color: '#000', bg: '#eee' };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>
            Chi tiết đơn #{booking.id}
          </Title>
          <Space>
            <Tag color={colorCfg.bg} style={{ color: colorCfg.color, border: 'none', fontWeight: 600, padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>
              {BOOKING_STATUS_LABELS[booking.status]}
            </Tag>
            <Text type="secondary">Tạo lúc: {formatDateTime(booking.created_at)}</Text>
          </Space>
        </div>
        <Space>
          {CUSTOMER_CANCELLABLE.includes(booking.status) && (
            <Button danger onClick={handleCancel} loading={isCancelling}>Hủy đơn</Button>
          )}
          {booking.status === 'COMPLETED' && booking.payment?.status === 'UNPAID' && booking.payment_method === 'VNPAY' && (
            <Button type="primary" onClick={handlePayment} loading={isPaying}>Thanh toán ngay</Button>
          )}
          {booking.status === 'COMPLETED' && (
            <Button type="primary" onClick={() => navigate(`/customer/reviews/new/${id}`)}>Đánh giá thợ</Button>
          )}
        </Space>
      </div>

      <Card className="glass-card" style={{ marginBottom: 24 }}>
        <Steps 
          current={currentStepIndex >= 0 ? currentStepIndex : 0} 
          status={booking.status === 'CANCELLED' ? 'error' : 'process'}
          items={BOOKING_STATUS_STEPS.map(status => ({
            title: BOOKING_STATUS_LABELS[status],
          }))} 
        />
        {booking.status === 'CANCELLED' && (
          <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--status-cancelled)', fontWeight: 600 }}>
            Đơn hàng đã bị hủy
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <Space direction="vertical" size="large" style={{ display: 'flex' }}>
          <Card title="Thông tin dịch vụ" className="glass-card">
            <Descriptions column={1} labelStyle={{ fontWeight: 500, color: 'var(--text-secondary)', width: 150 }}>
              <Descriptions.Item label="Dịch vụ"><Text strong>{booking.service?.name}</Text></Descriptions.Item>
              <Descriptions.Item label="Thời gian hẹn">{formatDate(booking.booking_date)} {booking.time_slot_start}</Descriptions.Item>
              <Descriptions.Item label="Mô tả sự cố">{booking.description}</Descriptions.Item>
              {booking.aiAnalyses?.[0]?.tech_summary && (
                <Descriptions.Item label="AI Chẩn đoán">
                  <div style={{ background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                    {booking.aiAnalyses[0].tech_summary}
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {quotationData?.data && (
            <Card title="Báo giá chi tiết" className="glass-card" extra={<Button type="link" onClick={() => navigate(`/customer/quotations/${quotationData.data.id}`)}>Xem chi tiết</Button>}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text>Tổng tiền dịch vụ và vật tư:</Text>
                <Title level={4} style={{ color: 'var(--orange)', margin: 0 }}>{formatVND(quotationData.data.total_extra_price)}</Title>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Trạng thái báo giá:</Text>
                <Tag color={quotationData.data.status === 'ACCEPTED' ? 'success' : quotationData.data.status === 'REJECTED' ? 'error' : 'warning'}>
                  {quotationData.data.status === 'ACCEPTED' ? 'Đã duyệt' : quotationData.data.status === 'REJECTED' ? 'Đã từ chối' : 'Chờ duyệt'}
                </Tag>
              </div>
              {booking.status === 'QUOTED' && quotationData.data.status === 'PENDING' && (
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <Button type="primary" onClick={() => navigate(`/customer/quotations/${quotationData.data.id}`)}>
                    Kiểm tra và duyệt báo giá
                  </Button>
                </div>
              )}
            </Card>
          )}
        </Space>

        <Space direction="vertical" size="large" style={{ display: 'flex' }}>
          <Card title="Kỹ thuật viên" className="glass-card">
            {booking.technicianProfile ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-primary)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--navy)' }}>
                  <UserOutlined />
                </div>
                <Title level={5} style={{ margin: 0 }}>{booking.technicianProfile?.user?.full_name}</Title>
                <div style={{ color: 'var(--text-secondary)', marginBottom: 16 }}><SafetyCertificateOutlined /> Đã xác minh</div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <PhoneOutlined /> {booking.technicianProfile?.user?.phone}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                Đang tìm kỹ thuật viên phù hợp...
              </div>
            )}
          </Card>

          <Card title="Địa chỉ thực hiện" className="glass-card">
            <Text type="secondary">{booking.address_detail}, {booking.ward?.name}, {booking.district?.name}</Text>
          </Card>
        </Space>
      </div>
    </div>
  );
}