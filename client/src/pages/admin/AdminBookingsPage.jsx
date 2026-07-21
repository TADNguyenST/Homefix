import { useState } from 'react';
import { Button, Descriptions, Drawer, Form, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, RobotOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatDate, formatVND } from '../../utils/helpers';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '../../utils/constants';

const { Title, Text } = Typography;
const { Option } = Select;

const isInspectionBooking = (booking) => (
  booking?.service?.name?.trim().toLowerCase().startsWith('khảo sát')
);

const hasMatchingSkill = (technician, booking) => technician.skills?.some((skill) => (
  skill.service_id === booking?.service_id ||
  (isInspectionBooking(booking) &&
    skill.service?.category_id === booking?.service?.category_id &&
    skill.service?.is_active !== false)
));

export default function AdminBookingsPage() {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedTechId, setSelectedTechId] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [recommendedTechs, setRecommendedTechs] = useState([]);
  const [recommendClicked, setRecommendClicked] = useState(false);

  const { data: bookingsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: () => adminApi.getBookings(),
  });

  const { data: techsData } = useQuery({
    queryKey: ['admin-technicians'],
    queryFn: () => adminApi.getTechnicians({ limit: 100 }),
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-booking-detail', selectedBooking?.id],
    queryFn: () => adminApi.getBookingById(selectedBooking.id),
    enabled: !!selectedBooking?.id && detailOpen,
  });

  const bookings = bookingsData?.data || [];
  const technicianList = techsData?.data?.data || techsData?.data || [];
  const technicians = technicianList.filter(
    (tech) => tech.user?.is_active !== false && tech.user?.is_locked !== true
  );
  const bookingDetail = detailData?.data || selectedBooking;

  const openAssign = (booking) => {
    setSelectedBooking(booking);
    setSelectedTechId(booking.technician_profile_id || null);
    setRecommendedTechs([]);
    setRecommendClicked(false);
    setAssignModalOpen(true);
  };

  const openDetail = (booking) => {
    setSelectedBooking(booking);
    setDetailOpen(true);
  };

  const confirmBooking = (booking) => {
    Modal.confirm({
      title: `Xác nhận đơn #${booking.id}?`,
      content: 'Sau khi xác nhận, đơn sẽ chuyển sang trạng thái chờ phân công kỹ thuật viên.',
      okText: 'Xác nhận',
      cancelText: 'Đóng',
      onOk: async () => {
        await adminApi.confirmBooking(booking.id);
        message.success('Đã xác nhận đơn hàng');
        refetch();
      },
    });
  };

  const assignTech = async () => {
    if (!selectedTechId) {
      message.warning('Vui lòng chọn kỹ thuật viên');
      return;
    }

    try {
      setLoadingAction(true);
      const payload = { technician_profile_id: selectedTechId };
      if (selectedBooking.technician_profile_id) {
        await adminApi.reassignTech(selectedBooking.id, payload);
        message.success('Đã chuyển kỹ thuật viên thành công');
      } else {
        await adminApi.assignTech(selectedBooking.id, payload);
        message.success('Đã phân công kỹ thuật viên thành công');
      }
      setAssignModalOpen(false);
      refetch();
    } catch (err) {
      message.error(err.message || 'Lỗi khi phân công');
    } finally {
      setLoadingAction(false);
    }
  };

  const recommendTech = async () => {
    try {
      setLoadingAction(true);
      setRecommendClicked(true);
      setRecommendedTechs([]);
      const res = await adminApi.recommendTech(selectedBooking.id);
      const suggestions = Array.isArray(res.data)
        ? res.data
        : res.data?.technicians || [];
      setRecommendedTechs(suggestions);
      if (suggestions[0]?.id) {
        setSelectedTechId(suggestions[0].id);
      }
      if (suggestions.length > 0) {
        message.success(`Đã tìm thấy ${suggestions.length} kỹ thuật viên phù hợp`);
      } else {
        message.info('Không có kỹ thuật viên đáp ứng đủ kỹ năng, khu vực và lịch làm việc');
      }
    } catch (err) {
      setRecommendedTechs([]);
      message.error(err.message || 'Không thể lấy gợi ý AI');
    } finally {
      setLoadingAction(false);
    }
  };

  const cancelBooking = (booking) => {
    Modal.confirm({
      title: `Hủy đơn #${booking.id}?`,
      content: 'Chỉ hủy các đơn chưa hoàn tất. Nếu có voucher, hệ thống sẽ hoàn lượt sử dụng.',
      okText: 'Hủy đơn',
      okButtonProps: { danger: true },
      onOk: async () => {
        await adminApi.cancelBooking(booking.id, { reason: 'Admin hủy đơn' });
        message.success('Đã hủy đơn hàng');
        refetch();
      },
    });
  };

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <span style={{ fontWeight: 700 }}>#{id}</span>,
    },
    {
      title: 'Dịch vụ',
      dataIndex: ['service', 'name'],
      key: 'service',
      render: (text) => <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{text}</span>,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, record) => record.customer?.full_name || 'N/A',
    },
    {
      title: 'Kỹ thuật viên',
      key: 'technician',
      render: (_, record) => record.technicianProfile
        ? record.technicianProfile.user?.full_name
        : <Text type="danger">Chưa phân công</Text>,
    },
    {
      title: 'Ngày hẹn',
      key: 'booking_date',
      render: (_, record) => `${formatDate(record.booking_date)} ${record.time_slot_start || ''}`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colorCfg = BOOKING_STATUS_COLORS[status] || {};
        return (
          <Tag color={colorCfg.bg} style={{ color: colorCfg.color, border: 'none', fontWeight: 600 }}>
            {BOOKING_STATUS_LABELS[status] || status}
          </Tag>
        );
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>Chi tiết</Button>
          {record.status === 'PENDING' && (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => confirmBooking(record)}>
              Xác nhận
            </Button>
          )}
          {record.status === 'CONFIRMED' && !record.technicianProfile && (
            <Button size="small" type="primary" icon={<UserSwitchOutlined />} onClick={() => openAssign(record)}>
              Phân công
            </Button>
          )}
          {record.status === 'ASSIGNED' && record.technicianProfile && (
            <Button size="small" type="primary" icon={<UserSwitchOutlined />} onClick={() => openAssign(record)}>
              Chuyển thợ
            </Button>
          )}
          {!['AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED'].includes(record.status) && (
            <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => cancelBooking(record)}>Hủy</Button>
          )}
        </Space>
      ),
    },
  ];

  const sortedTechnicians = [...technicians].sort((a, b) => {
    if (!selectedBooking) return 0;
    const aMatchSkill = hasMatchingSkill(a, selectedBooking) ? 1 : 0;
    const bMatchSkill = hasMatchingSkill(b, selectedBooking) ? 1 : 0;
    if (aMatchSkill !== bMatchSkill) return bMatchSkill - aMatchSkill;

    const aMatchDistrict = (a.district_id === selectedBooking.district_id || !a.district_id) ? 1 : 0;
    const bMatchDistrict = (b.district_id === selectedBooking.district_id || !b.district_id) ? 1 : 0;
    if (aMatchDistrict !== bMatchDistrict) return bMatchDistrict - aMatchDistrict;

    return (b.is_available ? 1 : 0) - (a.is_available ? 1 : 0);
  });

  const getTechOptionLabel = (tech) => {
    if (!selectedBooking) return tech.user?.full_name || '';
    const isMatchingSkill = hasMatchingSkill(tech, selectedBooking);
    const isSameDistrict = tech.district_id === selectedBooking.district_id || !tech.district_id;
    
    let labels = [];
    if (!isMatchingSkill) labels.push('Thiếu kỹ năng');
    if (!isSameDistrict) labels.push('Khác quận');
    if (!tech.is_available) labels.push('Bận');
    
    const statusText = labels.length > 0 ? ` [⚠️ ${labels.join(', ')}]` : ' [✓ Phù hợp]';
    return `${tech.user?.full_name} - ${tech.district?.name || 'Toàn TP'} - ${Number(tech.avg_rating || 0).toFixed(1)} sao ${statusText}`;
  };

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Quản lý đơn đặt lịch</Title>
        <p>Theo dõi và điều phối công việc cho kỹ thuật viên</p>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        <Table
          columns={columns}
          dataSource={bookings}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          scroll={{ x: 1100 }}
        />
      </div>

      <Modal
        title={selectedBooking?.technician_profile_id ? 'Chuyển kỹ thuật viên' : 'Phân công kỹ thuật viên'}
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        onOk={assignTech}
        confirmLoading={loadingAction}
        okText="Xác nhận"
        cancelText="Đóng"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button icon={<RobotOutlined />} onClick={recommendTech} loading={loadingAction}>
            Gợi ý kỹ thuật viên bằng AI
          </Button>
          {recommendClicked && (
            recommendedTechs.length > 0 ? (
              <div style={{ background: '#f5f7fa', padding: 12, borderRadius: 8, border: '1px solid #e8e8e8' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                  <RobotOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                  <Text strong style={{ color: '#1890ff' }}>Đề xuất kỹ thuật viên phù hợp:</Text>
                </div>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {recommendedTechs.slice(0, 3).map((tech) => {
                    const isSelected = selectedTechId === tech.id;
                    return (
                      <div
                        key={tech.id}
                        onClick={() => setSelectedTechId(tech.id)}
                        style={{
                          padding: '10px 12px',
                          background: isSelected ? '#e6f7ff' : '#fff',
                          border: isSelected ? '1px solid #1890ff' : '1px solid #f0f0f0',
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? '#0050b3' : 'inherit' }}>
                            {tech.user?.full_name || `Kỹ thuật viên #${tech.id}`}
                          </span>
                          <Tag color={tech.ai_score >= 85 ? 'success' : 'processing'} style={{ margin: 0, fontWeight: 700 }}>
                            {tech.ai_score}% phù hợp
                          </Tag>
                        </div>
                        {tech.ai_reason && (
                          <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic', marginTop: 2 }}>
                            {tech.ai_reason}
                          </Text>
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {tech.recommendation_source === 'GEMINI_ASSISTED'
                            ? 'Gemini hỗ trợ xếp hạng sau khi kiểm tra nghiệp vụ'
                            : 'Xếp hạng theo luật nghiệp vụ'}
                        </Text>
                      </div>
                    );
                  })}
                </Space>
              </div>
            ) : (
              <div style={{ background: '#fff2f0', padding: 12, borderRadius: 8, border: '1px solid #ffccc7' }}>
                <Text type="danger" style={{ fontWeight: 600 }}>
                  Không tìm thấy kỹ thuật viên nào phù hợp với yêu cầu của đơn hàng này.
                </Text>
              </div>
            )
          )}
          <Select
            style={{ width: '100%' }}
            placeholder="Chọn kỹ thuật viên"
            value={selectedTechId}
            onChange={setSelectedTechId}
            showSearch
            optionFilterProp="children"
          >
            {sortedTechnicians.map((tech) => (
              <Option key={tech.id} value={tech.id}>
                {getTechOptionLabel(tech)}
              </Option>
            ))}
          </Select>
        </Space>
      </Modal>

      <Drawer
        title={`Chi tiết đơn #${bookingDetail?.id || ''}`}
        open={detailOpen}
        width={720}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
      >
        {bookingDetail && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Khách hàng">{bookingDetail.customer?.full_name}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{bookingDetail.customer?.phone || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Dịch vụ">{bookingDetail.service?.name}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ">
                {bookingDetail.address_detail}, {bookingDetail.ward?.name}, {bookingDetail.district?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Lịch hẹn">
                {formatDate(bookingDetail.booking_date)} {bookingDetail.time_slot_start} - {bookingDetail.time_slot_end}
              </Descriptions.Item>
              <Descriptions.Item label="Kỹ thuật viên">
                {bookingDetail.technicianProfile?.user?.full_name || 'Chưa phân công'}
              </Descriptions.Item>
              <Descriptions.Item label="Giá dự kiến">{formatVND(bookingDetail.estimated_price)}</Descriptions.Item>
              <Descriptions.Item label="Giá cuối">{formatVND(bookingDetail.final_price || bookingDetail.payment?.amount)}</Descriptions.Item>
              <Descriptions.Item label="Thanh toán">
                {bookingDetail.payment_method} - {bookingDetail.payment?.status || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả">{bookingDetail.description}</Descriptions.Item>
            </Descriptions>

            <Form layout="inline">
              {bookingDetail.status === 'PENDING' && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => confirmBooking(bookingDetail)}>
                  Xác nhận
                </Button>
              )}
              {bookingDetail.status === 'CONFIRMED' && !bookingDetail.technicianProfile && (
                <Button type="primary" icon={<UserSwitchOutlined />} onClick={() => openAssign(bookingDetail)}>
                  Phân công
                </Button>
              )}
              {bookingDetail.status === 'ASSIGNED' && bookingDetail.technicianProfile && (
                <Button type="primary" icon={<UserSwitchOutlined />} onClick={() => openAssign(bookingDetail)}>
                  Chuyển thợ
                </Button>
              )}
              {!['AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED'].includes(bookingDetail.status) && (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => cancelBooking(bookingDetail)}>Hủy đơn</Button>
              )}
            </Form>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
