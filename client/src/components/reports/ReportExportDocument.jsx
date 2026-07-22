import { forwardRef, useMemo } from 'react';
import dayjs from 'dayjs';
import { getReportPeriod } from '../../utils/reportExport';

const COLORS = ['#FF6B16', '#1677FF', '#22A06B', '#7C5CFC', '#E5484D', '#FFB020'];
const PAGE_SIZE = 16;

const currency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;
const text = (value) => value === null || value === undefined || value === '' ? '-' : String(value);

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

const reportStyles = {
  page: {
    width: 794,
    height: 1123,
    padding: '42px 46px 38px',
    boxSizing: 'border-box',
    background: '#FFFFFF',
    color: '#172B4D',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11 },
  th: { background: '#172B4D', color: '#FFFFFF', padding: '9px 8px', textAlign: 'left', border: '1px solid #D9E2F2' },
  td: { padding: '8px', border: '1px solid #D9E2F2', verticalAlign: 'top', wordBreak: 'break-word' },
};

function PageHeader({ period }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottom: '2px solid #FF6B16', marginBottom: 22 }}>
      <img src="/logo.png" alt="HomeFix" style={{ width: 116, height: 48, objectFit: 'contain' }} />
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 12, color: '#5E6C84' }}>BÁO CÁO HOẠT ĐỘNG HỆ THỐNG</div>
        <div style={{ fontSize: 11, color: '#7A869A', marginTop: 5 }}>{period}</div>
      </div>
    </div>
  );
}

function PageFooter({ page, total }) {
  return (
    <div style={{ position: 'absolute', left: 46, right: 46, bottom: 17, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#7A869A', borderTop: '1px solid #E6EAF0', paddingTop: 8 }}>
      <span>HomeFix - Báo cáo nội bộ</span>
      <span>Trang {page}/{total}</span>
    </div>
  );
}

function Kpi({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 0, border: '1px solid #E6EAF0', borderTop: `4px solid ${color}`, padding: '16px 14px', background: '#FAFBFC' }}>
      <div style={{ color: '#5E6C84', fontSize: 10, textTransform: 'uppercase', minHeight: 26 }}>{label}</div>
      <div style={{ color, fontWeight: 700, fontSize: 19, marginTop: 8, whiteSpace: 'nowrap' }}>{currency(value)}</div>
    </div>
  );
}

