import { Table, Tag, Button, Typography, Space, Modal, message } from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { technicianApi } from '../../api/technicianApi';
import { Link, useNavigate } from 'react-router-dom';
import { formatVND, formatDateTime } from '../../utils/helpers';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../../utils/constants';

const { Title, Text } = Typography;

export default function TechJobsPage() {
  const navigate = useNavigate();

  const { data: jobsData, isLoading, refetch } = useQuery({
    queryKey: ['tech-jobs'],
    queryFn: () => technicianApi.getJobs(), // Assumes this endpoint returns ASSIGNED, IN_PROGRESS, INSPECTING, QUOTED, COMPLETING
  });

  const jobs = jobsData?.data || [];

  const handleAcceptJob = (id) => {
    Modal.confirm({
      title: 'Nhận công việc này?',
      content: 'Bạn sẽ chịu trách nhiệm hoàn thành công việc theo đúng thời gian đã hẹn.',
      onOk: async () => {
        try {
          await technicianApi.acceptJob(id);
          message.success('Đã nhận công việc');
          refetch();
        } catch (err) {
          message.error(err.message || 'Lỗi khi nhận việc');
        }
      }
    });
  };

  const columns = [
    {
      title: 'Mã Đơn',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <span style={{ fontWeight: 600 }}>#{id.substring(0, 8)}</span>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'Customer',
      key: 'customer',
      render: (customer) => customer?.User?.full_name || 'N/A',
    },
    {
      title: 'Dịch vụ',
      dataIndex: ['Service', 'name'],
      key: 'service',
      render: (text) => <span style={{ fontWeight: 500, color: 'var(--navy)' }}>{text}</span>,
    },
    {
      title: 'Ngày hẹn',
      dataIndex: 'scheduled_time',
      key: 'scheduled_time',
      render: (time) => formatDateTime(time),
    },
    {
      title: 'Địa chỉ',
      dataIndex: 'Address',
      key: 'address',
      render: (addr) => (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {addr?.street_address}, {addr?.Ward?.name}, {addr?.District?.name}
        </span>
      ),
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colorCfg = BOOKING_STATUS_COLORS[status] || {};
        return (
          <Tag color={colorCfg.bg} style={{ color: colorCfg.color, border: 'none', fontWeight: 600, padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>
            {BOOKING_STATUS_LABELS[status]}
          </Tag>
        );
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'ASSIGNED' && (
            <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleAcceptJob(record.id)}>Nhận</Button>
          )}
          <Button type="default" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/technician/jobs/${record.id}`)}>Chi tiết</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Công việc hiện tại</Title>
        <p>Danh sách các công việc bạn được phân công hoặc đang thực hiện</p>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table 
          columns={columns} 
          dataSource={jobs} 
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </div>
    </div>
  );
}