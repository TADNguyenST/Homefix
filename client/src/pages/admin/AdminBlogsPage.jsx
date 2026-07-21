import { useState } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Modal, Form, Input, Switch, message, Upload, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blogApi } from '../../api/blogApi';
import dayjs from 'dayjs';
import { uploadApi } from '../../api/uploadApi';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { resolveAssetUrl } from '../../utils/helpers';

const { Title } = Typography;
const BLOG_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function AdminBlogsPage() {
  const queryClient = useQueryClient();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();

  const { data: blogsData, isLoading } = useQuery({
    queryKey: ['admin-blogs'],
    queryFn: () => blogApi.getAllBlogsAdmin(),
  });

  const blogs = blogsData?.data || [];

  const createMutation = useMutation({
    mutationFn: (data) => blogApi.createBlog(data),
    onSuccess: () => {
      message.success('Tạo bài viết thành công');
      queryClient.invalidateQueries({ queryKey: ['admin-blogs'] });
      queryClient.invalidateQueries({ queryKey: ['public-blogs'] });
      handleCloseModal();
    },
    onError: (err) => {
      message.error(err.message || 'Lỗi khi tạo bài viết');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => blogApi.updateBlog(id, data),
    onSuccess: () => {
      message.success('Cập nhật bài viết thành công');
      queryClient.invalidateQueries({ queryKey: ['admin-blogs'] });
      queryClient.invalidateQueries({ queryKey: ['public-blogs'] });
      handleCloseModal();
    },
    onError: (err) => {
      message.error(err.message || 'Lỗi khi cập nhật bài viết');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => blogApi.deleteBlog(id),
    onSuccess: () => {
      message.success('Xoa bai viet thanh cong');
      queryClient.invalidateQueries({ queryKey: ['admin-blogs'] });
      queryClient.invalidateQueries({ queryKey: ['public-blogs'] });
    },
    onError: (err) => message.error(err.message || 'Khong the xoa bai viet'),
  });

  const handleOpenModal = (blog = null) => {
    setEditingBlog(blog);
    if (blog) {
      form.setFieldsValue({
        title: blog.title,
        slug: blog.slug,
        content: blog.content,
        image_urls: blog.image_urls || [],
        is_published: blog.is_published,
      });
    } else {
      form.setFieldsValue({
        is_published: true,
      });
    }
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingBlog(null);
    form.resetFields();
  };

  const handleUpload = async (options) => {
    const { file, onSuccess, onError } = options;
    const currentUrls = form.getFieldValue('image_urls') || [];
    if (currentUrls.length >= 3) {
      const limitError = new Error('Moi bai viet chi duoc tai toi da 3 anh');
      message.warning(limitError.message);
      onError(limitError);
      return;
    }

    if (!BLOG_IMAGE_TYPES.includes(file.type)) {
      const typeError = new Error('Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF');
      message.error(typeError.message);
      onError(typeError);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      const sizeError = new Error('Mỗi ảnh không được vượt quá 5 MB');
      message.error(sizeError.message);
      onError(sizeError);
      return;
    }

    try {
      setUploading(true);
      const res = await uploadApi.uploadImage(file);
      const url = res.data.url;
      form.setFieldsValue({ image_urls: [...currentUrls, url] });
      onSuccess('ok');
      message.success('Tải ảnh lên thành công');
    } catch (err) {
      console.error(err);
      onError(err);
      message.error('Lỗi khi tải ảnh lên');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (values) => {
    if (editingBlog) {
      updateMutation.mutate({ id: editingBlog.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns = [
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Đường dẫn (Slug)',
      dataIndex: 'slug',
      key: 'slug',
    },
    {
      title: 'Tác giả',
      dataIndex: ['author', 'full_name'],
      key: 'author',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_published',
      key: 'is_published',
      render: (is_published) => (
        <Tag color={is_published ? 'green' : 'default'}>
          {is_published ? 'Đã xuất bản' : 'Bản nháp'}
        </Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
            size="small"
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xoa bai viet?"
            description="Bai viet se khong con hien thi cho khach hang."
            okText="Xoa"
            cancelText="Huy"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button danger icon={<DeleteOutlined />} size="small" loading={deleteMutation.isPending}>
              Xoa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>Quản lý Bài viết</Title>}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Thêm bài viết
        </Button>
      }
      bordered={false}
      style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
    >
      <Table
        columns={columns}
        dataSource={blogs}
        rowKey="id"
        loading={isLoading}
      />

      <Modal
        title={editingBlog ? "Sửa bài viết" : "Thêm bài viết mới"}
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="title"
            label="Tiêu đề"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input placeholder="Ví dụ: 5 Cách bảo dưỡng điều hòa tại nhà" />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Đường dẫn (Slug)"
            rules={[
              { required: true, message: 'Vui lòng nhập đường dẫn' },
              { pattern: /^[a-z0-9-]+$/, message: 'Slug chỉ chứa chữ thường, số và dấu gạch ngang' }
            ]}
          >
            <Input placeholder="vi-du: 5-cach-bao-duong-dieu-hoa" />
          </Form.Item>

          <Form.Item name="image_urls" noStyle initialValue={[]}>
            <Input type="hidden" />
          </Form.Item>

          <Form.Item label="Ảnh bìa (Tối đa 3 ảnh)">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Upload
                customRequest={handleUpload}
                showUploadList={false}
                accept="image/jpeg,image/png,image/webp,image/gif"
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  Chọn ảnh tải lên
                </Button>
              </Upload>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.image_urls !== currentValues.image_urls}
              >
                {({ getFieldValue }) => {
                  const urls = getFieldValue('image_urls') || [];
                  return urls.length > 0 ? (
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {urls.map((url, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          <img src={resolveAssetUrl(url)} alt={`Cover Preview ${idx + 1}`} style={{ width: 120, height: 80, borderRadius: 8, objectFit: 'cover' }} />
                          <Button
                            size="small"
                            danger
                            style={{ position: 'absolute', top: -8, right: -8, borderRadius: '50%' }}
                            onClick={() => {
                              const newUrls = urls.filter((_, i) => i !== idx);
                              form.setFieldsValue({ image_urls: newUrls });
                            }}
                          >
                            X
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null;
                }}
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            name="content"
            label="Nội dung"
            rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
          >
            <ReactQuill
              theme="snow"
              placeholder="Nhập nội dung bài viết..."
              style={{ height: '400px', marginBottom: '40px' }}
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                  ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                  [{ 'align': [] }],
                  ['link', 'image', 'video'],
                  ['clean']
                ]
              }}
            />
          </Form.Item>

          <Form.Item
            name="is_published"
            label="Trạng thái xuất bản"
            valuePropName="checked"
          >
            <Switch checkedChildren="Hiện" unCheckedChildren="Ẩn" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={handleCloseModal}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {editingBlog ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
