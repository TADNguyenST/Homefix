import { useState } from 'react';
import {
  Table, Tag, Button, Typography, Modal, Form, Input, message,
  Drawer, Descriptions, Timeline, Empty, Card, Row, Col, Statistic, Space, Select, Spin,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, FileTextOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
  RobotOutlined, InboxOutlined, CalendarOutlined, ToolOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { complaintApi, bookingApi } from '../../api/bookingApi';
import { formatDateTime, formatVND } from '../../utils/helpers';
import { COMPLAINT_STATUS_LABELS, BOOKING_STATUS_LABELS } from '../../utils/constants';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─── helpers ────────────────────────────────────────────────
const STATUS_CFG = {
  OPEN:      { color: 'var(--warning)',   bg: '#fef3c7', antColor: 'warning',    label: 'Mới gửi',          icon: <InboxOutlined /> },
  IN_REVIEW: { color: '#3b82f6',          bg: '#dbeafe', antColor: 'processing', label: 'Đang xem xét',     icon: <ClockCircleOutlined /> },
  RESOLVED:  { color: 'var(--success)',   bg: '#dcfce7', antColor: 'success',    label: 'Đã giải quyết',    icon: <CheckCircleOutlined /> },
  REJECTED:  { color: 'var(--error)',     bg: '#fee2e2', antColor: 'error',      label: 'Đã từ chối',       icon: <CloseCircleOutlined /> },
};

const SENTIMENT_CFG = {
  NEGATIVE: { color: '#ef4444', bg: '#fee2e2', label: 'Tiêu cực' },
  NEUTRAL:  { color: '#64748b', bg: '#f1f5f9', label: 'Trung lập' },
  POSITIVE: { color: '#22c55e', bg: '#dcfce7', label: 'Tích cực' },
};

function StatusTag({ status }) {
  const cfg = STATUS_CFG[status] || {};
  return (
    <Tag
      color={cfg.antColor || 'default'}
      style={{ borderRadius: 20, fontWeight: 600, padding: '2px 12px' }}
    >
      {cfg.label || COMPLAINT_STATUS_LABELS[status] || status}
    </Tag>
  );
}

function SentimentTag({ sentiment }) {
  if (!sentiment) return <Tag color="default">NEUTRAL</Tag>;
  const cfg = SENTIMENT_CFG[sentiment] || {};
  return (
    <Tag
      style={{
        background: cfg.bg, color: cfg.color,
        border: `1px solid ${cfg.color}40`,
        borderRadius: 20, fontWeight: 600, padding: '2px 12px',
      }}
    >
      {cfg.label || sentiment}
    </Tag>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function ComplaintPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [form] = Form.useForm();

  // Fetch my complaints
  const { data: complaintsData, isLoading, refetch } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: complaintApi.getMy,
  });

  // Fetch ALL bookings (không chờ modal mở) → filter COMPLETED/CANCELLED ở frontend
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-bookings-all'],
    queryFn: () => bookingApi.getMyBookings({}),
  });

  const complaints = complaintsData?.data || [];
  const allBookings = bookingsData?.data || [];

  // Chỉ cho phép khiếu nại đơn đã hoàn thành hoặc bị hủy
  const eligibleBookings = allBookings.filter(b =>
    ['COMPLETED', 'CANCELLED'].includes(b.status)
  );

  // Statistics
  const openCount     = complaints.filter(c => c.status === 'OPEN').length;
  const reviewCount   = complaints.filter(c => c.status === 'IN_REVIEW').length;
  const resolvedCount = complaints.filter(c => c.status === 'RESOLVED').length;
  const rejectedCount = complaints.filter(c => c.status === 'REJECTED').length;

  // Filtered list
  const filteredComplaints = statusFilter
    ? complaints.filter(c => c.status === statusFilter)
    : complaints;

  // ─── Handlers ───────────────────────────────────────────
  const handleCreate = async (values) => {
    try {
      setLoading(true);
      await complaintApi.create(values.booking_id, {
        subject: values.subject,
        description: values.description,
      });
      message.success('Đã gửi khiếu nại thành công. Chúng tôi sẽ xử lý trong thời gian sớm nhất.');
      setIsModalVisible(false);
      form.resetFields();
      refetch();
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Lỗi khi gửi khiếu nại');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (record) => {
    setSelectedComplaint(record);
    setDrawerVisible(true);
  };

  // ─── Table Columns ──────────────────────────────────────
  const columns = [
    {
      title: '#',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      render: (id) => <Text style={{ fontWeight: 600, color: 'var(--navy)' }}>#{id}</Text>,
    },
    {
      title: 'Mã đơn',
      dataIndex: 'booking_id',
      key: 'booking_id',
      width: 90,
      render: (id) => <Text style={{ fontWeight: 600, color: 'var(--orange)' }}>#{id}</Text>,
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'subject',
      key: 'subject',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time) => <Text type="secondary">{formatDateTime(time)}</Text>,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: 'descend',
    },
    {
      title: 'AI Cảm xúc',
      dataIndex: 'ai_sentiment',
      key: 'ai_sentiment',
      width: 130,
      render: (s) => <SentimentTag sentiment={s} />,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => <StatusTag status={status} />,
      filters: Object.entries(STATUS_CFG).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => openDetail(record)}
          style={{ color: 'var(--navy)', fontWeight: 500 }}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  // ─── Timeline for detail drawer ──────────────────────────
  const buildTimeline = (c) => {
    const items = [
      {
        dot: <FileTextOutlined style={{ color: 'var(--navy)' }} />,
        children: (
          <>
            <Text strong>Bạn gửi khiếu nại</Text>
            <br />
            <Text type="secondary">{formatDateTime(c.created_at)}</Text>
          </>
        ),
      },
    ];
    if (c.status === 'IN_REVIEW') {
      items.push({
        dot: <ClockCircleOutlined style={{ color: '#3b82f6' }} />,
        color: 'blue',
        children: <Text strong style={{ color: '#3b82f6' }}>Đang được Admin xem xét...</Text>,
      });
    }
    if (c.resolved_at) {
      items.push({
        dot: c.status === 'RESOLVED'
          ? <CheckCircleOutlined style={{ color: 'var(--success)' }} />
          : <CloseCircleOutlined style={{ color: 'var(--error)' }} />,
        color: c.status === 'RESOLVED' ? 'green' : 'red',
        children: (
          <>
            <Text strong style={{ color: c.status === 'RESOLVED' ? 'var(--success)' : 'var(--error)' }}>
              {c.status === 'RESOLVED' ? 'Khiếu nại đã được giải quyết' : 'Khiếu nại bị từ chối'}
            </Text>
            <br />
            <Text type="secondary">{formatDateTime(c.resolved_at)}</Text>
            {c.admin_response && (
              <div style={{
                marginTop: 8, padding: '10px 14px',
                background: c.status === 'RESOLVED' ? '#dcfce7' : '#fee2e2',
                borderRadius: 8, borderLeft: `3px solid ${c.status === 'RESOLVED' ? 'var(--success)' : 'var(--error)'}`,
              }}>
                <Text strong>Phản hồi từ Admin: </Text>
                <Text>{c.admin_response}</Text>
              </div>
            )}
          </>
        ),
      });
    }
    return items;
  };

  return (
    <div>
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 6 }}>Khiếu nại của tôi</Title>
          <Text type="secondary">Quản lý và theo dõi các yêu cầu khiếu nại về chất lượng dịch vụ</Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => setIsModalVisible(true)}
          style={{
            background: 'var(--orange)', borderColor: 'var(--orange)',
            borderRadius: 'var(--radius-lg)', fontWeight: 600, height: 44,
          }}
        >
          Gửi khiếu nại mới
        </Button>
      </div>

      {/* ─── Stats ───────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'Đã gửi',        value: openCount,     color: '#f59e0b', border: '#f59e0b', icon: <InboxOutlined /> },
          { label: 'Đang xem xét',  value: reviewCount,   color: '#3b82f6', border: '#3b82f6', icon: <ClockCircleOutlined /> },
          { label: 'Đã giải quyết', value: resolvedCount, color: '#22c55e', border: '#22c55e', icon: <CheckCircleOutlined /> },
          { label: 'Bị từ chối',    value: rejectedCount, color: '#ef4444', border: '#ef4444', icon: <CloseCircleOutlined /> },
        ].map((s, i) => (
          <Col xs={12} md={6} key={i}>
            <Card
              style={{
                borderRadius: 'var(--radius-lg)',
                borderLeft: `4px solid ${s.border}`,
                boxShadow: 'var(--shadow-sm)',
              }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              <Statistic
                title={<Text style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</Text>}
                value={s.value}
                prefix={<span style={{ color: s.color, marginRight: 4 }}>{s.icon}</span>}
                valueStyle={{ fontSize: 26, fontWeight: 700, color: s.color }}
                suffix="vụ"
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ─── Filter bar ──────────────────────────────────── */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Text style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Lọc:</Text>
        <Select
          style={{ width: 180 }}
          placeholder="Tất cả trạng thái"
          allowClear
          value={statusFilter}
          onChange={setStatusFilter}
        >
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <Select.Option key={k} value={k}>{v.label}</Select.Option>
          ))}
        </Select>
      </div>

      {/* ─── Table ───────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table
          columns={columns}
          dataSource={filteredComplaints}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8, showTotal: (total) => `Tổng ${total} khiếu nại` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">Bạn chưa có khiếu nại nào</Text>}
              />
            ),
          }}
        />
      </div>

      {/* ─── Submit Modal ─────────────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ExclamationCircleOutlined style={{ color: 'var(--orange)', fontSize: 20 }} />
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy)' }}>Gửi khiếu nại mới</span>
          </div>
        }
        open={isModalVisible}
        onCancel={() => { setIsModalVisible(false); form.resetFields(); }}
        footer={null}
        width={540}
        bodyStyle={{ paddingTop: 8 }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
          Mô tả chi tiết vấn đề bạn gặp phải. AI sẽ phân tích nội dung để hỗ trợ xử lý nhanh hơn.
        </Text>

        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="booking_id"
            label="Chọn đơn hàng"
            rules={[{ required: true, message: 'Vui lòng chọn đơn hàng muốn khiếu nại' }]}
          >
            <Select
              showSearch
              placeholder={
                bookingsLoading
                  ? 'Đang tải danh sách đơn hàng...'
                  : eligibleBookings.length === 0
                  ? 'Bạn chưa có đơn hoàn thành / bị hủy'
                  : 'Chọn đơn hàng muốn khiếu nại...'
              }
              disabled={bookingsLoading || eligibleBookings.length === 0}
              loading={bookingsLoading}
              style={{ width: '100%' }}
              optionLabelProp="label"
              filterOption={(input, option) => {
                const q = input.toLowerCase();
                return (
                  String(option?.bookingId).includes(q) ||
                  (option?.serviceName || '').toLowerCase().includes(q)
                );
              }}
              notFoundContent={
                bookingsLoading ? (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <Spin size="small" />
                    <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 13 }}>Đang tải...</div>
                  </div>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Bạn chưa có đơn hàng đã hoàn thành hoặc bị hủy để khiếu nại
                      </Text>
                    }
                  />
                )
              }
            >
              {eligibleBookings.map(b => (
                <Select.Option
                  key={b.id}
                  value={b.id}
                  label={`Đơn #${b.id} — ${b.service?.name || 'Dịch vụ'}`}
                  bookingId={b.id}
                  serviceName={b.service?.name || ''}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '4px 0', gap: 8,
                  }}>
                    {/* Left: ID + service */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <strong style={{ color: 'var(--navy)', fontSize: 14 }}>Đơn #{b.id}</strong>
                        <Tag
                          color={b.status === 'COMPLETED' ? 'success' : 'error'}
                          style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', borderRadius: 10, margin: 0 }}
                        >
                          {BOOKING_STATUS_LABELS[b.status]}
                        </Tag>
                      </div>
                      <div style={{ color: '#475569', fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                        <ToolOutlined style={{ marginRight: 5, color: 'var(--orange)' }} />
                        {b.service?.name || 'Dịch vụ'}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>
                        <CalendarOutlined style={{ marginRight: 4 }} />
                        {b.booking_date ? formatDateTime(b.booking_date).split(' ')[0] : '—'}
                        {b.time_slot_start ? ` lúc ${b.time_slot_start}` : ''}
                      </div>
                    </div>
                    {/* Right: price */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--orange)', fontSize: 13 }}>
                        {formatVND(b.final_price || b.estimated_price)}
                      </div>
                    </div>
                  </div>
                </Select.Option>
              ))}
            </Select>

          </Form.Item>

          <Form.Item
            name="subject"
            label="Tiêu đề khiếu nại"
            rules={[
              { required: true, message: 'Vui lòng nhập tiêu đề khiếu nại' },
              { min: 5, message: 'Tiêu đề phải có tối thiểu 5 ký tự' }
            ]}
          >
            <Input
              placeholder="VD: Thợ làm việc không đúng cam kết, chất lượng kém..."
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Mô tả chi tiết"
            rules={[
              { required: true, message: 'Vui lòng mô tả chi tiết vấn đề' },
              { min: 10, message: 'Mô tả chi tiết phải có tối thiểu 10 ký tự' }
            ]}
          >
            <TextArea
              rows={5}
              placeholder="Mô tả rõ vấn đề bạn gặp phải, thời gian xảy ra, mức độ ảnh hưởng..."
              style={{ borderRadius: 8 }}
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <div style={{
            padding: '10px 14px', background: '#fef3c7', borderRadius: 8,
            borderLeft: '3px solid #f59e0b', marginBottom: 20,
          }}>
            <RobotOutlined style={{ color: '#f59e0b', marginRight: 6 }} />
            <Text style={{ fontSize: 13, color: '#92400e' }}>
              <strong>AI Phân tích:</strong> Nội dung khiếu nại sẽ được AI phân tích cảm xúc để hỗ trợ Admin xử lý nhanh hơn.
            </Text>
          </div>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{
                background: 'var(--orange)', borderColor: 'var(--orange)',
                borderRadius: 'var(--radius-lg)', fontWeight: 600, height: 46,
              }}
            >
              Gửi khiếu nại
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── Detail Drawer ────────────────────────────────── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ color: 'var(--orange)', fontSize: 18 }} />
            <span style={{ fontWeight: 700, color: 'var(--navy)' }}>
              Chi tiết khiếu nại #{selectedComplaint?.id}
            </span>
          </div>
        }
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={540}
        bodyStyle={{ paddingTop: 16 }}
        extra={selectedComplaint && <StatusTag status={selectedComplaint.status} />}
      >
        {selectedComplaint && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Basic Info */}
            <Card style={{ borderRadius: 'var(--radius-lg)', border: '1px solid #e2e8f0' }}>
              <Descriptions column={1} size="small" labelStyle={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                <Descriptions.Item label="Mã đơn hàng">
                  <Text strong style={{ color: 'var(--orange)' }}>#{selectedComplaint.booking_id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Dịch vụ">
                  {selectedComplaint.booking?.service?.name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày gửi">
                  {formatDateTime(selectedComplaint.created_at)}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <StatusTag status={selectedComplaint.status} />
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Content */}
            <Card
              title={<Text strong>Nội dung khiếu nại</Text>}
              style={{ borderRadius: 'var(--radius-lg)', border: '1px solid #e2e8f0' }}
            >
              <Text strong style={{ fontSize: 15, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>
                {selectedComplaint.subject}
              </Text>
              <Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
                {selectedComplaint.description}
              </Paragraph>
            </Card>

            {/* AI Sentiment */}
            <Card
              title={
                <Space>
                  <RobotOutlined style={{ color: '#6366f1' }} />
                  <Text strong>Phân tích AI</Text>
                </Space>
              }
              style={{ borderRadius: 'var(--radius-lg)', border: '1px solid #e2e8f0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Text style={{ color: 'var(--text-secondary)' }}>Cảm xúc được phát hiện:</Text>
                <SentimentTag sentiment={selectedComplaint.ai_sentiment} />
              </div>
              {selectedComplaint.ai_sentiment === 'NEGATIVE' && (
                <div style={{
                  marginTop: 10, padding: '8px 12px',
                  background: '#fee2e2', borderRadius: 8, fontSize: 13,
                  color: '#991b1b',
                }}>
                  ⚠️ AI phát hiện nội dung có cảm xúc tiêu cực — khiếu nại sẽ được ưu tiên xử lý.
                </div>
              )}
            </Card>

            {/* Timeline */}
            <Card
              title={<Text strong>Lịch sử xử lý</Text>}
              style={{ borderRadius: 'var(--radius-lg)', border: '1px solid #e2e8f0' }}
            >
              <Timeline items={buildTimeline(selectedComplaint)} />
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
}