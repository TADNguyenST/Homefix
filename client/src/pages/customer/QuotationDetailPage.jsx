import { useState } from 'react';
import { Card, Table, Typography, Button, Space, message, Tag, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { quotationApi } from '../../api/bookingApi';
import { formatVND, formatDateTime } from '../../utils/helpers';

const { Title, Text } = Typography;

const toNumber = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const { data: quotationData, isLoading, refetch } = useQuery({
    queryKey: ['quotation-detail', id],
    queryFn: () => quotationApi.getById(id),
  });

  const quotation = quotationData?.data;

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  if (!quotation) {
    return <div>Không tìm thấy báo giá</div>;
  }

  const quotationItems = quotation.quotationItems || quotation.items || [];
  const quotationSubtotal = quotationItems.reduce(
    (sum, item) => sum + (toNumber(item.quantity) * toNumber(item.unit_price)),
    0
  );
  const discountAmount = toNumber(quotation.booking?.discount_amount);
  const payableAmount = Math.max(0, quotationSubtotal - discountAmount);

  const columns = [
    {
      title: 'Tên vật tư / Dịch vụ',
      dataIndex: 'item_name',
      key: 'item_name',
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (price) => formatVND(toNumber(price)),
    },
    {
      title: 'Thành tiền',
      key: 'total',
      render: (_, record) => <Text strong>{formatVND(toNumber(record.quantity) * toNumber(record.unit_price))}</Text>,
    },
  ];

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      await quotationApi.accept(quotation.id);
      message.success('Đã duyệt báo giá thành công!');
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi duyệt báo giá');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    try {
      setIsRejecting(true);
      await quotationApi.reject(quotation.id);
      message.success('Đã từ chối báo giá');
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi từ chối báo giá');
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>
            Chi tiết báo giá
          </Title>
          <Text type="secondary">Cập nhật lúc: {formatDateTime(quotation.updated_at)}</Text>
        </div>
        <Tag color={quotation.status === 'ACCEPTED' ? 'success' : quotation.status === 'REJECTED' ? 'error' : 'warning'} style={{ fontSize: 14, padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>
          {quotation.status === 'ACCEPTED' ? 'Đã duyệt' : quotation.status === 'REJECTED' ? 'Đã từ chối' : 'Chờ duyệt'}
        </Tag>
      </div>

      <Card className="glass-card" style={{ marginBottom: 24 }}>
        <Table 
          columns={columns} 
          dataSource={quotationItems}
          rowKey={(record, index) => index}
          pagination={false}
          summary={() => {
            return (
              <>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3} align="right">
                    <Text strong>Tạm tính báo giá:</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text strong>{formatVND(quotationSubtotal)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                {discountAmount > 0 && (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3} align="right">
                      <Text type="success" strong>Giảm giá voucher:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong style={{ color: 'var(--success)' }}>- {formatVND(discountAmount)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3} align="right">
                    <Text strong>Khách cần thanh toán:</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text strong style={{ color: 'var(--orange)', fontSize: 18 }}>{formatVND(payableAmount)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </>
            );
          }}
        />
      </Card>

      {quotation.status === 'PENDING' && (
        <Card className="glass-card" style={{ textAlign: 'center' }}>
          <Title level={4} style={{ marginBottom: 16 }}>Xác nhận báo giá</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            Vui lòng kiểm tra kỹ các hạng mục. Sau khi bạn xác nhận, kỹ thuật viên sẽ tiến hành sửa chữa.
          </Text>
          <Space size="large">
            <Button size="large" onClick={handleReject} loading={isRejecting} icon={<CloseCircleOutlined />}>
              Từ chối báo giá
            </Button>
            <Button size="large" type="primary" onClick={handleAccept} loading={isAccepting} icon={<CheckCircleOutlined />}>
              Đồng ý & Bắt đầu sửa
            </Button>
          </Space>
        </Card>
      )}

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Button onClick={() => navigate(`/customer/bookings/${quotation.booking_id}`)}>
          Quay lại đơn đặt lịch
        </Button>
      </div>
    </div>
  );
}
