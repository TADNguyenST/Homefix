import { useState } from 'react';
import { Table, Button, Typography, Space, Modal, Form, Input, message, Select, Tag } from 'antd';
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';

const { Title } = Typography;

const districtTypeLabels = {
  QUAN: 'Khu vực trung tâm',
  HUYEN: 'Khu vực mở rộng',
};

const wardTypeLabels = {
  PHUONG: 'Phường',
  XA: 'Xã',
  THI_TRAN: 'Thị trấn',
};

export default function AdminDistrictsPage() {
  const [districtModalOpen, setDistrictModalOpen] = useState(false);
  const [wardModalOpen, setWardModalOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState(null);
  const [editingWard, setEditingWard] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [districtForm] = Form.useForm();
  const [wardForm] = Form.useForm();

  const { data: districtsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-districts'],
    queryFn: adminApi.getDistricts,
  });

  const districts = districtsData?.data || [];

  const openDistrictModal = (district = null) => {
    setEditingDistrict(district);
    districtForm.setFieldsValue(district || { type: 'QUAN' });
    setDistrictModalOpen(true);
  };

  const openWardModal = (district, ward = null) => {
    setSelectedDistrict(district);
    setEditingWard(ward);
    wardForm.setFieldsValue(ward || { type: 'PHUONG' });
    setWardModalOpen(true);
  };

  const saveDistrict = async (values) => {
    try {
      setLoadingAction(true);
      if (editingDistrict) {
        await adminApi.updateDistrict(editingDistrict.id, values);
        message.success('Cập nhật khu vực phục vụ thành công');
      } else {
        await adminApi.createDistrict(values);
        message.success('Thêm khu vực phục vụ thành công');
      }
      setDistrictModalOpen(false);
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi lưu khu vực phục vụ');
    } finally {
      setLoadingAction(false);
    }
  };

  const saveWard = async (values) => {
    try {
      setLoadingAction(true);
      if (editingWard) {
        await adminApi.updateWard(editingWard.id, values);
        message.success('Cập nhật phường/xã thành công');
      } else {
        await adminApi.createWard(selectedDistrict.id, values);
        message.success('Thêm phường/xã thành công');
      }
      setWardModalOpen(false);
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi lưu phường/xã');
    } finally {
      setLoadingAction(false);
    }
  };

  const deleteDistrict = (district) => {
    Modal.confirm({
      title: 'Xóa khu vực phục vụ?',
      content: 'Chỉ xóa được khi khu vực chưa có phường/xã, địa chỉ, đơn hàng hoặc kỹ thuật viên liên quan.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        await adminApi.deleteDistrict(district.id);
        message.success('Đã xóa khu vực phục vụ');
        refetch();
      },
    });
  };

  const deleteWard = (ward) => {
    Modal.confirm({
      title: 'Xóa phường/xã?',
      content: 'Chỉ xóa được khi phường/xã chưa có địa chỉ hoặc đơn hàng liên quan.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        await adminApi.deleteWard(ward.id);
        message.success('Đã xóa phường/xã');
        refetch();
      },
    });
  };

  const columns = [
    {
      title: 'Tên khu vực phục vụ',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <span style={{ fontWeight: 600 }}>{text}</span>
          <Tag color={record.type === 'QUAN' ? 'blue' : 'green'}>{districtTypeLabels[record.type] || record.type}</Tag>
        </Space>
      ),
    },
    {
      title: 'Số phường/xã',
      dataIndex: ['_count', 'wards'],
      key: 'ward_count',
      width: 140,
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={() => openWardModal(record)}>Thêm phường/xã</Button>
          <Button type="text" icon={<EditOutlined />} onClick={() => openDistrictModal(record)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => deleteDistrict(record)} />
        </Space>
      ),
      width: 260,
    },
  ];

  const expandedRowRender = (district) => (
    <Table
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={district.wards || []}
      columns={[
        { title: 'Tên phường/xã', dataIndex: 'name', key: 'name' },
        { title: 'Loại', dataIndex: 'type', key: 'type', render: (type) => <Tag>{wardTypeLabels[type] || type}</Tag>, width: 140 },
        {
          title: 'Hành động',
          key: 'action',
          width: 160,
          render: (_, ward) => (
            <Space>
              <Button type="text" icon={<EditOutlined />} onClick={() => openWardModal(district, ward)} />
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => deleteWard(ward)} />
            </Space>
          ),
        },
      ]}
    />
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Khu vực hoạt động</Title>
          <p>Quản lý khu vực phục vụ và danh sách phường/xã sau sáp nhập của Cần Thơ mới</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDistrictModal()}>Thêm khu vực</Button>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table
          columns={columns}
          dataSource={districts}
          rowKey="id"
          loading={isLoading}
          expandable={{ expandedRowRender }}
        />
      </div>

      <Modal
        title={editingDistrict ? 'Sửa khu vực phục vụ' : 'Thêm khu vực phục vụ mới'}
        open={districtModalOpen}
        onCancel={() => setDistrictModalOpen(false)}
        footer={null}
      >
        <Form form={districtForm} layout="vertical" onFinish={saveDistrict}>
          <Form.Item name="name" label="Tên khu vực phục vụ" rules={[{ required: true, message: 'Vui lòng nhập tên khu vực' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Nhóm khu vực" rules={[{ required: true, message: 'Vui lòng chọn nhóm khu vực' }]}>
            <Select options={[
              { value: 'QUAN', label: 'Khu vực trung tâm' },
              { value: 'HUYEN', label: 'Khu vực mở rộng' },
            ]} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loadingAction} block>
            Lưu lại
          </Button>
        </Form>
      </Modal>

      <Modal
        title={editingWard ? 'Sửa phường/xã' : `Thêm phường/xã cho ${selectedDistrict?.name || ''}`}
        open={wardModalOpen}
        onCancel={() => setWardModalOpen(false)}
        footer={null}
      >
        <Form form={wardForm} layout="vertical" onFinish={saveWard}>
          <Form.Item name="name" label="Tên phường/xã" rules={[{ required: true, message: 'Vui lòng nhập tên phường/xã' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Loại" rules={[{ required: true, message: 'Vui lòng chọn loại phường/xã' }]}>
            <Select options={[
              { value: 'PHUONG', label: 'Phường' },
              { value: 'XA', label: 'Xã' },
              { value: 'THI_TRAN', label: 'Thị trấn' },
            ]} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loadingAction} block>
            Lưu lại
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
