import { Button, Card, Col, Descriptions, Empty, Row, Skeleton, Typography, List, Avatar, Rate, Divider } from 'antd';
import { ArrowLeftOutlined, CalendarOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import dayjs from 'dayjs';
import { serviceApi } from '../../api/serviceApi';
import { formatDuration, formatVND } from '../../utils/helpers';

const { Title, Text, Paragraph } = Typography;

export default function ServiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['service-detail', id],
    queryFn: () => serviceApi.getById(id),
    enabled: !!id,
  });

  const [reviewPage, setReviewPage] = useState(1);
  const [reviewLimit] = useState(5);

  const { data: reviewsData, isLoading: isLoadingReviews } = useQuery({
    queryKey: ['service-reviews', id, reviewPage, reviewLimit],
    queryFn: () => serviceApi.getReviews(id, { page: reviewPage, limit: reviewLimit }),
    enabled: !!id,
  });

  const service = data?.data?.service;
  const reviews = reviewsData?.data?.reviews || [];
  const stats = reviewsData?.data?.stats || { average_rating: 0, total_reviews: 0 };
  const pagination = reviewsData?.pagination || { total: 0 };

  if (isLoading) {
    return (
      <div className="page-container" style={{ paddingTop: 40 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="page-container" style={{ padding: '80px 0' }}>
        <Empty description="Không tìm thấy dịch vụ" />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ paddingTop: 32 }}>
      <Link to="/services" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <ArrowLeftOutlined /> Quay lại danh sách dịch vụ
      </Link>

      <Row gutter={[32, 32]} align="top">
        <Col xs={24} lg={14}>
          <Card className="glass-card" styles={{ body: { padding: 0 } }} style={{ overflow: 'hidden' }}>
            {service.image_url ? (
              <div style={{ background: '#f8fafc', height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img alt={service.name} src={service.image_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ height: 420, background: 'var(--navy-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff' }}>Chưa có hình ảnh</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card className="glass-card">
            <Text strong style={{ color: 'var(--orange)' }}>{service.category?.name || 'Dịch vụ'}</Text>
            <Title level={1} style={{ color: 'var(--navy)', marginTop: 8 }}>{service.name}</Title>
            <Paragraph style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
              {service.description || 'Dịch vụ sửa chữa tại nhà, kỹ thuật viên sẽ khảo sát và xác nhận chi phí trước khi thực hiện.'}
            </Paragraph>

            <Descriptions column={1} bordered size="middle" style={{ margin: '24px 0' }}>
              <Descriptions.Item label="Giá tham khảo">
                <Text strong style={{ color: 'var(--orange)', fontSize: 20 }}>{formatVND(service.base_price)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Thời lượng dự kiến">
                <ClockCircleOutlined /> {formatDuration(service.estimated_duration)}
              </Descriptions.Item>
              <Descriptions.Item label="Danh mục">
                {service.category?.name || 'Khác'}
              </Descriptions.Item>
            </Descriptions>

            <Button
              type="primary"
              size="large"
              icon={<CalendarOutlined />}
              block
              onClick={() => navigate('/customer/booking', { state: { selectedServiceId: service.id } })}
            >
              Đặt lịch dịch vụ này
            </Button>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '48px 0' }} />

      {/* Đánh giá từ khách hàng */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: 'var(--navy)' }}>Đánh giá từ khách hàng</Title>
          {stats.total_reviews > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '4px 12px', borderRadius: 20, border: '1px solid #f0f0f0' }}>
              <Text strong style={{ fontSize: 16 }}>{stats.average_rating}</Text>
              <Rate disabled allowHalf defaultValue={stats.average_rating} value={stats.average_rating} style={{ fontSize: 14, color: '#fa8c16' }} />
              <Text type="secondary">({stats.total_reviews} đánh giá)</Text>
            </div>
          )}
        </div>

        <Card className="glass-card">
          <List
            loading={isLoadingReviews}
            dataSource={reviews}
            itemLayout="vertical"
            locale={{ emptyText: 'Chưa có đánh giá nào cho dịch vụ này.' }}
            pagination={
              stats.total_reviews > reviewLimit
                ? {
                    current: reviewPage,
                    pageSize: reviewLimit,
                    total: pagination.total,
                    onChange: (page) => setReviewPage(page),
                    align: 'center'
                  }
                : false
            }
            renderItem={(review) => (
              <List.Item key={review.id}>
                <List.Item.Meta
                  avatar={<Avatar src={review.customer_avatar} icon={!review.customer_avatar && <UserOutlined />} size="large" />}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Text strong>{review.customer_name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(review.created_at).format('DD/MM/YYYY HH:mm')}
                      </Text>
                    </div>
                  }
                  description={
                    <Rate disabled allowHalf defaultValue={review.rating} style={{ fontSize: 12, color: '#fa8c16' }} />
                  }
                />
                {review.comment && (
                  <Paragraph style={{ marginTop: 12, marginBottom: 0, color: 'var(--text-primary)' }}>
                    {review.comment}
                  </Paragraph>
                )}
                {review.technician_name && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Kỹ thuật viên thực hiện: <Text strong>{review.technician_name}</Text>
                    </Text>
                  </div>
                )}
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  );
}
