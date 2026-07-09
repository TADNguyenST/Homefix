import { Table, Tag, Button, Typography, Space, message, Modal, Input, Select, Card } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { formatDateTime } from '../../utils/helpers';
import { SearchOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { Option } = Select;

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['admin-users-list', search, statusFilter, currentPage],
    queryFn: () => adminApi.getUsers({
      role: 'CUSTOMER',
      search: search || undefined,
      is_active: statusFilter === 'active'
        ? 'true'
        : statusFilter === 'unverified' ? 'false' : undefined,
      is_locked: statusFilter === 'locked'
        ? 'true'
        : statusFilter === 'active' || statusFilter === 'unverified' ? 'false' : undefined,
      page: currentPage,
      limit: pageSize,
    }),
  });

  const users = usersData?.data || [];
  const totalUsers = usersData?.pagination?.total || 0;

  const handleToggleLock = (user) => {
    const action = user.is_locked ? 'Mở khóa' : 'Khóa';
    Modal.confirm({
      title: `Xác nhận ${action.toLowerCase()} tài khoản?`,
      content: `Bạn có chắc chắn muốn ${action.toLowerCase()} tài khoản ${user.email}?`,
      okText: 'Xác nhận',
      cancelText: 'Đóng',
      okButtonProps: { danger: !user.is_locked },
      onOk: async () => {
        try {
          setUpdatingUserId(user.id);
          if (user.is_locked) {
            await adminApi.unlockUser(user.id);
          } else {
            await adminApi.lockUser(user.id);
          }
          message.success(`Đã ${action.toLowerCase()} tài khoản thành công`);
          refetch();
        } catch (err) {
          message.error(err.message || `Lỗi khi ${action.toLowerCase()} tài khoản`);
        } finally {
          setUpdatingUserId(null);
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
      render: (text) => text || 'N/A',
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: (role) => <Tag color="blue">{role}</Tag>,
    },
    {
      title: 'Ngày đăng ký',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => formatDateTime(time),
    },
    {
      title: 'Trạng thái',
      key: 'account_status',
      render: (_, record) => {
        if (record.is_locked) return <Tag color="error">Đã khóa</Tag>;
        if (!record.is_active) return <Tag color="warning">Chưa xác thực</Tag>;
        return <Tag color="success">Hoạt động</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.role !== 'ADMIN' && (
            <Button 
              danger={!record.is_locked}
              type={record.is_locked ? 'primary' : 'default'}
              size="small" 
              icon={record.is_locked ? <UnlockOutlined /> : <LockOutlined />}
              loading={updatingUserId === record.id}
              onClick={() => handleToggleLock(record)}
            >
              {record.is_locked ? 'Mở khóa' : 'Khóa'}
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

      <Card className="glass-card" style={{ marginBottom: 20 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Tìm theo tên, email..."
            prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: 280 }}
            allowClear
          />
          <span style={{ color: 'var(--text-secondary)' }}>Trạng thái:</span>
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
            style={{ width: 180 }}
          >
            <Option value="all">Tất cả</Option>
            <Option value="active">Đang hoạt động</Option>
            <Option value="unverified">Chưa xác thực</Option>
            <Option value="locked">Đã khóa</Option>
          </Select>
        </Space>
      </Card>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table 
          columns={columns} 
          dataSource={users} 
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: totalUsers,
            onChange: (page) => setCurrentPage(page),
            showSizeChanger: false,
          }}
        />
      </div>
    </div>
  );
}
