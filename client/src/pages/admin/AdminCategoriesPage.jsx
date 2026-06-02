import { useState } from 'react';
import { Table, Button, Typography, Space, Modal, Form, Input, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';

const { Title } = Typography;
const { TextArea } = Input;

export default function AdminCategoriesPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [form] = Form.useForm();

  const { data: catData, isLoading, refetch } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: adminApi.getCategories,
  });

  const categories = catData?.data || [];

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingId(category.id);
      form.setFieldsValue(category);
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
        await adminApi.updateCategory(editingId, values);
        message.success('Cập nhật danh mục thành công');
      } else {
        await adminApi.createCategory(values);
        message.success('Thêm danh mục thành công');
      }
      setIsModalVisible(false);
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi lưu danh mục');
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
          message.error(err.message || 'Lỗi khi xóa');
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
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
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
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Quản lý Danh mục</Title>
          <p>Danh mục các nhóm dịch vụ sửa chữa</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Thêm danh mục</Button>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table 
          columns={columns} 
          dataSource={categories} 
          rowKey="id"
          loading={isLoading}
        />
      </div>

      <Modal
        title={editingId ? "Sửa danh mục" : "Thêm danh mục mới"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true }]}>
            <Input />
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