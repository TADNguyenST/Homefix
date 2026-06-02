import { Table, Tag, Button, Typography, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { technicianApi } from '../../api/technicianApi';
import { Link } from 'react-router-dom';
import { formatVND, formatDateTime } from '../../utils/helpers';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../../utils/constants';

const { Title } = Typography;

export default function TechHistoryPage() {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['tech-history'],
    queryFn: () => technicianApi.getJobHistory(), // Should return COMPLETED or CANCELLED jobs
  });

  const jobs = historyData?.data || [];

  const columns = [
    {
      title: 'Mã Đơn',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <span style={{ fontWeight: 600 }}>#{id.substring(0, 8)}</span>,
    },
    {
      title: 'Dịch vụ',
      dataIndex: ['Service', 'name'],
      key: 'service',
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: 'Khách hàng',
      dataIndex: ['Customer', 'User', 'full_name'],
      key: 'customer',
    },
    {
      title: 'Ngày hoàn thành',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (time) => formatDateTime(time),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'total_price',
      key: 'total_price',
      render: (price) => <span style={{ fontWeight: 600, color: 'var(--orange)' }}>{formatVND(price)}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colorCfg = BOOKING_STATUS_COLORS[status] || {};
        return (
          <Tag color={colorCfg.bg} style={{ color: colorCfg.color, border: 'none', fontWeight: 600 }}>
            {BOOKING_STATUS_LABELS[status]}
          </Tag>
        );
      },
    },
    {
      title: 'Thanh toán',
      dataIndex: 'payment_status',
      key: 'payment_status',
      render: (status) => (
        <Tag color={status === 'PAID' ? 'success' : 'default'} style={{ borderRadius: 'var(--radius-full)' }}>
          {status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Link to={`/technician/jobs/${record.id}`}>
          <Button type="default" size="small" icon={<EyeOutlined />}>Chi tiết</Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Lịch sử công việc</Title>
        <p>Các công việc đã hoàn thành hoặc đã bị hủy</p>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table 
          columns={columns} 
          dataSource={jobs} 
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
        />
      </div>
    </div>
  );
}