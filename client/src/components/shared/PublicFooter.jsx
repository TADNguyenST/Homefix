import { Link } from 'react-router-dom';

export default function PublicFooter() {
  return (
    <footer className="homefix-footer">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px' }}>
        <div>
          <h4>HomeFix</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Nền tảng sửa chữa nhà cửa với chẩn đoán tự động, thợ uy tín, giá minh bạch.</p>
        </div>
        <div>
          <h4>Dịch vụ</h4>
          <Link to="/services">Sửa điện</Link>
          <Link to="/services">Sửa nước</Link>
          <Link to="/services">Sửa điều hòa</Link>
          <Link to="/services">Sửa máy giặt</Link>
        </div>
        <div>
          <h4>Hỗ trợ</h4>
          <Link to="#">Liên hệ</Link>
          <Link to="#">FAQ</Link>
          <Link to="#">Điều khoản</Link>
        </div>
        <div>
          <h4>Liên hệ</h4>
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            <p>Hotline: 1900 1234</p>
            <p>Email: support@homefix.vn</p>
            <p>Cần Thơ</p>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '32px', paddingTop: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        &copy; 2026 HomeFix. All rights reserved.
      </div>
    </footer>
  );
}
