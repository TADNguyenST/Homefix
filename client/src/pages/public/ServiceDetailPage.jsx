import { Button, Card, Col, Descriptions, Empty, Row, Skeleton, Typography } from 'antd';
import { ArrowLeftOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

  const service = data?.data?.service;

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
              <img alt={service.name} src={service.image_url} style={{ width: '100%', height: 420, objectFit: 'cover' }} />
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
    </div>
  );
}
