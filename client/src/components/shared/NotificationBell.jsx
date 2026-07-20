import { Badge, Dropdown } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../../api/bookingApi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getNotificationRedirectUrl } from '../../utils/helpers';

export default function NotificationBell() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationApi.getAll({ is_read: false, limit: 5 }),
    enabled: isAuthenticated,
    refetchInterval: 60000, // Poll every minute
  });

  const notifications = notificationsData?.data || [];
  const unreadCount = notificationsData?.unread_count || 0;

  const handleMenuClick = async ({ key }) => {
    if (key === 'header' || key === 'empty') return;
    if (key === 'view-all') {
      navigate(user?.role === 'CUSTOMER' ? '/customer/notifications' : (user?.role === 'TECHNICIAN' ? '/technician/notifications' : '/admin/notifications'));
      return;
    }
    const noti = notifications.find(n => String(n.id) === String(key));
    if (noti) {
      try {
        await notificationApi.read(noti.id);
        await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
      const redirectUrl = getNotificationRedirectUrl(noti, user?.role);
      if (redirectUrl) {
        navigate(redirectUrl);
      }
    }
  };

  const items = [
    {
      key: 'header',
      label: <div style={{ fontWeight: 600, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>Thông báo ({unreadCount})</div>,
    },
    ...notifications.slice(0, 5).map((noti) => ({
      key: noti.id,
      label: (
        <div style={{ padding: '8px 0', maxWidth: 300, whiteSpace: 'normal' }}>
          <div style={{ fontWeight: 500 }}>{noti.title}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{noti.message}</div>
        </div>
      ),
    })),
    {
      key: 'view-all',
      label: <div style={{ textAlign: 'center', color: '#1890ff', padding: '8px 0' }}>Xem tất cả</div>,
    }
  ];

  if (notifications.length === 0) {
    items.splice(1, items.length - 2);
    items.splice(1, 0, { key: 'empty', label: <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>Không có thông báo mới</div> });
  }

  return (
    <Dropdown menu={{ items, onClick: handleMenuClick }} trigger={['click']} placement="bottomRight">
      <Badge count={unreadCount} style={{ cursor: 'pointer' }}>
        <BellOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
      </Badge>
    </Dropdown>
  );
}
