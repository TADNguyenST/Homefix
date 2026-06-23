import { Form, Input, Button, Card, Typography, message, Steps } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useState } from 'react';
import { authApi } from '../../api/authApi';

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const handleVerifyOtpLocal = (values) => {
    setOtpCode(values.otp_code);
    setCurrentStep(2);
  };
  
  const [form] = Form.useForm();

  const handleResendOtp = async () => {
    try {
      setLoading(true);
      await authApi.forgotPassword({ email });
      message.success('Đã gửi lại mã OTP. Vui lòng kiểm tra email!');
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Gửi lại mã thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (values) => {
    try {
      setLoading(true);
      await authApi.forgotPassword(values);
      setEmail(values.email);
      message.success('Mã OTP đã được gửi đến email của bạn');
      setCurrentStep(1);
    } catch (err) {
      message.error(err.message || 'Lỗi gửi yêu cầu');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (values) => {
    try {
      setLoading(true);
      await authApi.resetPassword({
        email,
        otp_code: otpCode,
        new_password: values.new_password,
        confirm_password: values.confirm_password
      });
      message.success('Khôi phục mật khẩu thành công. Vui lòng đăng nhập!');
      navigate('/login');
    } catch (err) {
      message.error(err.message || 'Mã OTP không đúng hoặc có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 64px - 200px)', padding: 24 }}>
      <Card className="glass-card" style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ color: 'var(--navy)', margin: 0 }}>Quên mật khẩu</Title>
          <Text type="secondary">Lấy lại quyền truy cập tài khoản</Text>
        </div>

        <Steps 
          current={currentStep} 
          items={[
            { title: 'Nhập Email' },
            { title: 'Nhập OTP' },
            { title: 'Đổi mật khẩu' }
          ]} 
          style={{ marginBottom: 32 }}
        />

        {currentStep === 0 && (
          <Form layout="vertical" onFinish={handleRequestOtp} size="large">
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập email!' },
                { type: 'email', message: 'Email không hợp lệ!' }
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="Email đăng ký" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                Gửi mã xác nhận
              </Button>
            </Form.Item>
          </Form>
        )}

        {currentStep === 1 && (
          <Form layout="vertical" onFinish={handleVerifyOtpLocal} size="large">
            <Form.Item
              name="otp_code"
              rules={[{ required: true, message: 'Vui lòng nhập mã OTP!' }]}
            >
              <Input placeholder="Mã OTP 6 số" />
            </Form.Item>
            <Form.Item>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button type="primary" htmlType="submit" style={{ flex: 1 }} loading={loading}>
                  Tiếp tục
                </Button>
                <Button onClick={handleResendOtp} disabled={loading}>
                  Gửi lại mã
                </Button>
              </div>
            </Form.Item>
          </Form>
        )}

        {currentStep === 2 && (
          <Form layout="vertical" onFinish={handleResetPassword} size="large">
            <Form.Item
              name="new_password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu mới!', min: 8 }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu mới" />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              dependencies={['new_password']}
              rules={[
                { required: true, message: 'Vui lòng xác nhận mật khẩu!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Xác nhận mật khẩu mới" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                Lưu mật khẩu mới
              </Button>
            </Form.Item>
          </Form>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/login">Quay lại đăng nhập</Link>
        </div>
      </Card>
    </div>
  );
}