function BarList({ title, items, valueKey = 'revenue', labelKey = 'name', limit = 7 }) {
  const visible = items.slice(0, limit);
  const max = Math.max(...visible.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <div style={{ flex: 1, border: '1px solid #E6EAF0', padding: 16, minHeight: 270 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 15 }}>{title}</div>
      {visible.length === 0 && <div style={{ color: '#7A869A', fontSize: 11 }}>Không có dữ liệu trong kỳ.</div>}
      {visible.map((item, index) => (
        <div key={`${item[labelKey]}-${index}`} style={{ marginBottom: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 10, marginBottom: 5 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text(item[labelKey])}</span>
            <strong>{currency(item[valueKey])}</strong>
          </div>
          <div style={{ height: 8, background: '#EDF1F7' }}>
            <div style={{ width: `${Math.max((Number(item[valueKey] || 0) / max) * 100, 2)}%`, height: '100%', background: COLORS[index % COLORS.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OverviewPage({ report, period, page, total }) {
  const summary = report.summary || {};
  const paymentTotal = (report.payments || []).length;
  return (
    <div data-report-page style={reportStyles.page}>
      <PageHeader period={period} />
      <div style={{ background: '#172B4D', color: '#FFFFFF', padding: '22px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#B3C0D4' }}>TỔNG DOANH THU KHÁCH HÀNG ĐÃ THANH TOÁN</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#FF8B43' }}>{currency(summary.total_revenue)}</div>
          <div style={{ fontSize: 12 }}>{paymentTotal} giao dịch thành công</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 11, marginBottom: 20 }}>
        <Kpi label="VNPAY đã nhận" value={summary.vnpay_received} color="#1677FF" />
        <Kpi label="Tiền mặt đã đối soát" value={summary.cash_settled} color="#22A06B" />
        <Kpi label="Kỹ thuật viên đang giữ" value={summary.cash_pending} color="#FF8B00" />
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <BarList title="Doanh thu theo ngày" items={(report.dailyStats || []).map((item) => ({ ...item, name: item.date }))} />
        <BarList title="Dịch vụ đóng góp nhiều nhất" items={report.serviceStats || []} />
      </div>
      <div style={{ marginTop: 20, padding: 15, background: '#FFF5ED', borderLeft: '4px solid #FF6B16', fontSize: 11, lineHeight: 1.55 }}>
        <strong>Phạm vi số liệu:</strong> chỉ bao gồm giao dịch có trạng thái đã thanh toán trong kỳ. Tiền mặt đang giữ chưa được xem là tiền công ty đã nhận cho đến khi hoàn tất đối soát.
      </div>
      <PageFooter page={page} total={total} />
    </div>
  );
}

function DetailPage({ descriptor, rows, page, total, chunkIndex, chunkCount }) {
  return (
    <div data-report-page style={reportStyles.page}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: '#172B4D', fontSize: 9, fontWeight: 700, marginBottom: 12 }}>HOMEFIX - BÁO CÁO CHI TIẾT</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{descriptor.title}</div>
        <div style={{ marginTop: 5, fontSize: 10, color: '#7A869A' }}>
          {chunkCount > 1 ? `Phần ${chunkIndex + 1}/${chunkCount} - ` : ''}{rows.length} dòng trên trang
        </div>
      </div>
      <table style={reportStyles.table}>
        <colgroup>
          {descriptor.columns.map((column) => <col key={column.key} style={{ width: column.width }} />)}
        </colgroup>
        <thead>
          <tr>{descriptor.columns.map((column) => <th key={column.key} style={{ ...reportStyles.th, textAlign: column.align || 'left' }}>{column.title}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${descriptor.key}-${chunkIndex}-${index}`} style={{ background: index % 2 ? '#F7F9FC' : '#FFFFFF' }}>
              {descriptor.columns.map((column) => (
                <td key={column.key} style={{ ...reportStyles.td, textAlign: column.align || 'left' }}>
                  {column.render ? column.render(row) : text(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <PageFooter page={page} total={total} />
    </div>
  );
}

const ReportExportDocument = forwardRef(function ReportExportDocument({ report, dateRange }, ref) {
  const period = getReportPeriod(dateRange);
  const descriptors = useMemo(() => [
    {
      key: 'daily', title: 'Doanh thu theo ngày', rows: report.dailyStats || [],
      columns: [
        { key: 'date', title: 'Ngày', width: '32%' },
        { key: 'bookings', title: 'Số đơn', width: '28%', align: 'center' },
        { key: 'revenue', title: 'Doanh thu', width: '40%', align: 'right', render: (row) => currency(row.revenue) },
      ],
    },
    {
      key: 'service', title: 'Hiệu quả theo dịch vụ', rows: report.serviceStats || [],
      columns: [
        { key: 'name', title: 'Dịch vụ', width: '46%' },
        { key: 'bookings', title: 'Số đơn', width: '20%', align: 'center' },
        { key: 'revenue', title: 'Doanh thu', width: '34%', align: 'right', render: (row) => currency(row.revenue) },
      ],
    },
    {
      key: 'district', title: 'Hiệu quả theo khu vực', rows: report.districtStats || [],
      columns: [
        { key: 'name', title: 'Khu vực', width: '46%' },
        { key: 'bookings', title: 'Số đơn', width: '20%', align: 'center' },
        { key: 'revenue', title: 'Doanh thu', width: '34%', align: 'right', render: (row) => currency(row.revenue) },
      ],
    },
    {
      key: 'technician', title: 'Hiệu suất kỹ thuật viên', rows: report.technicianStats || [],
      columns: [
        { key: 'name', title: 'Kỹ thuật viên', width: '46%' },
        { key: 'bookings', title: 'Số đơn', width: '20%', align: 'center' },
        { key: 'revenue', title: 'Doanh thu', width: '34%', align: 'right', render: (row) => currency(row.revenue) },
      ],
    },
    {
      key: 'customer', title: 'Khách hàng nổi bật', rows: report.customerStats || [],
      columns: [
        { key: 'name', title: 'Khách hàng', width: '32%' },
        { key: 'phone', title: 'Điện thoại', width: '23%' },
        { key: 'bookings', title: 'Số đơn', width: '16%', align: 'center' },
        { key: 'revenue', title: 'Chi tiêu', width: '29%', align: 'right', render: (row) => currency(row.revenue) },
      ],
    },
    {
      key: 'material', title: 'Vật tư và hạng mục phát sinh', rows: report.quotationItemStats || [],
      columns: [
        { key: 'name', title: 'Vật tư / Hạng mục', width: '48%' },
        { key: 'quantity', title: 'Số lượng', width: '20%', align: 'center' },
        { key: 'revenue', title: 'Doanh thu', width: '32%', align: 'right', render: (row) => currency(row.revenue) },
      ],
    },
    {
      key: 'payment', title: 'Chi tiết giao dịch đã thanh toán', rows: report.payments || [], pageSize: 12,
      columns: [
        { key: 'booking', title: 'Đơn', width: '8%', align: 'center', render: (row) => `#${text(row.booking?.id)}` },
        { key: 'date', title: 'Thanh toán', width: '16%', render: (row) => row.paid_at ? dayjs(row.paid_at).format('DD/MM/YYYY HH:mm') : '-' },
        { key: 'customer', title: 'Khách hàng', width: '18%', render: (row) => text(row.booking?.customer?.full_name) },
        { key: 'service', title: 'Dịch vụ', width: '20%', render: (row) => text(row.booking?.service?.name) },
        { key: 'technician', title: 'Kỹ thuật viên', width: '17%', render: (row) => text(row.booking?.technicianProfile?.user?.full_name) },
        { key: 'method', title: 'PT', width: '8%', align: 'center' },
        { key: 'amount', title: 'Số tiền', width: '13%', align: 'right', render: (row) => currency(row.amount) },
      ],
    },
  ], [report]);

  const detailPages = descriptors.flatMap((descriptor) => {
    if (!descriptor.rows.length) return [];
    const chunks = chunk(descriptor.rows, descriptor.pageSize || PAGE_SIZE);
    return chunks.map((rows, chunkIndex) => ({ descriptor, rows, chunkIndex, chunkCount: chunks.length }));
  });
  const total = detailPages.length + 1;

  return (
    <div ref={ref} aria-hidden="true" style={{ position: 'fixed', left: -12000, top: 0, width: 794, zIndex: -1 }}>
      <OverviewPage report={report} period={period} page={1} total={total} />
      {detailPages.map((item, index) => (
        <DetailPage
          key={`${item.descriptor.key}-${item.chunkIndex}`}
          {...item}
          period={period}
          page={index + 2}
          total={total}
        />
      ))}
    </div>
  );
});

export default ReportExportDocument;
