import { useState } from 'react';
import { Table, Button, Typography, Space, Modal, Form, Input, InputNumber, DatePicker, Switch, message, Tag, Select } from 'antd';
import { EditOutlined, PlusOutlined, PoweroffOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatVND } from '../../utils/helpers';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export default function AdminVouchersPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [form] = Form.useForm();
  const discountType = Form.useWatch('discount_type', form);

  const { data: vouchersData, isLoading, refetch } = useQuery({
    queryKey: ['admin-vouchers'],
    queryFn: adminApi.getVouchers,
  });

  const vouchers = vouchersData?.data || [];

  const handleOpenModal = (voucher = null) => {
    if (voucher) {
      setEditingId(voucher.id);
      form.setFieldsValue({
        code: voucher.code,
        discount_type: voucher.discount_type,
        discount_value: Number(voucher.discount_value || 0),
        min_order_amount: Number(voucher.min_order_amount || 0),
        max_discount: voucher.max_discount === null || voucher.max_discount === undefined ? null : Number(voucher.max_discount),
        usage_limit: voucher.usage_limit,
        start_date: voucher.start_date ? dayjs(voucher.start_date) : null,
        end_date: voucher.end_date ? dayjs(voucher.end_date) : null,
        is_active: voucher.is_active,
      });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({
        discount_type: 'PERCENTAGE',
        min_order_amount: 0,
        max_discount: null,
        is_active: true,
      });
    }
    setIsModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      setLoadingAction(true);
      const payload = {
        ...values,
        code: values.code.trim().toUpperCase(),
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date.format('YYYY-MM-DD'),
        max_discount: values.discount_type === 'PERCENTAGE' ? (values.max_discount ?? null) : null,
      };

      if (editingId) {
        await adminApi.updateVoucher(editingId, payload);
        message.success('Cập nhật voucher thành công');
      } else {
        await adminApi.createVoucher(payload);
        message.success('Tạo voucher thành công');
      }
      setIsModalVisible(false);
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi lưu voucher');
    } finally {
      setLoadingAction(false);
    }
  };

  const toggleVoucher = async (voucher) => {
    try {
      await adminApi.toggleVoucher(voucher.id);
      message.success(voucher.is_active ? 'Đã tắt voucher' : 'Đã bật voucher');
      refetch();
    } catch (err) {
      message.error(err.message || 'Không thể đổi trạng thái voucher');
    }
  };

  const renderDiscount = (record) => {
    if (record.discount_type === 'PERCENTAGE') {
      return (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: 'var(--orange)' }}>{Number(record.discount_value)}%</Text>
          {record.max_discount && <Text type="secondary" style={{ fontSize: 12 }}>Tối đa {formatVND(record.max_discount)}</Text>}
        </Space>
      );
    }
    return <Text strong style={{ color: 'var(--orange)' }}>{formatVND(record.discount_value)}</Text>;
  };

  const columns = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      render: (text) => <Tag color="blue" style={{ fontSize: 14, fontWeight: 600 }}>{text}</Tag>,
    },
    {
      title: 'Loại giảm',
      dataIndex: 'discount_type',
      key: 'discount_type',
      render: (type) => <Tag color={type === 'PERCENTAGE' ? 'purple' : 'green'}>{type === 'PERCENTAGE' ? 'Theo %' : 'Theo tiền'}</Tag>,
    },
    {
      title: 'Giá trị',
      key: 'discount',
      render: (_, record) => renderDiscount(record),
    },
    {
      title: 'Đơn tối thiểu',
      dataIndex: 'min_order_amount',
      key: 'min_order_amount',
      render: (value) => formatVND(value || 0),
    },
    {
      title: 'Lượt dùng',
      key: 'usage',
      render: (_, record) => `${record.used_count || record._count?.usages || 0}/${record.usage_limit}`,
    },
    {
      title: 'Thời gian',
      key: 'time',
      render: (_, record) => (
        <span style={{ fontSize: 13 }}>
          {dayjs(record.start_date).format('DD/MM/YYYY')} - {dayjs(record.end_date).format('DD/MM/YYYY')}
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>{isActive ? 'Hoạt động' : 'Đã tắt'}</Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          <Button type="text" icon={<PoweroffOutlined />} danger={record.is_active} onClick={() => toggleVoucher(record)} />
        </Space>
      ),
      width: 120,
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Mã khuyến mãi</Title>
          <p>Quản lý voucher giảm theo phần trăm hoặc số tiền cố định</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Thêm mã mới</Button>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table
          columns={columns}
          dataSource={vouchers}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1000 }}
        />
      </div>

      <Modal
        title={editingId ? 'Sửa voucher' : 'Thêm voucher'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="code" label="Mã voucher" rules={[{ required: true, message: 'Vui lòng nhập mã voucher' }]}>
            <Input style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item name="discount_type" label="Loại giảm giá" rules={[{ required: true }]}>
            <Select>
              <Option value="PERCENTAGE">Giảm theo phần trăm</Option>
              <Option value="FIXED">Giảm số tiền cố định</Option>
            </Select>
          </Form.Item>

          <Space style={{ display: 'flex' }} align="start">
            <Form.Item
              name="discount_value"
              label={discountType === 'FIXED' ? 'Số tiền giảm' : 'Phần trăm giảm'}
              rules={[
                { required: true, message: 'Vui lòng nhập giá trị giảm' },
                () => ({
                  validator(_, value) {
                    if (discountType !== 'PERCENTAGE' || value <= 100) return Promise.resolve();
                    return Promise.reject(new Error('Phần trăm giảm không được vượt quá 100%'));
                  },
                }),
              ]}
            >
              <InputNumber min={1} max={discountType === 'PERCENTAGE' ? 100 : undefined} step={discountType === 'FIXED' ? 10000 : 1} style={{ width: 180 }} />
            </Form.Item>

            {discountType === 'PERCENTAGE' && (
              <Form.Item name="max_discount" label="Giảm tối đa">
                <InputNumber min={0} step={10000} style={{ width: 180 }} />
              </Form.Item>
            )}
          </Space>

          <Form.Item name="min_order_amount" label="Giá trị đơn tối thiểu">
            <InputNumber min={0} step={10000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="usage_limit" label="Tổng lượt sử dụng" rules={[{ required: true, message: 'Vui lòng nhập số lượt' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Space style={{ display: 'flex' }}>
            <Form.Item name="start_date" label="Từ ngày" rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}>
              <DatePicker style={{ width: 180 }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="end_date" label="Đến ngày" rules={[{ required: true, message: 'Chọn ngày kết thúc' }]}>
              <DatePicker style={{ width: 180 }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>

          <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Tắt" />
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
