INSERT INTO services (
  category_id,
  name,
  description,
  base_price,
  estimated_duration,
  is_active,
  is_deleted,
  created_at,
  updated_at
)
SELECT
  category.id,
  inspection.name,
  'Phí khảo sát ban đầu tại nhà; kỹ thuật viên sẽ kiểm tra và báo giá trước khi sửa chữa.',
  150000,
  45,
  TRUE,
  FALSE,
  NOW(),
  NOW()
FROM service_categories AS category
JOIN (
  VALUES
    ('Điện lạnh', 'Khảo sát điện lạnh'),
    ('Thiết bị giặt sấy', 'Khảo sát thiết bị giặt sấy'),
    ('Thiết bị bếp', 'Khảo sát thiết bị bếp'),
    ('Điện gia dụng', 'Khảo sát điện gia dụng'),
    ('Cấp thoát nước', 'Khảo sát cấp thoát nước')
) AS inspection(category_name, name)
  ON inspection.category_name = category.name
WHERE category.is_deleted = FALSE
  AND NOT EXISTS (
    SELECT 1
    FROM services AS existing
    WHERE existing.category_id = category.id
      AND LOWER(existing.name) = LOWER(inspection.name)
  );
