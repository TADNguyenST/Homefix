import { Card, Col, Empty, Row, Tag, Typography, Button, Space, message } from 'antd';
import { CopyOutlined, GiftOutlined } from '@ant-design/icons';
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

  const vouchers = data?.data || [];

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      message.success(`Đã sao chép mã ${code}`);
    } catch {
      message.info(`Mã voucher: ${code}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Voucher khả dụng</Title>
        <p>Danh sách mã khuyến mãi còn hiệu lực và chưa được bạn sử dụng</p>
      </div>

      {vouchers.length === 0 && !isLoading ? (
        <Card className="glass-card">
          <Empty description="Hiện chưa có voucher khả dụng" />
        </Card>
      ) : (
        <Row gutter={[20, 20]}>
          {vouchers.map((voucher) => (
            <Col xs={24} md={12} xl={8} key={voucher.id}>
              <Card
                loading={isLoading}
                className="glass-card"
                style={{ height: '100%', borderTop: '4px solid var(--orange)' }}
              >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Tag color="orange" style={{ fontWeight: 700, fontSize: 14, padding: '4px 10px' }}>
                      {voucher.code}
                    </Tag>
                    <GiftOutlined style={{ color: 'var(--orange)', fontSize: 22 }} />
                  </Space>

                  <Title level={4} style={{ margin: 0, color: 'var(--navy)' }}>
                    {getVoucherTitle(voucher)}
                  </Title>

                  <Text type="secondary">
                    Đơn tối thiểu: {formatVND(voucher.min_order_amount || 0)}
                  </Text>
                  <Text type="secondary">
                    Còn {Math.max(0, voucher.usage_limit - voucher.used_count)} lượt, hết hạn {dayjs(voucher.end_date).format('DD/MM/YYYY')}
                  </Text>

                  <Button icon={<CopyOutlined />} onClick={() => copyCode(voucher.code)} block>
                    Sao chép mã
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
