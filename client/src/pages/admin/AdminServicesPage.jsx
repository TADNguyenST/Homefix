import { useState } from 'react';
import { Table, Button, Typography, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Upload } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import axiosClient from '../../api/axiosClient';
import { formatVND } from '../../utils/helpers';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function AdminServicesPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);

  const { data: srvData, isLoading, refetch } = useQuery({
    queryKey: ['admin-services'],
    queryFn: adminApi.getServices,
  });

  const { data: catData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: adminApi.getCategories,
  });

  // paginated response: { data: [...], pagination: {...} }
  const services = srvData?.data?.data || srvData?.data || [];
  const categories = catData?.data || [];

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingId(service.id);
      form.setFieldsValue({
        ...service,
        category_id: service.category_id || service.category?.id,
      });
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      setLoadingAction(true);
      if (editingId) {
        await adminApi.updateService(editingId, values);
        message.success('Cập nhật dịch vụ thành công');
      } else {
        await adminApi.createService(values);
        message.success('Thêm dịch vụ thành công');
      }
      setIsModalVisible(false);
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi lưu dịch vụ');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Xóa dịch vụ?',
      content: 'Chỉ xóa khi dịch vụ này chưa có đơn đặt lịch nào.',
      onOk: async () => {
        try {
          await adminApi.deleteService(id);
          message.success('Đã xóa dịch vụ');
          refetch();
        } catch (err) {
          message.error(err.message || 'Lỗi khi xóa');
        }
      }
    });
  };

  // Custom upload handler
  const handleUpload = async (info) => {
    const formData = new FormData();
    formData.append('image', info.file);
    try {
      setUploading(true);
      const res = await axiosClient.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = API_BASE + res.data.url;
      form.setFieldsValue({ image_url: imageUrl });
      message.success('Upload ảnh thành công');
    } catch (err) {
      message.error('Lỗi upload ảnh');
    } finally {
      setUploading(false);
    }
  };

  const columns = [
    {
      title: 'Danh mục',
      key: 'category',
      render: (_, record) => {
        const catName = record.category?.name || record.Category?.name;
        return catName ? <Tag color="blue">{catName}</Tag> : <Tag color="default">Chưa gán</Tag>;
      },
      width: 160,
    },
    {
      title: 'Tên dịch vụ',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        const imgUrl = record.image_url;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {imgUrl ? (
              <img src={imgUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0' }} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#94a3b8' }}>📷</div>
            )}
            <span style={{ fontWeight: 500, color: 'var(--navy)' }}>{text}</span>
          </div>
        );
      },
    },
    {
      title: 'Giá cơ bản',
      dataIndex: 'base_price',
      key: 'base_price',
      render: (price) => <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{formatVND(price)}</span>,
      width: 140,
    },
    {
      title: 'Thời gian',
      dataIndex: 'estimated_duration',
      key: 'estimated_duration',
      render: (val) => val ? `${val} phút` : '—',
      width: 100,
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
      width: 120,
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Quản lý Dịch vụ</Title>
          <p>Các dịch vụ chi tiết cung cấp cho khách hàng</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Thêm dịch vụ</Button>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table 
          columns={columns} 
          dataSource={services} 
          rowKey="id"
          loading={isLoading}
        />
      </div>

      <Modal
        title={editingId ? "Sửa dịch vụ" : "Thêm dịch vụ mới"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="category_id" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục' }]}>
            <Select placeholder="Chọn danh mục">
              {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="base_price" label="Giá kiểm tra cơ bản (VNĐ)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} step={10000} />
          </Form.Item>
          <Form.Item name="estimated_duration" label="Thời gian ước tính (phút)">
            <InputNumber style={{ width: '100%' }} min={10} step={15} placeholder="VD: 60" />
          </Form.Item>
          
          {/* Upload ảnh từ máy hoặc dán link */}
          <Form.Item label="Hình ảnh dịch vụ">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Upload
                showUploadList={false}
                customRequest={handleUpload}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  {uploading ? 'Đang tải lên...' : 'Upload ảnh từ máy tính'}
                </Button>
              </Upload>
              <Form.Item name="image_url" noStyle>
                <Input placeholder="Hoặc dán URL ảnh tại đây" />
              </Form.Item>
              {form.getFieldValue('image_url') && (
                <img 
                  src={form.getFieldValue('image_url')} 
                  alt="Preview" 
                  style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, marginTop: 8, border: '1px solid #e2e8f0' }} 
                />
              )}
            </Space>
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loadingAction} block>
              Lưu lại
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}