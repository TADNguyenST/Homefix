import { useState, useEffect, useMemo } from 'react';
import { Form, Input, Button, Card, Typography, Select, DatePicker, Radio, message, Divider, Space, Steps, Alert, Upload, Row, Col, Tag } from 'antd';
import { RobotOutlined, UploadOutlined, SafetyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { bookingApi, addressApi } from '../../api/bookingApi';
import { serviceApi } from '../../api/serviceApi';
import { aiApi } from '../../api/aiApi';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { formatVND } from '../../utils/helpers';

// Tiện ích chuyển đổi File sang Base64
const getBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function BookingFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiResultSource, setAiResultSource] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileList, setFileList] = useState([]);

  // Prefill state from LandingPage AI Doctor redirection
  const prefilledServiceId = location.state?.prefilledServiceId || null;
  const navigationSelectedServiceId = location.state?.selectedServiceId || null;
  const prefilledDescription = location.state?.prefilledDescription || '';
  const prefilledAiResult = location.state?.prefilledAiResult || null;

  // Fetch data
  const { data: servicesData } = useQuery({ queryKey: ['services'], queryFn: () => serviceApi.getAll({ limit: 100 }) });
  const { data: addressesData } = useQuery({ queryKey: ['addresses'], queryFn: addressApi.getAll });
  const { data: deviceTypesData } = useQuery({ queryKey: ['device-types'], queryFn: () => serviceApi.getDeviceTypes() });
  const { data: vouchersData } = useQuery({ queryKey: ['available-vouchers'], queryFn: bookingApi.getAvailableVouchers });

  const services = useMemo(() => servicesData?.data?.data || servicesData?.data || [], [servicesData]);
  const addresses = useMemo(() => addressesData?.data || [], [addressesData]);
  const deviceTypes = useMemo(() => deviceTypesData?.data?.device_types || deviceTypesData?.data || [], [deviceTypesData]);
  const availableVouchers = useMemo(() => vouchersData?.data || [], [vouchersData]);

  useEffect(() => {
    if (addresses.length > 0 && !form.getFieldValue('address_id')) {
      const defaultAddress = addresses.find(addr => addr.is_default) || addresses[0];
      form.setFieldsValue({ address_id: defaultAddress.id });
    }
  }, [addresses, form]);

  // Handle prefilled state from Landing Page or Service Detail redirection
  useEffect(() => {
    const serviceIdFromNavigation = prefilledServiceId || navigationSelectedServiceId;
    if (serviceIdFromNavigation) {
      form.setFieldsValue({ 
        service_id: serviceIdFromNavigation,
        issue_description: prefilledDescription
      });
      if (prefilledAiResult) {
        setAiResult(prefilledAiResult);
        setAiResultSource('home');
        message.success('Đã tải kết quả chẩn đoán nhanh từ trang chủ');
      }
    }
  }, [prefilledServiceId, navigationSelectedServiceId, prefilledDescription, prefilledAiResult, form]);

  const handleDiagnose = async () => {
    const description = form.getFieldValue('issue_description');
    if (!description || description.length < 10) {
      message.warning('Vui lòng mô tả chi tiết sự cố (ít nhất 10 ký tự) để hệ thống chẩn đoán chính xác.');
      return;
    }

    try {
      setIsDiagnosing(true);
      
      // Chuyển ảnh đầu tiên thành base64 nếu có
      let base64_image = null;
      if (fileList.length > 0 && fileList[0].originFileObj) {
        base64_image = await getBase64(fileList[0].originFileObj);
      }

      const res = await aiApi.diagnose({ description, base64_image });
      const diagnosis = res.data.diagnosis; // { severity, service_id, diagnosis_error, diagnosis_solution, safety_tips, predicted_cause, suggested_action, summary }
      setAiResult(diagnosis);
      setAiResultSource('booking');
      
      // Auto-select service dựa trên ID do AI trả về
      if (diagnosis.service_id) {
        form.setFieldsValue({ service_id: diagnosis.service_id });
        const match = services.find(s => s.id === diagnosis.service_id);
        if (match) {
          message.success(`Hệ thống chẩn đoán xong và tự động chọn dịch vụ: ${match.name}`);
        }
      } else {
        message.info('Đã phân tích xong. Vui lòng tự chọn dịch vụ thủ công ở bên dưới.');
      }
    } catch (err) {
      message.error(err.message || 'Lỗi khi chạy chẩn đoán thông minh');
    } finally {
      setIsDiagnosing(false);
    }
  };

  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [voucherData, setVoucherData] = useState(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);

  const handleApplyVoucher = async () => {
    if (!voucherCodeInput.trim()) {
      message.warning('Vui lòng nhập mã giảm giá');
      return;
    }
    const service_id = form.getFieldValue('service_id');
    if (!service_id) {
      message.warning('Vui lòng chọn dịch vụ trước khi áp dụng mã giảm giá');
      return;
    }

    try {
      setIsValidatingVoucher(true);
      const res = await bookingApi.validateVoucher({ voucher_code: voucherCodeInput.trim(), service_id });
      setVoucherData(res.data);
      form.setFieldsValue({ voucher_code: voucherCodeInput.trim() });
      message.success(`Áp dụng thành công mã giảm giá ${res.data.code}`);
    } catch (err) {
      setVoucherData(null);
      form.setFieldsValue({ voucher_code: null });
      message.error(err.message || 'Mã giảm giá không hợp lệ');
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setVoucherData(null);
    setVoucherCodeInput('');
    form.setFieldsValue({ voucher_code: null });
    message.info('Đã gỡ mã giảm giá');
  };

  const onFinish = async (values) => {
    try {
      setIsSubmitting(true);
      
      const addressId = Number(values.address_id ?? form.getFieldValue('address_id'));
      const selectedAddress = addresses.find(addr => addr.id === addressId);
      if (!selectedAddress) {
        message.error('Vui lòng chọn địa chỉ thực hiện!');
        return;
      }

      const scheduledTime = values.scheduled_time ?? form.getFieldValue('scheduled_time');
      if (!scheduledTime) {
        message.error('Vui lòng chọn thời gian mong muốn!');
        return;
      }

      const booking_date = scheduledTime.format('YYYY-MM-DD');
      const time_slot_start = scheduledTime.format('HH:mm');
      // Thời lượng mặc định 2 tiếng cho một ca làm việc
      const time_slot_end = scheduledTime.add(2, 'hour').format('HH:mm');

      const payload = {
        service_id: values.service_id,
        device_type_id: values.device_type_id || null,
        description: values.issue_description,
        customer_address_id: addressId,
        district_id: selectedAddress.district_id,
        ward_id: selectedAddress.ward_id,
        address_detail: selectedAddress.address_detail,
        booking_date,
        time_slot_start,
        time_slot_end,
        payment_method: values.payment_method,
        // Chẩn đoán đính kèm
        ai_diagnosis: aiResult?.suggested_action || aiResult?.diagnosis_solution || null,
        voucher_code: values.voucher_code || form.getFieldValue('voucher_code') || null,
      };

      const res = await bookingApi.create(payload);
      message.success('Đặt lịch thành công!');
      navigate(`/customer/bookings/${res.data.id}`);
      
    } catch (err) {
      if (err.errors && err.errors.length > 0) {
        const errorMsgs = err.errors.map(e => `${e.field} (${e.message})`).join(', ');
        message.error(`Lỗi: ${errorMsgs}`);
        console.error('Validation Errors:', err.errors);
      } else {
        message.error(err.message || 'Lỗi khi đặt lịch');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const next = () => {
    const stepFields = currentStep === 0
      ? ['issue_description', 'service_id']
      : ['scheduled_time', 'address_id'];
    form.validateFields(stepFields).then(() => {
      setCurrentStep(currentStep + 1);
    });
  };

  const prev = () => setCurrentStep(currentStep - 1);

  const selectedServiceId = Form.useWatch('service_id', form);
  const selectedService = services.find(s => s.id === selectedServiceId);
  const filteredDeviceTypes = selectedService
    ? deviceTypes.filter(d => !d.category_id || d.category_id === selectedService.category_id)
    : deviceTypes;

  const steps = [
    {
      title: 'Dịch vụ & Sự cố',
      content: (
        <div style={{ marginTop: 24 }}>
          <Form.Item
            name="issue_description"
            label="Mô tả sự cố của bạn"
            rules={[{ required: true, message: 'Vui lòng mô tả sự cố!' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="Ví dụ: Máy lạnh nhà tôi bật không lên, đèn nhấp nháy liên tục..." 
            />
          </Form.Item>

          <Form.Item label="Hình ảnh sự cố (Tùy chọn)">
            <Upload
              listType="picture-card"
              fileList={fileList}
              onChange={({ fileList: newFileList }) => setFileList(newFileList)}
              beforeUpload={() => false}
              maxCount={3}
              accept="image/*"
            >
              {fileList.length >= 3 ? null : (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>Tải ảnh lên</div>
                </div>
              )}
            </Upload>
          </Form.Item>

          <div style={{ marginBottom: 24 }}>
            <Button 
              type="primary" 
              icon={<RobotOutlined />} 
              onClick={handleDiagnose} 
              loading={isDiagnosing}
              style={{ background: 'var(--navy)', borderColor: 'var(--navy)' }}
            >
              {aiResultSource === 'home' ? 'Phân tích lại với mô tả / ảnh mới' : 'Chẩn đoán sự cố tự động'}
            </Button>
          </div>

            {aiResultSource === 'home' && aiResult && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 'var(--radius-md)' }}
                message="Đã có kết quả chẩn đoán nhanh từ trang chủ"
                description="Bạn có thể tiếp tục đặt lịch ngay, hoặc thêm ảnh/sửa mô tả rồi bấm phân tích lại để AI đưa ra gợi ý sát hơn."
              />
            )}

            {/* AI Results Output Container */}
            {aiResult && (
              <div className="fade-in-up" style={{ marginBottom: 24, background: '#0f172a', borderRadius: 24, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #1e293b' }}>
                <div style={{ padding: '16px 24px', background: 'rgba(30, 41, 59, 0.8)', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RobotOutlined style={{ color: '#fbbf24', fontSize: 18 }} />
                    <Text strong style={{ color: '#fcd34d', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Bản Chẩn Đoán AI</Text>
                  </div>
                  <Tag color={aiResult.severity === 'HIGH' || aiResult.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'} style={{ border: 'none', fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>
                    Mức độ: {aiResult.severity}
                  </Tag>
                </div>

                <div style={{ padding: 24 }}>
                  <Row gutter={[24, 24]}>
                    {/* Cột Trái: Chẩn đoán */}
                    <Col xs={24} md={13}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                          <Text style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 4 }}>Nguyên Nhân Dự Đoán</Text>
                          <Text style={{ fontSize: 15, color: '#f8fafc', lineHeight: 1.6 }}>{aiResult.predicted_cause || aiResult.diagnosis_error}</Text>
                        </div>
                        <div>
                          <Text style={{ fontSize: 11, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 4 }}>Giải Pháp Khắc Phục</Text>
                          <Text style={{ fontSize: 15, color: '#f8fafc', lineHeight: 1.6 }}>{aiResult.suggested_action || aiResult.diagnosis_solution}</Text>
                        </div>
                      </div>
                    </Col>

                    {/* Cột Phải: Safety */}
                    <Col xs={24} md={11}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', borderLeft: '1px solid #334155', paddingLeft: 24, marginLeft: -12 }} className="md-border-left">
                        {/* Cảnh báo an toàn */}
                        {Array.isArray(aiResult.safety_tips) && aiResult.safety_tips.length > 0 && (
                          <div>
                            <Text style={{ fontSize: 11, textTransform: 'uppercase', color: '#fbbf24', fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>Lời Khuyên An Toàn</Text>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {aiResult.safety_tips.map((tip, idx) => (
                                <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 12px', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                  <SafetyOutlined style={{ color: '#f87171', marginTop: 2 }} />
                                  <Text style={{ color: '#fca5a5', fontSize: 13, lineHeight: 1.4 }}>{tip}</Text>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                           <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                             Hệ thống đã tự động ghi nhận và áp dụng giải pháp này cho đơn hàng của bạn.
                           </Text>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>
            )}

          <Form.Item
            name="service_id"
            label="Chọn dịch vụ"
            rules={[{ required: true, message: 'Vui lòng chọn dịch vụ!' }]}
          >
            <Select 
              size="large"
              placeholder="Chọn dịch vụ phù hợp" 
              showSearch 
              optionFilterProp="children"
              onChange={() => {
                form.setFieldsValue({ device_type_id: undefined });
                if (voucherData) {
                  setVoucherData(null);
                  setVoucherCodeInput('');
                  form.setFieldsValue({ voucher_code: null });
                }
              }}
            >
              {services.map(s => (
                <Option key={s.id} value={s.id}>
                  {s.name} - Giá từ {formatVND(s.base_price)}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="device_type_id"
            label="Loại thiết bị"
            rules={[{ required: false }]}
          >
            <Select
              size="large"
              placeholder={selectedService ? 'Chọn loại thiết bị nếu muốn mô tả rõ hơn' : 'Chọn dịch vụ trước để lọc loại thiết bị'}
              allowClear
              disabled={!selectedService}
            >
              {filteredDeviceTypes.map(d => (
                <Option key={d.id} value={d.id}>
                  {d.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>
      ),
    },
    {
      title: 'Thời gian & Địa điểm',
      content: (
        <div style={{ marginTop: 24 }}>
          <Form.Item
            name="scheduled_time"
            label="Thời gian mong muốn"
            rules={[{ required: true, message: 'Vui lòng chọn thời gian!' }]}
          >
            <DatePicker 
              showTime 
              format="DD/MM/YYYY HH:mm" 
              size="large" 
              style={{ width: '100%' }} 
              disabledDate={(current) => current && current < dayjs().add(24, 'hour').startOf('day')}
            />
          </Form.Item>

          <Form.Item
            name="address_id"
            label="Địa chỉ thực hiện"
            rules={[{ required: true, message: 'Vui lòng chọn địa chỉ!' }]}
          >
            {addresses.length > 0 ? (
              <Radio.Group style={{ width: '100%' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {addresses.map(addr => (
                    <Card 
                      key={addr.id} 
                      size="small" 
                      style={{ 
                        border: '1px solid #e2e8f0', 
                        cursor: 'pointer',
                        background: form.getFieldValue('address_id') === addr.id ? 'var(--bg-primary)' : 'white'
                      }}
                      onClick={() => form.setFieldsValue({ address_id: addr.id })}
                    >
                      <Radio value={addr.id}>
                        <div style={{ marginLeft: 8 }}>
                          <div style={{ fontWeight: 600 }}>{addr.label || 'Địa chỉ'}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            {addr.address_detail}, {addr.ward?.name}, {addr.district?.name}
                          </div>
                        </div>
                      </Radio>
                    </Card>
                  ))}
                </Space>
              </Radio.Group>
            ) : (
              <Alert 
                message="Bạn chưa có địa chỉ nào." 
                type="warning" 
                action={<Button size="small" onClick={() => navigate('/customer/addresses')}>Thêm địa chỉ mới</Button>} 
              />
            )}
          </Form.Item>
        </div>
      ),
    },
    {
      title: 'Xác nhận & Thanh toán',
      content: (
        <div style={{ marginTop: 24 }}>
          <Card size="small" title="Thông tin đơn hàng" style={{ marginBottom: 24, border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary">Dịch vụ:</Text>
              <Text strong>{selectedService?.name || '---'}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text type="secondary">Phí dịch vụ cơ bản:</Text>
              <Text strong style={{ color: 'var(--text-primary)' }}>
                {selectedService ? formatVND(selectedService.base_price) : '---'}
              </Text>
            </div>

            {/* VOUCHER SECTION */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 16, border: '1px dashed #cbd5e1' }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Khuyến mãi / Mã giảm giá</Text>
              {!voucherData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {availableVouchers.length > 0 && (
                    <Select
                      placeholder="Chọn voucher khả dụng"
                      allowClear
                      onChange={(code) => setVoucherCodeInput(code || '')}
                      options={availableVouchers.map(v => ({
                        value: v.code,
                        label: `${v.code} - ${v.discount_type === 'PERCENTAGE' ? `Giảm ${Number(v.discount_value)}%` : `Giảm ${formatVND(v.discount_value)}`}`,
                      }))}
                    />
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input 
                      placeholder="Nhập mã (VD: GIAM50K)" 
                      value={voucherCodeInput}
                      onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                      style={{ textTransform: 'uppercase' }}
                      allowClear
                    />
                    <Button 
                      type="primary" 
                      onClick={handleApplyVoucher}
                      loading={isValidatingVoucher}
                      style={{ background: 'var(--navy)' }}
                    >
                      Áp dụng
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', padding: '8px 12px', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="success" style={{ margin: 0, fontWeight: 600 }}>{voucherData.code}</Tag>
                    <Text type="success" style={{ fontSize: 13 }}>- {formatVND(voucherData.discount_amount)}</Text>
                  </div>
                  <Button type="text" size="small" danger onClick={handleRemoveVoucher}>Gỡ</Button>
                </div>
              )}
            </div>

            {/* TỔNG TIỀN */}
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 16 }}>Tổng tạm tính:</Text>
              <Text strong style={{ color: 'var(--orange)', fontSize: 18 }}>
                {selectedService ? formatVND(voucherData ? voucherData.final_price : selectedService.base_price) : '---'}
              </Text>
            </div>

            <Text type="secondary" style={{ fontSize: 12 }}>
              *Lưu ý: Phí trên chỉ là phí cơ bản hoặc phí khảo sát. Kỹ thuật viên sẽ báo giá chi tiết vật tư và công thợ sau khi kiểm tra thực tế.
            </Text>
          </Card>

          <Form.Item
            name="payment_method"
            label="Phương thức thanh toán"
            rules={[{ required: true, message: 'Vui lòng chọn phương thức thanh toán!' }]}
            initialValue="CASH"
          >
            <Radio.Group style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Card size="small" style={{ border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => form.setFieldsValue({ payment_method: 'CASH' })}>
                  <Radio value="CASH">Tiền mặt sau khi hoàn thành</Radio>
                </Card>
                <Card size="small" style={{ border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => form.setFieldsValue({ payment_method: 'VNPAY' })}>
                  <Radio value="VNPAY">Chuyển khoản / VNPAY</Radio>
                </Card>
              </Space>
            </Radio.Group>
          </Form.Item>
        </div>
      ),
    }
  ];

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1>Đặt lịch sửa chữa</h1>
        <p>Hoàn thành các bước dưới đây để kỹ thuật viên đến hỗ trợ bạn</p>
      </div>

      <Card className="glass-card">
        <Steps current={currentStep} items={steps.map(s => ({ title: s.title }))} style={{ marginBottom: 32 }} />

        <Form form={form} layout="vertical" onFinish={onFinish}>
          {steps.map((step, index) => (
            <div key={index} style={{ display: currentStep === index ? 'block' : 'none' }}>
              {step.content}
            </div>
          ))}

          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
            {currentStep > 0 && (
              <Button onClick={prev} size="large">
                Quay lại
              </Button>
            )}
            {currentStep === 0 && <div />} {/* Spacer */}
            
            {currentStep < steps.length - 1 && (
              <Button type="primary" onClick={next} size="large">
                Tiếp tục
              </Button>
            )}
            
            {currentStep === steps.length - 1 && (
              <Button type="primary" htmlType="submit" size="large" loading={isSubmitting}>
                Xác nhận đặt lịch
              </Button>
            )}
          </div>
        </Form>
      </Card>
    </div>
  );
}
