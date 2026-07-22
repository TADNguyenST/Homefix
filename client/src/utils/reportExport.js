import dayjs from 'dayjs';

const NAVY = '#172B4D';
const ORANGE = '#FF6B16';
const LIGHT_BLUE = '#EAF2FF';
const BORDER = '#D9E2F2';

const moneyFormat = '#,##0" đ"';

const textCell = (value, style = {}) => ({
  type: String,
  value: value === null || value === undefined || value === '' ? '-' : String(value),
  wrap: true,
  alignVertical: 'center',
  ...style,
});

const numberCell = (value, style = {}) => ({
  type: Number,
  value: Number(value || 0),
  alignVertical: 'center',
  ...style,
});

const moneyCell = (value, style = {}) => numberCell(value, {
  format: moneyFormat,
  align: 'right',
  ...style,
});

const titleRow = (title, columnCount) => [
  textCell(title, {
    span: columnCount,
    fontSize: 18,
    fontWeight: 'bold',
    color: NAVY,
    height: 30,
  }),
  ...Array(columnCount - 1).fill(null),
];

const subtitleRow = (subtitle, columnCount) => [
  textCell(subtitle, {
    span: columnCount,
    fontSize: 11,
    color: '#5E6C84',
    height: 22,
  }),
  ...Array(columnCount - 1).fill(null),
];

const headerRow = (headers) => headers.map((header) => textCell(header, {
  backgroundColor: NAVY,
  color: '#FFFFFF',
  fontWeight: 'bold',
  align: 'center',
  borderColor: BORDER,
  borderStyle: 'thin',
  height: 25,
}));

const dataRow = (cells, index) => cells.map((cell) => ({
  ...cell,
  backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F7F9FC',
  borderColor: BORDER,
  borderStyle: 'thin',
  height: 22,
}));

const emptyRow = (columnCount) => [
  textCell('Không có dữ liệu trong kỳ báo cáo', {
    span: columnCount,
    align: 'center',
    color: '#7A869A',
    fontStyle: 'italic',
    height: 28,
  }),
  ...Array(columnCount - 1).fill(null),
];

const createTableSheet = ({ title, period, headers, rows }) => {
  const count = headers.length;
  return [
    titleRow(title, count),
    subtitleRow(`Kỳ báo cáo: ${period}`, count),
    Array(count).fill(null),
    headerRow(headers),
    ...(rows.length ? rows.map(dataRow) : [emptyRow(count)]),
  ];
};

const createSummarySheet = (report, period) => {
  const summary = report.summary || {};
  const daily = report.dailyStats || [];
  const service = report.serviceStats || [];
  const paymentCount = (report.payments || []).length;

  return [
    [null, null, textCell('BÁO CÁO HOẠT ĐỘNG HOMEFIX', {
      span: 6,
      fontSize: 20,
      fontWeight: 'bold',
      color: NAVY,
      align: 'center',
      height: 32,
    }), null, null, null, null, null],
    [null, null, textCell(`Kỳ báo cáo: ${period}`, {
      span: 6,
      fontSize: 12,
      color: '#5E6C84',
      align: 'center',
      height: 24,
    }), null, null, null, null, null],
    Array(8).fill(null),
    [textCell('CHỈ SỐ TỔNG QUAN', {
      span: 8,
      backgroundColor: ORANGE,
      color: '#FFFFFF',
      fontWeight: 'bold',
      height: 26,
    }), null, null, null, null, null, null, null],
    [
      textCell('Tổng doanh thu khách trả', { span: 3, fontWeight: 'bold', backgroundColor: '#FFF5ED' }), null, null,
      moneyCell(summary.total_revenue, { span: 2, fontWeight: 'bold', color: ORANGE, backgroundColor: '#FFF5ED' }), null,
      textCell('Số giao dịch', { span: 2, fontWeight: 'bold', backgroundColor: '#FFF5ED' }), null,
      numberCell(paymentCount, { fontWeight: 'bold', backgroundColor: '#FFF5ED', align: 'center' }),
    ],
    [
      textCell('Doanh thu VNPAY', { span: 3 }), null, null,
      moneyCell(summary.vnpay_received, { span: 2 }), null,
      textCell('Tiền mặt đã thu', { span: 2 }), null,
      moneyCell(summary.cash_collected),
    ],
    [
      textCell('Tiền mặt đã đối soát', { span: 3, backgroundColor: '#F7F9FC' }), null, null,
      moneyCell(summary.cash_settled, { span: 2, backgroundColor: '#F7F9FC' }), null,
      textCell('Tiền kỹ thuật viên đang giữ', { span: 2, backgroundColor: '#F7F9FC' }), null,
      moneyCell(summary.cash_pending, { backgroundColor: '#F7F9FC' }),
    ],
    Array(8).fill(null),
    [textCell('DOANH THU THEO NGÀY', {
      span: 4,
      backgroundColor: NAVY,
      color: '#FFFFFF',
      fontWeight: 'bold',
      align: 'center',
    }), null, null, null, textCell('DỊCH VỤ NỔI BẬT', {
      span: 4,
      backgroundColor: NAVY,
      color: '#FFFFFF',
      fontWeight: 'bold',
      align: 'center',
    }), null, null, null],
    [
      textCell('Ngày', { fontWeight: 'bold', backgroundColor: LIGHT_BLUE, align: 'center' }),
      textCell('Số đơn', { fontWeight: 'bold', backgroundColor: LIGHT_BLUE, align: 'center' }),
      textCell('Doanh thu', { span: 2, fontWeight: 'bold', backgroundColor: LIGHT_BLUE, align: 'center' }), null,
      textCell('Dịch vụ', { span: 2, fontWeight: 'bold', backgroundColor: LIGHT_BLUE, align: 'center' }), null,
      textCell('Số đơn', { fontWeight: 'bold', backgroundColor: LIGHT_BLUE, align: 'center' }),
      textCell('Doanh thu', { fontWeight: 'bold', backgroundColor: LIGHT_BLUE, align: 'center' }),
    ],
    ...Array.from({ length: Math.max(Math.min(daily.length, 12), Math.min(service.length, 12), 1) }, (_, index) => {
      const day = daily[index];
      const item = service[index];
      return [
        textCell(day?.date),
        numberCell(day?.bookings, { align: 'center' }),
        moneyCell(day?.revenue, { span: 2 }), null,
        textCell(item?.name, { span: 2 }), null,
        numberCell(item?.bookings, { align: 'center' }),
        moneyCell(item?.revenue),
      ];
    }),
    Array(8).fill(null),
    [textCell('Báo cáo được tạo tự động từ dữ liệu giao dịch đã thanh toán của HomeFix.', {
      span: 8,
      color: '#7A869A',
      fontStyle: 'italic',
      align: 'center',
    }), null, null, null, null, null, null, null],
  ];
};

