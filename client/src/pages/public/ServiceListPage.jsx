import { useState } from 'react';
import { Typography, Row, Col, Card, Spin, Empty, Input, Select, Button, Space } from 'antd';
import { SearchOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { serviceApi } from '../../api/serviceApi';
import { useNavigate } from 'react-router-dom';
import { formatVND } from '../../utils/helpers';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ServiceListPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);

  // Fetch categories for filter
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: serviceApi.getCategories,
  });

  // Fetch services
  const { data: servicesData, isLoading } = useQuery({
    queryKey: ['services', categoryFilter],
    queryFn: () => serviceApi.getAll(categoryFilter ? { category_id: categoryFilter, limit: 100 } : { limit: 100 }),
  });

  const categories = categoriesData?.data?.categories || [];
  let services = servicesData?.data?.data || servicesData?.data || [];

  // Client-side search
  if (searchTerm) {
    services = services.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  return (
    <div className="page-container">
      <div style={{ textAlign: 'center', margin: '40px 0 60px' }}>
        <Title level={1} style={{ color: 'var(--navy)' }}>Dịch vụ sửa chữa</Title>
        <Text type="secondary" style={{ fontSize: 18 }}>Tìm dịch vụ phù hợp với nhu cầu của bạn</Text>
      </div>

      <div style={{ marginBottom: 40, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Input 
          size="large"
          placeholder="Tìm kiếm dịch vụ..." 
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: 400, flex: 1 }}
        />
        <Select 
          size="large"
          placeholder="Tất cả danh mục"
          allowClear
          value={categoryFilter}
          onChange={setCategoryFilter}
          style={{ width: 240 }}
        >
          {categories.map(cat => (
            <Option key={cat.id} value={cat.id}>{cat.name}</Option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
        </div>
      ) : services.length === 0 ? (
        <Empty description="Không tìm thấy dịch vụ nào" style={{ margin: '100px 0' }} />
      ) : (
        <Row gutter={[24, 24]}>
          {services.map(service => (
            <Col xs={24} sm={12} lg={8} xl={6} key={service.id}>
              <Card 
                hoverable
                className="hover-card glass-card"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                styles={{ body: { padding: 24, flex: 1, display: 'flex', flexDirection: 'column' } }}
                cover={
                  service.image_url ? (
                    <img 
                      alt={service.name} 
                      src={service.image_url} 
                      style={{ height: 200, objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ height: 200, background: 'var(--navy-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', opacity: 0.5 }}>Chưa có hình ảnh</Text>
                    </div>
                  )
                }
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ padding: '6px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>
                    {service.category?.name || service.Category?.name || 'Khác'}
                  </div>
                </div>
                <Title level={4} style={{ marginBottom: 8, fontSize: 20 }}>{service.name}</Title>
                <Text type="secondary" style={{ flex: 1, marginBottom: 24, fontSize: 14 }}>
                  {service.description || 'Chưa có mô tả'}
                </Text>
                
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Giá từ</div>
                    <div style={{ color: 'var(--orange)', fontWeight: 700, fontSize: 18 }}>
                      {formatVND(service.base_price)}
                    </div>
                  </div>
                  <Button 
                    type="primary" 
                    shape="circle" 
                    icon={<ArrowRightOutlined />} 
                    onClick={() => navigate(`/services/${service.id}`)}
                  />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <div style={{ textAlign: 'center', marginTop: 60, padding: 40, background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)' }}>
        <Title level={3} style={{ color: 'var(--navy)', marginBottom: 16 }}>Không tìm thấy dịch vụ bạn cần?</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24, fontSize: 16 }}>
          Hãy để AI chẩn đoán sự cố giúp bạn hoặc mô tả vấn đề, chúng tôi sẽ cử thợ đến kiểm tra.
        </Text>
        <Button size="large" type="primary" onClick={() => navigate('/customer/booking')}>
          Mô tả sự cố ngay
        </Button>
      </div>
    </div>
  );
}
