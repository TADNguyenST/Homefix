import { useState } from 'react';
import { Table, Button, Typography, Space, Modal, Form, Input, Switch, message, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';

const { Title } = Typography;
const { TextArea } = Input;

export default function AdminCategoriesPage() {
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [form] = Form.useForm();

  const { data: catData, isLoading, refetch } = useQuery({
    queryKey: ['admin-categories', search],
    queryFn: () => adminApi.getCategories({ search }),
  });

  const categories = catData?.data?.data || catData?.data || [];

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingId(category.id);
      form.setFieldsValue({
        ...category,
      });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ is_active: true });
    }
    setIsModalVisible(true);
  };

  const handleToggleStatus = async (record, checked) => {
    try {
      await adminApi.updateCategory(record.id, { is_active: checked });
      message.success('Cập nhật trạng thái thành công');
      refetch();
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  const handleSave = async (values) => {
    try {
      setLoadingAction(true);
      if (editingId) {
        await adminApi.updateCategory(editingId, values);
        message.success('Cập nhật danh mục thành công');
      } else {
        await adminApi.createCategory(values);
        message.success('Thêm danh mục thành công');
      }
      setIsModalVisible(false);
      refetch();
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Lỗi khi lưu danh mục');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Xóa danh mục?',
      content: 'Lưu ý: Xóa danh mục sẽ ảnh hưởng đến các dịch vụ bên trong.',
      onOk: async () => {
        try {
          await adminApi.deleteCategory(id);
          message.success('Đã xóa danh mục');
          refetch();
        } catch (err) {
          message.error(err.response?.data?.message || err.message || 'Lỗi khi xóa');
        }
      }
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Tên danh mục',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {record.icon_url && <img src={record.icon_url} alt="icon" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: '50%' }} />}
          <span style={{ fontWeight: 500, color: 'var(--navy)' }}>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || <span style={{ color: 'var(--text-secondary)' }}>Chưa có mô tả</span>,
    },
    {
      title: 'Số dịch vụ',
      key: 'service_count',
      render: (_, record) => <Tag color="blue">{record._count?.services || 0} dịch vụ</Tag>,
    },
    {
      title: 'Số loại thiết bị',
      key: 'device_count',
      render: (_, record) => <Tag color="cyan">{record._count?.deviceTypes || 0} loại</Tag>,
    },
    {
      title: 'Trạng thái',
      key: 'is_active',
      render: (_, record) => (
        <Switch 
          checked={record.is_active} 
          onChange={(checked) => handleToggleStatus(record, checked)} 
          checkedChildren="Bật" 
          unCheckedChildren="Tắt"
        />
      ),
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Quản lý Danh mục</Title>
          <p>Danh mục các nhóm dịch vụ sửa chữa</p>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Thêm danh mục
        </Button>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        
        {/* Lọc và Tìm kiếm */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input.Search 
            placeholder="Tìm danh mục theo tên" 
            allowClear 
            onSearch={(value) => setSearch(value)}
            style={{ width: 300 }}
          />
        </div>

        <Table 
          columns={columns} 
          dataSource={categories} 
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
        />
      </div>

      <Modal
        title={<span style={{ fontSize: 20, color: 'var(--navy)' }}>{editingId ? "Sửa danh mục" : "Thêm danh mục mới"}</span>}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 24 }}>
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: 'Vui lòng nhập tên danh mục' }]}>
            <Input placeholder="Vd: Sửa Điện Lạnh" />
          </Form.Item>
          
          <Form.Item name="icon_url" label="Icon URL (Tùy chọn)">
            <Input placeholder="Vd: https://example.com/icon.png" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <TextArea rows={3} placeholder="Mô tả về nhóm dịch vụ này..." />
          </Form.Item>

          <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={loadingAction}>
                Lưu lại
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}