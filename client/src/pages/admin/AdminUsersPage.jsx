import { Table, Tag, Button, Typography, Space, message, Modal } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatDateTime } from '../../utils/helpers';

const { Title } = Typography;

export default function AdminUsersPage() {
  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: () => adminApi.getUsers(),
  });

  const users = (usersData?.data || []).filter(u => u.role === 'CUSTOMER');

  const handleToggleLock = (user) => {
    const action = user.is_active ? 'Khóa' : 'Mở khóa';
    Modal.confirm({
      title: `Xác nhận ${action.toLowerCase()} tài khoản?`,
      content: `Bạn có chắc chắn muốn ${action.toLowerCase()} tài khoản ${user.email}?`,
      onOk: async () => {
        try {
          if (user.is_active) {
            await adminApi.lockUser(user.id);
          } else {
            await adminApi.unlockUser(user.id);
          }
          message.success(`Đã ${action.toLowerCase()} tài khoản`);
          // Note: you might want to call refetch() from useQuery here if you extract it: const { data, refetch } = useQuery...
          refetch();
        } catch (err) {
          message.error(err.message || `Lỗi khi ${action.toLowerCase()} tài khoản`);
        }
      }
    });
  };

  const columns = [
    {
      title: 'Họ và tên',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        let color = 'blue';
        if (role === 'ADMIN') color = 'red';
        if (role === 'TECHNICIAN') color = 'orange';
        return <Tag color={color}>{role}</Tag>;
      },
    },
    {
      title: 'Ngày đăng ký',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => formatDateTime(time),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'error'}>
          {isActive ? 'Hoạt động' : 'Đã khóa'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.role !== 'ADMIN' && (
            <Button 
              danger={record.is_active} 
              type={!record.is_active ? "primary" : "default"}
              size="small" 
              onClick={() => handleToggleLock(record)}
            >
              {record.is_active ? 'Khóa' : 'Mở khóa'}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Quản lý Khách hàng</Title>
        <p>Danh sách tài khoản khách hàng trên hệ thống</p>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table 
          columns={columns} 
          dataSource={users} 
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
        />
      </div>
    </div>
  );
}