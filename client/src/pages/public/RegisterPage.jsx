import { Form, Input, Button, Card, Typography, Divider, message, Select, Modal } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../api/authApi';
import { useState } from 'react';

const { Title, Text } = Typography;
const { Option } = Select;

export default function RegisterPage() {
  const { register, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [form] = Form.useForm();
  const [otpForm] = Form.useForm();

  const onFinish = async (values) => {
    try {
      setLoading(true);
      await register(values);
      setRegisteredEmail(values.email);
      setOtpModalVisible(true);
      message.success('Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP.');
    } catch (err) {
      message.error(err.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (values) => {
    try {
      setOtpLoading(true);
      await verifyOtp(registeredEmail, values.otp_code);
      message.success('Xác thực OTP thành công. Vui lòng đăng nhập!');
      setOtpModalVisible(false);
      navigate('/login');
    } catch (err) {
      message.error(err.message || 'Xác thực OTP thất bại');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setOtpLoading(true);
      await authApi.resendOtp({ email: registeredEmail });
      message.success('Đã gửi lại mã OTP. Vui lòng kiểm tra email!');
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Gửi lại mã thất bại');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 64px - 200px)', padding: 24 }}>
      <Card className="glass-card" style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ color: 'var(--navy)', margin: 0 }}>Tạo tài khoản</Title>
          <Text type="secondary">Tham gia HomeFix ngay hôm nay</Text>
        </div>

        <Form
          form={form}
          name="register_form"
          layout="vertical"
          onFinish={onFinish}
          size="large"
          initialValues={{ role: 'CUSTOMER' }}
        >
          <Form.Item
            name="full_name"
            rules={[{ required: true, message: 'Vui lòng nhập họ và tên!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Họ và tên" />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Email không hợp lệ!' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" />
          </Form.Item>

          <Form.Item
            name="phone"
            rules={[{ required: true, message: 'Vui lòng nhập số điện thoại!' }]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="Số điện thoại" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!', min: 6 }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Xác nhận mật khẩu" />
          </Form.Item>


          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Đăng ký
            </Button>
          </Form.Item>
        </Form>

        <Divider plain>Hoặc</Divider>
        <div style={{ textAlign: 'center' }}>
          <Text>Đã có tài khoản? </Text>
          <Link to="/login">Đăng nhập</Link>
        </div>
      </Card>

      <Modal
        title="Xác thực OTP"
        open={otpModalVisible}
        footer={null}
        onCancel={() => setOtpModalVisible(false)}
        mask={{ closable: false }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>Mã OTP đã được gửi đến email: <b>{registeredEmail}</b></Text>
        </div>
        <Form form={otpForm} onFinish={onVerifyOtp} layout="vertical">
          <Form.Item
            name="otp_code"
            rules={[{ required: true, message: 'Vui lòng nhập mã OTP' }]}
          >
            <Input placeholder="Nhập mã OTP 6 số" size="large" />
          </Form.Item>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button type="primary" htmlType="submit" style={{ flex: 1 }} loading={otpLoading} size="large">
              Xác nhận
            </Button>
            <Button onClick={handleResendOtp} disabled={otpLoading} size="large">
              Gửi lại mã
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
