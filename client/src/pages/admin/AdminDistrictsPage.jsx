import { useState } from 'react';
import { Table, Button, Typography, Space, Modal, Form, Input, message, Select, Tag, Switch } from 'antd';
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';

const { Title } = Typography;

const districtTypeLabels = {
  CENTER: 'Khu vực trung tâm',
  SUBURB: 'Khu vực mở rộng',
  // Legacy fallback
  QUAN: 'Khu vực trung tâm',
  HUYEN: 'Khu vực mở rộng',
};

const wardTypeLabels = {
  PHUONG: 'Phường',
  XA: 'Xã',
  THI_TRAN: 'Thị trấn',
};

export default function AdminDistrictsPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(null);

  const [districtModalOpen, setDistrictModalOpen] = useState(false);
  const [wardModalOpen, setWardModalOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState(null);
  const [editingWard, setEditingWard] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [districtForm] = Form.useForm();
  const [wardForm] = Form.useForm();

  const { data: districtsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-districts', search, filterType],
    queryFn: () => adminApi.getDistricts({ search, type: filterType }),
  });

  const districts = districtsData?.data?.data || districtsData?.data || [];

  const openDistrictModal = (district = null) => {
    setEditingDistrict(district);
    districtForm.resetFields();
    if (district) {
      districtForm.setFieldsValue({
        name: district.name,
        type: district.type === 'QUAN' ? 'CENTER' : district.type === 'HUYEN' ? 'SUBURB' : district.type,
        is_active: district.is_active,
      });
    } else {
      districtForm.setFieldsValue({ type: 'CENTER', is_active: true });
    }
    setDistrictModalOpen(true);
  };

  const openWardModal = (district, ward = null) => {
    setSelectedDistrict(district);
    setEditingWard(ward);
    wardForm.resetFields();
    if (ward) {
      wardForm.setFieldsValue({ name: ward.name, type: ward.type, is_active: ward.is_active });
    } else {
      wardForm.setFieldsValue({ type: 'PHUONG', is_active: true });
    }
    setWardModalOpen(true);
  };

  const handleError = (err) => {
    const msg = err.response?.data?.message || err.message || 'Lỗi hệ thống';
    message.error(msg);
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
      handleError(err);
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
      handleError(err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleDistrict = (district) => {
    const isActive = district.is_active !== false;
    Modal.confirm({
      title: isActive ? `Vô hiệu hóa "${district.name}"?` : `Kích hoạt "${district.name}"?`,
      content: isActive
        ? 'Khu vực sẽ bị ẩn khỏi form đặt lịch. Các đơn hàng hiện tại không bị ảnh hưởng.'
        : 'Khu vực sẽ hiển thị trở lại trong form đặt lịch.',
      okText: isActive ? 'Vô hiệu hóa' : 'Kích hoạt',
      cancelText: 'Hủy',
      okButtonProps: { danger: isActive },
      onOk: async () => {
        try {
          await adminApi.toggleDistrict(district.id);
          message.success(isActive ? 'Đã vô hiệu hóa khu vực phục vụ' : 'Đã kích hoạt khu vực phục vụ');
          refetch();
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const handleToggleWard = (ward) => {
    const isActive = ward.is_active !== false;
    Modal.confirm({
      title: isActive ? `Vô hiệu hóa "${ward.name}"?` : `Kích hoạt "${ward.name}"?`,
      content: isActive
        ? 'Phường/xã sẽ bị ẩn khỏi form đặt lịch.'
        : 'Phường/xã sẽ hiển thị trở lại trong form đặt lịch.',
      okText: isActive ? 'Vô hiệu hóa' : 'Kích hoạt',
      cancelText: 'Hủy',
      okButtonProps: { danger: isActive },
      onOk: async () => {
        try {
          await adminApi.toggleWard(ward.id);
          message.success(isActive ? 'Đã vô hiệu hóa phường/xã' : 'Đã kích hoạt phường/xã');
          refetch();
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const deleteDistrict = (district) => {
    Modal.confirm({
      title: `Xóa khu vực "${district.name}"?`,
      content: 'Chỉ xóa được khi khu vực chưa có phường/xã, địa chỉ, đơn hàng hoặc kỹ thuật viên liên quan.',
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await adminApi.deleteDistrict(district.id);
          message.success('Đã xóa khu vực phục vụ');
          refetch();
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const deleteWard = (ward) => {
    Modal.confirm({
      title: `Xóa phường/xã "${ward.name}"?`,
      content: 'Chỉ xóa được khi phường/xã chưa có địa chỉ hoặc đơn hàng liên quan.',
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await adminApi.deleteWard(ward.id);
          message.success('Đã xóa phường/xã');
          refetch();
        } catch (err) {
          handleError(err);
        }
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
          <span style={{ fontWeight: 600, color: record.is_active !== false ? 'inherit' : '#999' }}>{text}</span>
          <Tag color={record.type === 'CENTER' || record.type === 'QUAN' ? 'blue' : 'green'}>
            {districtTypeLabels[record.type] || record.type}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Số phường/xã',
      dataIndex: ['_count', 'wards'],
      key: 'ward_count',
      width: 130,
      align: 'center',
    },
    {
      title: 'Trạng thái',
      key: 'is_active',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Tag color={record.is_active !== false ? 'success' : 'default'}>
          {record.is_active !== false ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 240,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={() => openWardModal(record)}>
            Thêm phường/xã
          </Button>
          <Button type="text" icon={<EditOutlined />} onClick={() => openDistrictModal(record)} />
          <Switch
            size="small"
            checked={record.is_active !== false}
            onChange={() => handleToggleDistrict(record)}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => deleteDistrict(record)} />
        </Space>
      ),
    },
  ];

  const expandedRowRender = (district) => (
    <Table
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={district.wards || []}
      columns={[
        {
          title: 'Tên phường/xã',
          dataIndex: 'name',
          key: 'name',
          render: (text, record) => (
            <span style={{ color: record.is_active !== false ? 'inherit' : '#999' }}>{text}</span>
          ),
        },
        {
          title: 'Loại',
          dataIndex: 'type',
          key: 'type',
          width: 100,
          render: (type) => <Tag>{wardTypeLabels[type] || type}</Tag>,
        },
        {
          title: 'Trạng thái',
          key: 'is_active',
          width: 130,
          align: 'center',
          render: (_, record) => (
            <Tag color={record.is_active !== false ? 'success' : 'default'}>
              {record.is_active !== false ? 'Hoạt động' : 'Vô hiệu hóa'}
            </Tag>
          ),
        },
        {
          title: 'Hành động',
          key: 'action',
          width: 160,
          render: (_, ward) => (
            <Space>
              <Button type="text" icon={<EditOutlined />} onClick={() => openWardModal(district, ward)} />
              <Switch
                size="small"
                checked={ward.is_active !== false}
                onChange={() => handleToggleWard(ward)}
                checkedChildren="ON"
                unCheckedChildren="OFF"
              />
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => deleteWard(ward)} />
            </Space>
          ),
        },
      ]}
    />
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Khu vực hoạt động</Title>
          <p>Quản lý vùng phục vụ và danh sách phường/xã — Kích hoạt/vô hiệu hóa để kiểm soát form đặt lịch</p>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openDistrictModal()}>
          Thêm khu vực
        </Button>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>

        {/* Lọc và Tìm kiếm */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="Tìm khu vực theo tên"
            allowClear
            onSearch={(value) => setSearch(value)}
            style={{ width: 280 }}
          />
          <Select
            placeholder="Lọc theo nhóm khu vực"
            allowClear
            style={{ width: 200 }}
            onChange={(val) => setFilterType(val)}
          >
            <Select.Option value="CENTER">Khu vực trung tâm</Select.Option>
            <Select.Option value="SUBURB">Khu vực mở rộng</Select.Option>
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={districts}
          rowKey="id"
          loading={isLoading}
          expandable={{ expandedRowRender }}
          pagination={{ pageSize: 15 }}
          rowClassName={(record) => record.is_active === false ? 'row-inactive' : ''}
        />
      </div>

      {/* MODAL DISTRICT */}
      <Modal
        title={
          <span style={{ fontSize: 20, color: 'var(--navy)' }}>
            {editingDistrict ? 'Sửa khu vực phục vụ' : 'Thêm khu vực phục vụ mới'}
          </span>
        }
        open={districtModalOpen}
        onCancel={() => setDistrictModalOpen(false)}
        footer={null}
      >
        <Form form={districtForm} layout="vertical" onFinish={saveDistrict} style={{ marginTop: 24 }}>
          <Form.Item name="name" label="Tên khu vực phục vụ" rules={[{ required: true, message: 'Vui lòng nhập tên khu vực' }]}>
            <Input placeholder="Vd: Khu vực Ninh Kiều" />
          </Form.Item>
          <Form.Item name="type" label="Nhóm khu vực" rules={[{ required: true, message: 'Vui lòng chọn nhóm khu vực' }]}>
            <Select options={[
              { value: 'CENTER', label: 'Khu vực trung tâm' },
              { value: 'SUBURB', label: 'Khu vực mở rộng' },
            ]} />
          </Form.Item>
          <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Vô hiệu hóa" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setDistrictModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={loadingAction}>Lưu lại</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL WARD */}
      <Modal
        title={
          <span style={{ fontSize: 20, color: 'var(--navy)' }}>
            {editingWard ? `Sửa phường/xã "${editingWard.name}"` : `Thêm phường/xã cho ${selectedDistrict?.name || ''}`}
          </span>
        }
        open={wardModalOpen}
        onCancel={() => setWardModalOpen(false)}
        footer={null}
      >
        <Form form={wardForm} layout="vertical" onFinish={saveWard} style={{ marginTop: 24 }}>
          <Form.Item name="name" label="Tên phường/xã" rules={[{ required: true, message: 'Vui lòng nhập tên phường/xã' }]}>
            <Input placeholder="Vd: Xuân Khánh" />
          </Form.Item>
          <Form.Item name="type" label="Loại" rules={[{ required: true, message: 'Vui lòng chọn loại' }]}>
            <Select options={[
              { value: 'PHUONG', label: 'Phường' },
              { value: 'XA', label: 'Xã' },
              { value: 'THI_TRAN', label: 'Thị trấn' },
            ]} />
          </Form.Item>
          <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Vô hiệu hóa" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setWardModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={loadingAction}>Lưu lại</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
