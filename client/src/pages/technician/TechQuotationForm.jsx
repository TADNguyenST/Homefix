import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Space, message, InputNumber, Row, Col, Table, Divider, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { technicianApi } from '../../api/technicianApi';
import { formatVND } from '../../utils/helpers';

const { Title, Text, Paragraph } = Typography;

export default function TechQuotationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const { data: jobData, isLoading } = useQuery({
    queryKey: ['tech-job-quotation', id],
    queryFn: () => technicianApi.getJobById(id),
  });

  const job = jobData?.data;

  // Add initial base service fee
  useEffect(() => {
    if (job && job.service && items.length === 0) {
      setItems([{
        key: Date.now().toString(),
        item_name: `Phí cơ bản - ${job.service.name}`,
        quantity: 1,
        unit_price: job.service.base_price,
      }]);
    }
  }, [job]);

  const handleAddItem = (values) => {
    setItems([...items, { ...values, key: Date.now().toString() }]);
    form.resetFields();
  };

  const handleRemoveItem = (key) => {
    setItems(items.filter(item => item.key !== key));
  };

  const handleSubmitQuotation = async () => {
    if (items.length === 0) {
      message.error('Vui lòng thêm ít nhất một hạng mục vào báo giá');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        items: items.map(item => ({
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }))
      };
      await technicianApi.createQuotation(id, payload);
      message.success('Tạo báo giá thành công. Đang chờ khách hàng duyệt.');
      navigate(`/technician/jobs/${id}`);
    } catch (err) {
      message.error(err.message || 'Lỗi khi tạo báo giá');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const columns = [
    {
      title: 'Tên vật tư / Dịch vụ',
      dataIndex: 'item_name',
      key: 'item_name',
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
      width: 100,
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (price) => formatVND(price),
      width: 150,
    },
    {
      title: 'Thành tiền',
      key: 'total',
      render: (_, record) => <Text strong>{formatVND(record.quantity * record.unit_price)}</Text>,
      width: 150,
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.key)} />
      ),
      width: 60,
    },
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Đang tải thông tin đơn hàng..." />
      </div>
    );
  }

  if (job?.status !== 'INSPECTING') {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 500, margin: '0 auto' }}>
        <Title level={4} style={{ color: 'var(--navy)', marginBottom: 16 }}>Đơn hàng không ở trạng thái khảo sát</Title>
        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          Bạn chỉ có thể tạo báo giá khi đơn hàng đang ở trạng thái khảo sát (INSPECTING).
        </Paragraph>
        <Button type="primary" onClick={() => navigate(`/technician/jobs/${id}`)}>Quay lại chi tiết công việc</Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>
          Tạo báo giá
        </Title>
        <p>Đơn hàng #{id} - Khách hàng {job?.customer?.full_name}</p>
      </div>

      <Row gutter={24}>
        <Col span={8}>
          <Card title="Thêm hạng mục" className="glass-card">
            <Form form={form} layout="vertical" onFinish={handleAddItem}>
              <Form.Item name="item_name" label="Tên vật tư / Dịch vụ" rules={[{ required: true }]}>
                <Input placeholder="Ví dụ: Thay ống nước" />
              </Form.Item>
              <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]} initialValue={1}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="unit_price" label="Đơn giá (VNĐ)" rules={[{ required: true }]}>
                <InputNumber min={0} step={10000} style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
              <Form.Item>
                <Button type="dashed" htmlType="submit" block icon={<PlusOutlined />}>
                  Thêm vào danh sách
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={16}>
          <Card className="glass-card">
            <Table 
              columns={columns} 
              dataSource={items} 
              pagination={false}
              rowKey="key"
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3} align="right">
                    <Text strong style={{ fontSize: 16 }}>Tổng thanh toán:</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} colSpan={2}>
                    <Text strong style={{ color: 'var(--orange)', fontSize: 20 }}>
                      {formatVND(totalAmount)}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
            
            <Divider />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary">Khách hàng sẽ nhận được thông báo để duyệt báo giá này trên ứng dụng của họ.</Text>
              <Space>
                <Button onClick={() => navigate(`/technician/jobs/${id}`)}>Hủy</Button>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSubmitQuotation} loading={loading} disabled={items.length === 0}>
                  Gửi báo giá cho khách
                </Button>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}