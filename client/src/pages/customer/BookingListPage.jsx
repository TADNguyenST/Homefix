import { Table, Tag, Button, Select, DatePicker, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { bookingApi } from '../../api/bookingApi';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { formatVND, formatDateTime } from '../../utils/helpers';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '../../utils/constants';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function BookingListPage() {
  const [statusFilter, setStatusFilter] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['my-bookings', statusFilter],
    queryFn: () => bookingApi.getMyBookings(statusFilter ? { status: statusFilter } : {}),
  });

  const bookings = bookingsData?.data || [];

  const columns = [
    {
      title: 'Mã Đơn',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <span style={{ fontWeight: 600 }}>#{id}</span>,
    },
    {
      title: 'Dịch vụ',
      dataIndex: ['service', 'name'],
      key: 'service',
      render: (text) => <span style={{ fontWeight: 500, color: 'var(--navy)' }}>{text}</span>,
    },
    {
      title: 'Ngày đặt',
      dataIndex: 'booking_date',
      key: 'booking_date',
      render: (_, record) => `${formatDateTime(record.booking_date)} ${record.time_slot_start || ''}`,
    },
    {
      title: 'Kỹ thuật viên',
      dataIndex: 'technician',
      key: 'technician',
      render: (_, record) => record.technicianProfile?.user?.full_name || <span style={{ color: 'var(--text-muted)' }}>Chưa gán</span>,
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'estimated_price',
      key: 'estimated_price',
      render: (price, record) => (
        <span style={{ fontWeight: 600, color: 'var(--orange)' }}>
          {formatVND(record.final_price || record.payment?.amount || price)}
        </span>
      ),
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
      title: 'Thanh toán',
      key: 'payment_status',
      render: (_, record) => {
        const status = record.payment?.status;
        return (
          <Tag color={status === 'PAID' ? 'success' : 'default'} style={{ borderRadius: 'var(--radius-full)' }}>
            {PAYMENT_STATUS_LABELS[status] || 'Chưa thanh toán'}
          </Tag>
        );
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Link to={`/customer/bookings/${record.id}`}>
          <Button type="primary" size="small" icon={<EyeOutlined />}>Chi tiết</Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Đơn đặt lịch</h1>
          <p>Quản lý và theo dõi các đơn sửa chữa của bạn</p>
        </div>
        <Link to="/customer/booking">
          <Button type="primary" size="large">Đặt lịch mới</Button>
        </Link>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)', marginBottom: 24 }}>
        <Space size="large" style={{ marginBottom: 24 }}>
          <div>
            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Lọc theo trạng thái</div>
            <Select 
              style={{ width: 200 }} 
              placeholder="Tất cả trạng thái" 
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              {Object.entries(BOOKING_STATUS_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </div>
          <div>
            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Lọc theo thời gian</div>
            <RangePicker style={{ width: 280 }} value={dateRange} onChange={(dates) => setDateRange(dates)} />
          </div>
        </Space>

        <Table 
          columns={columns} 
          dataSource={bookings} 
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </div>
    </div>
  );
}
