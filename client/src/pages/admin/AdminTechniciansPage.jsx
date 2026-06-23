import { Table, Tag, Button, Typography, Space, Modal, message, Descriptions, Divider, Row, Col, Form, Input, InputNumber, Select, Switch, Checkbox, TimePicker } from 'antd';
import { useState } from 'react';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { formatDateTime } from '../../utils/helpers';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function AdminTechniciansPage() {
  const [search, setSearch] = useState('');
  const [filterDistrict, setFilterDistrict] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);

  const { data: techsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-technicians-list', search, filterDistrict, filterStatus],
    queryFn: () => adminApi.getTechnicians({
      search,
      district_id: filterDistrict,
      is_available: filterStatus
    }),
  });

  const { data: districtsData } = useQuery({
    queryKey: ['admin-districts-list'],
    queryFn: () => adminApi.getDistricts(),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['admin-services-list'],
    queryFn: () => adminApi.getServices(),
  });

  // Handle paginated data from backend
  const technicians = techsData?.data?.data || techsData?.data || [];
  const districts = districtsData?.data || [];
  const services = servicesData?.data?.data || servicesData?.data || [];

  const [selectedTech, setSelectedTech] = useState(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);

  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleViewDetail = (tech) => {
    setSelectedTech(tech);
    setIsDetailVisible(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      schedule_days: [1, 2, 3, 4, 5],
      schedule_time: [dayjs('08:00', 'HH:mm'), dayjs('17:00', 'HH:mm')],
    });
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    // Tìm giờ bắt đầu / kết thúc từ schedules hiện có
    const existingDays = record.schedules?.map(s => s.day_of_week) || [];
    const firstSchedule = record.schedules?.[0];
    form.setFieldsValue({
      full_name: record.user?.full_name,
      email: record.user?.email,
      phone: record.user?.phone,
      years_of_experience: record.years_of_experience,
      district_id: record.district_id,
      bio: record.bio,
      is_available: record.is_available,
      skills: record.skills?.map(s => s.service_id) || [],
      schedule_days: existingDays.length > 0 ? existingDays : [1, 2, 3, 4, 5],
      schedule_time: firstSchedule
        ? [dayjs(firstSchedule.start_time, 'HH:mm'), dayjs(firstSchedule.end_time, 'HH:mm')]
        : [dayjs('08:00', 'HH:mm'), dayjs('17:00', 'HH:mm')],
    });
    setIsModalVisible(true);
  };

  const handleToggleActive = async (record) => {
    Modal.confirm({
      title: record.is_available ? 'Ngừng nhận việc?' : 'Cho phép nhận việc?',
      content: record.is_available ? 'Kỹ thuật viên sẽ không thể được phân công đơn mới.' : 'Kỹ thuật viên sẽ sẵn sàng nhận việc lại.',
      onOk: async () => {
        try {
          await adminApi.updateTechnician(record.id, { is_available: !record.is_available });
          message.success('Cập nhật trạng thái thành công');
          refetch();
        } catch (err) {
          message.error(err.response?.data?.message || err.message || 'Lỗi khi cập nhật trạng thái');
        }
      }
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      let techProfileId = editingId;

      if (editingId) {
        await adminApi.updateTechnician(editingId, {
          years_of_experience: values.years_of_experience,
          district_id: values.district_id,
          bio: values.bio,
          is_available: values.is_available,
        });
        message.success('Cập nhật thông tin thành công');
      } else {
        const res = await adminApi.createTechnician(values);
        techProfileId = res.data.profile.id;
        message.success('Thêm thợ thành công. Mật khẩu mặc định: HomeFix@2026');
      }

      // Cập nhật chuyên môn (skills)
      if (values.skills && techProfileId) {
        const skillPayload = {
          skills: values.skills.map(service_id => ({ service_id, skill_level: 'INTERMEDIATE' }))
        };
        await adminApi.updateTechSkills(techProfileId, skillPayload);
      }

      // Cập nhật lịch làm việc
      if (values.schedule_days && values.schedule_time && techProfileId) {
        const startTime = values.schedule_time[0].format('HH:mm');
        const endTime = values.schedule_time[1].format('HH:mm');
        const schedulePayload = {
          schedules: values.schedule_days.map(day => ({
            day_of_week: day,
            start_time: startTime,
            end_time: endTime,
          }))
        };
        await adminApi.updateTechSchedule(techProfileId, schedulePayload);
      }

      setIsModalVisible(false);
      refetch();
    } catch (err) {
      console.error('Save Technician Error:', err);

      // Lỗi do điền thiếu trên giao diện (Ant Design)
      if (err.errorFields) {
        message.warning('Vui lòng điền đầy đủ và đúng định dạng các ô yêu cầu!');
        return;
      }
      
      // Lỗi từ backend trả về (Zod validation hoặc trùng email)
      if (err.response?.data?.errors) {
        const formErrors = err.response.data.errors.map(e => ({
          name: e.field.split('.'),
          errors: [e.message]
        }));
        form.setFields(formErrors);
        message.error('Dữ liệu không hợp lệ, vui lòng kiểm tra lại!');
      } else {
        message.error(err.response?.data?.message || err.message || 'Lỗi khi lưu thông tin');
      }
    }
  };

  const getDayName = (dayIdx) => {
    const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[dayIdx] || `Thứ ${dayIdx + 1}`;
  };

  const columns = [
    {
      title: 'Họ và tên',
      dataIndex: ['user', 'full_name'],
      key: 'full_name',
      render: (text) => <span style={{ fontWeight: 500, color: 'var(--navy)' }}>{text || 'N/A'}</span>,
    },
    {
      title: 'Số điện thoại',
      dataIndex: ['user', 'phone'],
      key: 'phone',
    },
    {
      title: 'Khu vực',
      dataIndex: ['district', 'name'],
      key: 'district',
      render: (text) => text || 'Chưa cập nhật',
    },
    {
      title: 'Chuyên môn',
      key: 'skills',
      render: (_, record) => {
        if (!record.skills || record.skills.length === 0) return <span style={{ color: 'var(--text-secondary)' }}>Chưa có</span>;
        return (
          <Space size={[0, 4]} wrap>
            {record.skills.map((s, i) => (
              <Tag color="blue" key={i}>{s.service?.name}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Kinh nghiệm',
      dataIndex: 'years_of_experience',
      key: 'years_of_experience',
      render: (val) => `${val || 0} năm`,
    },
    {
      title: 'Hoàn thành / Đánh giá',
      key: 'performance',
      render: (_, record) => (
        <div>
          <div>{record.total_completed_jobs || 0} đơn</div>
          <div style={{ color: 'var(--orange)', fontWeight: 600 }}>⭐ {record.avg_rating ? Number(record.avg_rating).toFixed(1) : 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_available',
      key: 'is_available',
      render: (is_available) => (
        <Tag color={is_available ? 'success' : 'default'}>
          {is_available ? 'Sẵn sàng nhận việc' : 'Đang bận / Tạm nghỉ'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" type="primary" onClick={() => handleViewDetail(record)}>Chi tiết</Button>
          <Button size="small" onClick={() => handleEdit(record)}>Sửa</Button>
          <Button 
            size="small" 
            danger={record.is_available} 
            type={!record.is_available ? "primary" : "default"}
            onClick={() => handleToggleActive(record)}
          >
            {record.is_available ? 'Khóa' : 'Mở khóa'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Quản lý Kỹ thuật viên</Title>
          <p>Kiểm duyệt và quản lý hồ sơ đối tác thợ sửa chữa</p>
        </div>
        <Button type="primary" size="large" onClick={handleAdd}>
          + Thêm mới thợ
        </Button>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
        
        {/* Lọc và Tìm kiếm */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input.Search 
            placeholder="Tìm theo tên, email, SĐT" 
            allowClear 
            onSearch={(value) => setSearch(value)}
            style={{ width: 250 }}
          />
          <Select 
            placeholder="Lọc theo khu vực" 
            allowClear 
            style={{ width: 200 }}
            onChange={(val) => setFilterDistrict(val)}
          >
            {districts.map(d => (
              <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
            ))}
          </Select>
          <Select 
            placeholder="Lọc theo trạng thái" 
            allowClear 
            style={{ width: 180 }}
            onChange={(val) => setFilterStatus(val)}
          >
            <Select.Option value={true}>Sẵn sàng nhận việc</Select.Option>
            <Select.Option value={false}>Đang bận / Tạm nghỉ</Select.Option>
          </Select>
        </div>

        <Table 
          columns={columns} 
          dataSource={technicians} 
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
        />
      </div>

      {/* MODAL CHI TIẾT */}
      <Modal
        title={<span style={{ fontSize: 20, color: 'var(--navy)' }}>Hồ sơ Kỹ thuật viên</span>}
        open={isDetailVisible}
        onCancel={() => setIsDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailVisible(false)}>Đóng</Button>
        ]}
        width={700}
      >
        {selectedTech && (
          <div>
            <Descriptions bordered column={2} size="small" labelStyle={{ width: 140, fontWeight: 600 }}>
              <Descriptions.Item label="Họ và tên" span={2}>
                <span style={{ fontSize: 16, color: 'var(--navy)', fontWeight: 700 }}>
                  {selectedTech.user?.full_name}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Email">{selectedTech.user?.email}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{selectedTech.user?.phone}</Descriptions.Item>
              <Descriptions.Item label="Khu vực">{selectedTech.district?.name || 'Chưa cập nhật'}</Descriptions.Item>
              <Descriptions.Item label="Kinh nghiệm">{selectedTech.years_of_experience} năm</Descriptions.Item>
              <Descriptions.Item label="Đánh giá">
                <span style={{ color: 'var(--orange)', fontWeight: 600 }}>⭐ {selectedTech.avg_rating ? Number(selectedTech.avg_rating).toFixed(1) : 'N/A'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Đã hoàn thành">{selectedTech.total_completed_jobs} đơn</Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={2}>
                <Tag color={selectedTech.is_available ? 'success' : 'default'}>
                  {selectedTech.is_available ? 'Sẵn sàng nhận việc' : 'Đang bận / Tạm nghỉ'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Giới thiệu" span={2}>
                {selectedTech.bio || <span style={{ color: 'var(--text-secondary)' }}>Chưa có thông tin giới thiệu</span>}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Chuyên môn</Divider>
            {selectedTech.skills && selectedTech.skills.length > 0 ? (
              <Space wrap>
                {selectedTech.skills.map((s, i) => (
                  <Tag color="blue" key={i} style={{ padding: '4px 12px', fontSize: 14 }}>
                    {s.service?.name} ({s.skill_level})
                  </Tag>
                ))}
              </Space>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Kỹ thuật viên này chưa cập nhật chuyên môn.</p>
            )}

            <Divider orientation="left">Lịch làm việc</Divider>
            {selectedTech.schedules && selectedTech.schedules.length > 0 ? (
              <Row gutter={[12, 12]}>
                {selectedTech.schedules.map((schedule, index) => (
                  <Col xs={12} sm={8} key={index}>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{getDayName(schedule.day_of_week)}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {schedule.start_time} - {schedule.end_time}
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Chưa có lịch làm việc.</p>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL THÊM / SỬA */}
      <Modal
        title={<span style={{ fontSize: 20, color: 'var(--navy)' }}>{editingId ? 'Sửa thông tin thợ' : 'Thêm mới Kỹ thuật viên'}</span>}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={() => setIsModalVisible(false)}
        okText="Lưu thông tin"
        cancelText="Hủy"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên!' }]}>
                <Input disabled={!!editingId} placeholder="Vd: Nguyễn Văn A" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email không hợp lệ!' }]}>
                <Input disabled={!!editingId} placeholder="Vd: thosuachua@homefix.vn" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập SĐT!' }]}>
                <Input disabled={!!editingId} placeholder="Vd: 0987654321" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="district_id" label="Khu vực hoạt động">
                <Select placeholder="Chọn khu vực">
                  {districts.map(d => (
                    <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="years_of_experience" label="Số năm kinh nghiệm">
                <InputNumber min={0} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="skills" label="Chuyên môn (Các dịch vụ hỗ trợ)">
                <Select mode="multiple" placeholder="Chọn chuyên môn" allowClear>
                  {services.map(s => (
                    <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            {editingId && (
              <Col span={12}>
                <Form.Item name="is_available" label="Trạng thái khả dụng" valuePropName="checked">
                  <Switch checkedChildren="Sẵn sàng" unCheckedChildren="Đang bận" />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Form.Item name="bio" label="Giới thiệu bản thân (Tùy chọn)">
            <Input.TextArea rows={3} placeholder="Mô tả kinh nghiệm, kỹ năng đặc biệt..." />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 14, color: 'var(--navy)' }}>Lịch làm việc</Divider>

          <Form.Item name="schedule_days" label="Ngày làm việc">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row>
                <Col span={6}><Checkbox value={1}>Thứ 2</Checkbox></Col>
                <Col span={6}><Checkbox value={2}>Thứ 3</Checkbox></Col>
                <Col span={6}><Checkbox value={3}>Thứ 4</Checkbox></Col>
                <Col span={6}><Checkbox value={4}>Thứ 5</Checkbox></Col>
                <Col span={6}><Checkbox value={5}>Thứ 6</Checkbox></Col>
                <Col span={6}><Checkbox value={6}>Thứ 7</Checkbox></Col>
                <Col span={6}><Checkbox value={0}>Chủ nhật</Checkbox></Col>
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item name="schedule_time" label="Giờ làm việc (Bắt đầu - Kết thúc)">
            <TimePicker.RangePicker format="HH:mm" minuteStep={30} style={{ width: '100%' }} />
          </Form.Item>

          {!editingId && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, background: '#f8fafc', padding: '12px', borderRadius: 8 }}>
              💡 Mật khẩu mặc định của tài khoản sẽ được khởi tạo là: <b>HomeFix@2026</b>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}