import { useState } from 'react';
import { Card, Steps, Button, Typography, Tag, Descriptions, Space, Spin, message, Modal, Divider, Timeline, Image, DatePicker, Select, Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { bookingApi, quotationApi } from '../../api/bookingApi';
import { paymentApi } from '../../api/paymentApi';
import { useParams, useNavigate } from 'react-router-dom';
import { formatVND, formatDateTime, formatDate, isBookingSlotAvailable } from '../../utils/helpers';
import { BOOKING_STATUS_STEPS, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, CUSTOMER_CANCELLABLE, BOOKING_TIME_SLOTS } from '../../utils/constants';
import { UserOutlined, PhoneOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const resolveImageUrl = (url) => (url?.startsWith('http') ? url : `${API_ORIGIN}${url}`);
const toNumber = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [rescheduleSlotValue, setRescheduleSlotValue] = useState(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const { data: bookingData, isLoading, refetch } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingApi.getById(id),
  });

  const { data: quotationData } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationApi.getByBooking(id),
    enabled: ['QUOTED', 'COMPLETING', 'AWAITING_PAYMENT', 'COMPLETED'].includes(bookingData?.data?.status),
  });

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  const booking = bookingData?.data;
  if (!booking) return <div>Không tìm thấy đơn hàng</div>;

  const currentStepIndex = BOOKING_STATUS_STEPS.indexOf(booking.status);
  const quotations = Array.isArray(quotationData?.data) ? quotationData.data : [];
  const currentQuotation = quotations.find(q => q.status === 'PENDING')
    || quotations.find(q => q.status === 'ACCEPTED')
    || quotations[0];
  const quotationSubtotal = currentQuotation ? toNumber(currentQuotation.total_extra_price) : 0;
  const quotationDiscount = currentQuotation ? toNumber(booking.discount_amount) : 0;
  const quotationPayable = currentQuotation
    ? Math.max(0, quotationSubtotal - quotationDiscount)
    : toNumber(booking.final_price ?? booking.payment?.amount ?? booking.estimated_price);
  const timelineItems = [...(booking.statusHistories || [])]
    .reverse()
    .map(item => ({
      color: item.to_status === 'CANCELLED' ? 'red' : item.to_status === 'COMPLETED' ? 'green' : 'blue',
      children: (
        <div>
          <Text strong>{BOOKING_STATUS_LABELS[item.to_status] || item.to_status}</Text>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDateTime(item.created_at)}</div>
          {item.note && <div style={{ marginTop: 4 }}>{item.note}</div>}
        </div>
      ),
    }));
  const canReschedule = ['PENDING', 'CONFIRMED', 'ASSIGNED'].includes(booking.status);
  
  const customerImages = booking.images?.filter(img => img.uploaded_by === 'CUSTOMER') || [];
  const technicianImages = booking.images?.filter(img => img.uploaded_by === 'TECHNICIAN') || [];
  const completionHistory = booking.statusHistories?.find(h => h.to_status === 'AWAITING_PAYMENT');
  const completionNoteText = completionHistory?.note;
  
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
      } else {
        message.success(res.message || res.data?.message || 'Thanh toán thành công');
        refetch();
      }
    } catch (err) {
      message.error(err.message || 'Lỗi khi tạo thanh toán');
    } finally {
      setIsPaying(false);
    }
  };

  const handleReschedule = async () => {
    const selectedSlot = BOOKING_TIME_SLOTS.find(slot => slot.value === rescheduleSlotValue);
    if (!rescheduleDate || !selectedSlot) {
      message.warning('Vui lòng chọn ngày và ca sửa chữa mới');
      return;
    }

    try {
      setIsRescheduling(true);
      await bookingApi.reschedule(id, {
        booking_date: rescheduleDate.format('YYYY-MM-DD'),
        time_slot_start: selectedSlot.start,
        time_slot_end: selectedSlot.end,
      });
      message.success('Đổi lịch thành công');
      setIsRescheduleOpen(false);
      setRescheduleDate(null);
      setRescheduleSlotValue(null);
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi đổi lịch');
    } finally {
      setIsRescheduling(false);
    }
  };

  const handlePrintReceipt = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Biên nhận thanh toán #${booking.id}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; }
            .receipt-container { max-width: 600px; margin: 0 auto; border: 1px dashed #ccc; padding: 30px; border-radius: 8px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .logo { font-size: 24px; font-weight: bold; color: #1a3a6e; margin-bottom: 5px; }
            .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin-top: 10px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
            .label { color: #666; }
            .value { font-weight: bold; }
            .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .items-table th, .items-table td { text-align: left; padding: 8px; font-size: 14px; }
            .items-table th { border-bottom: 1px solid #333; }
            .items-table td { border-bottom: 1px solid #eee; }
            .total-section { margin-top: 20px; border-top: 2px solid #333; padding-top: 15px; }
            .total-row { display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 8px; }
            .grand-total { font-size: 18px; font-weight: bold; color: #e05e00; }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 15px; }
            @media print {
              body { padding: 0; }
              .receipt-container { border: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="logo">HOMEFIX AI</div>
              <div>Dịch vụ sửa chữa thiết bị gia đình thông minh</div>
              <div class="title">BIÊN NHẬN THANH TOÁN</div>
              <div style="font-size: 12px; color: #666; margin-top: 5px;">Mã đơn: #${booking.id}</div>
            </div>
            
            <div class="row">
              <span class="label">Khách hàng:</span>
              <span class="value">${booking.customer?.full_name}</span>
            </div>
            <div class="row">
              <span class="label">Số điện thoại:</span>
              <span class="value">${booking.customer?.phone || ''}</span>
            </div>
            <div class="row">
              <span class="label">Địa chỉ:</span>
              <span class="value">${booking.address_detail}, ${booking.ward?.name}, ${booking.district?.name}</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="row">
              <span class="label">Kỹ thuật viên thực hiện:</span>
              <span class="value">${booking.technicianProfile?.user?.full_name || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">SĐT thợ:</span>
              <span class="value">${booking.technicianProfile?.user?.phone || ''}</span>
            </div>
            <div class="row">
              <span class="label">Thời gian thực hiện:</span>
              <span class="value">${booking.booking_date ? new Date(booking.booking_date).toLocaleDateString('vi-VN') : ''} (${booking.time_slot_start} - ${booking.time_slot_end})</span>
            </div>

            <div class="divider"></div>

            <div style="font-weight: bold; margin-bottom: 10px;">CHI TIẾT DỊCH VỤ</div>
            <div class="row">
              <span>${booking.service?.name}</span>
              <span class="value">${Number(booking.service?.base_price || 0).toLocaleString('vi-VN')}đ</span>
            </div>

            ${currentQuotation && currentQuotation.items && currentQuotation.items.length > 0 ? `
              <div style="font-weight: bold; margin: 15px 0 10px 0;">HẠNG MỤC PHÁT SINH</div>
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Hạng mục</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th style="text-align: right;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${currentQuotation.items.map(item => `
                    <tr>
                      <td>${item.item_name}</td>
                      <td>${item.quantity}</td>
                      <td>${Number(item.unit_price).toLocaleString('vi-VN')}đ</td>
                      <td style="text-align: right;">${(item.quantity * Number(item.unit_price)).toLocaleString('vi-VN')}đ</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <div class="total-section">
              <div class="total-row">
                <span class="label">Tổng cộng chi phí:</span>
                <span class="value">${Number(booking.estimated_price || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              ${currentQuotation ? `
                <div class="total-row">
                  <span class="label">Phát sinh thêm:</span>
                  <span class="value">${Number(currentQuotation.total_extra_price).toLocaleString('vi-VN')}đ</span>
                </div>
              ` : ''}
              ${Number(booking.discount_amount) > 0 ? `
                <div class="total-row" style="color: green;">
                  <span class="label">Khuyến mãi voucher:</span>
                  <span class="value">-${Number(booking.discount_amount).toLocaleString('vi-VN')}đ</span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span>THỰC THANH TOÁN:</span>
                <span>${Number(booking.payment?.amount || booking.final_price || 0).toLocaleString('vi-VN')}đ</span>
              </div>
            </div>

            <div class="divider"></div>

            <div class="row">
              <span class="label">Phương thức thanh toán:</span>
              <span class="value">${booking.payment_method === 'VNPAY' ? 'VNPAY (Thanh toán trực tuyến)' : 'TIỀN MẶT (Thu hộ bởi thợ)'}</span>
            </div>
            <div class="row">
              <span class="label">Thời gian thanh toán:</span>
              <span class="value">${booking.payment?.paid_at ? new Date(booking.payment.paid_at).toLocaleString('vi-VN') : ''}</span>
            </div>
            <div class="row">
              <span class="label">Mã giao dịch/Biên nhận:</span>
              <span class="value" style="font-family: monospace;">${booking.payment?.transaction_code || ''}</span>
            </div>

            <div class="footer">
              <p>Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ của HomeFix!</p>
              <p>Mọi thắc mắc vui lòng liên hệ hotline: 1900-1234 hoặc email: support@homefix.vn</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
          {canReschedule && (
            <Button onClick={() => setIsRescheduleOpen(true)}>Đổi lịch</Button>
          )}
          {CUSTOMER_CANCELLABLE.includes(booking.status) && (
            <Button danger onClick={handleCancel} loading={isCancelling}>Hủy đơn</Button>
          )}
          {booking.status === 'AWAITING_PAYMENT' && booking.payment?.status !== 'PAID' && booking.payment_method === 'VNPAY' && (
            <Button type="primary" onClick={handlePayment} loading={isPaying}>Thanh toán ngay</Button>
          )}
          {booking.status === 'COMPLETED' && booking.payment?.status === 'PAID' && !booking.review && (
            <Button type="primary" onClick={() => navigate(`/customer/reviews/new/${id}`)}>Đánh giá thợ</Button>
          )}
          {booking.payment?.status === 'PAID' && (
            <Button onClick={() => setIsReceiptOpen(true)}>Xem biên nhận</Button>
          )}
        </Space>
      </div>

      <Modal
        title="Đổi lịch hẹn"
        open={isRescheduleOpen}
        onCancel={() => {
          setIsRescheduleOpen(false);
          setRescheduleDate(null);
          setRescheduleSlotValue(null);
        }}
        onOk={handleReschedule}
        okText="Xác nhận đổi lịch"
        cancelText="Quay lại"
        confirmLoading={isRescheduling}
      >
        <DatePicker
          format="DD/MM/YYYY"
          style={{ width: '100%' }}
          value={rescheduleDate}
          onChange={(value) => {
            setRescheduleDate(value);
            setRescheduleSlotValue(null);
          }}
          placeholder="Chọn ngày sửa chữa mới"
          disabledDate={(current) =>
            current && BOOKING_TIME_SLOTS.every(
              (slot) => !isBookingSlotAvailable(current, slot)
            )
          }
        />
        <Select
          style={{ width: '100%', marginTop: 12 }}
          value={rescheduleSlotValue}
          onChange={setRescheduleSlotValue}
          placeholder={rescheduleDate ? 'Chọn ca sửa chữa mới' : 'Chọn ngày trước'}
          disabled={!rescheduleDate}
          options={BOOKING_TIME_SLOTS.map((slot) => ({
            value: slot.value,
            label: slot.label,
            disabled: !isBookingSlotAvailable(rescheduleDate, slot),
          }))}
        />
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          message="Chỉ sử dụng ca 2 giờ và phải đổi lịch trước ít nhất 24 giờ."
        />
      </Modal>

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
              <Descriptions.Item label="Thời gian hẹn">
                {formatDate(booking.booking_date)} {booking.time_slot_start} - {booking.time_slot_end}
              </Descriptions.Item>
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

          {currentQuotation && (
            <Card title="Báo giá chi tiết" className="glass-card" extra={<Button type="link" onClick={() => navigate(`/customer/quotations/${currentQuotation.id}`)}>Xem chi tiết</Button>}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text>Tạm tính báo giá:</Text>
                <Text strong>{formatVND(quotationSubtotal)}</Text>
              </div>
              {quotationDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text type="success">Giảm giá voucher:</Text>
                  <Text strong style={{ color: 'var(--success)' }}>- {formatVND(quotationDiscount)}</Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text>Khách cần thanh toán:</Text>
                <Title level={4} style={{ color: 'var(--orange)', margin: 0 }}>{formatVND(quotationPayable)}</Title>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Trạng thái báo giá:</Text>
                <Tag color={currentQuotation.status === 'ACCEPTED' ? 'success' : currentQuotation.status === 'REJECTED' ? 'error' : 'warning'}>
                  {currentQuotation.status === 'ACCEPTED' ? 'Đã duyệt' : currentQuotation.status === 'REJECTED' ? 'Đã từ chối' : 'Chờ duyệt'}
                </Tag>
              </div>
              {booking.status === 'QUOTED' && currentQuotation.status === 'PENDING' && (
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <Button type="primary" onClick={() => navigate(`/customer/quotations/${currentQuotation.id}`)}>
                    Kiểm tra và duyệt báo giá
                  </Button>
                </div>
              )}
            </Card>
          )}
        {booking.status === 'AWAITING_PAYMENT' && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 20 }}
            message="Kỹ thuật viên đã hoàn tất sửa chữa"
            description={booking.payment_method === 'VNPAY'
              ? 'Vui lòng thanh toán VNPAY để hoàn tất đơn hàng.'
              : 'Vui lòng thanh toán tiền mặt cho kỹ thuật viên. Đơn sẽ hoàn tất sau khi kỹ thuật viên xác nhận đã thu tiền.'}
          />
        )}
        {booking.status === 'COMPLETED' && booking.payment?.status === 'PAID' && (
          <Alert
            type="success"
            showIcon
            style={{ marginTop: 20 }}
            message="Thanh toán đã được ghi nhận"
            description={booking.payment_method === 'VNPAY'
              ? `HomeFix đã nhận thanh toán qua VNPAY${booking.payment.transaction_code ? `, mã giao dịch ${booking.payment.transaction_code}` : ''}.`
              : `Kỹ thuật viên đã xác nhận thu đủ ${formatVND(booking.payment.amount)} tiền mặt${booking.payment.transaction_code ? `, mã biên nhận ${booking.payment.transaction_code}` : ''}.`}
          />
        )}
          {customerImages.length > 0 && (
            <Card title="Hình ảnh sự cố (Khách hàng cung cấp)" className="glass-card">
              <Image.PreviewGroup>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                  {customerImages.map(image => (
                    <Image
                      key={image.id}
                      src={resolveImageUrl(image.image_url)}
                      alt="Incident evidence"
                      style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                    />
                  ))}
                </div>
              </Image.PreviewGroup>
            </Card>
          )}

          {(technicianImages.length > 0 || completionNoteText) && (
            <Card title="Biên bản nghiệm thu & Ảnh sau sửa" className="glass-card" styles={{ body: { padding: 24 } }} style={{ border: '1px solid var(--success-border)', background: '#f8fafc' }}>
              {completionNoteText && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ display: 'block', marginBottom: 6, color: 'var(--navy)' }}>Ghi chú bàn giao từ Kỹ thuật viên:</Text>
                  <div style={{ padding: '12px 16px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', fontStyle: 'italic', color: 'var(--text-primary)' }}>
                    "{completionNoteText}"
                  </div>
                </div>
              )}
              {technicianImages.length > 0 && (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8, color: 'var(--navy)' }}>Hình ảnh nghiệm thu thực tế:</Text>
                  <Image.PreviewGroup>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                      {technicianImages.map(image => (
                        <Image
                          key={image.id}
                          src={resolveImageUrl(image.image_url)}
                          alt="Repair completion evidence"
                          style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                        />
                      ))}
                    </div>
                  </Image.PreviewGroup>
                </div>
              )}
            </Card>
          )}

          {timelineItems.length > 0 && (
            <Card title="Lich su trang thai" className="glass-card">
              <Timeline items={timelineItems} />
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

      <Modal
        title="Biên nhận thanh toán"
        open={isReceiptOpen}
        onCancel={() => setIsReceiptOpen(false)}
        width={650}
        footer={[
          <Button key="close" onClick={() => setIsReceiptOpen(false)}>Đóng</Button>,
          <Button key="print" type="primary" onClick={handlePrintReceipt}>In biên nhận</Button>
        ]}
      >
        <div style={{ padding: '10px 0', fontFamily: 'sans-serif' }}>
          {/* Header/Logo */}
          <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid var(--navy)', paddingBottom: 16 }}>
            <Title level={3} style={{ color: 'var(--navy)', margin: '0 0 4px 0', letterSpacing: 1 }}>HOMEFIX AI</Title>
            <Text type="secondary">Hệ thống sửa chữa thiết bị thông minh gia đình</Text>
            <div style={{ fontSize: 18, fontWeight: 700, textTransform: 'uppercase', marginTop: 12, color: 'var(--orange)' }}>
              Biên nhận thanh toán
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>Đơn đặt lịch: #{booking.id}</Text>
          </div>

          {/* Info grid */}
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 20 }}>
            <Descriptions.Item label="Khách hàng">
              <Text strong>{booking.customer?.full_name}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{booking.customer?.phone}</Descriptions.Item>
            <Descriptions.Item label="Địa chỉ thực hiện">
              {booking.address_detail}, {booking.ward?.name}, {booking.district?.name}
            </Descriptions.Item>
            <Descriptions.Item label="Kỹ thuật viên">
              <Text strong>{booking.technicianProfile?.user?.full_name || 'N/A'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian sửa chữa">
              {formatDate(booking.booking_date)} {booking.time_slot_start} - {booking.time_slot_end}
            </Descriptions.Item>
          </Descriptions>

          {/* Details breakdown */}
          <Divider orientation="left" style={{ margin: '16px 0 8px', fontSize: 14 }}>Chi tiết chi phí</Divider>
          
          <div style={{ padding: '0 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text>{booking.service?.name} (Giá gốc)</Text>
              <Text strong>{formatVND(booking.estimated_price)}</Text>
            </div>

            {currentQuotation && currentQuotation.items && currentQuotation.items.length > 0 && (
              <>
                <div style={{ fontWeight: 600, margin: '12px 0 6px 0', color: 'var(--text-secondary)' }}>Hạng mục phát sinh:</div>
                {currentQuotation.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 12, marginBottom: 6, fontSize: 13 }}>
                    <Text type="secondary">{item.item_name} (x{item.quantity})</Text>
                    <Text type="secondary">{formatVND(item.quantity * item.unit_price)}</Text>
                  </div>
                ))}
              </>
            )}

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text>Tạm tính:</Text>
              <Text strong>{formatVND(Number(booking.estimated_price) + Number(currentQuotation?.total_extra_price || 0))}</Text>
            </div>

            {Number(booking.discount_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--success)' }}>
                <Text>Voucher giảm giá:</Text>
                <Text strong style={{ color: 'var(--success)' }}>-{formatVND(booking.discount_amount)}</Text>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, background: 'var(--bg-primary)', padding: '12px', borderRadius: 8 }}>
              <Text strong style={{ fontSize: 16 }}>Thực thanh toán:</Text>
              <Title level={4} style={{ color: 'var(--orange)', margin: 0 }}>
                {formatVND(booking.payment?.amount || booking.final_price || 0)}
              </Title>
            </div>
          </div>

          <Divider orientation="left" style={{ margin: '24px 0 8px', fontSize: 14 }}>Thông tin thanh toán</Divider>
          <Descriptions column={1} size="small" style={{ padding: '0 8px' }}>
            <Descriptions.Item label="Phương thức thanh toán">
              <Tag color={booking.payment_method === 'VNPAY' ? 'cyan' : 'green'}>
                {booking.payment_method === 'VNPAY' ? 'VNPAY (Trực tuyến)' : 'Tiền mặt'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian thanh toán">
              {booking.payment?.paid_at ? formatDateTime(booking.payment.paid_at) : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Mã giao dịch / Biên nhận">
              <Text code>{booking.payment?.transaction_code || 'N/A'}</Text>
            </Descriptions.Item>
          </Descriptions>

          <div style={{ textAlign: 'center', marginTop: 30, color: 'var(--text-muted)', fontSize: 12 }}>
            Cảm ơn quý khách đã sử dụng dịch vụ của HomeFix!
          </div>
        </div>
      </Modal>
    </div>
  );
}
