import { useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';

const { Title, Text } = Typography;

const wardTypeLabels = {
  PHUONG: 'Phường',
  XA: 'Xã',
  DAC_KHU: 'Đặc khu',
  THI_TRAN: 'Thị trấn',
};

const unwrapList = (response) => {
  const value = response?.data?.data ?? response?.data ?? response;
  return Array.isArray(value) ? value : [];
};

export default function AdminDistrictsPage() {
  const [search, setSearch] = useState('');
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [wardModalOpen, setWardModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [togglingKey, setTogglingKey] = useState(null);
  const [areaForm] = Form.useForm();
  const [wardForm] = Form.useForm();

  const selectedProvinceCode = Form.useWatch('province_code', areaForm);
  const wardProvinceCode = areaModalOpen ? selectedProvinceCode : selectedArea?.province_code;

  const { data: districtsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-districts', search],
    queryFn: () => adminApi.getDistricts({ search }),
  });
  const { data: provincesData, isLoading: provincesLoading, error: provincesError } = useQuery({
    queryKey: ['administrative-provinces'],
    queryFn: adminApi.getAdministrativeProvinces,
    staleTime: 60 * 60 * 1000,
  });
  const {
    data: externalWardsData,
    isLoading: externalWardsLoading,
    error: externalWardsError,
  } = useQuery({
    queryKey: ['administrative-wards', wardProvinceCode],
    queryFn: () => adminApi.getAdministrativeWards(wardProvinceCode),
    enabled: !!wardProvinceCode && (areaModalOpen || wardModalOpen),
    staleTime: 60 * 60 * 1000,
  });

  const districts = unwrapList(districtsData);
  const provinces = unwrapList(provincesData);
  const externalWards = unwrapList(externalWardsData);
  const assignedProvinceCodes = new Set(districts.map((area) => area.province_code).filter(Boolean));
  const areaWardCodes = new Set((selectedArea?.wards || []).map((ward) => ward.external_code).filter(Boolean));
  const selectableWards = externalWards.filter((ward) => !areaWardCodes.has(ward.code));

  const openAreaModal = () => {
    areaForm.resetFields();
    areaForm.setFieldsValue({ is_active: true, ward_codes: [] });
    setAreaModalOpen(true);
  };

  const openWardModal = (area) => {
    setSelectedArea(area);
    wardForm.resetFields();
    setWardModalOpen(true);
  };

  const saveArea = async (values) => {
    try {
      setLoadingAction(true);
      await adminApi.createDistrict({
        province_code: values.province_code,
        is_active: values.is_active,
        wards: (values.ward_codes || []).map((external_code) => ({ external_code })),
      });
      message.success('Đã thêm tỉnh/thành và các phường/xã phục vụ');
      setAreaModalOpen(false);
      await refetch();
    } catch (err) {
      message.error(err.message || 'Không thể thêm tỉnh/thành phục vụ');
    } finally {
      setLoadingAction(false);
    }
  };

  const saveWard = async ({ external_code }) => {
    try {
      setLoadingAction(true);
      await adminApi.createWard(selectedArea.id, { external_code });
      message.success('Đã thêm phường/xã từ dữ liệu hành chính');
      setWardModalOpen(false);
      await refetch();
    } catch (err) {
      message.error(err.message || 'Không thể thêm phường/xã');
    } finally {
      setLoadingAction(false);
    }
  };

  const toggleArea = async (area, checked) => {
    try {
      setTogglingKey(`area-${area.id}`);
      await adminApi.updateDistrict(area.id, { is_active: checked });
      message.success(checked ? 'Đã mở phục vụ tỉnh/thành' : 'Đã tạm ngừng tỉnh/thành và toàn bộ phường/xã');
      await refetch();
    } catch (err) {
      message.error(err.message || 'Không thể cập nhật trạng thái');
    } finally {
      setTogglingKey(null);
    }
  };

  const toggleWard = async (ward, checked) => {
    try {
      setTogglingKey(`ward-${ward.id}`);
      await adminApi.updateWard(ward.id, { is_active: checked });
      message.success(checked ? 'Đã mở phục vụ phường/xã' : 'Đã tạm ngừng phục vụ phường/xã');
      await refetch();
    } catch (err) {
      message.error(err.message || 'Không thể cập nhật trạng thái phường/xã');
    } finally {
      setTogglingKey(null);
    }
  };

  const confirmDelete = (title, content, action) => {
    Modal.confirm({
      title,
      content,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await action();
          message.success('Đã xóa dữ liệu');
          await refetch();
        } catch (err) {
          message.error(err.message || 'Không thể xóa dữ liệu đang được sử dụng');
        }
      },
    });
  };

  const columns = [
    {
      title: 'Tỉnh/Thành phố phục vụ',
      dataIndex: 'province_name',
      render: (value, area) => <Text strong>{value || area.name}</Text>,
    },
    {
      title: 'Mã hành chính',
      dataIndex: 'province_code',
      width: 140,
      align: 'center',
    },
    {
      title: 'Số phường/xã',
      dataIndex: ['_count', 'wards'],
      width: 130,
      align: 'center',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      width: 130,
      render: (active) => <Tag color={active ? 'success' : 'default'}>{active ? 'Hoạt động' : 'Tạm ngừng'}</Tag>,
    },
    {
      title: 'Hành động',
      width: 300,
      render: (_, area) => (
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={() => openWardModal(area)}>
            Thêm phường/xã
          </Button>
          <Switch
            checked={area.is_active}
            loading={togglingKey === `area-${area.id}`}
            onChange={(checked) => toggleArea(area, checked)}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            title="Xóa tỉnh/thành chưa sử dụng"
            onClick={() => confirmDelete(
              'Xóa tỉnh/thành phục vụ?',
              'Chỉ xóa được khi không còn phường/xã, địa chỉ, booking hoặc kỹ thuật viên liên quan.',
              () => adminApi.deleteDistrict(area.id),
            )}
          />
        </Space>
      ),
    },
  ];

  const expandedRowRender = (area) => (
    <Table
      size="small"
      rowKey="id"
      pagination={{ pageSize: 15, hideOnSinglePage: true }}
      dataSource={area.wards || []}
      locale={{ emptyText: 'Chưa chọn phường/xã phục vụ' }}
      columns={[
        { title: 'Tên phường/xã', dataIndex: 'name' },
        { title: 'Mã hành chính', dataIndex: 'external_code', width: 140 },
        { title: 'Loại', dataIndex: 'type', render: (type) => <Tag>{wardTypeLabels[type] || type}</Tag>, width: 120 },
        { title: 'Trạng thái', dataIndex: 'is_active', render: (active) => <Tag color={active ? 'success' : 'default'}>{active ? 'Hoạt động' : 'Tạm ngừng'}</Tag>, width: 120 },
        {
          title: 'Hành động',
          width: 150,
          render: (_, ward) => (
            <Space>
              <Switch
                checked={ward.is_active}
                loading={togglingKey === `ward-${ward.id}`}
                onChange={(checked) => toggleWard(ward, checked)}
                checkedChildren="ON"
                unCheckedChildren="OFF"
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                title="Xóa phường/xã chưa sử dụng"
                onClick={() => confirmDelete(
                  'Xóa phường/xã?',
                  'Chỉ xóa được phường/xã chưa có địa chỉ hoặc booking liên quan.',
                  () => adminApi.deleteWard(ward.id),
                )}
              />
            </Space>
          ),
        },
      ]}
    />
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Khu vực hoạt động</Title>
          <Text type="secondary">Tỉnh/thành và phường/xã được đồng bộ từ dữ liệu hành chính; chỉ địa bàn đang hoạt động mới được đặt lịch.</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openAreaModal}>
          Thêm tỉnh/thành
        </Button>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 8, boxShadow: 'var(--shadow-sm)' }}>
        <Input.Search
          placeholder="Tìm theo tỉnh/thành"
          allowClear
          onSearch={setSearch}
          style={{ width: 320, marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={districts}
          rowKey="id"
          loading={isLoading}
          expandable={{ expandedRowRender }}
          pagination={{ pageSize: 15 }}
          scroll={{ x: 900 }}
        />
      </div>

      <Modal
        title="Thêm tỉnh/thành phục vụ"
        open={areaModalOpen}
        onCancel={() => setAreaModalOpen(false)}
        footer={null}
        width={680}
        forceRender
      >
        <Form form={areaForm} layout="vertical" onFinish={saveArea} style={{ marginTop: 20 }}>
          <Form.Item name="province_code" label="Tỉnh/Thành phố" rules={[{ required: true, message: 'Vui lòng chọn tỉnh/thành' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              loading={provincesLoading}
              placeholder="Chọn tỉnh/thành từ dữ liệu hành chính"
              onChange={() => areaForm.setFieldValue('ward_codes', [])}
              options={provinces.map((province) => ({
                value: province.code,
                label: province.name,
                disabled: assignedProvinceCodes.has(province.code),
              }))}
            />
          </Form.Item>
          {provincesError && <Alert type="error" showIcon message="Không tải được danh sách tỉnh/thành. Vui lòng kiểm tra kết nối API." style={{ marginBottom: 16 }} />}
          <Form.Item
            name="ward_codes"
            label="Phường/Xã phục vụ ban đầu"
            extra="Có thể chọn ngay hoặc bổ sung sau. Tên và mã hành chính không thể nhập tay."
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              loading={externalWardsLoading}
              disabled={!selectedProvinceCode}
              placeholder={selectedProvinceCode ? 'Chọn phường/xã thuộc tỉnh/thành này' : 'Chọn tỉnh/thành trước'}
              options={externalWards.map((ward) => ({ value: ward.code, label: ward.name }))}
            />
          </Form.Item>
          {selectedProvinceCode && externalWards.length > 0 && (
            <Button type="link" onClick={() => areaForm.setFieldValue('ward_codes', externalWards.map((ward) => ward.code))} style={{ paddingLeft: 0, marginTop: -12 }}>
              Chọn toàn bộ {externalWards.length} phường/xã
            </Button>
          )}
          {externalWardsError && <Alert type="error" showIcon message="Không tải được phường/xã của tỉnh/thành đã chọn." style={{ margin: '8px 0 16px' }} />}
          <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Tạm ngừng" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAreaModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={loadingAction}>Lưu lại</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Thêm phường/xã thuộc ${selectedArea?.province_name || selectedArea?.name || ''}`}
        open={wardModalOpen}
        onCancel={() => setWardModalOpen(false)}
        footer={null}
        forceRender
      >
        <Form form={wardForm} layout="vertical" onFinish={saveWard} style={{ marginTop: 20 }}>
          <Form.Item
            name="external_code"
            label="Phường/Xã"
            rules={[{ required: true, message: 'Vui lòng chọn phường/xã' }]}
            extra="Danh sách chỉ gồm các phường/xã thuộc tỉnh/thành này và chưa được thêm."
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={externalWardsLoading}
              placeholder="Chọn phường/xã từ dữ liệu hành chính"
              options={selectableWards.map((ward) => ({ value: ward.code, label: ward.name }))}
              notFoundContent={externalWardsLoading ? 'Đang tải...' : 'Không còn phường/xã để thêm'}
            />
          </Form.Item>
          {externalWardsError && <Alert type="error" showIcon message="Không tải được phường/xã. Vui lòng kiểm tra kết nối API." style={{ marginBottom: 16 }} />}
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setWardModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={loadingAction} disabled={!selectableWards.length}>Thêm</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
