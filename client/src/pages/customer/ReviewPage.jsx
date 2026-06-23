import { useEffect, useState } from 'react';
import { Form, Rate, Input, Button, Card, Typography, message, Spin, Avatar, Space, Result } from 'antd';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { UserOutlined, SmileOutlined, MessageOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { bookingApi, reviewApi } from '../../api/bookingApi';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const RATING_DESC = {
  1: 'Tệ (Không đạt yêu cầu)',
  2: 'Không hài lòng (Cần cải thiện nhiều)',
  3: 'Bình thường (Đạt yêu cầu)',
  4: 'Hài lòng (Dịch vụ tốt)',
  5: 'Tuyệt vời (Rất hài lòng)',
};

export default function ReviewPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [ratingVal, setRatingVal] = useState(5);

  useEffect(() => {
    async function fetchBookingDetails() {
      try {
        setLoadingBooking(true);
        const res = await bookingApi.getById(bookingId);
        const data = res.data;
        setBooking(data);
        
        if (data.review) {
          message.warning('Bạn đã gửi đánh giá cho đơn hàng này rồi!');
          navigate(`/customer/bookings/${bookingId}`);
        }
      } catch (err) {
        message.error('Không thể tải thông tin đơn hàng');
      } finally {
        setLoadingBooking(false);
      }
    }
    fetchBookingDetails();
  }, [bookingId, navigate]);

  const onFinish = async (values) => {
    try {
      setSubmitting(true);
      await reviewApi.create(bookingId, values);
      message.success('Cảm ơn bạn đã gửi đánh giá!');
      navigate(`/customer/bookings/${bookingId}`);
    } catch (err) {
      message.error(err.message || 'Lỗi khi gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingBooking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Đang tải thông tin đơn hàng..." />
      </div>
    );
  }

  // Nếu đơn hàng chưa hoàn thành hoặc chưa thanh toán
  const isCompleted = booking?.status === 'COMPLETED';
  const isPaid = booking?.payment?.status === 'PAID';

  if (!isCompleted || !isPaid) {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto' }}>
        <Result
          status="warning"
          title="Không thể thực hiện đánh giá"
          subTitle={
            <div style={{ textAlign: 'left', marginTop: 16 }}>
              <Paragraph>Đơn hàng cần đáp ứng điều kiện sau để có thể đánh giá:</Paragraph>
              <ul>
                <li>Trạng thái đơn hàng phải là <strong>Hoàn thành (COMPLETED)</strong>. Hiện tại: <Text type="danger">{booking?.status}</Text></li>
                <li>Trạng thái thanh toán phải là <strong>Đã thanh toán (PAID)</strong>. Hiện tại: <Text type="danger">{booking?.payment?.status || 'Chưa thanh toán'}</Text></li>
              </ul>
            </div>
          }
          extra={[
            <Button type="primary" key="back" onClick={() => navigate(`/customer/bookings/${bookingId}`)}>
              Quay lại chi tiết đơn hàng
            </Button>
          ]}
        />
      </div>
    );
  }

  const techInfo = booking?.technicianProfile;
  const techUser = techInfo?.user;
  const serviceName = booking?.service?.name;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={`/customer/bookings/${bookingId}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
          <ArrowLeftOutlined /> Quay lại chi tiết đơn hàng
        </Link>
      </div>

      <div className="page-header" style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8, fontWeight: 700 }}>Đánh Giá Dịch Vụ</Title>
        <Text type="secondary">Ý kiến phản hồi của bạn giúp kỹ thuật viên cải thiện tay nghề và nâng cao dịch vụ</Text>
      </div>

      <Card
        className="glass-card"
        style={{
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
        }}
      >
        {/* Service and Tech summary card */}
        <div style={{
          background: 'rgba(249, 115, 22, 0.05)',
          padding: 16,
          borderRadius: 'var(--radius-lg)',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          border: '1px solid rgba(249, 115, 22, 0.1)'
        }}>
          <Avatar
            size={60}
            src={techUser?.avatar_url}
            icon={<UserOutlined />}
            style={{ backgroundColor: 'var(--orange)', border: '2px solid white', boxShadow: 'var(--shadow-sm)' }}
          />
          <div style={{ flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kỹ thuật viên</Text>
            <Text strong style={{ fontSize: 16, color: 'var(--navy)', display: 'block' }}>{techUser?.full_name || 'Kỹ thuật viên Homefix'}</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Dịch vụ đã sửa: <strong>{serviceName}</strong>
            </Text>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ rating: 5 }}
        >
          <Form.Item
            name="rating"
            label={
              <Space>
                <SmileOutlined style={{ color: 'var(--orange)' }} />
                <span>Bạn hài lòng như thế nào với kỹ thuật viên này?</span>
              </Space>
            }
            rules={[{ required: true, message: 'Vui lòng chọn số sao!' }]}
            style={{ marginBottom: 24 }}
          >
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <Rate
                style={{ fontSize: 40, color: 'var(--orange)' }}
                value={ratingVal}
                onChange={(v) => setRatingVal(v)}
              />
              <div style={{ marginTop: 12, height: 20 }}>
                <Text strong style={{ color: 'var(--orange-dark)', fontSize: 15 }}>
                  {RATING_DESC[ratingVal]}
                </Text>
              </div>
            </div>
          </Form.Item>

          <Form.Item
            name="comment"
            label={
              <Space>
                <MessageOutlined style={{ color: 'var(--text-secondary)' }} />
                <span>Nhận xét và góp ý chi tiết</span>
              </Space>
            }
            rules={[{ max: 500, message: 'Độ dài tối đa 500 ký tự!' }]}
          >
            <TextArea
              rows={5}
              placeholder="Ví dụ: Kỹ thuật viên đến đúng giờ, lịch sự, sửa nhanh và dọn dẹp sạch sẽ sau khi hoàn thành. Rất hài lòng!"
              style={{ borderRadius: 'var(--radius-md)' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={submitting}
              style={{ height: 48, fontSize: 16, fontWeight: 600 }}
            >
              Gửi đánh giá dịch vụ
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}