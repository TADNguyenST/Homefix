import { useEffect, useState } from 'react';
import { Result, Button, Card } from 'antd';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('info'); // 'success' | 'error' | 'info'
  const [message, setMessage] = useState('Đang kiểm tra kết quả thanh toán...');

  useEffect(() => {
    const vnp_ResponseCode = searchParams.get('vnp_ResponseCode');
    
    if (vnp_ResponseCode) {
      if (vnp_ResponseCode === '00') {
        setStatus('success');
        setMessage('Thanh toán thành công! Cảm ơn bạn đã sử dụng dịch vụ của HomeFix.');
      } else {
        setStatus('error');
        setMessage('Thanh toán thất bại hoặc đã bị hủy. Vui lòng thử lại sau.');
      }
    } else {
      setStatus('error');
      setMessage('Không tìm thấy thông tin thanh toán.');
    }
  }, [searchParams]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card className="glass-card" style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>
        <Result
          status={status}
          title={status === 'success' ? 'Thanh toán thành công' : 'Thanh toán thất bại'}
          subTitle={message}
          extra={[
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