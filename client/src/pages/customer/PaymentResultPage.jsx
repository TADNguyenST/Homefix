import { useEffect, useState } from 'react';
import { Result, Button, Card } from 'antd';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { paymentApi } from '../../api/paymentApi';

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('info'); // 'success' | 'error' | 'info'
  const [message, setMessage] = useState('Đang kiểm tra kết quả thanh toán...');
  const [bookingId, setBookingId] = useState(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const vnpResponseCode = searchParams.get('vnp_ResponseCode');

      if (!vnpResponseCode) {
        setStatus('error');
        setMessage('Không tìm thấy thông tin thanh toán.');
        return;
      }

      try {
        const params = Object.fromEntries(searchParams.entries());
        const res = await paymentApi.verifyVnpayReturn(params);
        setBookingId(res.data?.booking_id || null);
        setStatus('success');
        setMessage(res.message || 'Thanh toán thành công! Cảm ơn bạn đã sử dụng dịch vụ của HomeFix.');
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Thanh toán thất bại hoặc đã bị hủy. Vui lòng thử lại sau.');
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card className="glass-card" style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>
        <Result
          status={status}
          title={status === 'success' ? 'Thanh toán thành công' : 'Thanh toán thất bại'}
          subTitle={message}
          extra={[
            bookingId && (
              <Button type="primary" key="booking" onClick={() => navigate(`/customer/bookings/${bookingId}`)}>
                Xem đơn hàng
              </Button>
            ),
            <Button type="primary" key="console" onClick={() => navigate('/customer/bookings')}>
              Về danh sách đơn
            </Button>,
            <Link to="/customer" key="home">
              <Button>Về trang chủ</Button>
            </Link>,
          ]}
        />
      </Card>
    </div>
  );
}
