import { useState } from 'react';
import { Form, Rate, Input, Button, Card, Typography, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { reviewApi } from '../../api/bookingApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function ReviewPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      await reviewApi.create(bookingId, values);
      message.success('Cảm ơn bạn đã gửi đánh giá!');
      navigate(`/customer/bookings/${bookingId}`);
    } catch (err) {
      message.error(err.message || 'Lỗi khi gửi đánh giá');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <Title level={2} style={{ color: 'var(--navy)' }}>Đánh giá dịch vụ</Title>
        <Text type="secondary">Đánh giá của bạn giúp chúng tôi nâng cao chất lượng dịch vụ</Text>
      </div>

      <Card className="glass-card">
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="rating"
            label="Chất lượng dịch vụ"
            rules={[{ required: true, message: 'Vui lòng chọn số sao!' }]}
            style={{ textAlign: 'center' }}
          >
            <Rate style={{ fontSize: 36, color: 'var(--orange)' }} />
          </Form.Item>

          <Form.Item
            name="comment"
            label="Nhận xét chi tiết"
          >
            <TextArea rows={4} placeholder="Chia sẻ trải nghiệm của bạn về thợ và dịch vụ..." />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              Gửi đánh giá
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}