import { useState } from 'react';
import { Card, Col, Empty, Row, Tag, Typography, Button, Space, message, Progress } from 'antd';
import { CopyOutlined, CheckOutlined, GiftOutlined, CalendarOutlined, FireOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { bookingApi } from '../../api/bookingApi';
import { formatVND } from '../../utils/helpers';

const { Title, Text } = Typography;

const getVoucherTitle = (voucher) => {
  if (voucher.discount_type === 'PERCENTAGE') {
    const cap = voucher.max_discount ? `, tối đa ${formatVND(voucher.max_discount)}` : '';
    return `Giảm ${Number(voucher.discount_value)}%${cap}`;
  }
  return `Giảm ${formatVND(voucher.discount_value)}`;
};

export default function CustomerVouchersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['available-vouchers'],
    queryFn: bookingApi.getAvailableVouchers,
  });

  const [copiedCode, setCopiedCode] = useState(null);

  const vouchers = data?.data || [];

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      message.success(`Đã sao chép mã voucher ${code}`);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      message.info(`Mã voucher: ${code}`);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <GiftOutlined style={{ color: 'var(--orange)' }} />
          <span>Kho Voucher Của Bạn</span>
        </Title>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Sử dụng các mã giảm giá đặc quyền dưới đây khi đặt dịch vụ tại Homefix để nhận ưu đãi hấp dẫn nhất.
        </p>
      </div>

      {vouchers.length === 0 && !isLoading ? (
        <Card className="glass-card" style={{ padding: '40px 24px', textAlign: 'center', borderRadius: 'var(--radius-xl)' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Text strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>Không tìm thấy voucher khả dụng</Text>
                <Text type="secondary">Tất cả voucher đã được sử dụng hoặc đã hết hạn.</Text>
              </Space>
            }
          />
        </Card>
      ) : (
        <Row gutter={[24, 24]}>
          {vouchers.map((voucher) => {
            const usagePercent = Math.min(100, Math.round((voucher.used_count / voucher.usage_limit) * 100));
            const remainingUses = Math.max(0, voucher.usage_limit - voucher.used_count);
            
            // Check if expiring within 3 days
            const daysLeft = dayjs(voucher.end_date).diff(dayjs(), 'day');
            const isExpiringSoon = daysLeft >= 0 && daysLeft <= 3;
            
            return (
              <Col xs={24} md={12} xl={8} key={voucher.id}>
                <Card
                  loading={isLoading}
                  className="glass-card hover-card"
                  style={{
                    height: '100%',
                    borderRadius: 'var(--radius-xl)',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                  }}
                  bodyStyle={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
                >
                  {/* Decorative Ticket Layout background elements */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: -10,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#f8fafc',
                    boxShadow: 'inset -3px 0 3px rgba(0,0,0,0.05)',
                    transform: 'translateY(-50%)',
                    zIndex: 10
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    right: -10,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#f8fafc',
                    boxShadow: 'inset 3px 0 3px rgba(0,0,0,0.05)',
                    transform: 'translateY(-50%)',
                    zIndex: 10
                  }} />

                  <div>
                    {/* Header: Code & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Tag color="orange" style={{ fontWeight: 800, fontSize: 13, padding: '4px 12px', border: '1px solid #fb923c' }}>
                        {voucher.code}
                      </Tag>
                      
                      {isExpiringSoon ? (
                        <Tag color="error" icon={<FireOutlined />} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          Sắp hết hạn ({daysLeft} ngày)
                        </Tag>
                      ) : (
                        <Tag color="success" style={{ fontWeight: 500 }}>
                          Khả dụng
                        </Tag>
                      )}
                    </div>

                    {/* Body: Value */}
                    <Title level={4} style={{ margin: '0 0 8px 0', color: 'var(--navy)', fontWeight: 700 }}>
                      {getVoucherTitle(voucher)}
                    </Title>

                    {/* Body: Min Order Amount */}
                    <div style={{ marginBottom: 16 }}>
                      <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                        Áp dụng đơn tối thiểu từ: <Text strong style={{ color: 'var(--text-primary)' }}>{formatVND(voucher.min_order_amount || 0)}</Text>
                      </Text>
                    </div>

                    {/* Progress limit bar */}
                    <div style={{ margin: '16px 0 20px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                        <Text type="secondary">Đã dùng trên hệ thống</Text>
                        <Text strong>{voucher.used_count}/{voucher.usage_limit}</Text>
                      </div>
                      <Progress 
                        percent={usagePercent} 
                        strokeColor={{
                          '0%': 'var(--orange-light)',
                          '100%': 'var(--orange)',
                        }}
                        trailColor="#e2e8f0"
                        showInfo={false}
                        status="active"
                        strokeWidth={6}
                      />
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                        Bạn còn: <Text strong style={{ color: 'var(--success)' }}>{remainingUses} lượt dùng</Text>
                      </Text>
                    </div>
                  </div>

                  {/* Footer Action & Exp Date */}
                  <div style={{ marginTop: 'auto' }}>
                    <div style={{
                      borderTop: '1px dashed #cbd5e1',
                      paddingTop: 16,
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <CalendarOutlined /> Hạn dùng: {dayjs(voucher.end_date).format('DD/MM/YYYY')}
                      </span>
                    </div>

                    <Button
                      type={copiedCode === voucher.code ? 'dashed' : 'primary'}
                      icon={copiedCode === voucher.code ? <CheckOutlined style={{ color: 'var(--success)' }} /> : <CopyOutlined />}
                      onClick={() => copyCode(voucher.code)}
                      block
                      style={{
                        height: 40,
                        fontWeight: 600,
                        backgroundColor: copiedCode === voucher.code ? '#f0fdf4' : undefined,
                        borderColor: copiedCode === voucher.code ? 'var(--success)' : undefined,
                        color: copiedCode === voucher.code ? 'var(--success)' : undefined,
                      }}
                    >
                      {copiedCode === voucher.code ? 'Đã sao chép' : 'Sao chép mã'}
                    </Button>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
