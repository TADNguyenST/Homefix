import { Card, Typography, List, Rate, Spin, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { technicianApi } from '../../api/technicianApi';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime } from '../../utils/helpers';

const { Title, Text } = Typography;

export default function TechRatingPage() {
  const { user } = useAuth();
  
  // Note: Since technicianApi.getRating is just an example, we might fetch reviews directly from the review API
  // if backend supports it. For now, assume technicianApi.getRating returns an array of reviews.
  const { data: ratingData, isLoading } = useQuery({
    queryKey: ['tech-rating'],
    queryFn: () => technicianApi.getRating(),
  });

  const reviews = ratingData?.data || [];
  
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) 
    : 0;

  if (isLoading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Đánh giá của khách hàng</Title>
        <p>Phản hồi từ khách hàng về chất lượng dịch vụ của bạn</p>
      </div>

      <Card className="glass-card" style={{ marginBottom: 24, textAlign: 'center', padding: '20px 0' }}>
        <Title level={1} style={{ fontSize: 48, color: 'var(--orange)', margin: 0 }}>{averageRating}</Title>
        <Rate disabled value={Number(averageRating)} allowHalf style={{ fontSize: 24, margin: '8px 0' }} />
        <div style={{ color: 'var(--text-secondary)' }}>Dựa trên {reviews.length} đánh giá</div>
      </Card>

      <Card className="glass-card">
        <List
          itemLayout="vertical"
          dataSource={reviews}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={<div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)' }}><UserOutlined /></div>}
                title={
                  <Space>
                    <Text strong>{item.Booking?.Customer?.User?.full_name || 'Khách hàng'}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(item.created_at)}</Text>
                  </Space>
                }
                description={<Rate disabled value={item.rating} style={{ fontSize: 14 }} />}
              />
              <div style={{ marginLeft: 56 }}>
                {item.comment ? (
                  <Text>{item.comment}</Text>
                ) : (
                  <Text type="secondary" italic>Không có nhận xét</Text>
                )}
              </div>
            </List.Item>
          )}
        />
        {reviews.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
            Bạn chưa có đánh giá nào
          </div>
        )}
      </Card>
    </div>
  );
}