import { Routes, Route } from 'react-router-dom';

// Layouts
import PublicLayout from './components/layouts/PublicLayout';
import CustomerLayout from './components/layouts/CustomerLayout';
import TechLayout from './components/layouts/TechLayout';
import AdminLayout from './components/layouts/AdminLayout';

// Shared & Auth
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';
import LandingPage from './pages/public/LandingPage';
import ServiceListPage from './pages/public/ServiceListPage';
import ServiceDetailPage from './pages/public/ServiceDetailPage';
import NotificationPage from './pages/public/NotificationPage';

// Dashboards (Placeholders)
import CustomerDashboard from './pages/customer/CustomerDashboard';
import BookingFormPage from './pages/customer/BookingFormPage';
import BookingListPage from './pages/customer/BookingListPage';
import BookingDetailPage from './pages/customer/BookingDetailPage';
import QuotationDetailPage from './pages/customer/QuotationDetailPage';
import PaymentResultPage from './pages/customer/PaymentResultPage';
import ReviewPage from './pages/customer/ReviewPage';
import ComplaintPage from './pages/customer/ComplaintPage';
import AddressPage from './pages/customer/AddressPage';
import CustomerVouchersPage from './pages/customer/CustomerVouchersPage';
import AccountProfilePage from './pages/shared/AccountProfilePage';

// Technician Routes
import TechDashboard from './pages/technician/TechDashboard';
import TechJobsPage from './pages/technician/TechJobsPage';
import TechJobDetailPage from './pages/technician/TechJobDetailPage';
import TechQuotationForm from './pages/technician/TechQuotationForm';
import TechSchedulePage from './pages/technician/TechSchedulePage';
import TechHistoryPage from './pages/technician/TechHistoryPage';
import TechRatingPage from './pages/technician/TechRatingPage';

// Admin Routes
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminBookingsPage from './pages/admin/AdminBookingsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminTechniciansPage from './pages/admin/AdminTechniciansPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminServicesPage from './pages/admin/AdminServicesPage';
import AdminDeviceTypesPage from './pages/admin/AdminDeviceTypesPage';
import AdminDistrictsPage from './pages/admin/AdminDistrictsPage';
import AdminVouchersPage from './pages/admin/AdminVouchersPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminPaymentDetailPage from './pages/admin/AdminPaymentDetailPage';
import AdminComplaintsPage from './pages/admin/AdminComplaintsPage';

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/services" element={<ServiceListPage />} />
        <Route path="/services/:id" element={<ServiceDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Customer Routes */}
      <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
        <Route path="/customer" element={<CustomerLayout />}>
          <Route index element={<CustomerDashboard />} />
          <Route path="booking" element={<BookingFormPage />} />
          <Route path="bookings" element={<BookingListPage />} />
          <Route path="bookings/:id" element={<BookingDetailPage />} />
          <Route path="quotations/:id" element={<QuotationDetailPage />} />
          <Route path="payment-result" element={<PaymentResultPage />} />
          <Route path="reviews/new/:bookingId" element={<ReviewPage />} />
          <Route path="complaints" element={<ComplaintPage />} />
          <Route path="vouchers" element={<CustomerVouchersPage />} />
          <Route path="addresses" element={<AddressPage />} />
          <Route path="profile" element={<AccountProfilePage />} />
          <Route path="notifications" element={<NotificationPage />} />
        </Route>
      </Route>

      {/* Technician Routes */}
      <Route element={<ProtectedRoute allowedRoles={['TECHNICIAN']} />}>
        <Route path="/technician" element={<TechLayout />}>
          <Route index element={<TechDashboard />} />
          <Route path="jobs" element={<TechJobsPage />} />
          <Route path="jobs/:id" element={<TechJobDetailPage />} />
          <Route path="jobs/:id/quotation" element={<TechQuotationForm />} />
          <Route path="schedule" element={<TechSchedulePage />} />
          <Route path="history" element={<TechHistoryPage />} />
          <Route path="rating" element={<TechRatingPage />} />
          <Route path="profile" element={<AccountProfilePage />} />
          <Route path="notifications" element={<NotificationPage />} />
        </Route>
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="bookings" element={<AdminBookingsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="technicians" element={<AdminTechniciansPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="services" element={<AdminServicesPage />} />
          <Route path="device-types" element={<AdminDeviceTypesPage />} />
          <Route path="districts" element={<AdminDistrictsPage />} />
          <Route path="vouchers" element={<AdminVouchersPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="payments/:id" element={<AdminPaymentDetailPage />} />
          <Route path="complaints" element={<AdminComplaintsPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="notifications" element={<NotificationPage />} />
          <Route path="profile" element={<AccountProfilePage />} />
        </Route>
      </Route>

      {/* Fallback 404 */}
      <Route path="*" element={<div style={{ textAlign: 'center', padding: '50px' }}>404 Not Found</div>} />
    </Routes>
  );
}

export default App;
