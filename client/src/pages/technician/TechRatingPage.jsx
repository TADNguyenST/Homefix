import { Card, Typography, List, Rate, Spin, Space, Row, Col, Progress, Avatar, Tag } from 'antd';
import { UserOutlined, CalendarOutlined, ToolOutlined, CheckCircleOutlined, SmileOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { technicianApi } from '../../api/technicianApi';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime } from '../../utils/helpers';

const { Title, Text } = Typography;

export default function TechRatingPage() {
  const { user } = useAuth();
  
  const { data: ratingData, isLoading } = useQuery({
    queryKey: ['tech-rating'],
    queryFn: () => technicianApi.getRating(),
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Đang tải thông tin đánh giá..." />
      </div>
    );
  }

  const {
    avg_rating = 0,
    total_completed_jobs = 0,
    total_reviews = 0,
    rating_breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    reviews = []
  } = ratingData?.data || {};

  // Calculate percentages for breakdown progress bars
  const getProgressPercent = (count) => {
    if (total_reviews === 0) return 0;
    return Math.round((count / total_reviews) * 100);
  };

  const getSentimentTag = (sentiment) => {
    switch (sentiment) {
      case 'POSITIVE':
        return <Tag color="success">Tích cực</Tag>;
      case 'NEGATIVE':
        return <Tag color="error">Cần cải thiện</Tag>;
      case 'NEUTRAL':
      default:
        return <Tag color="default">Trung lập</Tag>;
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <SmileOutlined style={{ color: 'var(--orange)' }} />
          <span>Đánh Giá Của Khách Hàng</span>
        </Title>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Tổng quan điểm xếp hạng và phản hồi chi tiết từ khách hàng về chất lượng dịch vụ của bạn.
        </p>
      </div>

      {/* Ratings summary and stats cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        {/* Left: Avg rating and breakdown */}
        <Col xs={24} md={16}>
          <Card
            className="glass-card"
            style={{
              height: '100%',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(255, 255, 255, 0.4)'
            }}
          >
            <Row gutter={[24, 24]} align="middle">
              {/* Avg Rating Big Circle */}
              <Col xs={24} sm={8} style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                <Title level={1} style={{ fontSize: 64, color: 'var(--orange)', margin: 0, fontWeight: 800, lineHeight: 1 }}>
                  {Number(avg_rating).toFixed(1)}
                </Title>
                <div style={{ margin: '8px 0' }}>
                  <Rate disabled value={Number(avg_rating)} allowHalf style={{ fontSize: 18, color: 'var(--orange)' }} />
                </div>
                <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                  {total_reviews} đánh giá
                </Text>
              </Col>
              
              {/* Breakdown bars */}
              <Col xs={24} sm={16}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = rating_breakdown[stars] || 0;
                    const percent = getProgressPercent(count);
                    return (
                      <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Text style={{ width: 45, textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                          {stars} sao
                        </Text>
                        <div style={{ flex: 1 }}>
                          <Progress
                            percent={percent}
                            showInfo={false}
                            strokeColor="var(--orange)"
                            trailColor="#f1f5f9"
                            strokeWidth={8}
                          />
                        </div>
                        <Text type="secondary" style={{ width: 30, fontSize: 13, textAlign: 'left' }}>
                          {count}
                        </Text>
                      </div>
                    );
                  })}
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Right: completed jobs and reviews count stats */}
        <Col xs={24} md={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
            <Card
              className="glass-card"
              style={{
                flex: 1,
                borderRadius: 'var(--radius-xl)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center'
              }}
              bodyStyle={{ width: '100%', padding: 20 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#22c55e',
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24
                }}>
                  <CheckCircleOutlined />
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, color: 'var(--navy)', fontWeight: 700 }}>
                    {total_completed_jobs}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>Đơn hàng đã hoàn thành</Text>
                </div>
              </div>
            </Card>

            <Card
              className="glass-card"
              style={{
                flex: 1,
                borderRadius: 'var(--radius-xl)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center'
              }}
              bodyStyle={{ width: '100%', padding: 20 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  background: 'rgba(249, 115, 22, 0.1)',
                  color: 'var(--orange)',
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24
                }}>
                  <SmileOutlined />
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, color: 'var(--navy)', fontWeight: 700 }}>
                    {getProgressPercent((rating_breakdown[5] || 0) + (rating_breakdown[4] || 0))}%
                  </Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>Tỷ lệ hài lòng (4-5★)</Text>
                </div>
              </div>
            </Card>
          </div>
        </Col>
      </Row>

      {/* Review list */}
      <Card
        title={
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>
            Danh sách nhận xét chi tiết
          </span>
        }
        className="glass-card"
        style={{
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(255, 255, 255, 0.4)'
        }}
        bodyStyle={{ padding: '8px 24px' }}
      >
        {reviews.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            Bạn chưa nhận được nhận xét nào từ khách hàng.
          </div>
        ) : (
          <List
            itemLayout="vertical"
            dataSource={reviews}
            pagination={{ pageSize: 5 }}
            renderItem={(item) => (
              <List.Item
                key={item.id}
                style={{ padding: '20px 0', borderBottom: '1px solid #f1f5f9' }}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <Avatar
                    size={44}
                    src={item.customer?.avatar_url}
                    icon={<UserOutlined />}
                    style={{ backgroundColor: 'var(--orange-light)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                      <Space size={8}>
                        <Text strong style={{ color: 'var(--navy)' }}>{item.customer?.full_name || 'Khách hàng ẩn danh'}</Text>
                        {getSentimentTag(item.ai_sentiment)}
                      </Space>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <CalendarOutlined /> {formatDateTime(item.created_at)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <Rate disabled value={item.rating} style={{ fontSize: 13, color: 'var(--orange)' }} />
                      <Text type="secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ToolOutlined /> {item.booking?.service?.name || 'Dịch vụ'} (Đơn #{item.booking?.id})
                      </Text>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginTop: 8 }}>
                      {item.comment ? (
                        <Text style={{ color: 'var(--text-primary)', fontSize: 14 }}>"{item.comment}"</Text>
                      ) : (
                        <Text type="secondary" italic style={{ fontSize: 13 }}>Khách hàng không để lại nhận xét bằng lời.</Text>
                      )}
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}