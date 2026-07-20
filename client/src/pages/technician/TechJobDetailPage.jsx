import { useState } from 'react';
import { Card, Steps, Button, Typography, Tag, Descriptions, Space, Spin, message, Divider, Modal, Alert, Form, Input, Upload, Image } from 'antd';
import { EnvironmentOutlined, PhoneOutlined, UserOutlined, FormOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { technicianApi } from '../../api/technicianApi';
import { uploadApi } from '../../api/bookingApi';
import { useParams, useNavigate } from 'react-router-dom';
import { formatVND, formatDate, formatDateTime } from '../../utils/helpers';
import { BOOKING_STATUS_STEPS, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../../utils/constants';

const { Title, Text } = Typography;

const toNumber = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function TechJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loadingAction, setLoadingAction] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);

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
  const currentQuotation = job.quotations?.find(q => q.status === 'PENDING')
    || job.quotations?.find(q => q.status === 'ACCEPTED')
    || job.quotations?.[0];
  const quotationSubtotal = currentQuotation
    ? toNumber(currentQuotation.total_extra_price)
    : toNumber(job.final_price ?? job.payment?.amount ?? job.estimated_price);
  const discountAmount = currentQuotation ? toNumber(job.discount_amount) : 0;
  const payableAmount = currentQuotation
    ? Math.max(0, quotationSubtotal - discountAmount)
    : toNumber(job.final_price ?? job.payment?.amount ?? job.estimated_price);

  const customerImages = job.images?.filter(img => img.uploaded_by === 'CUSTOMER') || [];
  const technicianImages = job.images?.filter(img => img.uploaded_by === 'TECHNICIAN') || [];
  const completionHistory = job.statusHistories?.find(h => h.to_status === 'AWAITING_PAYMENT');
  const completionNoteText = completionHistory?.note;

  const resolveImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `http://localhost:5000${url}`;
  };

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
      content: `Bạn xác nhận đã thu đủ số tiền ${formatVND(payableAmount)} từ khách hàng?`,
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

  const handleSubmitCompletion = async () => {
    if (!completionNote.trim()) {
      message.error('Vui lòng nhập ghi chú bàn giao / biên bản nghiệm thu');
      return;
    }

    try {
      setUploading(true);
      const uploadedImageUrls = [];

      // 1. Tải ảnh lên tuần tự
      if (fileList.length > 0) {
        for (const file of fileList) {
          const uploadResult = await uploadApi.image(file.originFileObj);
          if (uploadResult.data?.url) {
            uploadedImageUrls.push(uploadResult.data.url);
          }
        }
      }

      // 2. Gọi API cập nhật trạng thái kèm ảnh và ghi chú
      await technicianApi.updateJobStatus(id, {
        new_status: 'AWAITING_PAYMENT',
        note: completionNote,
        image_urls: uploadedImageUrls,
      });

      message.success('Đã báo cáo hoàn thành sửa chữa thành công');
      setIsCompletionModalOpen(false);
      setCompletionNote('');
      setFileList([]);
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi báo cáo hoàn thành');
    } finally {
      setUploading(false);
    }
  };

  const renderActionButtons = () => {
    switch (job.status) {
      case 'ASSIGNED':
        return (
          <Space>
            <Button type="primary" onClick={async () => {
              try {
                setLoadingAction(true);
                await technicianApi.acceptJob(id);
                message.success('Đã nhận công việc và chuyển sang trạng thái đang thực hiện');
                refetch();
              } catch (err) {
                message.error(err.message || 'Lỗi khi nhận việc');
              } finally {
                setLoadingAction(false);
              }
            }} loading={loadingAction}>
              Nhận công việc (Bắt đầu di chuyển)
            </Button>
            <Button danger onClick={() => {
              let reason = '';
              Modal.confirm({
                title: 'Từ chối công việc?',
                content: (
                  <div style={{ marginTop: 12 }}>
                    <p>Vui lòng nhập lý do từ chối:</p>
                    <textarea 
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #d9d9d9', outline: 'none' }} 
                      rows={3}
                      placeholder="Lý do từ chối nhận đơn..."
                      onChange={(e) => { reason = e.target.value; }}
                    />
                  </div>
                ),
                onOk: async () => {
                  try {
                    setLoadingAction(true);
                    await technicianApi.rejectJob(id, { reason });
                    message.success('Đã từ chối công việc');
                    navigate('/technician/jobs');
                  } catch (err) {
                    message.error(err.message || 'Lỗi khi từ chối việc');
                  } finally {
                    setLoadingAction(false);
                  }
                }
              });
            }} loading={loadingAction}>
              Từ chối nhận việc
            </Button>
          </Space>
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
          <Button type="primary" onClick={() => setIsCompletionModalOpen(true)}>
            Hoàn thành sửa chữa
          </Button>
        );
      case 'AWAITING_PAYMENT':
        if (job.payment_method === 'CASH' && job.payment?.status === 'UNPAID') {
          return (
            <Button type="primary" style={{ background: 'var(--success)' }} onClick={handleConfirmCash}>
              Đã thu tiền mặt
            </Button>
          );
        }
        return <Tag color="warning">Chờ khách hàng thanh toán</Tag>;
      case 'COMPLETED':
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

          {['QUOTED', 'COMPLETING', 'AWAITING_PAYMENT', 'COMPLETED'].includes(job.status) && (
            <Card title="Báo giá & Thanh toán" className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text>Tạm tính báo giá:</Text>
                <Text strong>{formatVND(quotationSubtotal)}</Text>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text type="success">Giảm giá voucher:</Text>
                  <Text strong style={{ color: 'var(--success)' }}>- {formatVND(discountAmount)}</Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text>Khách cần thanh toán:</Text>
                <Title level={4} style={{ color: 'var(--orange)', margin: 0 }}>{formatVND(payableAmount)}</Title>
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
              {job.payment_method === 'CASH' && job.payment?.status === 'PAID' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                  <Text>Trạng thái bàn giao:</Text>
                  <Tag color={job.payment?.settlement_status === 'SETTLED' ? 'success' : 'warning'}>
                    {job.payment?.settlement_status === 'SETTLED'
                      ? 'HomeFix đã nhận tiền'
                      : 'Chờ bàn giao cho HomeFix'}
                  </Tag>
                </div>
              )}
            </Card>
          )}

          {customerImages.length > 0 && (
            <Card title="Hình ảnh sự cố (Khách hàng cung cấp)" className="glass-card">
              <Image.PreviewGroup>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                  {customerImages.map(image => (
                    <Image
                      key={image.id}
                      src={resolveImageUrl(image.image_url)}
                      alt="Incident evidence"
                      style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                    />
                  ))}
                </div>
              </Image.PreviewGroup>
            </Card>
          )}

          {(technicianImages.length > 0 || completionNoteText) && (
            <Card title="Biên bản nghiệm thu & Ảnh sau sửa" className="glass-card" styles={{ body: { padding: 24 } }} style={{ border: '1px solid var(--success-border)', background: '#f8fafc' }}>
              {completionNoteText && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ display: 'block', marginBottom: 6, color: 'var(--navy)' }}>Ghi chú bàn giao nghiệm thu:</Text>
                  <div style={{ padding: '12px 16px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', fontStyle: 'italic', color: 'var(--text-primary)' }}>
                    "{completionNoteText}"
                  </div>
                </div>
              )}
              {technicianImages.length > 0 && (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8, color: 'var(--navy)' }}>Hình ảnh nghiệm thu thực tế:</Text>
                  <Image.PreviewGroup>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                      {technicianImages.map(image => (
                        <Image
                          key={image.id}
                          src={resolveImageUrl(image.image_url)}
                          alt="Repair completion evidence"
                          style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                        />
                      ))}
                    </div>
                  </Image.PreviewGroup>
                </div>
              )}
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

      <Modal
        title="Báo cáo hoàn thành sửa chữa"
        open={isCompletionModalOpen}
        confirmLoading={uploading}
        onOk={handleSubmitCompletion}
        onCancel={() => {
          if (!uploading) {
            setIsCompletionModalOpen(false);
            setCompletionNote('');
            setFileList([]);
          }
        }}
        okText="Xác nhận hoàn thành"
        cancelText="Hủy"
        destroyOnClose
      >
        <div style={{ margin: '16px 0' }}>
          <Text type="secondary">
            Vui lòng nhập ghi chú nghiệm thu và tải lên hình ảnh nghiệm thu thực tế sau khi đã sửa chữa xong thiết bị.
          </Text>
        </div>
        
        <Form layout="vertical">
          <Form.Item 
            label="Ghi chú bàn giao / Biên bản nghiệm thu" 
            required 
            help="Mô tả công việc đã thực hiện, linh kiện thay thế nếu có..."
          >
            <Input.TextArea
              rows={4}
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="Ví dụ: Đã vệ sinh sạch sẽ máy lạnh, nạp gas và sửa bo mạch điều khiển. Máy chạy mát, chạy êm và không còn chảy nước..."
              disabled={uploading}
            />
          </Form.Item>

          <Form.Item label="Hình ảnh sau sửa chữa (Tối đa 3 ảnh)">
            <Upload
              listType="picture-card"
              fileList={fileList}
              onChange={({ fileList: newFileList }) => setFileList(newFileList)}
              beforeUpload={() => false}
              maxCount={3}
              accept="image/*"
              disabled={uploading}
            >
              {fileList.length >= 3 ? null : (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>Tải ảnh lên</div>
                </div>
              )}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
