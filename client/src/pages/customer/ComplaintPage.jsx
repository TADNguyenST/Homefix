import { useState } from 'react';
import { Table, Tag, Button, Typography, Modal, Form, Input, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { complaintApi } from '../../api/bookingApi';
import { formatDateTime } from '../../utils/helpers';
import { COMPLAINT_STATUS_LABELS } from '../../utils/constants';

const { Title } = Typography;
const { TextArea } = Input;

export default function ComplaintPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const { data: complaintsData, isLoading, refetch } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: complaintApi.getMy,
  });

  const complaints = complaintsData?.data || [];

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'booking_id',
      key: 'booking_id',
      render: (id) => <span style={{ fontWeight: 600 }}>#{id}</span>,
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => formatDateTime(time),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
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
        return <Tag color={color}>{COMPLAINT_STATUS_LABELS[status]}</Tag>;
      },
    },
    {
      title: 'Phản hồi',
      dataIndex: 'admin_response',
      key: 'admin_response',
      ellipsis: true,
      render: (text) => text || '-',
    },
  ];

  const handleCreate = async (values) => {
    try {
      setLoading(true);
      await complaintApi.create(values.booking_id, values);
      message.success('Đã gửi khiếu nại thành công');
      setIsModalVisible(false);
      form.resetFields();
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi gửi khiếu nại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Khiếu nại của tôi</Title>
          <p>Quản lý các yêu cầu khiếu nại về chất lượng dịch vụ</p>
        </div>
        <Button type="primary" onClick={() => setIsModalVisible(true)}>Gửi khiếu nại mới</Button>
      </div>

      <Table 
        className="glass-card"
        columns={columns} 
        dataSource={complaints} 
        rowKey="id"
        loading={isLoading}
      />

      <Modal
        title="Gửi khiếu nại"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="booking_id"
            label="Mã đơn hàng (Copy từ danh sách đơn)"
            rules={[{ required: true, message: 'Vui lòng nhập mã đơn hàng' }]}
          >
            <Input placeholder="Nhập ID đơn hàng" />
          </Form.Item>

          <Form.Item
            name="subject"
            label="Tiêu đề khiếu nại"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input placeholder="Ví dụ: Dịch vụ không đạt chất lượng" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Chi tiết khiếu nại"
            rules={[{ required: true, message: 'Vui lòng mô tả chi tiết' }]}
          >
            <TextArea rows={4} placeholder="Mô tả rõ vấn đề bạn gặp phải..." />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Gửi khiếu nại
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}