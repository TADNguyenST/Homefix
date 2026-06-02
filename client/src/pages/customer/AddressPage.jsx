import { useState, useEffect } from 'react';
import { Card, Button, Typography, Modal, Form, Input, message, Row, Col, Space, Switch, Select, Tag } from 'antd';
import { EnvironmentOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { addressApi } from '../../api/bookingApi';

const { Title, Text } = Typography;

export default function AddressPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [form] = Form.useForm();

  const { data: addressesData, isLoading, refetch } = useQuery({
    queryKey: ['addresses'],
    queryFn: addressApi.getAll,
  });

  const addresses = addressesData?.data || [];

  useEffect(() => {
    addressApi.getDistricts()
      .then(res => setDistricts(res.data || []))
      .catch(err => console.error(err));
  }, []);

  const handleDistrictChange = (districtId) => {
    form.setFieldsValue({ ward_id: undefined });
    setWards([]);
    if (districtId) {
      addressApi.getWards(districtId)
        .then(res => setWards(res.data || []))
        .catch(err => console.error(err));
    }
  };

  const handleOpenModal = (address = null) => {
    if (address) {
      setEditingId(address.id);
      form.setFieldsValue(address);
      if (address.district_id) {
        addressApi.getWards(address.district_id)
          .then(res => setWards(res.data || []))
          .catch(err => console.error(err));
      } else {
        setWards([]);
      }
    } else {
      setEditingId(null);
      form.resetFields();
      setWards([]);
    }
    setIsModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      setLoading(true);

      if (editingId) {
        await addressApi.update(editingId, values);
        message.success('Cập nhật địa chỉ thành công');
      } else {
        await addressApi.create(values);
        message.success('Thêm địa chỉ mới thành công');
      }
      setIsModalVisible(false);
      refetch();
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Lỗi khi lưu địa chỉ');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Xóa địa chỉ?',
      content: 'Bạn có chắc chắn muốn xóa địa chỉ này?',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await addressApi.remove(id);
          message.success('Đã xóa địa chỉ');
          refetch();
        } catch (err) {
          message.error(err.response?.data?.message || err.message || 'Lỗi khi xóa');
        }
      },
    });
  };

  const handleSetDefault = async (id) => {
    try {
      await addressApi.setDefault(id);
      message.success('Đã đặt làm địa chỉ mặc định');
      refetch();
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Lỗi khi thiết lập mặc định');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Sổ địa chỉ</Title>
          <p>Quản lý địa chỉ đặt dịch vụ trong khu vực HomeFix hỗ trợ</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Thêm địa chỉ
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        {addresses.map((addr) => (
          <Col xs={24} md={12} key={addr.id}>
            <Card
              className="glass-card"
              style={{ height: '100%' }}
              actions={[
                <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(addr)}>Sửa</Button>,
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(addr.id)}>Xóa</Button>,
              ]}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Space>
                  <EnvironmentOutlined style={{ color: 'var(--orange)', fontSize: 20 }} />
                  <Text strong>{addr.label || 'Địa chỉ'}</Text>
                </Space>
                {addr.is_default && <Tag color="blue">Mặc định</Tag>}
              </div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                {addr.address_detail}, {addr.ward?.name || 'Phường/Xã'}, {addr.district?.name || 'Khu vực phục vụ'}
              </Text>

              {!addr.is_default && (
                <Button size="small" onClick={() => handleSetDefault(addr.id)}>
                  Đặt làm mặc định
                </Button>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title={editingId ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="label" label="Nhãn địa chỉ (Ví dụ: Nhà riêng, Cơ quan...)" rules={[{ required: true, message: 'Vui lòng nhập nhãn địa chỉ' }]}>
            <Input placeholder="Ví dụ: Nhà riêng" />
          </Form.Item>
          <Form.Item name="district_id" label="Khu vực phục vụ" rules={[{ required: true, message: 'Vui lòng chọn khu vực phục vụ' }]}>
            <Select placeholder="Chọn khu vực phục vụ" onChange={handleDistrictChange}>
              {districts.map(d => (
                <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="ward_id" label="Phường/Xã sau sáp nhập" rules={[{ required: true, message: 'Vui lòng chọn phường/xã' }]}>
            <Select placeholder="Chọn phường/xã" disabled={!wards.length}>
              {wards.map(w => (
                <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="address_detail" label="Địa chỉ chi tiết (Số nhà, đường...)" rules={[{ required: true, message: 'Vui lòng nhập chi tiết số nhà, tên đường' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="is_default" valuePropName="checked">
            <Switch checkedChildren="Mặc định" unCheckedChildren="Thường" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading || isLoading} block>Lưu địa chỉ</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
