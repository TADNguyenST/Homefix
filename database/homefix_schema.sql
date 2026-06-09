-- ============================================================
-- HOMEFIX AI — DATABASE SCHEMA (PostgreSQL)
-- 23 Tables | 11 Enums
-- Generated for ERD Drawing
-- ============================================================

-- ========================
-- ENUMS
-- ========================

CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'TECHNICIAN', 'ADMIN');
CREATE TYPE "DistrictType" AS ENUM ('QUAN', 'HUYEN');
CREATE TYPE "WardType" AS ENUM ('PHUONG', 'XA', 'THI_TRAN');
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'EXPERT');
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE "PaymentMethod" AS ENUM ('VNPAY', 'CASH');
CREATE TYPE "UploaderType" AS ENUM ('CUSTOMER', 'TECHNICIAN');
CREATE TYPE "QuotationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED');
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- ========================
-- NHÓM 1: USER & AUTH
-- ========================

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            "Role" NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(15),
    avatar_url      VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE password_reset_tokens (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL,
    otp_code        VARCHAR(6) NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    used_at         TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================
-- NHÓM 2: ĐỊA LÝ & ĐỊA CHỈ
-- ========================

CREATE TABLE districts (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    type            "DistrictType" NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE wards (
    id              SERIAL PRIMARY KEY,
    district_id     INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    type            "WardType" NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ward_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE
);

CREATE TABLE customer_addresses (
    id              SERIAL PRIMARY KEY,
    customer_id     INT NOT NULL,
    district_id     INT NOT NULL,
    ward_id         INT NOT NULL,
    address_detail  VARCHAR(500) NOT NULL,
    label           VARCHAR(50) NOT NULL DEFAULT 'Nhà',
    is_default      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ca_user FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ca_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE,
    CONSTRAINT fk_ca_ward FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE CASCADE
);

-- ========================
-- NHÓM 3: DỊCH VỤ & THIẾT BỊ
-- ========================

CREATE TABLE service_categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    icon_url        VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE services (
    id                  SERIAL PRIMARY KEY,
    category_id         INT NOT NULL,
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    base_price          DECIMAL(12,0) NOT NULL,
    estimated_duration  INT NOT NULL,
    image_url           VARCHAR(500),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_service_category FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE CASCADE
);

CREATE TABLE device_types (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- NHÓM 4: KỸ THUẬT VIÊN
-- ========================

CREATE TABLE technician_profiles (
    id                      SERIAL PRIMARY KEY,
    user_id                 INT NOT NULL UNIQUE,
    district_id             INT,
    years_of_experience     INT NOT NULL DEFAULT 0,
    bio                     TEXT,
    avg_rating              DECIMAL(2,1) NOT NULL DEFAULT 0.0,
    total_completed_jobs    INT NOT NULL DEFAULT 0,
    is_available            BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tp_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL
);

CREATE TABLE technician_skills (
    id                      SERIAL PRIMARY KEY,
    technician_profile_id   INT NOT NULL,
    service_id              INT NOT NULL,
    skill_level             "SkillLevel" NOT NULL,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ts_profile FOREIGN KEY (technician_profile_id) REFERENCES technician_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_ts_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    CONSTRAINT uq_tech_service UNIQUE (technician_profile_id, service_id)
);

CREATE TABLE technician_schedules (
    id                      SERIAL PRIMARY KEY,
    technician_profile_id   INT NOT NULL,
    day_of_week             INT NOT NULL,
    start_time              VARCHAR(5) NOT NULL,
    end_time                VARCHAR(5) NOT NULL,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_tsch_profile FOREIGN KEY (technician_profile_id) REFERENCES technician_profiles(id) ON DELETE CASCADE
);

-- ========================
-- NHÓM 5: VOUCHER
-- ========================

CREATE TABLE vouchers (
    id                  SERIAL PRIMARY KEY,
    code                VARCHAR(50) NOT NULL UNIQUE,
    discount_type       "DiscountType" NOT NULL,
    discount_value      DECIMAL(12,0) NOT NULL,
    min_order_amount    DECIMAL(12,0) NOT NULL DEFAULT 0,
    max_discount        DECIMAL(12,0),
    usage_limit         INT NOT NULL,
    used_count          INT NOT NULL DEFAULT 0,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- NHÓM 6: BOOKING (TRUNG TÂM)
-- ========================

CREATE TABLE bookings (
    id                      SERIAL PRIMARY KEY,
    customer_id             INT NOT NULL,
    technician_profile_id   INT,
    service_id              INT NOT NULL,
    device_type_id          INT,
    description             TEXT NOT NULL,
    customer_address_id     INT,
    district_id             INT NOT NULL,
    ward_id                 INT NOT NULL,
    address_detail          VARCHAR(500) NOT NULL,
    booking_date            DATE NOT NULL,
    time_slot_start         VARCHAR(5) NOT NULL,
    time_slot_end           VARCHAR(5) NOT NULL,
    status                  VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    estimated_price         DECIMAL(12,0) NOT NULL,
    final_price             DECIMAL(12,0),
    payment_method          "PaymentMethod" NOT NULL,
    voucher_id              INT,
    discount_amount         DECIMAL(12,0) NOT NULL DEFAULT 0,
    inspection_note         TEXT,
    ai_severity             VARCHAR(20),
    ai_summary              TEXT,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_bk_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_bk_tech FOREIGN KEY (technician_profile_id) REFERENCES technician_profiles(id) ON DELETE SET NULL,
    CONSTRAINT fk_bk_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    CONSTRAINT fk_bk_device FOREIGN KEY (device_type_id) REFERENCES device_types(id) ON DELETE SET NULL,
    CONSTRAINT fk_bk_address FOREIGN KEY (customer_address_id) REFERENCES customer_addresses(id) ON DELETE SET NULL,
    CONSTRAINT fk_bk_district FOREIGN KEY (district_id) REFERENCES districts(id),
    CONSTRAINT fk_bk_ward FOREIGN KEY (ward_id) REFERENCES wards(id),
    CONSTRAINT fk_bk_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL
);

CREATE TABLE booking_images (
    id              SERIAL PRIMARY KEY,
    booking_id      INT NOT NULL,
    image_url       VARCHAR(500) NOT NULL,
    uploaded_by     "UploaderType" NOT NULL,
    uploaded_at     TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_bi_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE booking_status_history (
    id              SERIAL PRIMARY KEY,
    booking_id      INT NOT NULL,
    from_status     VARCHAR(30),
    to_status       VARCHAR(30) NOT NULL,
    changed_by      INT NOT NULL,
    note            TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_bsh_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_bsh_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================
-- NHÓM 7: BÁO GIÁ
-- ========================

CREATE TABLE quotations (
    id                  SERIAL PRIMARY KEY,
    booking_id          INT NOT NULL,
    total_extra_price   DECIMAL(12,0) NOT NULL,
    note                TEXT,
    status              "QuotationStatus" NOT NULL DEFAULT 'PENDING',
    created_by          INT NOT NULL,
    responded_by        INT,
    responded_at        TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_qt_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_qt_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_qt_responder FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE quotation_items (
    id              SERIAL PRIMARY KEY,
    quotation_id    INT NOT NULL,
    item_name       VARCHAR(200) NOT NULL,
    quantity        INT NOT NULL DEFAULT 1,
    unit_price      DECIMAL(12,0) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_qi_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
);

-- ========================
-- NHÓM 8: THANH TOÁN
-- ========================

CREATE TABLE payments (
    id                  SERIAL PRIMARY KEY,
    booking_id          INT NOT NULL UNIQUE,
    amount              DECIMAL(12,0) NOT NULL,
    method              "PaymentMethod" NOT NULL,
    status              "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    transaction_code    VARCHAR(100),
    vnpay_txn_ref       VARCHAR(100),
    vnpay_response_code VARCHAR(10),
    payment_url         TEXT,
    failed_reason       VARCHAR(255),
    paid_at             TIMESTAMP,
    confirmed_by        INT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_pm_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_pm_confirmer FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================
-- NHÓM 9: ĐÁNH GIÁ & KHIẾU NẠI
-- ========================

CREATE TABLE reviews (
    id                      SERIAL PRIMARY KEY,
    booking_id              INT NOT NULL UNIQUE,
    customer_id             INT NOT NULL,
    technician_profile_id   INT NOT NULL,
    rating                  INT NOT NULL,
    comment                 TEXT,
    ai_sentiment            "Sentiment",
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_rv_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_rv_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_rv_tech FOREIGN KEY (technician_profile_id) REFERENCES technician_profiles(id) ON DELETE CASCADE,
    CONSTRAINT chk_rating CHECK (rating >= 1 AND rating <= 5)
);

CREATE TABLE complaints (
    id              SERIAL PRIMARY KEY,
    booking_id      INT NOT NULL,
    customer_id     INT NOT NULL,
    subject         VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,
    status          "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    admin_response  TEXT,
    ai_sentiment    "Sentiment",
    resolved_at     TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_cp_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_cp_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================
-- NHÓM 10: THÔNG BÁO & AI
-- ========================

CREATE TABLE notifications (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    type            VARCHAR(50) NOT NULL,
    reference_id    INT,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_nf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE ai_analysis (
    id                  SERIAL PRIMARY KEY,
    booking_id          INT NOT NULL,
    input_text          TEXT NOT NULL,
    suggested_services  JSON,
    severity            VARCHAR(20),
    tech_summary        TEXT,
    raw_response        JSON,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ai_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- ========================
-- NHÓM VOUCHER USAGE (bảng trung gian)
-- ========================

CREATE TABLE voucher_usages (
    id              SERIAL PRIMARY KEY,
    voucher_id      INT NOT NULL,
    user_id         INT NOT NULL,
    booking_id      INT NOT NULL,
    used_at         TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_vu_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
    CONSTRAINT fk_vu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_vu_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT uq_voucher_booking UNIQUE (voucher_id, booking_id)
);

-- ============================================================
-- END OF SCHEMA
-- 23 Tables | 11 Enums | Full Foreign Keys & Constraints
-- ============================================================
