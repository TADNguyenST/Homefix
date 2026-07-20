const querystring = require('querystring');

const encodeVnpValue = (value) => encodeURIComponent(String(value)).replace(/%20/g, '+');

const sortVnpParams = (params) => Object.keys(params)
  .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
  .sort()
  .reduce((result, key) => {
    result[key] = encodeVnpValue(params[key]);
    return result;
  }, {});

const stringifyVnpParams = (params) => querystring.stringify(
  sortVnpParams(params),
  '&',
  '=',
  { encodeURIComponent: (value) => value },
);

const formatVnpDate = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}${value.hour}${value.minute}${value.second}`;
};

const normalizeVnpIp = (value) => {
  const ip = String(value || '').split(',')[0].trim();

  if (!ip || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }

  return ip.replace(/^::ffff:/, '');
};

const createVnpTxnRef = (bookingId, timestamp = Date.now()) =>
  `HF${bookingId}${timestamp}`;

module.exports = {
  sortVnpParams,
  stringifyVnpParams,
  formatVnpDate,
  normalizeVnpIp,
  createVnpTxnRef,
};
