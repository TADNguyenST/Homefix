import { useState } from 'react';
import { Table, Tag, Typography, Card, Row, Col, Statistic, Select, Space, Button, Tabs, Modal, Checkbox, Input, Avatar, Badge, message, Divider } from 'antd';
import {
  WalletOutlined, CheckCircleOutlined, ClockCircleOutlined,
  EyeOutlined, FilterOutlined, CreditCardOutlined, DollarOutlined,
  HistoryOutlined, UserOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { formatVND, formatDateTime } from '../../utils/helpers';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PAYMENT_STATUS = {
  PAID:    { label: 'Đã thanh toán', color: 'success' },
  PENDING: { label: 'Đang xử lý',   color: 'processing' },
  UNPAID:  { label: 'Chưa thanh toán', color: 'warning' },
  FAILED:  { label: 'Thất bại',     color: 'error' },
};

const PAYMENT_METHOD = {
  CASH:  { label: 'Tiền mặt', color: 'green' },
  VNPAY: { label: 'VNPAY',    color: 'cyan' },
};

const getSettlementConfig = (payment) => {
  if (payment.method === 'VNPAY' && payment.status === 'PAID') {
    return { label: 'HomeFix nhận qua VNPAY', color: 'cyan' };
  }
  if (payment.method !== 'CASH' || payment.status !== 'PAID') {
    return { label: 'Chưa phát sinh', color: 'default' };
  }
  if (payment.settlement_status === 'SETTLED') {
    return { label: 'Đã bàn giao HomeFix', color: 'success' };
  }
  return { label: 'Kỹ thuật viên đang giữ', color: 'warning' };
};

export default function AdminPaymentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('transactions');
  const [filters, setFilters] = useState({
    method: undefined,
    status: undefined,
    settlement_status: undefined,
    page: 1,
    limit: 12,
  });

  // Details Modal State
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState([]);
  const [settlementNote, setSettlementNote] = useState('');

  // Queries
  const { data: paymentsData, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ['admin-payments', filters],
    queryFn: () => adminApi.getPayments(filters),
  });

  const { data: walletsData, isLoading: isWalletsLoading, refetch: refetchWallets } = useQuery({
    queryKey: ['admin-tech-wallets'],
    queryFn: () => adminApi.getTechnicianWallets(),
    enabled: activeTab === 'wallets',
  });

  // Mutation for batch settlement
  const batchSettlementMutation = useMutation({
    mutationFn: (payload) => adminApi.confirmCashSettlementBatch(payload),
    onSuccess: (res) => {
      message.success(res.message || 'Xác nhận đối soát lô thành công');
      setSelectedPaymentIds([]);
      setSettlementNote('');
      
      // Refresh wallet info
      refetchWallets().then((updated) => {
        if (selectedWallet) {
          const freshWallet = updated.data?.data?.find(w => w.id === selectedWallet.id);
          if (freshWallet) {
            setSelectedWallet(freshWallet);
          } else {
            setSelectedWallet(null);
          }
        }
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err) => {
      message.error(err.message || 'Lỗi khi xác nhận đối soát lô');
    }
  });

  const payments = Array.isArray(paymentsData?.data) ? paymentsData.data : [];
  const summary = paymentsData?.summary || {};
  const wallets = Array.isArray(walletsData?.data) ? walletsData.data : [];

  const handleBatchSettlement = () => {
    if (selectedPaymentIds.length === 0) return;
    Modal.confirm({
      title: `Xác nhận đối soát ${selectedPaymentIds.length} giao dịch?`,
      content: `Bạn có chắc chắn muốn xác nhận đã nhận đủ tiền mặt của ${selectedPaymentIds.length} đơn đặt lịch đã chọn từ thợ? Hành động này không thể hoàn tác.`,
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      onOk: () => {
        batchSettlementMutation.mutate({
          paymentIds: selectedPaymentIds,
          note: settlementNote,
        });
      }
    });
  };

  const columns = [
    {
      title: 'Mã giao dịch',
      dataIndex: 'transaction_code',
      key: 'transaction_code',
      render: (id) => (
        <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 13 }}>
          {id || <span style={{ color: '#bbb' }}>---</span>}
        </span>
      ),
    },
    {
      title: 'Đơn #',
      dataIndex: 'booking_id',
      key: 'booking_id',
      render: (id) => <strong style={{ color: 'var(--navy)' }}>#{id}</strong>,
      width: 80,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{record.booking?.customer?.full_name || 'N/A'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.booking?.customer?.phone || ''}</Text>
        </Space>
      ),
    },
    {
      title: 'Dịch vụ',
      key: 'service',
      render: (_, record) => record.booking?.service?.name || 'N/A',
      ellipsis: true,
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => <strong style={{ color: 'var(--orange)', fontSize: 14 }}>{formatVND(amount)}</strong>,
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
    },
    {
      title: 'Phương thức',
      dataIndex: 'method',
      key: 'method',
      render: (method) => {
        const cfg = PAYMENT_METHOD[method] || { label: method || '---', color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const cfg = PAYMENT_STATUS[status] || { label: status, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Dòng tiền',
      key: 'settlement_status',
      render: (_, record) => {
        const cfg = getSettlementConfig(record);
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => <Text style={{ fontSize: 12 }}>{formatDateTime(time)}</Text>,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: 'descend',
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          style={{ color: '#1677ff' }}
          onClick={(e) => { e.stopPropagation(); navigate(`/admin/payments/${record.id}`); }}
        />
      ),
    },
  ];

  const walletColumns = [
    {
      title: 'Kỹ thuật viên',
      key: 'tech',
      render: (_, record) => (
        <Space size="middle">
          <Avatar 
            src={record.avatar_url} 
            icon={<UserOutlined />}
            style={{ backgroundColor: 'var(--navy)' }}
          />
          <Space direction="vertical" size={0}>
            <Text strong>{record.full_name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.phone} · {record.email}</Text>
          </Space>
        </Space>
      )
    },
    {
      title: 'Tổng tiền đã thu',
      dataIndex: 'total_collected',
      key: 'total_collected',
      render: (val) => <Text strong style={{ color: 'var(--navy)' }}>{formatVND(val)}</Text>,
      sorter: (a, b) => a.total_collected - b.total_collected,
    },
    {
      title: 'Đã đối soát',
      dataIndex: 'total_settled',
      key: 'total_settled',
      render: (val) => <Text strong style={{ color: 'var(--success)' }}>{formatVND(val)}</Text>,
      sorter: (a, b) => a.total_settled - b.total_settled,
    },
    {
      title: 'Đang giữ (chờ đối soát)',
      dataIndex: 'total_pending',
      key: 'total_pending',
      render: (val) => (
        <Badge count={val > 0 ? 'Đang giữ tiền' : 0} offset={[10, -5]}>
          <Text strong style={{ color: val > 0 ? 'var(--orange)' : 'var(--text-secondary)', fontSize: 15 }}>
            {formatVND(val)}
          </Text>
        </Badge>
      ),
      sorter: (a, b) => a.total_pending - b.total_pending,
    },
    {
      title: '',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="primary" 
          ghost
          icon={<WalletOutlined />} 
          onClick={() => {
            setSelectedWallet(record);
            setSelectedPaymentIds([]);
          }}
        >
          Chi tiết ví
        </Button>
      )
    }
  ];

  const detailPaymentColumns = [
    {
      title: 'Đơn hàng',
      dataIndex: 'booking_id',
      key: 'booking_id',
      render: (id) => <strong style={{ color: 'var(--navy)' }}>#{id}</strong>,
      width: 70
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{record.customer_name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.customer_phone}</Text>
        </Space>
      )
    },
    {
      title: 'Dịch vụ',
      dataIndex: 'service_name',
      key: 'service_name',
      ellipsis: true,
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (val) => <Text strong style={{ color: 'var(--orange)' }}>{formatVND(val)}</Text>,
    },
    {
      title: 'Ngày thanh toán',
      dataIndex: 'paid_at',
      key: 'paid_at',
      render: (val) => formatDateTime(val),
    },
    {
      title: 'Trạng thái bàn giao',
      dataIndex: 'settlement_status',
      key: 'settlement_status',
      render: (status) => {
        if (status === 'SETTLED') return <Tag color="success">Đã bàn giao</Tag>;
        return <Tag color="warning">Chờ bàn giao</Tag>;
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 4 }}>Thanh toán</Title>
        <Text type="secondary">Quản lý các giao dịch thanh toán và đối soát tiền mặt của thợ</Text>
      </div>

      <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid var(--orange)' }}>
            <Statistic
              title="Tổng doanh thu đã thanh toán"
              value={formatVND(summary.total_revenue || 0)}
              prefix={<WalletOutlined style={{ color: 'var(--orange)' }} />}
              valueStyle={{ fontSize: 18, fontWeight: 700, color: 'var(--orange)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #52c41a' }}>
            <Statistic
              title="HomeFix đã thực nhận"
              value={formatVND(summary.homefix_received || 0)}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #1677ff' }}>
            <Statistic
              title="VNPAY đã nhận"
              value={formatVND(summary.vnpay_received || 0)}
              prefix={<CreditCardOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #ff4d4f' }}>
            <Statistic
              title="Tiền mặt chờ bàn giao"
              value={formatVND(summary.cash_pending || 0)}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ fontSize: 18, fontWeight: 700, color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'transactions',
              label: (
                <span>
                  <HistoryOutlined />
                  Lịch sử thanh toán
                </span>
              ),
              children: (
                <div>
                  <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                    <Select
                      allowClear
                      placeholder="Phương thức"
                      style={{ width: 140 }}
                      onChange={(val) => setFilters(f => ({ ...f, method: val, page: 1 }))}
                      suffixIcon={<FilterOutlined />}
                    >
                      <Option value="CASH">Tiền mặt</Option>
                      <Option value="VNPAY">VNPAY</Option>
                    </Select>
                    <Select
                      allowClear
                      placeholder="Trạng thái"
                      style={{ width: 160 }}
                      onChange={(val) => setFilters(f => ({ ...f, status: val, page: 1 }))}
                    >
                      {Object.entries(PAYMENT_STATUS).map(([key, val]) => (
                        <Option key={key} value={key}>{val.label}</Option>
                      ))}
                    </Select>
                    <Select
                      allowClear
                      placeholder="Đối soát tiền mặt"
                      style={{ width: 190 }}
                      onChange={(val) => setFilters(f => ({ ...f, settlement_status: val, page: 1 }))}
                    >
                      <Option value="PENDING">Chờ bàn giao</Option>
                      <Option value="SETTLED">Đã bàn giao</Option>
                    </Select>
                  </Space>

                  <Table
                    columns={columns}
                    dataSource={payments}
                    rowKey="id"
                    loading={isPaymentsLoading}
                    pagination={{
                      current: filters.page,
                      pageSize: filters.limit,
                      total: paymentsData?.pagination?.total || 0,
                      showSizeChanger: false,
                      showTotal: (total) => `Tổng ${total} giao dịch`,
                      onChange: (page) => setFilters(f => ({ ...f, page })),
                    }}
                    onRow={(record) => ({
                      onClick: () => navigate(`/admin/payments/${record.id}`),
                      style: { cursor: 'pointer' },
                    })}
                    rowClassName={() => 'clickable-row'}
                  />
                </div>
              )
            },
            {
              key: 'wallets',
              label: (
                <span>
                  <WalletOutlined />
                  Ví tiền mặt của thợ (BL-045)
                </span>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">
                      Theo dõi số tiền mặt mà từng thợ đã thu hộ từ khách hàng và quản lý bàn giao.
                    </Text>
                  </div>
                  <Table
                    columns={walletColumns}
                    dataSource={wallets}
                    rowKey="id"
                    loading={isWalletsLoading}
                    pagination={false}
                  />
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* Technician Wallet Details Modal */}
      <Modal
        title={`Ví tiền mặt thợ: ${selectedWallet?.full_name}`}
        open={!!selectedWallet}
        onCancel={() => setSelectedWallet(null)}
        width={900}
        footer={null}
      >
        {selectedWallet && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
              <Avatar 
                size={64} 
                src={selectedWallet.avatar_url} 
                icon={<UserOutlined />}
                style={{ backgroundColor: 'var(--navy)' }}
              />
              <div>
                <Title level={4} style={{ margin: 0 }}>{selectedWallet.full_name}</Title>
                <Text type="secondary">{selectedWallet.phone} · {selectedWallet.email}</Text>
              </div>
            </div>

            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#e6f7ff', border: '1px solid #91d5ff' }}>
                  <Statistic 
                    title="Tổng tiền mặt thu hộ" 
                    value={formatVND(selectedWallet.total_collected)} 
                    valueStyle={{ color: 'var(--navy)', fontSize: 16, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <Statistic 
                    title="Đã đối soát bàn giao" 
                    value={formatVND(selectedWallet.total_settled)} 
                    valueStyle={{ color: 'var(--success)', fontSize: 16, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#fff7e6', border: '1px solid #ffd591' }}>
                  <Statistic 
                    title="Chờ bàn giao" 
                    value={formatVND(selectedWallet.total_pending)} 
                    valueStyle={{ color: 'var(--orange)', fontSize: 16, fontWeight: 700 }}
                  />
                </Card>
              </Col>
            </Row>

            <Divider orientation="left" style={{ margin: '16px 0 8px' }}>Danh sách các khoản tiền mặt đã thu</Divider>

            <Table
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: selectedPaymentIds,
                onChange: (keys) => setSelectedPaymentIds(keys),
                getCheckboxProps: (record) => ({
                  disabled: record.settlement_status === 'SETTLED',
                }),
              }}
              columns={detailPaymentColumns}
              dataSource={selectedWallet.payments}
              rowKey="id"
              pagination={{ pageSize: 5 }}
            />

            {selectedPaymentIds.length > 0 && (
              <div style={{ marginTop: 16, padding: 16, border: '1px solid #ffe58f', backgroundColor: '#fffbe6', borderRadius: 8 }}>
                <Title level={5} style={{ margin: '0 0 12px 0', color: '#d46b08' }}>
                  Đối soát lô {selectedPaymentIds.length} giao dịch đã chọn
                </Title>
                <div style={{ marginBottom: 12 }}>
                  <Text strong>Tổng số tiền đối soát: </Text>
                  <Text strong style={{ color: 'var(--orange)', fontSize: 16 }}>
                    {formatVND(
                      selectedWallet.payments
                        .filter(p => selectedPaymentIds.includes(p.id))
                        .reduce((sum, p) => sum + p.amount, 0)
                    )}
                  </Text>
                </div>
                <TextArea
                  rows={2}
                  placeholder="Nhập ghi chú đối soát lô (ví dụ: Thợ đã bàn giao đủ tiền mặt tại văn phòng)"
                  value={settlementNote}
                  onChange={(e) => setSettlementNote(e.target.value)}
                  maxLength={500}
                  style={{ marginBottom: 12 }}
                />
                <div style={{ textAlign: 'right' }}>
                  <Button 
                    type="primary" 
                    icon={<CheckCircleOutlined />}
                    onClick={handleBatchSettlement}
                    loading={batchSettlementMutation.isPending}
                  >
                    Xác nhận đối soát lô
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
