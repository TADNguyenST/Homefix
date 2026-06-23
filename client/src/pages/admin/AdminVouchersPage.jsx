import { useState } from 'react';
import {
  Table, Button, Typography, Space, Modal, Form, Input, InputNumber,
  DatePicker, Switch, message, Tag, Select, Card, Row, Col, Statistic,
  Tooltip, Badge, Avatar, Divider, Empty, Spin
} from 'antd';
import {
  EditOutlined, PlusOutlined, PoweroffOutlined, HistoryOutlined,
  GiftOutlined, CheckCircleOutlined, CloseCircleOutlined, UserOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatVND, formatDateTime, formatDate } from '../../utils/helpers';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export default function AdminVouchersPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [form] = Form.useForm();
  const discountType = Form.useWatch('discount_type', form);

  // Usage history modal
  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState(null);
  const [selectedVoucherCode, setSelectedVoucherCode] = useState('');

  const { data: vouchersData, isLoading, refetch } = useQuery({
    queryKey: ['admin-vouchers'],
    queryFn: adminApi.getVouchers,
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['voucher-usages', selectedVoucherId],
    queryFn: () => adminApi.getVoucherUsages(selectedVoucherId),
    enabled: !!selectedVoucherId && usageModalVisible,
  });

  const vouchers = vouchersData?.data || [];
  const usages = usageData?.data?.usages || [];

  // Stats
  const totalVouchers = vouchers.length;
  const activeVouchers = vouchers.filter(v => v.is_active).length;
  const totalUsed = vouchers.reduce((sum, v) => sum + (v.used_count || 0), 0);
  const expiredVouchers = vouchers.filter(v => dayjs().isAfter(dayjs(v.end_date))).length;

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

  const handleOpenUsageHistory = (voucher) => {
    setSelectedVoucherId(voucher.id);
    setSelectedVoucherCode(voucher.code);
    setUsageModalVisible(true);
  };

  const renderDiscount = (record) => {
    if (record.discount_type === 'PERCENTAGE') {
      return (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: 'var(--orange)', fontSize: 15 }}>{Number(record.discount_value)}%</Text>
          {record.max_discount && <Text type="secondary" style={{ fontSize: 12 }}>Tối đa {formatVND(record.max_discount)}</Text>}
        </Space>
      );
    }
    return <Text strong style={{ color: 'var(--orange)', fontSize: 15 }}>{formatVND(record.discount_value)}</Text>;
  };

  const getVoucherStatus = (record) => {
    const now = dayjs();
    if (!record.is_active) return { label: 'Đã tắt', color: 'default' };
    if (now.isAfter(dayjs(record.end_date))) return { label: 'Hết hạn', color: 'error' };
    if (now.isBefore(dayjs(record.start_date))) return { label: 'Chưa bắt đầu', color: 'processing' };
    if (record.used_count >= record.usage_limit) return { label: 'Đã hết lượt', color: 'warning' };
    return { label: 'Đang hoạt động', color: 'success' };
  };

  const columns = [
    {
      title: 'Mã Voucher',
      dataIndex: 'code',
      key: 'code',
      render: (text) => (
        <Tag color="blue" style={{ fontSize: 14, fontWeight: 700, padding: '4px 10px', letterSpacing: 1 }}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Loại giảm',
      dataIndex: 'discount_type',
      key: 'discount_type',
      render: (type) => (
        <Tag color={type === 'PERCENTAGE' ? 'purple' : 'green'} style={{ fontWeight: 500 }}>
          {type === 'PERCENTAGE' ? '% Phần trăm' : '₫ Số tiền'}
        </Tag>
      ),
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
      render: (value) => <Text style={{ color: '#666' }}>{formatVND(value || 0)}</Text>,
    },
    {
      title: 'Lượt dùng',
      key: 'usage',
      render: (_, record) => {
        const used = record.used_count || 0;
        const limit = record.usage_limit;
        const pct = Math.round((used / limit) * 100);
        return (
          <Space direction="vertical" size={2}>
            <Text strong>{used}/{limit}</Text>
            <div style={{ width: 80, height: 6, background: '#f0f0f0', borderRadius: 3 }}>
              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 100 ? '#ff4d4f' : 'var(--orange)', borderRadius: 3 }} />
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Thời gian',
      key: 'time',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: 12, color: '#888' }}>Từ: {dayjs(record.start_date).format('DD/MM/YYYY')}</Text>
          <Text style={{ fontSize: 12, color: '#888' }}>Đến: {dayjs(record.end_date).format('DD/MM/YYYY')}</Text>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, record) => {
        const st = getVoucherStatus(record);
        return <Tag color={st.color}>{st.label}</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Tooltip title="Xem lịch sử dùng">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              style={{ color: '#1677ff' }}
              onClick={() => handleOpenUsageHistory(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          </Tooltip>
          <Tooltip title={record.is_active ? 'Tắt voucher' : 'Bật voucher'}>
            <Button
              type="text"
              icon={<PoweroffOutlined />}
              danger={record.is_active}
              style={!record.is_active ? { color: '#52c41a' } : {}}
              onClick={() => toggleVoucher(record)}
            />
          </Tooltip>
        </Space>
      ),
      width: 130,
    },
  ];

  const usageColumns = [
    {
      title: 'Khách hàng',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar
            src={record.user?.avatar_url}
            icon={<UserOutlined />}
            size={32}
            style={{ background: 'var(--orange)' }}
          />
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>{record.user?.full_name || 'N/A'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{record.user?.email}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Đơn hàng',
      key: 'booking',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: 'var(--navy)' }}>#{record.booking?.id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.booking?.service?.name}</Text>
        </Space>
      ),
    },
    {
      title: 'Giá trị đơn',
      key: 'price',
      render: (_, record) => (
        <Text style={{ color: 'var(--orange)', fontWeight: 500 }}>
          {formatVND(record.booking?.final_price || record.booking?.estimated_price || 0)}
        </Text>
      ),
    },
    {
      title: 'Trạng thái đơn',
      key: 'booking_status',
      render: (_, record) => (
        <Tag color={record.booking?.status === 'COMPLETED' ? 'success' : record.booking?.status === 'CANCELLED' ? 'error' : 'processing'}>
          {record.booking?.status}
        </Tag>
      ),
    },
    {
      title: 'Ngày sử dụng',
      dataIndex: 'used_at',
      key: 'used_at',
      render: (t) => formatDateTime(t),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 4 }}>Mã khuyến mãi</Title>
          <Text type="secondary">Quản lý voucher giảm theo phần trăm hoặc số tiền cố định</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleOpenModal()}>
          Thêm mã mới
        </Button>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid var(--orange)', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--orange)' }}>{totalVouchers}</div>
            <Text type="secondary">Tổng voucher</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #52c41a', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>{activeVouchers}</div>
            <Text type="secondary">Đang hoạt động</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #1677ff', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>{totalUsed}</div>
            <Text type="secondary">Lượt đã dùng</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #ff4d4f', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ff4d4f' }}>{expiredVouchers}</div>
            <Text type="secondary">Đã hết hạn</Text>
          </Card>
        </Col>
      </Row>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table
          columns={columns}
          dataSource={vouchers}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 10, showTotal: (t) => `Tổng ${t} voucher` }}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        title={
          <Space>
            <GiftOutlined style={{ color: 'var(--orange)' }} />
            {editingId ? 'Chỉnh sửa voucher' : 'Tạo voucher mới'}
          </Space>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnHidden
        width={520}
      >
        <Divider style={{ margin: '12px 0' }} />
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="code" label="Mã voucher" rules={[{ required: true, message: 'Vui lòng nhập mã voucher' }]}>
            <Input style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: 1 }} placeholder="VD: SUMMER30" />
          </Form.Item>

          <Form.Item name="discount_type" label="Loại giảm giá" rules={[{ required: true }]}>
            <Select>
              <Option value="PERCENTAGE">Giảm theo phần trăm (%)</Option>
              <Option value="FIXED">Giảm số tiền cố định (₫)</Option>
            </Select>
          </Form.Item>

          <Space style={{ display: 'flex' }} align="start">
            <Form.Item
              name="discount_value"
              label={discountType === 'FIXED' ? 'Số tiền giảm (₫)' : 'Phần trăm giảm (%)'}
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
              <InputNumber
                min={1}
                max={discountType === 'PERCENTAGE' ? 100 : undefined}
                step={discountType === 'FIXED' ? 10000 : 1}
                style={{ width: 200 }}
                formatter={v => discountType === 'FIXED' ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : v}
              />
            </Form.Item>

            {discountType === 'PERCENTAGE' && (
              <Form.Item name="max_discount" label="Giảm tối đa (₫)">
                <InputNumber min={0} step={10000} style={{ width: 200 }} />
              </Form.Item>
            )}
          </Space>

          <Form.Item name="min_order_amount" label="Giá trị đơn tối thiểu (₫)">
            <InputNumber min={0} step={10000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="usage_limit" label="Tổng lượt sử dụng" rules={[{ required: true, message: 'Vui lòng nhập số lượt' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Space style={{ display: 'flex' }}>
            <Form.Item name="start_date" label="Ngày bắt đầu" rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}>
              <DatePicker style={{ width: 200 }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="end_date" label="Ngày kết thúc" rules={[{ required: true, message: 'Chọn ngày kết thúc' }]}>
              <DatePicker style={{ width: 200 }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>

          <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Tắt" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loadingAction} block size="large">
              {editingId ? 'Cập nhật voucher' : 'Tạo voucher'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Usage History Modal */}
      <Modal
        title={
          <Space>
            <HistoryOutlined style={{ color: '#1677ff' }} />
            <span>Lịch sử sử dụng — <Tag color="blue" style={{ fontWeight: 700 }}>{selectedVoucherCode}</Tag></span>
          </Space>
        }
        open={usageModalVisible}
        onCancel={() => { setUsageModalVisible(false); setSelectedVoucherId(null); }}
        footer={null}
        width={800}
        destroyOnHidden
      >
        {usageLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : usages.length === 0 ? (
          <Empty description="Voucher này chưa được sử dụng lần nào" style={{ padding: 40 }} />
        ) : (
          <Table
            columns={usageColumns}
            dataSource={usages}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            scroll={{ x: 600 }}
          />
        )}
      </Modal>
    </div>
  );
}
