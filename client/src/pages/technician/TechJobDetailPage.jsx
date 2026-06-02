import { useState } from 'react';
import { Card, Steps, Button, Typography, Tag, Descriptions, Space, Spin, message, Divider, Modal, Alert } from 'antd';
import { EnvironmentOutlined, PhoneOutlined, UserOutlined, FormOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { technicianApi } from '../../api/technicianApi';
import { bookingApi } from '../../api/bookingApi'; // fallback or shared
import { useParams, useNavigate } from 'react-router-dom';
import { formatVND, formatDate, formatDateTime } from '../../utils/helpers';
import { BOOKING_STATUS_STEPS, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../../utils/constants';

const { Title, Text } = Typography;

export default function TechJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loadingAction, setLoadingAction] = useState(false);

  const { data: jobData, isLoading, refetch } = useQuery({
    queryKey: ['tech-job', id],
    queryFn: () => technicianApi.getJobById(id),
  });

  const job = jobData?.data;

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  if (!job) return <div>Không tìm thấy đơn hàng</div>;

  const currentStepIndex = BOOKING_STATUS_STEPS.indexOf(job.status);
  const colorCfg = BOOKING_STATUS_COLORS[job.status] || { color: '#000', bg: '#eee' };

  const handleUpdateStatus = async (newStatus) => {
    try {
      setLoadingAction(true);
      await technicianApi.updateJobStatus(id, { new_status: newStatus });
      message.success(`Đã cập nhật trạng thái: ${BOOKING_STATUS_LABELS[newStatus]}`);
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi cập nhật trạng thái');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleConfirmCash = () => {
    Modal.confirm({
      title: 'Xác nhận thu tiền mặt?',
      content: `Bạn xác nhận đã thu đủ số tiền ${formatVND(Number(job.final_price || job.estimated_price || 0))} từ khách hàng?`,
      onOk: async () => {
        try {
          await technicianApi.confirmCash(id);
          message.success('Đã xác nhận thu tiền mặt');
          refetch();
        } catch (err) {
          message.error(err.message || 'Lỗi xác nhận');
        }
      }
    });
  };

  const renderActionButtons = () => {
    switch (job.status) {
      case 'ASSIGNED':
        return (
          <Button type="primary" onClick={() => handleUpdateStatus('IN_PROGRESS')} loading={loadingAction}>
            Bắt đầu di chuyển
          </Button>
        );
      case 'IN_PROGRESS':
        return (
          <Button type="primary" onClick={() => handleUpdateStatus('INSPECTING')} loading={loadingAction}>
            Đã đến nơi (Bắt đầu khảo sát)
          </Button>
        );
      case 'INSPECTING':
        return (
          <Button type="primary" icon={<FormOutlined />} onClick={() => navigate(`/technician/jobs/${id}/quotation`)}>
            Tạo báo giá
          </Button>
        );
      case 'QUOTED':
        return (
          <Alert message="Chờ khách hàng duyệt báo giá" type="info" showIcon />
        );
      case 'COMPLETING':
        return (
          <Button type="primary" onClick={() => handleUpdateStatus('COMPLETED')} loading={loadingAction}>
            Hoàn thành sửa chữa
          </Button>
        );
      case 'COMPLETED':
        if (job.payment_method === 'CASH' && job.payment?.status === 'UNPAID') {
          return (
            <Button type="primary" style={{ background: 'var(--success)' }} onClick={handleConfirmCash}>
              Đã thu tiền mặt
            </Button>
          );
        }
        return <Tag color="success">Công việc đã hoàn tất</Tag>;
      default:
        return null;
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>
            Công việc #{job.id}
          </Title>
          <Space>
            <Tag color={colorCfg.bg} style={{ color: colorCfg.color, border: 'none', fontWeight: 600, padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>
              {BOOKING_STATUS_LABELS[job.status]}
            </Tag>
            <Text type="secondary">Tạo lúc: {formatDateTime(job.created_at)}</Text>
          </Space>
        </div>
        <Space>
          {renderActionButtons()}
        </Space>
      </div>

      <Card className="glass-card" style={{ marginBottom: 24 }}>
        <Steps 
          current={currentStepIndex >= 0 ? currentStepIndex : 0} 
          items={BOOKING_STATUS_STEPS.map(status => ({
            title: BOOKING_STATUS_LABELS[status],
          }))} 
        />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <Space direction="vertical" size="large" style={{ display: 'flex' }}>
          <Card title="Chi tiết công việc" className="glass-card">
            <Descriptions column={1} labelStyle={{ fontWeight: 500, color: 'var(--text-secondary)', width: 150 }}>
              <Descriptions.Item label="Dịch vụ"><Text strong>{job.service?.name}</Text></Descriptions.Item>
              <Descriptions.Item label="Khách yêu cầu">{formatDate(job.booking_date)} {job.time_slot_start || ''} - {job.time_slot_end || ''}</Descriptions.Item>
              <Descriptions.Item label="Mô tả sự cố">{job.description}</Descriptions.Item>
              {job.aiAnalyses?.[0]?.tech_summary && (
                <Descriptions.Item label="AI Chẩn đoán">
                  <div style={{ background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                    {job.aiAnalyses[0].tech_summary}
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {['QUOTED', 'COMPLETING', 'COMPLETED'].includes(job.status) && (
            <Card title="Báo giá & Thanh toán" className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text>Tổng tiền dịch vụ và vật tư:</Text>
                <Title level={4} style={{ color: 'var(--orange)', margin: 0 }}>{formatVND(Number(job.final_price || job.estimated_price || 0))}</Title>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text>Hình thức thanh toán:</Text>
                <Text strong>{job.payment_method === 'VNPAY' ? 'Chuyển khoản / VNPAY' : 'Tiền mặt'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Trạng thái thanh toán:</Text>
                <Tag color={job.payment?.status === 'PAID' ? 'success' : 'warning'}>
                  {job.payment?.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                </Tag>
              </div>
            </Card>
          )}
        </Space>

        <Space direction="vertical" size="large" style={{ display: 'flex' }}>
          <Card title="Thông tin Khách hàng" className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--navy)' }}>
                <UserOutlined />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{job.customer?.full_name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Khách hàng</div>
              </div>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <PhoneOutlined style={{ color: 'var(--text-secondary)' }} />
              <Text>{job.customer?.phone}</Text>
            </div>
          </Card>

          <Card title="Địa điểm thực hiện" className="glass-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <EnvironmentOutlined style={{ color: 'var(--orange)', marginTop: 4 }} />
              <div>
                <Text strong style={{ display: 'block' }}>Địa chỉ:</Text>
                <Text type="secondary">{job.address_detail || 'Đang cập nhật'}, {job.ward?.name}, {job.district?.name}</Text>
              </div>
            </div>
          </Card>
        </Space>
      </div>
    </div>
  );
}