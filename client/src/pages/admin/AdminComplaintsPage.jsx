import { useState, useMemo } from 'react';
import {
  Table, Tag, Button, Typography, Space, Modal, Form, Input, message,
  Select, Card, Row, Col, Statistic, Drawer, Descriptions, Timeline,
  Divider, Tabs, Badge, Progress, Tooltip, Empty,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  EyeOutlined, RobotOutlined, WarningOutlined, InboxOutlined,
  FileTextOutlined, UserOutlined, BarChartOutlined, ExclamationCircleOutlined,
  ThunderboltOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatDateTime } from '../../utils/helpers';
import { COMPLAINT_STATUS_LABELS } from '../../utils/constants';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─── Config ──────────────────────────────────────────────────
const STATUS_CFG = {
  OPEN:      { color: '#f59e0b', bg: '#fef3c7', antColor: 'warning',    label: 'Mới gửi',          icon: <InboxOutlined /> },
  IN_REVIEW: { color: '#3b82f6', bg: '#dbeafe', antColor: 'processing', label: 'Đang xem xét',     icon: <ClockCircleOutlined /> },
  RESOLVED:  { color: '#22c55e', bg: '#dcfce7', antColor: 'success',    label: 'Đã giải quyết',    icon: <CheckCircleOutlined /> },
  REJECTED:  { color: '#ef4444', bg: '#fee2e2', antColor: 'error',      label: 'Đã từ chối',       icon: <CloseCircleOutlined /> },
};

const SENTIMENT_CFG = {
  NEGATIVE: { color: '#ef4444', bg: '#fee2e2', label: 'Tiêu cực 😠', antColor: 'red' },
  NEUTRAL:  { color: '#64748b', bg: '#f1f5f9', label: 'Trung lập 😐', antColor: 'default' },
  POSITIVE: { color: '#22c55e', bg: '#dcfce7', label: 'Tích cực 😊', antColor: 'green' },
};

function StatusTag({ status }) {
  const cfg = STATUS_CFG[status] || {};
  return (
    <Tag
      color={cfg.antColor || 'default'}
      style={{ borderRadius: 20, fontWeight: 600, padding: '2px 12px' }}
      icon={cfg.icon}
    >
      {cfg.label || COMPLAINT_STATUS_LABELS[status] || status}
    </Tag>
  );
}

