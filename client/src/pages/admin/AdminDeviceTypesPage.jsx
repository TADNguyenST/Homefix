import { useState } from 'react';
import { Table, Button, Typography, Space, Modal, Form, Input, Select, message, Tag, Switch } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';

const { Title } = Typography;
const { Option } = Select;

export default function AdminDeviceTypesPage() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState(null);
  const [isShowingTrash, setIsShowingTrash] = useState(false);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [form] = Form.useForm();

  const { data: deviceData, isLoading, refetch } = useQuery({
    queryKey: ['admin-device-types', search, filterCategory, isShowingTrash],
    queryFn: () => adminApi.getDeviceTypes({
      search,
      category_id: filterCategory,
      is_deleted: isShowingTrash,
      limit: 100,
    }),
  });

  const { data: catData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: adminApi.getCategories,
  });

  const deviceTypes = deviceData?.data?.data || deviceData?.data || [];
  const categories = catData?.data?.data || catData?.data || [];

  const handleOpenModal = (deviceType = null) => {
    if (deviceType) {
      setEditingId(deviceType.id);
      form.setFieldsValue({
        ...deviceType,
        category_id: deviceType.category_id || deviceType.category?.id,
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
      await adminApi.updateDeviceType(record.id, { is_active: checked });
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
        await adminApi.updateDeviceType(editingId, values);
        message.success('Cập nhật loại thiết bị thành công');
      } else {
        await adminApi.createDeviceType(values);
        message.success('Thêm loại thiết bị thành công');
      }
      setIsModalVisible(false);
      refetch();
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Lỗi khi lưu loại thiết bị');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Xóa loại thiết bị?',
      content: 'Bạn có chắc chắn muốn xóa loại thiết bị này?',
      onOk: async () => {
        try {
          await adminApi.deleteDeviceType(id);
          message.success('Đã xóa loại thiết bị');
          refetch();
        } catch (err) {
          message.error(err.response?.data?.message || err.message || 'Lỗi khi xóa');
        }
      }
    });
  };

  const handleRestore = async (id) => {
    try {
      await adminApi.updateDeviceType(id, { is_deleted: false });
      message.success('Đã khôi phục loại thiết bị');
      refetch();
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Lỗi khi khôi phục');
    }
  };

  const columns = [
    {
      title: 'Thuộc danh mục',
      dataIndex: ['category', 'name'],
      key: 'category',
      render: (text) => text ? <Tag color="blue">{text}</Tag> : <Tag color="default">Chung</Tag>,
      width: 160,
    },
    {
      title: 'Tên loại thiết bị',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span style={{ fontWeight: 500, color: 'var(--navy)' }}>{text}</span>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || <span style={{ color: 'var(--text-secondary)' }}>—</span>,
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
      width: 100,
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          {isShowingTrash ? (
            <Button type="primary" ghost icon={<UndoOutlined />} onClick={() => handleRestore(record.id)}>
              Khôi phục
            </Button>
          ) : (
            <>
              <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
            </>
          )}
        </Space>
      ),
      width: 130,
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Loại thiết bị</Title>
          <p>Quản lý các loại thiết bị hỗ trợ sửa chữa (Máy lạnh, Bồn cầu,...)</p>
        </div>
        <Space>
          <Button
            type={isShowingTrash ? "default" : "dashed"}
            size="large"
            danger={!isShowingTrash}
            icon={isShowingTrash ? null : <DeleteOutlined />}
            onClick={() => setIsShowingTrash(!isShowingTrash)}
          >
            {isShowingTrash ? "Quay lại danh sách" : "Đã xóa"}
          </Button>
          {!isShowingTrash && (
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              Thêm loại thiết bị
            </Button>
          )}
        </Space>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>

        {/* Lọc và Tìm kiếm */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="Tìm loại thiết bị theo tên"
            allowClear
            onSearch={(value) => setSearch(value)}
            style={{ width: 300 }}
          />
          <Select
            placeholder="Lọc theo danh mục"
            allowClear
            style={{ width: 250 }}
            onChange={(val) => setFilterCategory(val)}
          >
            {categories.map(c => (
              <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
            ))}
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={deviceTypes}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
        />
      </div>

      <Modal
        title={<span style={{ fontSize: 20, color: 'var(--navy)' }}>{editingId ? "Sửa loại thiết bị" : "Thêm loại thiết bị mới"}</span>}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 24 }}>
          <Form.Item name="category_id" label="Thuộc danh mục dịch vụ">
            <Select placeholder="Chọn danh mục" allowClear>
              {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item name="name" label="Tên loại thiết bị" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
            <Input placeholder="Vd: Máy lạnh Inverter" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả về loại thiết bị này..." />
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
