import { Button, Card, Col, Layout, Row, Tag, Typography } from 'antd';
import {
  HomeOutlined,
  LoginOutlined,
  ProfileOutlined,
  ToolOutlined,
  TagsOutlined,
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const modules = [
  { title: 'Authentication', owner: 'Member 1', items: ['Register', 'Login', 'Profile'] },
  { title: 'Customer Address', owner: 'Member 2', items: ['Address CRUD', 'Default Address'] },
  { title: 'Categories', owner: 'Member 3', items: ['Category CRUD'] },
  { title: 'Services & Devices', owner: 'Member 4', items: ['Service CRUD', 'Device Type CRUD'] },
  { title: 'Vouchers', owner: 'Member 5', items: ['Voucher CRUD', 'Available Vouchers'] },
];

export default function App() {
  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="brand">
          <HomeOutlined />
          <span>HomeFix</span>
        </div>
        <div className="header-actions">
          <Button icon={<LoginOutlined />}>Login</Button>
          <Button type="primary" icon={<ProfileOutlined />}>Profile</Button>
        </div>
      </Header>
      <Content className="app-content">
        <section className="intro">
          <Tag color="orange">Iteration 1</Tag>
          <Title level={2}>Home appliance repair management</Title>
          <Text type="secondary">
            Starter interface for CRUD modules before booking, AI and payment are added.
          </Text>
        </section>

        <Row gutter={[16, 16]}>
          {modules.map((module) => (
            <Col xs={24} md={12} lg={8} key={module.title}>
              <Card
                title={module.title}
                extra={<Tag>{module.owner}</Tag>}
                className="module-card"
              >
                {module.items.map((item) => (
                  <div className="module-row" key={item}>
                    <ToolOutlined />
                    <span>{item}</span>
                  </div>
                ))}
                <Button block icon={<TagsOutlined />} style={{ marginTop: 16 }}>
                  Open module
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      </Content>
    </Layout>
  );
}