export const getReportPeriod = (dateRange) => {
  const start = dateRange?.[0]?.format('DD/MM/YYYY') || '-';
  const end = dateRange?.[1]?.format('DD/MM/YYYY') || '-';
  return `${start} - ${end}`;
};

export const exportReportExcel = async ({ report, dateRange }) => {
  const { default: writeXlsxFile } = await import('write-excel-file');
  const period = getReportPeriod(dateRange);
  const sheets = [];
  const sheetNames = [];
  const columns = [];

  sheets.push(createSummarySheet(report, period));
  sheetNames.push('Tổng quan');
  columns.push([
    { width: 18 }, { width: 12 }, { width: 18 }, { width: 14 },
    { width: 22 }, { width: 18 }, { width: 12 }, { width: 18 },
  ]);

  const tableDefinitions = [
    {
      name: 'Theo ngày', title: 'DOANH THU THEO NGÀY', widths: [18, 15, 22],
      headers: ['Ngày', 'Số đơn', 'Doanh thu'],
      rows: (report.dailyStats || []).map((item) => [
        textCell(item.date), numberCell(item.bookings, { align: 'center' }), moneyCell(item.revenue),
      ]),
    },
    {
      name: 'Dịch vụ', title: 'HIỆU QUẢ THEO DỊCH VỤ', widths: [36, 15, 22, 16],
      headers: ['Dịch vụ', 'Số đơn', 'Doanh thu', 'Tỷ trọng'],
      rows: (report.serviceStats || []).map((item) => [
        textCell(item.name), numberCell(item.bookings, { align: 'center' }), moneyCell(item.revenue),
        numberCell(Number(item.percentage || 0) / 100, { format: '0.0%', align: 'right' }),
      ]),
    },
    {
      name: 'Khu vực', title: 'HIỆU QUẢ THEO KHU VỰC', widths: [36, 15, 22, 16],
      headers: ['Khu vực', 'Số đơn', 'Doanh thu', 'Tỷ trọng'],
      rows: (report.districtStats || []).map((item) => [
        textCell(item.name), numberCell(item.bookings, { align: 'center' }), moneyCell(item.revenue),
        numberCell(Number(item.percentage || 0) / 100, { format: '0.0%', align: 'right' }),
      ]),
    },
    {
      name: 'Kỹ thuật viên', title: 'HIỆU SUẤT KỸ THUẬT VIÊN', widths: [34, 15, 22, 16],
      headers: ['Kỹ thuật viên', 'Số đơn', 'Doanh thu', 'Tỷ trọng'],
      rows: (report.technicianStats || []).map((item) => [
        textCell(item.name), numberCell(item.bookings, { align: 'center' }), moneyCell(item.revenue),
        numberCell(Number(item.percentage || 0) / 100, { format: '0.0%', align: 'right' }),
      ]),
    },
    {
      name: 'Khách hàng', title: 'KHÁCH HÀNG NỔI BẬT', widths: [12, 30, 18, 15, 22, 16],
      headers: ['Mã KH', 'Khách hàng', 'Số điện thoại', 'Số đơn', 'Chi tiêu', 'Tỷ trọng'],
      rows: (report.customerStats || []).map((item) => [
        numberCell(item.id, { align: 'center' }), textCell(item.name), textCell(item.phone),
        numberCell(item.bookings, { align: 'center' }), moneyCell(item.revenue),
        numberCell(Number(item.percentage || 0) / 100, { format: '0.0%', align: 'right' }),
      ]),
    },
    {
      name: 'Vật tư', title: 'VẬT TƯ VÀ HẠNG MỤC PHÁT SINH', widths: [42, 18, 24, 16],
      headers: ['Tên vật tư / Hạng mục', 'Số lượng', 'Doanh thu', 'Tỷ trọng'],
      rows: (report.quotationItemStats || []).map((item) => [
        textCell(item.name), numberCell(item.quantity, { align: 'center' }), moneyCell(item.revenue),
        numberCell(Number(item.percentage || 0) / 100, { format: '0.0%', align: 'right' }),
      ]),
    },
    {
      name: 'Giao dịch', title: 'CHI TIẾT GIAO DỊCH ĐÃ THANH TOÁN',
      widths: [12, 20, 26, 18, 28, 26, 16, 18, 18, 22],
      headers: ['Mã đơn', 'Ngày thanh toán', 'Khách hàng', 'Điện thoại', 'Dịch vụ', 'Kỹ thuật viên', 'Phương thức', 'Thanh toán', 'Đối soát', 'Số tiền'],
      rows: (report.payments || []).map((payment) => [
        numberCell(payment.booking?.id, { align: 'center' }),
        textCell(payment.paid_at ? dayjs(payment.paid_at).format('DD/MM/YYYY HH:mm') : '-'),
        textCell(payment.booking?.customer?.full_name),
        textCell(payment.booking?.customer?.phone),
        textCell(payment.booking?.service?.name),
        textCell(payment.booking?.technicianProfile?.user?.full_name),
        textCell(payment.method),
        textCell(payment.status),
        textCell(payment.settlement_status),
        moneyCell(payment.amount),
      ]),
    },
  ];

  tableDefinitions.forEach((definition) => {
    sheets.push(createTableSheet({
      title: definition.title,
      period,
      headers: definition.headers,
      rows: definition.rows,
    }));
    sheetNames.push(definition.name);
    columns.push(definition.widths.map((width) => ({ width })));
  });

  let logoBuffer;
  try {
    const logoResponse = await fetch('/logo.png');
    if (logoResponse.ok) logoBuffer = await logoResponse.arrayBuffer();
  } catch {
    logoBuffer = undefined;
  }

  const images = sheets.map(() => []);
  if (logoBuffer) {
    images[0].push({
      content: logoBuffer,
      contentType: 'image/png',
      width: 125,
      height: 54,
      dpi: 96,
      anchor: { row: 1, column: 1 },
      title: 'HomeFix',
      description: 'Logo HomeFix',
    });
  }

  await writeXlsxFile(sheets, {
    sheets: sheetNames,
    columns,
    images,
    fontFamily: 'Arial',
    fontSize: 11,
    orientation: 'landscape',
    showGridLines: false,
    fileName: `bao-cao-homefix-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`,
  });
};

const waitForImages = async (root) => {
  const pendingImages = Array.from(root.querySelectorAll('img'))
    .filter((image) => !image.complete)
    .map((image) => new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    }));
  await Promise.all(pendingImages);
};

export const exportReportPdf = async ({ root }) => {
  if (!root) throw new Error('Không thể khởi tạo nội dung báo cáo PDF');

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  await waitForImages(root);
  if (document.fonts?.ready) await document.fonts.ready;

  const pages = Array.from(root.querySelectorAll('[data-report-page]'));
  if (!pages.length) throw new Error('Báo cáo PDF không có nội dung');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const captureHost = document.createElement('div');
  Object.assign(captureHost.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: '794px',
    background: '#FFFFFF',
  });
  document.body.appendChild(captureHost);
  try {
    for (let index = 0; index < pages.length; index += 1) {
      const pageClone = pages[index].cloneNode(true);
      captureHost.replaceChildren(pageClone);
      await waitForImages(pageClone);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = await html2canvas(pageClone, {
        scale: 1.7,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        imageTimeout: 10000,
      });
      if (index > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }
  } finally {
    captureHost.remove();
  }

  pdf.save(`bao-cao-homefix-${dayjs().format('YYYYMMDD-HHmm')}.pdf`);
};
