import { Outlet } from 'react-router-dom';
import PublicNavbar from '../shared/PublicNavbar';
import PublicFooter from '../shared/PublicFooter';

export default function PublicLayout() {
  return (
    <div className="public-layout">
      <PublicNavbar />
      <main>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
