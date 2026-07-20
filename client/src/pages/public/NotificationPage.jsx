import { Card, List, Typography, Spin, Button, message, Badge } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../../api/bookingApi';
import { timeAgo, getNotificationRedirectUrl } from '../../utils/helpers';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function NotificationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getAll({ limit: 50 }),
  });

  const notifications = notifData?.data || [];
  const unreadCount = notifData?.unread_count || 0;

  const markAsReadMutation = useMutation({
    mutationFn: (id) => notificationApi.read(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationApi.readAll(),
    onSuccess: () => {
      message.success('Đã đánh dấu tất cả là đã đọc');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const handleItemClick = (item) => {
    if (!item.is_read) {
      markAsReadMutation.mutate(item.id);
    }
    const redirectUrl = getNotificationRedirectUrl(item, user?.role);
    if (redirectUrl) {
      navigate(redirectUrl);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Thông báo của bạn</Title>
          <p>Cập nhật tình trạng đơn hàng và tin tức mới nhất</p>
        </div>
        {unreadCount > 0 && (
          <Button 
            type="primary" 
            ghost 
            icon={<CheckOutlined />} 
            onClick={() => markAllAsReadMutation.mutate()}
            loading={markAllAsReadMutation.isPending}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      <Card className="glass-card" styles={{ body: { padding: 0 } }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin size="large" /></div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <BellOutlined style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 16 }} />
            <Text type="secondary" style={{ display: 'block' }}>Chưa có thông báo nào</Text>
          </div>
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={notifications}
            renderItem={(item) => (
              <List.Item 
                onClick={() => handleItemClick(item)}
                style={{ 
                  padding: '16px 24px', 
                  cursor: 'pointer',
                  background: item.is_read ? 'transparent' : 'var(--status-assigned-bg)',
                  borderBottom: '1px solid #f1f5f9',
                  transition: 'background 0.3s'
                }}
                className="notification-item"
              >
                <List.Item.Meta
                  avatar={
                    <Badge dot={!item.is_read}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange)' }}>
                        <BellOutlined />
                      </div>
                    </Badge>
                  }
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong={!item.is_read}>{item.title}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{timeAgo(item.created_at)}</Text>
                    </div>
                  }
                  description={
                    <div>
                      <Text style={{ color: item.is_read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{item.message}</Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
