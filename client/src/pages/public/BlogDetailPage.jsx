import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Typography, Spin, Alert, Breadcrumb, Avatar, Divider, Space } from 'antd';
import { UserOutlined, ClockCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { blogApi } from '../../api/blogApi';
import { getInitials, stripHtmlAndTruncate } from '../../utils/helpers';
import DOMPurify from 'dompurify';
import ImageGrid from '../../components/ImageGrid';

const { Title, Paragraph, Text } = Typography;

export default function BlogDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data: blogData, isLoading, isError } = useQuery({
    queryKey: ['blog', slug],
    queryFn: () => blogApi.getBlogBySlug(slug),
    retry: false,
  });

  const { data: relatedBlogsData } = useQuery({
    queryKey: ['public-blogs', { limit: 4 }],
    queryFn: () => blogApi.getPublicBlogs({ limit: 4 }),
  });

  const blog = blogData?.data;
  const relatedBlogs = relatedBlogsData?.data?.filter(b => b.id !== blog?.id).slice(0, 3) || [];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !blog) {
    return (
      <div className="container" style={{ padding: '60px 20px', minHeight: '60vh' }}>
        <Alert
          message="Không tìm thấy bài viết"
          description="Bài viết này không tồn tại hoặc đã bị xóa."
          type="error"
          showIcon
          action={
            <Link to="/">Quay về trang chủ</Link>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', padding: '40px 0' }}>
      <div className="container" style={{ maxWidth: 1100, margin: '0 auto', background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>

        <Breadcrumb style={{ marginBottom: 24 }}>
          <Breadcrumb.Item>
            <Link to="/"><ArrowLeftOutlined /> Trang chủ</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Tin tức</Breadcrumb.Item>
        </Breadcrumb>

        <Title level={1} style={{ fontSize: '32px', marginBottom: 16 }}>{blog.title}</Title>

        <Space size="large" style={{ marginBottom: 24, color: 'var(--text-secondary)' }}>
          <Space>
            <Avatar
              src={blog.author?.avatar_url}
              icon={<UserOutlined />}
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              {!blog.author?.avatar_url && getInitials(blog.author?.full_name)}
            </Avatar>
            <Text strong>{blog.author?.full_name || 'Admin'}</Text>
          </Space>
          <Space>
            <ClockCircleOutlined />
            <Text type="secondary">{dayjs(blog.created_at).format('DD/MM/YYYY HH:mm')}</Text>
          </Space>
        </Space>

        {blog.image_urls && blog.image_urls.length > 0 && (
          <div style={{ marginBottom: 32, borderRadius: 12, overflow: 'hidden' }}>
            <ImageGrid images={blog.image_urls} height={450} />
          </div>
        )}

        <Divider />

        <div
          className="blog-content"
          style={{ fontSize: '18px', lineHeight: '1.8', color: '#333', wordWrap: 'break-word', overflowWrap: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blog.content) }}
        />

        <Divider style={{ marginTop: 40 }} />

        {relatedBlogs.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <Title level={3} style={{ marginBottom: 24 }}>Bài viết mới nhất</Title>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '24px' }}>
              {relatedBlogs.map(related => (
                <Link to={`/blogs/${related.slug}`} key={related.id}>
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #f0f0f0', transition: 'box-shadow 0.3s' }} className="related-blog-card">
                    {related.image_urls && related.image_urls.length > 0 ? (
                      <img src={related.image_urls[0]} alt={related.title} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: 160, background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#adb5bd' }}>No Image</div>
                    )}
                    <div style={{ padding: 16 }}>
                      <Title level={5} style={{ margin: 0, marginBottom: 8, fontSize: 16, height: 44, overflow: 'hidden' }}>{related.title}</Title>
                      <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 14 }}>
                        {stripHtmlAndTruncate(related.content, 100)}
                      </Paragraph>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <Link to="/blogs">
            <Typography.Link>← Xem tất cả bài viết</Typography.Link>
          </Link>
        </div>
      </div>
    </div>
  );
}