function SentimentTag({ sentiment }) {
  if (!sentiment) sentiment = 'NEUTRAL';
  const cfg = SENTIMENT_CFG[sentiment] || SENTIMENT_CFG.NEUTRAL;
  return (
    <Tag
      color={cfg.antColor}
      style={{ borderRadius: 20, fontWeight: 600, padding: '2px 10px' }}
    >
      {cfg.label}
    </Tag>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function AdminComplaintsPage() {
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible]   = useState(false);
  const [selectedComplaint, setSelectedComplaint]       = useState(null);
  const [loadingAction, setLoadingAction]               = useState(false);
  const [statusFilter, setStatusFilter]                 = useState(null);
  const [sentimentFilter, setSentimentFilter]           = useState(null);
  const [searchText, setSearchText]                     = useState('');
  const [form] = Form.useForm();

  const { data: complaintsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-complaints'],
    queryFn: () => adminApi.getComplaints(),
  });

  const complaints = useMemo(() => {
    const raw = complaintsData?.data?.data || complaintsData?.data || [];
    return raw;
  }, [complaintsData]);

  // ─── Statistics ─────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = complaints.length;
    const open      = complaints.filter(c => c.status === 'OPEN').length;
    const inReview  = complaints.filter(c => c.status === 'IN_REVIEW').length;
    const resolved  = complaints.filter(c => c.status === 'RESOLVED').length;
    const rejected  = complaints.filter(c => c.status === 'REJECTED').length;
    const negative  = complaints.filter(c => c.ai_sentiment === 'NEGATIVE').length;
    const neutral   = complaints.filter(c => c.ai_sentiment === 'NEUTRAL' || !c.ai_sentiment).length;
    const positive  = complaints.filter(c => c.ai_sentiment === 'POSITIVE').length;
    const resolvedRate = total > 0 ? Math.round(((resolved + rejected) / total) * 100) : 0;
    return { total, open, inReview, resolved, rejected, negative, neutral, positive, resolvedRate };
  }, [complaints]);

  // ─── Filtered data ──────────────────────────────────────
  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (sentimentFilter && (c.ai_sentiment || 'NEUTRAL') !== sentimentFilter) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const customerName = (c.customer?.full_name || '').toLowerCase();
        const subject = (c.subject || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        if (!customerName.includes(q) && !subject.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [complaints, statusFilter, sentimentFilter, searchText]);

  // ─── Handlers ───────────────────────────────────────────
  const handleOpenResolve = (record) => {
    setSelectedComplaint(record);
    form.resetFields();
    form.setFieldsValue({ status: 'RESOLVED' });
    setResolveModalVisible(true);
  };

  const handleOpenDetail = (record) => {
    setSelectedComplaint(record);
    setDetailDrawerVisible(true);
  };

  const handleResolve = async (values) => {
    try {
      setLoadingAction(true);
      await adminApi.resolveComplaint(selectedComplaint.id, {
        admin_response: values.admin_response,
        status: values.status,
      });
      message.success(values.status === 'RESOLVED' ? 'Đã giải quyết khiếu nại!' : 'Đã từ chối khiếu nại');
      setResolveModalVisible(false);
      setDetailDrawerVisible(false);
      refetch();
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Lỗi khi xử lý');
    } finally {
      setLoadingAction(false);
    }
  };

  // ─── Table Columns ──────────────────────────────────────
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 65,
      render: (id) => <Text style={{ fontWeight: 600, color: 'var(--navy)' }}>#{id}</Text>,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, r) => (
        <div>
          <Text strong style={{ display: 'block' }}>{r.customer?.full_name || 'N/A'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.customer?.phone || r.customer?.email || ''}</Text>
        </div>
      ),
    },
    {
      title: 'Đơn / Dịch vụ',
      key: 'booking',
      render: (_, r) => (
        <div>
          <Text strong style={{ color: 'var(--orange)', display: 'block' }}>#{r.booking_id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.booking?.service?.name || '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Tiêu đề khiếu nại',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
      render: (text, r) => (
        <Tooltip title={r.description}>
          <Text strong>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 155,
      render: (t) => <Text type="secondary" style={{ fontSize: 13 }}>{formatDateTime(t)}</Text>,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: 'descend',
    },
    {
      title: 'AI Cảm xúc',
      dataIndex: 'ai_sentiment',
      key: 'ai_sentiment',
      width: 145,
      render: (s) => <SentimentTag sentiment={s} />,
      filters: Object.entries(SENTIMENT_CFG).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (value, r) => (r.ai_sentiment || 'NEUTRAL') === value,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 155,
      render: (status) => <StatusTag status={status} />,
      filters: Object.entries(STATUS_CFG).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (value, r) => r.status === value,
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 145,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleOpenDetail(r)}
              style={{ color: '#6366f1', fontWeight: 500 }}
            />
          </Tooltip>
          {(r.status === 'OPEN' || r.status === 'IN_REVIEW') && (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleOpenResolve(r)}
              style={{
                background: 'var(--navy)', borderColor: 'var(--navy)',
                borderRadius: 6, fontWeight: 600,
              }}
            >
              Xử lý
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // ─── Row highlighting for negative sentiment ─────────────
  const rowClassName = (record) => {
    if (record.ai_sentiment === 'NEGATIVE' && (record.status === 'OPEN' || record.status === 'IN_REVIEW')) {
      return 'complaint-row-urgent';
    }
    return '';
  };

  // ─── Timeline for detail drawer ──────────────────────────
  const buildTimeline = (c) => {
    if (!c) return [];
    const items = [
      {
        dot: <FileTextOutlined style={{ color: 'var(--navy)' }} />,
        children: (
          <>
            <Text strong>Khách hàng gửi khiếu nại</Text>
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
        children: <Text strong style={{ color: '#3b82f6' }}>Admin đang xem xét...</Text>,
      });
    }
    if (c.resolved_at) {
      items.push({
        dot: c.status === 'RESOLVED'
          ? <CheckCircleOutlined style={{ color: '#22c55e' }} />
          : <CloseCircleOutlined style={{ color: '#ef4444' }} />,
        color: c.status === 'RESOLVED' ? 'green' : 'red',
        children: (
          <>
            <Text strong style={{ color: c.status === 'RESOLVED' ? '#22c55e' : '#ef4444' }}>
              {c.status === 'RESOLVED' ? 'Đã giải quyết' : 'Đã từ chối'}
            </Text>
            <br />
            <Text type="secondary">{formatDateTime(c.resolved_at)}</Text>
            {c.admin_response && (
              <div style={{
                marginTop: 8, padding: '10px 14px',
                background: c.status === 'RESOLVED' ? '#dcfce7' : '#fee2e2',
                borderRadius: 8, borderLeft: `3px solid ${c.status === 'RESOLVED' ? '#22c55e' : '#ef4444'}`,
              }}>
                <Text style={{ fontSize: 13 }}>{c.admin_response}</Text>
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
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 6 }}>Quản lý Khiếu nại</Title>
        <Text type="secondary">Tiếp nhận, phân tích AI và giải quyết các phản ánh từ khách hàng</Text>
      </div>

      {/* ─── Stats Row ───────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'Tổng khiếu nại',   value: stats.total,    color: 'var(--navy)', border: 'var(--navy)', icon: <FileTextOutlined /> },
          { label: 'Chờ xử lý',        value: stats.open + stats.inReview, color: '#f59e0b', border: '#f59e0b', icon: <ClockCircleOutlined /> },
          { label: 'Đã giải quyết',    value: stats.resolved, color: '#22c55e', border: '#22c55e', icon: <CheckCircleOutlined /> },
          { label: 'Đã từ chối',       value: stats.rejected, color: '#ef4444', border: '#ef4444', icon: <CloseCircleOutlined /> },
        ].map((s, i) => (
          <Col xs={12} lg={6} key={i}>
            <Card
              style={{ borderRadius: 'var(--radius-lg)', borderLeft: `4px solid ${s.border}`, boxShadow: 'var(--shadow-sm)' }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              <Statistic
                title={<Text style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</Text>}
                value={s.value}
                prefix={<span style={{ color: s.color, marginRight: 4 }}>{s.icon}</span>}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: s.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ─── AI Sentiment Analysis Section ──────────────── */}
      <Card
        title={
          <Space>
            <RobotOutlined style={{ color: '#6366f1', fontSize: 18 }} />
            <Text strong style={{ fontSize: 16, color: 'var(--navy)' }}>Phân tích AI Sentiment</Text>
            <Tag color="purple" style={{ fontWeight: 600 }}>AI</Tag>
          </Space>
        }
        style={{
          borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)',
          marginBottom: 24, borderTop: '3px solid #6366f1',
        }}
      >
        <Row gutter={[24, 16]} align="middle">
          {/* Sentiment Bars */}
          <Col xs={24} md={16}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'NEGATIVE', label: 'Tiêu cực', value: stats.negative, color: '#ef4444', bg: '#fee2e2', icon: '😠' },
                { key: 'NEUTRAL',  label: 'Trung lập', value: stats.neutral,  color: '#64748b', bg: '#f1f5f9', icon: '😐' },
                { key: 'POSITIVE', label: 'Tích cực',  value: stats.positive, color: '#22c55e', bg: '#dcfce7', icon: '😊' },
              ].map(s => (
                <div key={s.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Space size={6}>
                      <span style={{ fontSize: 18 }}>{s.icon}</span>
                      <Text strong style={{ color: s.color }}>{s.label}</Text>
                    </Space>
                    <Text strong style={{ color: s.color }}>
                      {s.value} khiếu nại
                      {stats.total > 0 && (
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                          ({Math.round((s.value / stats.total) * 100)}%)
                        </Text>
                      )}
                    </Text>
                  </div>
                  <Progress
                    percent={stats.total > 0 ? Math.round((s.value / stats.total) * 100) : 0}
                    strokeColor={s.color}
                    trailColor={s.bg}
                    showInfo={false}
                    strokeWidth={10}
                    style={{ margin: 0 }}
                  />
                </div>
              ))}
            </div>
          </Col>

          {/* Resolve Rate */}
          <Col xs={24} md={8} style={{ textAlign: 'center' }}>
            <div style={{
              padding: '20px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: 'var(--radius-xl)', border: '1px solid #bae6fd',
            }}>
              <Progress
                type="circle"
                percent={stats.resolvedRate}
                strokeColor={{ '0%': '#6366f1', '100%': '#8b5cf6' }}
                width={110}
                format={(p) => (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#6366f1' }}>{p}%</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Tỷ lệ xử lý</div>
                  </div>
                )}
              />
              <div style={{ marginTop: 12 }}>
                <Text strong style={{ color: 'var(--navy)' }}>Tổng đã xử lý</Text>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#6366f1' }}>
                  {stats.resolved + stats.rejected} / {stats.total}
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* Urgent notice */}
        {stats.negative > 0 && (
          <div style={{
            marginTop: 16, padding: '10px 16px',
            background: '#fee2e2', borderRadius: 8,
            borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <WarningOutlined style={{ color: '#ef4444', fontSize: 18 }} />
            <Text style={{ color: '#991b1b' }}>
              <strong>{stats.negative} khiếu nại có cảm xúc tiêu cực</strong> — AI khuyến nghị ưu tiên xử lý những khiếu nại này.
            </Text>
          </div>
        )}
      </Card>

      {/* ─── Filters ─────────────────────────────────────── */}
      <Card style={{ borderRadius: 'var(--radius-lg)', marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
        <Space wrap size={12}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Tìm theo tên KH, tiêu đề..."
            style={{ width: 260, borderRadius: 8 }}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
          />
          <Select
            style={{ width: 180 }}
            placeholder="Lọc theo trạng thái"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
          >
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <Select.Option key={k} value={k}>
                <Space size={4}>{v.icon}<span>{v.label}</span></Space>
              </Select.Option>
            ))}
          </Select>
          <Select
            style={{ width: 180 }}
            placeholder="Lọc theo AI sentiment"
            allowClear
            value={sentimentFilter}
            onChange={setSentimentFilter}
          >
            {Object.entries(SENTIMENT_CFG).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v.label}</Select.Option>
            ))}
          </Select>
          {(statusFilter || sentimentFilter || searchText) && (
            <Button
              type="link"
              onClick={() => { setStatusFilter(null); setSentimentFilter(null); setSearchText(''); }}
              style={{ color: '#ef4444', padding: 0 }}
            >
              Xoá bộ lọc
            </Button>
          )}
          <Text type="secondary" style={{ fontSize: 13 }}>
            Hiển thị {filteredComplaints.length} / {complaints.length} khiếu nại
          </Text>
        </Space>
      </Card>

      {/* ─── Table ───────────────────────────────────────── */}
      <Card style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <style>{`
          .complaint-row-urgent { background: #fff7ed !important; }
          .complaint-row-urgent:hover > td { background: #ffedd5 !important; }
        `}</style>
        <Table
          columns={columns}
          dataSource={filteredComplaints}
          rowKey="id"
          loading={isLoading}
          rowClassName={rowClassName}
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng ${total} khiếu nại` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">Chưa có khiếu nại nào</Text>}
              />
            ),
          }}
        />
      </Card>

      {/* ─── Resolve Modal ────────────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThunderboltOutlined style={{ color: 'var(--orange)', fontSize: 20 }} />
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy)' }}>
              Xử lý khiếu nại #{selectedComplaint?.id}
            </span>
          </div>
        }
        open={resolveModalVisible}
        onCancel={() => setResolveModalVisible(false)}
        footer={null}
        width={540}
        bodyStyle={{ paddingTop: 12 }}
      >
        {selectedComplaint && (
          <div>
            {/* Quick summary */}
            <div style={{
              padding: '12px 16px', background: '#f8fafc',
              borderRadius: 8, marginBottom: 20, border: '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Khách hàng</Text>
                  <Text strong style={{ display: 'block' }}>{selectedComplaint.customer?.full_name}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Mã đơn</Text>
                  <Text strong style={{ display: 'block', color: 'var(--orange)' }}>#{selectedComplaint.booking_id}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>AI Cảm xúc</Text>
                  <div><SentimentTag sentiment={selectedComplaint.ai_sentiment} /></div>
                </div>
              </div>
              <Divider style={{ margin: '10px 0' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>Nội dung khiếu nại</Text>
              <Text style={{ display: 'block', marginTop: 4 }}>{selectedComplaint.subject}</Text>
              <Text type="secondary" style={{ fontSize: 13 }}>{selectedComplaint.description}</Text>
            </div>

            {/* Resolve Form */}
            <Form
              form={form}
              layout="vertical"
              onFinish={handleResolve}
              initialValues={{ status: 'RESOLVED' }}
            >
              <Form.Item
                name="status"
                label="Kết quả xử lý"
                rules={[{ required: true, message: 'Chọn kết quả xử lý' }]}
              >
                <Select style={{ borderRadius: 8 }}>
                  <Select.Option value="RESOLVED">
                    <Space>
                      <CheckCircleOutlined style={{ color: '#22c55e' }} />
                      Chấp nhận & Đã giải quyết
                    </Space>
                  </Select.Option>
                  <Select.Option value="REJECTED">
                    <Space>
                      <CloseCircleOutlined style={{ color: '#ef4444' }} />
                      Từ chối khiếu nại (Không hợp lệ)
                    </Space>
                  </Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="admin_response"
                label="Phản hồi cho khách hàng"
                rules={[{ required: true, message: 'Vui lòng nhập phản hồi' }]}
                extra="Khách hàng sẽ nhận được thông báo với nội dung này"
              >
                <TextArea
                  rows={4}
                  placeholder="VD: Chúng tôi đã xác nhận sự việc và đã liên hệ kỹ thuật viên. Xin lỗi vì sự bất tiện, chúng tôi sẽ hoàn tiền 50%..."
                  style={{ borderRadius: 8 }}
                  showCount
                  maxLength={500}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => setResolveModalVisible(false)}>Hủy</Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loadingAction}
                    style={{
                      background: 'var(--navy)', borderColor: 'var(--navy)',
                      borderRadius: 8, fontWeight: 600,
                    }}
                  >
                    Lưu kết quả xử lý
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* ─── Detail Drawer ────────────────────────────────── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ color: 'var(--orange)', fontSize: 18 }} />
            <span style={{ fontWeight: 700, color: 'var(--navy)' }}>
              Khiếu nại #{selectedComplaint?.id}
            </span>
          </div>
        }
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={580}
        extra={
          selectedComplaint &&
          (selectedComplaint.status === 'OPEN' || selectedComplaint.status === 'IN_REVIEW') && (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => { setDetailDrawerVisible(false); handleOpenResolve(selectedComplaint); }}
              style={{ background: 'var(--navy)', borderColor: 'var(--navy)', fontWeight: 600, borderRadius: 8 }}
            >
              Xử lý ngay
            </Button>
          )
        }
      >
        {selectedComplaint && (
          <Tabs
            items={[
              {
                key: 'info',
                label: (
                  <Space>
                    <FileTextOutlined />
                    Thông tin
                  </Space>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <StatusTag status={selectedComplaint.status} />
                      <SentimentTag sentiment={selectedComplaint.ai_sentiment} />
                    </div>

                    {/* Customer Info */}
                    <Card
                      title={<Space><UserOutlined /><Text strong>Khách hàng</Text></Space>}
                      size="small"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    >
                      <Descriptions column={1} size="small" labelStyle={{ color: '#64748b', fontWeight: 500 }}>
                        <Descriptions.Item label="Họ tên">{selectedComplaint.customer?.full_name || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Email">{selectedComplaint.customer?.email || '—'}</Descriptions.Item>
                        <Descriptions.Item label="SĐT">{selectedComplaint.customer?.phone || '—'}</Descriptions.Item>
                      </Descriptions>
                    </Card>

                    {/* Booking Info */}
                    <Card
                      title={<Space><BarChartOutlined /><Text strong>Đơn hàng liên quan</Text></Space>}
                      size="small"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    >
                      <Descriptions column={1} size="small" labelStyle={{ color: '#64748b', fontWeight: 500 }}>
                        <Descriptions.Item label="Mã đơn">
                          <Text strong style={{ color: 'var(--orange)' }}>#{selectedComplaint.booking_id}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Dịch vụ">{selectedComplaint.booking?.service?.name || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Ngày đặt">
                          {selectedComplaint.booking?.booking_date ? formatDateTime(selectedComplaint.booking.booking_date) : '—'}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>

                    {/* Complaint Content */}
                    <Card
                      title={<Space><ExclamationCircleOutlined style={{ color: 'var(--orange)' }} /><Text strong>Nội dung khiếu nại</Text></Space>}
                      size="small"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    >
                      <Text strong style={{ fontSize: 15, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>
                        {selectedComplaint.subject}
                      </Text>
                      <Paragraph style={{ color: '#64748b', marginBottom: 0 }}>
                        {selectedComplaint.description}
                      </Paragraph>
                      <Divider style={{ margin: '12px 0' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Ngày gửi: {formatDateTime(selectedComplaint.created_at)}
                      </Text>
                    </Card>

                    {/* Admin response if exists */}
                    {selectedComplaint.admin_response && (
                      <Card
                        title={<Text strong>Phản hồi của Admin</Text>}
                        size="small"
                        style={{
                          borderRadius: 'var(--radius-lg)',
                          borderLeft: `4px solid ${selectedComplaint.status === 'RESOLVED' ? '#22c55e' : '#ef4444'}`,
                        }}
                      >
                        <Text>{selectedComplaint.admin_response}</Text>
                        {selectedComplaint.resolved_at && (
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Xử lý lúc: {formatDateTime(selectedComplaint.resolved_at)}
                            </Text>
                          </div>
                        )}
                      </Card>
                    )}
                  </div>
                ),
              },
              {
                key: 'ai',
                label: (
                  <Space>
                    <RobotOutlined style={{ color: '#6366f1' }} />
                    AI Sentiment
                  </Space>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Card
                      style={{
                        borderRadius: 'var(--radius-xl)',
                        background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                        border: '1px solid #c4b5fd',
                      }}
                    >
                      <div style={{ textAlign: 'center', padding: '12px 0' }}>
                        <RobotOutlined style={{ fontSize: 48, color: '#6366f1', marginBottom: 12 }} />
                        <Title level={4} style={{ color: '#4c1d95', marginBottom: 8 }}>Kết quả phân tích AI</Title>
                        <Text style={{ color: '#6d28d9' }}>
                          AI đã phân tích nội dung khiếu nại và phân loại cảm xúc
                        </Text>
                      </div>
                    </Card>

                    <Card style={{ borderRadius: 'var(--radius-lg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text strong style={{ fontSize: 16 }}>Sentiment phát hiện:</Text>
                        <SentimentTag sentiment={selectedComplaint.ai_sentiment} />
                      </div>

                      {Object.entries(SENTIMENT_CFG).map(([key, cfg]) => (
                        <div key={key} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: cfg.color, fontWeight: (selectedComplaint.ai_sentiment || 'NEUTRAL') === key ? 700 : 400 }}>
                              {cfg.label}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {(selectedComplaint.ai_sentiment || 'NEUTRAL') === key ? '✓ Phù hợp nhất' : ''}
                            </Text>
                          </div>
                          <Progress
                            percent={(selectedComplaint.ai_sentiment || 'NEUTRAL') === key ? 100 : 10}
                            strokeColor={cfg.color}
                            trailColor={cfg.bg}
                            showInfo={false}
                            strokeWidth={8}
                          />
                        </div>
                      ))}

                      {selectedComplaint.ai_sentiment === 'NEGATIVE' && (
                        <div style={{
                          marginTop: 16, padding: '12px 16px',
                          background: '#fee2e2', borderRadius: 8,
                          borderLeft: '4px solid #ef4444',
                        }}>
                          <Space>
                            <WarningOutlined style={{ color: '#ef4444' }} />
                            <Text strong style={{ color: '#991b1b' }}>Khuyến nghị ưu tiên</Text>
                          </Space>
                          <br />
                          <Text style={{ color: '#991b1b', fontSize: 13 }}>
                            AI phát hiện cảm xúc tiêu cực cao. Nên liên hệ khách hàng ngay và ưu tiên xử lý.
                          </Text>
                        </div>
                      )}
                    </Card>

                    <Card
                      title={<Text strong>Văn bản được phân tích</Text>}
                      style={{ borderRadius: 'var(--radius-lg)' }}
                      size="small"
                    >
                      <div style={{
                        padding: '12px 16px', background: '#f8fafc',
                        borderRadius: 8, fontStyle: 'italic', color: '#475569', lineHeight: 1.6,
                      }}>
                        "{selectedComplaint.subject}. {selectedComplaint.description}"
                      </div>
                    </Card>
                  </div>
                ),
              },
              {
                key: 'timeline',
                label: (
                  <Space>
                    <ClockCircleOutlined />
                    Lịch sử
                  </Space>
                ),
                children: (
                  <Card style={{ borderRadius: 'var(--radius-lg)' }}>
                    <Timeline items={buildTimeline(selectedComplaint)} />
                  </Card>
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </div>
  );
}
