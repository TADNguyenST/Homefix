import { Typography, Row, Col, Card, Spin, Alert, Breadcrumb, Space, Avatar } from 'antd';
import { ArrowRightOutlined, FileTextOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { blogApi } from '../../api/blogApi';
import { getInitials, stripHtmlAndTruncate } from '../../utils/helpers';
import ImageGrid from '../../components/ImageGrid';

const { Title, Text } = Typography;

export default function BlogListPage() {
  const navigate = useNavigate();

  const { data: blogsData, isLoading, isError } = useQuery({
    queryKey: ['public-blogs', { limit: 100 }],
    queryFn: () => blogApi.getPublicBlogs({ limit: 100 })
  });

  const blogs = blogsData?.data || [];

  const fallbackImages = [
    'https://images.unsplash.com/photo-1544724569-5f546fd6f2b6?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1563223771-5fe4038fbfc9?auto=format&fit=crop&q=80&w=600',
  ];

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  if (isError) {
    return <div className="page-container" style={{ padding: '60px 0' }}><Alert type="error" message="Lỗi khi tải danh sách bài viết" /></div>;
  }

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', padding: '40px 0' }}>
      <div className="page-container">
        <Breadcrumb style={{ marginBottom: 24 }}>
          <Breadcrumb.Item>
            <Link to="/">Trang chủ</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Tin tức</Breadcrumb.Item>
        </Breadcrumb>

        <div style={{ marginBottom: 40 }}>
          <Text style={{ color: 'var(--orange)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 13 }}>
            <FileTextOutlined /> Tin tức & Cẩm nang
          </Text>
          <Title level={1} style={{ color: 'var(--navy)', marginTop: 8, marginBottom: 0, fontWeight: 700 }}>
            Chia sẻ kiến thức
          </Title>
        </div>

        {blogs.length === 0 ? (
          <Alert message="Chưa có bài viết nào" type="info" />
        ) : (
          <Row gutter={[24, 24]}>
            {blogs.map((blog, idx) => (
              <Col xs={24} sm={12} md={8} key={blog.id}>
                <Card
                  hoverable
                  className="hover-card fade-in-up"
                  style={{ height: '100%', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: 'none', boxShadow: 'var(--shadow-md)' }}
                  cover={
                    blog.image_urls && blog.image_urls.length > 0 ? (
                      <ImageGrid images={blog.image_urls} height={200} />
                    ) : (
                      <div style={{ height: 200, overflow: 'hidden', background: '#f8fafc' }}>
                        <img
                          alt={blog.title}
                          src={fallbackImages[idx % fallbackImages.length]}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                        />
                      </div>
                    )
                  }
                  styles={{ body: { padding: '20px 24px', display: 'flex', flexDirection: 'column' } }}
                  onClick={() => navigate(`/blogs/${blog.slug}`)}
                >
                  <Card.Meta
                    title={
                      <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                        {blog.title}
                      </Typography.Paragraph>
                    }
                    description={
                      <div>
                        <Space size="middle" style={{ marginBottom: 12, marginTop: 8 }}>
                          <Space size="small">
                            <Avatar size="small" src={blog.author?.avatar_url} icon={!blog.author?.avatar_url && <UserOutlined />}>
                              {!blog.author?.avatar_url && getInitials(blog.author?.full_name)}
                            </Avatar>
                            <Text type="secondary" style={{ fontSize: 13 }}>{blog.author?.full_name || 'Admin'}</Text>
                          </Space>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            <ClockCircleOutlined style={{ marginRight: 4 }}/>
                            {dayjs(blog.created_at).format('DD/MM/YYYY')}
                          </Text>
                        </Space>
                        <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ wordWrap: 'break-word', wordBreak: 'break-word' }}>
                          {stripHtmlAndTruncate(blog.content, 180)}
                        </Typography.Paragraph>
                      </div>
                    }
                  />
                  <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                    <Text strong style={{ color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      Đọc tiếp <ArrowRightOutlined />
                    </Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}
