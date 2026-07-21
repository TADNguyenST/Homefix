const test = require('node:test');
const assert = require('node:assert/strict');

const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
process.env.CLOUDINARY_CLOUD_NAME = 'homefix-test';

const { getOwnedStorageKey, _test } = require('../src/services/imageStorageService');

test.after(() => {
  if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
  else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
});

test('đọc đúng public ID từ URL Cloudinary của HomeFix', () => {
  const url = 'https://res.cloudinary.com/homefix-test/image/upload/v1780000000/homefix/uploads/7-example.jpg';
  assert.equal(_test.parseCloudinaryPublicId(url), 'homefix/uploads/7-example');
  assert.deepEqual(getOwnedStorageKey(url, 7), {
    provider: 'cloudinary',
    key: 'homefix/uploads/7-example',
    url,
  });
});

test('chỉ chủ sở hữu mới có thể xóa ảnh Cloudinary hoặc ảnh local', () => {
  const cloudUrl = 'https://res.cloudinary.com/homefix-test/image/upload/v1780000000/homefix/uploads/7-example.jpg';
  assert.equal(getOwnedStorageKey(cloudUrl, 8), null);
  assert.equal(getOwnedStorageKey('/uploads/7-example.jpg', 7)?.provider, 'local');
  assert.equal(getOwnedStorageKey('/uploads/7-example.jpg', 8), null);
});

test('không nhận URL từ Cloudinary cloud khác hoặc host giả mạo', () => {
  assert.equal(_test.parseCloudinaryPublicId('https://res.cloudinary.com/other/image/upload/v1/homefix/uploads/7-a.jpg'), null);
  assert.equal(_test.parseCloudinaryPublicId('https://example.com/homefix/uploads/7-a.jpg'), null);
});
