import { useState } from 'react';
import { Table, Tag, Button, Typography, Space, Modal, Form, Input, message, Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatDateTime } from '../../utils/helpers';
import { COMPLAINT_STATUS_LABELS } from '../../utils/constants';
import { CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function AdminComplaintsPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [form] = Form.useForm();

  const { data: complaintsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-complaints'],
    queryFn: () => adminApi.getComplaints(),
  });

  const complaints = complaintsData?.data || [];

  const handleOpenResolve = (id) => {
    setResolvingId(id);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleResolve = async (values) => {
    try {
      setLoadingAction(true);
      await adminApi.resolveComplaint(resolvingId, {
        admin_response: values.resolution_notes,
        status: values.status,
      });
      message.success('Đã xử lý khiếu nại');
      setIsModalVisible(false);
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi xử lý');
    } finally {
      setLoadingAction(false);
    }
  };

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'booking_id',
      key: 'booking_id',
      render: (id) => <span style={{ fontWeight: 600 }}>#{id}</span>,
    },
    {
      title: 'Khách hàng',
      dataIndex: ['Booking', 'Customer', 'User', 'full_name'],
      key: 'customer',
      render: (_, record) => record.booking?.customer?.full_name || 'N/A',
    },
    {
      title: 'Kỹ thuật viên bị phản ánh',
      key: 'tech',
      render: (_, record) => record.booking?.technicianProfile?.user?.full_name || 'N/A',
    },
    {
      title: 'Chi tiết khiếu nại',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => formatDateTime(time),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        if (status === 'IN_REVIEW') color = 'processing';
        if (status === 'RESOLVED') color = 'success';
        if (status === 'REJECTED') color = 'error';
        return <Tag color={color}>{COMPLAINT_STATUS_LABELS[status] || status}</Tag>;
      },
    },
    {
      title: 'AI sentiment',
      dataIndex: 'ai_sentiment',
      key: 'ai_sentiment',
      render: (sentiment) => {
        const color = sentiment === 'NEGATIVE' ? 'red' : sentiment === 'POSITIVE' ? 'green' : 'default';
        return <Tag color={color}>{sentiment || 'NEUTRAL'}</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'OPEN' || record.status === 'IN_REVIEW' ? (
            <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => handleOpenResolve(record.id)}>Xử lý</Button>
          ) : (
            <Button type="default" size="small">Xem</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Quản lý Khiếu nại</Title>
        <p>Tiếp nhận và giải quyết các phản ánh từ khách hàng</p>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table 
          columns={columns} 
          dataSource={complaints} 
          rowKey="id"
          loading={isLoading}
        />
      </div>

      <Modal
        title="Giải quyết khiếu nại"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleResolve} initialValues={{ status: 'RESOLVED' }}>
          <Form.Item name="resolution_notes" label="Ghi chú hướng giải quyết (Khách hàng sẽ thấy)" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="Ví dụ: Đã liên hệ khách hàng xin lỗi và hoàn tiền 50%..." />
          </Form.Item>
          <Form.Item name="status" label="Kết quả xử lý" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="RESOLVED">Chấp nhận & Đã giải quyết</Select.Option>
              <Select.Option value="REJECTED">Từ chối khiếu nại (Không hợp lệ)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loadingAction} block>
              Lưu kết quả
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
