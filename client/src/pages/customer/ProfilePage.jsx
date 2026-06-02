import { useState, useEffect } from 'react';
import { Card, Button, Typography, Form, Input, message, Tabs, Divider } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../api/authApi';

const { Title } = Typography;

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
      });
    }
  }, [user, profileForm]);

  const handleUpdateProfile = async (values) => {
    try {
      setLoading(true);
      const res = await authApi.updateProfile(values);
      updateUser(res.data);
      message.success('Cập nhật thông tin thành công');
    } catch (err) {
      message.error(err.message || 'Lỗi khi cập nhật thông tin');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (values) => {
    try {
      setPwdLoading(true);
      await authApi.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      message.success('Đổi mật khẩu thành công');
      passwordForm.resetFields();
    } catch (err) {
      message.error(err.message || 'Lỗi khi đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.');
    } finally {
      setPwdLoading(false);
    }
  };

  const items = [
    {
      key: '1',
      label: 'Thông tin cá nhân',
      children: (
        <Form form={profileForm} layout="vertical" onFinish={handleUpdateProfile}>
          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input prefix={<MailOutlined />} disabled />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true }]}>
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Lưu thay đổi
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: '2',
      label: 'Đổi mật khẩu',
      children: (
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item 
            name="current_password" 
            label="Mật khẩu hiện tại" 
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item 
            name="new_password" 
            label="Mật khẩu mới" 
            rules={[{ required: true, min: 6, message: 'Mật khẩu mới ít nhất 6 ký tự' }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item 
            name="confirm_password" 
            label="Xác nhận mật khẩu mới" 
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
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
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={pwdLoading}>
              Cập nhật mật khẩu
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <Title level={2} style={{ color: 'var(--navy)', marginBottom: 8 }}>Hồ sơ cá nhân</Title>
        <p>Quản lý thông tin tài khoản và bảo mật</p>
      </div>

      <Card className="glass-card">
        <Tabs defaultActiveKey="1" items={items} />
      </Card>
    </div>
  );
}