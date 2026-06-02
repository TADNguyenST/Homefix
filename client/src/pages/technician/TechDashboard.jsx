import { Row, Col, Card, Typography, Statistic, Spin, Tag, Button, message, Modal, Empty, Avatar } from 'antd';
import { 
  ToolOutlined, 
  CheckCircleOutlined, 
  StarOutlined, 
  EnvironmentOutlined, 
  PhoneOutlined, 
  UserOutlined, 
  DollarCircleOutlined,
  CalendarOutlined,
  FormOutlined,
  SendOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { technicianApi } from '../../api/technicianApi';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { formatVND, formatDate, getInitials } from '../../utils/helpers';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../../utils/constants';

const { Title, Text, Paragraph } = Typography;

export default function TechDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Queries
  const { data: jobsData, isLoading: loadingJobs } = useQuery({
    queryKey: ['tech-jobs-dashboard'],
    queryFn: () => technicianApi.getJobs(),
  });

  const { data: ratingData, isLoading: loadingRating } = useQuery({
    queryKey: ['tech-rating-dashboard'],
    queryFn: () => technicianApi.getRating(),
  });

  const jobs = jobsData?.data || [];
  const avgRating = ratingData?.data?.avg_rating || 0;

  // Active jobs filter
  const activeJobsList = jobs.filter(b => ['ASSIGNED', 'IN_PROGRESS', 'INSPECTING', 'QUOTED', 'COMPLETING'].includes(b.status));
  const completedJobsList = jobs.filter(b => b.status === 'COMPLETED');
  const totalSpent = completedJobsList.filter(b => b.payment?.status === 'PAID').reduce((sum, b) => sum + Number(b.final_price || b.estimated_price || 0), 0);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => technicianApi.updateJobStatus(id, { new_status: status }),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái công việc');
      queryClient.invalidateQueries(['tech-jobs-dashboard']);
    },
    onError: (err) => {
      message.error(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  });

  const acceptJobMutation = useMutation({
    mutationFn: (id) => technicianApi.acceptJob(id),
    onSuccess: () => {
      message.success('Đã tiếp nhận đơn hàng');
      queryClient.invalidateQueries(['tech-jobs-dashboard']);
    },
    onError: (err) => {
      message.error(err.message || 'Lỗi khi tiếp nhận đơn');
    }
  });

  const confirmCashMutation = useMutation({
    mutationFn: (id) => technicianApi.confirmCash(id),
    onSuccess: () => {
      message.success('Đã xác nhận thu tiền mặt thành công!');
      queryClient.invalidateQueries(['tech-jobs-dashboard']);
    },
    onError: (err) => {
      message.error(err.message || 'Lỗi xác nhận');
    }
  });

  const handleConfirmCash = (id, amount) => {
    Modal.confirm({
      title: 'Xác nhận thu tiền mặt?',
      content: `Xác nhận bạn đã nhận đủ ${formatVND(amount)} từ khách hàng?`,
      onOk: () => {
        confirmCashMutation.mutate(id);
      }
    });
  };

  if (loadingJobs || loadingRating) {
    return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Banner Kỹ thuật viên */}
      <div className="glass-card" style={{ background: 'linear-gradient(135deg, var(--navy-dark) 0%, var(--navy) 100%)', padding: 24, borderRadius: 'var(--radius-xl)', marginBottom: 32, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 'bold' }}>
            {getInitials(user?.full_name)}
          </div>
          <div>
            <Title level={3} style={{ color: 'white', margin: 0, fontWeight: 700 }}>{user?.full_name}</Title>
            <Text style={{ color: 'var(--text-muted)', fontSize: 14 }}>Kỹ thuật viên chuyên nghiệp | Lĩnh vực sửa chữa gia dụng</Text>
          </div>
        </div>
        <Link to="/technician/schedule">
          <Button type="primary" icon={<CalendarOutlined />} style={{ background: 'var(--orange)', borderColor: 'var(--orange)' }}>
            Xem lịch đặt của tôi
          </Button>
        </Link>
      </div>

      {/* Stats Cards Row */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={8}>
          <Card className="glass-card" styles={{ body: { padding: 20 } }}>
            <Statistic 
              title={<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Doanh thu tích lũy</span>} 
              value={formatVND(totalSpent)} 
              prefix={<DollarCircleOutlined style={{ color: 'var(--success)' }} />} 
              valueStyle={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: 'var(--navy)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="glass-card" styles={{ body: { padding: 20 } }}>
            <Statistic 
              title={<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Việc chờ thi công</span>} 
              value={activeJobsList.length} 
              prefix={<ToolOutlined style={{ color: 'var(--orange)' }} />} 
              valueStyle={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: 'var(--navy)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="glass-card" styles={{ body: { padding: 20 } }}>
            <Statistic 
              title={<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Điểm đánh giá</span>} 
              value={avgRating || 'N/A'} 
              suffix="/ 5.0"
              prefix={<StarOutlined style={{ color: 'var(--warning)' }} />} 
              valueStyle={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: 'var(--navy)' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Bento Layout Grid */}
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <div style={{ marginBottom: 16 }}>
            <Title level={4} style={{ color: 'var(--navy)', margin: 0 }}><ToolOutlined /> Công việc hiện tại cần thực hiện ({activeJobsList.length})</Title>
            <Text type="secondary">Xác nhận, thi công, lập báo giá cho từng đơn hàng của bạn</Text>
          </div>

          {activeJobsList.length === 0 ? (
            <Card className="glass-card" style={{ textAlign: 'center', padding: '48px 0' }}>
              <Empty description="Bạn chưa có đơn công việc nào được giao!" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">Khi Admin phân công đơn mới, công việc sẽ xuất hiện tại đây.</Text>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {activeJobsList.map(job => {
                const colors = BOOKING_STATUS_COLORS[job.status] || { color: '#64748b', bg: '#f1f5f9' };
                return (
                  <Card 
                    key={job.id} 
                    className="glass-card fade-in-up" 
                    styles={{ body: { padding: 0 } }}
                    style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                  >
                    {/* Header: Mã Đơn & Status */}
                    <div style={{ padding: '16px 20px', background: 'rgba(248, 250, 252, 0.8)', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: 'var(--navy)', color: 'white', padding: '4px 8px', borderRadius: 6, fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>
                          #{job.id}
                        </div>
                        <Text strong style={{ color: 'var(--navy)', fontSize: 15 }}>{job.service?.name}</Text>
                      </div>
                      <Tag color={colors.bg} style={{ color: colors.color, border: 'none', fontWeight: 700, padding: '4px 12px', borderRadius: 20, margin: 0 }}>
                        {BOOKING_STATUS_LABELS[job.status]}
                      </Tag>
                    </div>

                    {/* Content */}
                    <div style={{ padding: 20 }}>
                      <Row gutter={[24, 24]}>
                        <Col xs={24} sm={12}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <Avatar size={40} style={{ backgroundColor: '#f1f5f9', color: '#475569' }}><UserOutlined /></Avatar>
                            <div>
                              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Chủ nhà</Text>
                              <Text strong style={{ fontSize: 14, color: 'var(--navy)' }}>{job.customer?.full_name}</Text>
                              <div style={{ marginTop: 4 }}>
                                <Text style={{ color: 'var(--navy)', fontWeight: 600, fontSize: 13 }}><PhoneOutlined /> {job.customer?.phone}</Text>
                              </div>
                            </div>
                          </div>
                        </Col>
                        <Col xs={24} sm={12}>
                          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 12, height: '100%' }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <ClockCircleOutlined style={{ color: 'var(--orange)', marginTop: 2 }} />
                              <div>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Lịch hẹn</Text>
                                <Text strong style={{ color: 'var(--orange)', fontSize: 13 }}>{formatDate(job.booking_date)} {job.time_slot_start || ''}</Text>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <EnvironmentOutlined style={{ color: 'var(--navy)', marginTop: 2 }} />
                              <div>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Địa chỉ</Text>
                                <Text style={{ fontSize: 13, lineHeight: 1.4 }}>{job.street_address || job.address_detail}, {job.ward?.name}, {job.district?.name}</Text>
                              </div>
                            </div>
                          </div>
                        </Col>
                      </Row>

                      {/* Yêu cầu / Mô tả */}
                      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #e2e8f0' }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Mô tả sự cố:</Text>
                        <Paragraph style={{ margin: '4px 0 0', fontSize: 14 }}>
                          {job.description || <Text type="secondary" italic>Không có mô tả</Text>}
                        </Paragraph>
                        {job.aiAnalyses?.[0]?.tech_summary && (
                          <div style={{ background: '#fef3c7', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12, color: '#b45309', display: 'flex', gap: 8 }}>
                            <RobotOutlined style={{ marginTop: 2 }} />
                            <div>
                              <strong>Gợi ý AI:</strong> {job.aiAnalyses[0].tech_summary}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Operational Technician Actions */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                      {job.status === 'ASSIGNED' && (
                        <>
                          <Button 
                            danger 
                            icon={<CloseOutlined />} 
                            onClick={() => {
                              Modal.confirm({
                                title: 'Từ chối đơn hàng này?',
                                content: 'Lý do từ chối đơn hàng để báo lại với hệ thống:',
                                icon: <CloseOutlined style={{ color: 'red' }} />,
                                onOk: async () => {
                                  try {
                                    await technicianApi.rejectJob(job.id, { reason: 'Từ chối do lịch bận đột xuất' });
                                    message.success('Đã từ chối đơn hàng');
                                    queryClient.invalidateQueries(['tech-jobs-dashboard']);
                                  } catch (err) {
                                    message.error(err.message || 'Lỗi từ chối đơn');
                                  }
                                }
                              });
                            }}
                          >
                            Từ chối
                          </Button>
                          <Button 
                            type="primary" 
                            icon={<SendOutlined />}
                            style={{ background: 'var(--navy)', borderColor: 'var(--navy)' }}
                            onClick={() => acceptJobMutation.mutate(job.id)}
                            loading={acceptJobMutation.isPending}
                          >
                            Tiếp nhận & Di chuyển
                          </Button>
                        </>
                      )}

                      {job.status === 'IN_PROGRESS' && (
                        <Button 
                          type="primary" 
                          icon={<ToolOutlined />}
                          onClick={() => updateStatusMutation.mutate({ id: job.id, status: 'INSPECTING' })}
                        >
                          Đến nơi (Bắt đầu khảo sát)
                        </Button>
                      )}

                      {job.status === 'INSPECTING' && (
                        <Link to={`/technician/jobs/${job.id}/quotation`}>
                          <Button type="primary" icon={<FormOutlined />} style={{ background: 'var(--orange)', borderColor: 'var(--orange)' }}>
                            Khảo sát xong (Lập báo giá)
                          </Button>
                        </Link>
                      )}

                      {job.status === 'QUOTED' && (
                        <Text type="secondary" italic style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Spin size="small" /> Đã gửi báo giá chi tiết, đang chờ khách hàng duyệt...
                        </Text>
                      )}

                      {job.status === 'COMPLETING' && (
                        <Button 
                          type="primary" 
                          icon={<CheckCircleOutlined />}
                          style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                          onClick={() => updateStatusMutation.mutate({ id: job.id, status: 'COMPLETED' })}
                        >
                          Hoàn tất sửa chữa
                        </Button>
                      )}

                      {job.status === 'COMPLETED' && job.payment?.method === 'CASH' && job.payment?.status === 'UNPAID' && (
                        <Button 
                          type="primary" 
                          icon={<DollarCircleOutlined />}
                          style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                          onClick={() => handleConfirmCash(job.id, Number(job.final_price || job.estimated_price || 0))}
                        >
                          Thu tiền mặt & Xác nhận thanh toán
                        </Button>
                      )}

                      {job.status === 'COMPLETED' && (job.payment?.status === 'PAID') && (
                        <Tag color="success" style={{ fontWeight: 600, padding: '4px 12px' }}>Đơn hàng hoàn tất & Đã thanh toán</Tag>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Col>

      </Row>
    </div>
  );
}
