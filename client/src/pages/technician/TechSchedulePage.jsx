import { Calendar, Badge, Card, Typography, Spin, Drawer, List, Tag } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { technicianApi } from '../../api/technicianApi';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { BOOKING_STATUS_LABELS } from '../../utils/constants';

const { Title, Text } = Typography;

const activeStatuses = ['ASSIGNED', 'IN_PROGRESS', 'INSPECTING', 'QUOTED', 'COMPLETING'];

const getBadgeType = (status) => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED') return 'error';
  if (activeStatuses.includes(status)) return 'processing';
  return 'default';
};

export default function TechSchedulePage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['tech-jobs-schedule'],
    queryFn: () => technicianApi.getJobs({ limit: 50 }),
  });

  const jobs = jobsData?.data?.data || jobsData?.data || [];

  const getListData = (value) => jobs
    .filter(job => dayjs(job.booking_date).isSame(value, 'day'))
    .sort((a, b) => (a.time_slot_start || '').localeCompare(b.time_slot_start || ''))
    .map(job => ({
      type: getBadgeType(job.status),
      content: `${job.time_slot_start || '--:--'} - ${job.service?.name || 'Dịch vụ'}`,
      id: job.id,
      job,
    }));

  const dateCellRender = (value) => {
    const listData = getListData(value);
    return (
      <ul className="events" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {listData.map((item) => (
          <li key={item.id} style={{ marginBottom: 4 }}>
            <Badge status={item.type} text={<span style={{ fontSize: 12 }}>{item.content}</span>} />
          </li>
        ))}
      </ul>
    );
  };

  const onSelect = (newValue) => {
    setSelectedDate(newValue);
    setIsDrawerOpen(true);
  };

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  }

  const selectedJobs = getListData(selectedDate);

  return (
    <div>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Lịch trình công việc</Title>
        <p>Quản lý lịch làm việc và các cuộc hẹn với khách hàng</p>
      </div>

      <Card className="glass-card">
        <Calendar
          dateCellRender={dateCellRender}
          onSelect={onSelect}
          style={{ background: 'transparent' }}
        />
      </Card>

      <Drawer
        title={`Lịch trình ngày ${selectedDate.format('DD/MM/YYYY')}`}
        placement="right"
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        width={420}
      >
        {selectedJobs.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            Không có công việc nào trong ngày này.
          </div>
        ) : (
          <List
            itemLayout="vertical"
            dataSource={selectedJobs}
            renderItem={(item) => (
              <List.Item
                actions={[<a key="view" onClick={() => navigate(`/technician/jobs/${item.id}`)}>Xem chi tiết</a>]}
              >
                <List.Item.Meta
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>{item.job.service?.name || 'Dịch vụ'}</span>
                      <Tag>{BOOKING_STATUS_LABELS[item.job.status] || item.job.status}</Tag>
                    </div>
                  }
                  description={
                    <>
                      <div>Thời gian: {item.job.time_slot_start} - {item.job.time_slot_end}</div>
                      <div>Khách: {item.job.customer?.full_name || 'Đang cập nhật'}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.job.address_detail}, {item.job.ward?.name}, {item.job.district?.name}
                      </Text>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </div>
  );
}
