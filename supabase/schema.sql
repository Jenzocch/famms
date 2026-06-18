-- ============================================================
-- PDP V1 — Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Departments ─────────────────────────────────────────────
CREATE TABLE departments (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO departments (name) VALUES
  ('Operations'), ('Finance'), ('Marketing'), ('IT'), ('HR'), ('Procurement'), ('Management');

-- ── Profiles (extends auth.users) ───────────────────────────
CREATE TYPE user_role AS ENUM ('applicant','dept_manager','general_manager','director','purchasing');

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'applicant',
  department_id UUID REFERENCES departments(id),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Purchase Requests ────────────────────────────────────────
CREATE TYPE request_status AS ENUM (
  'draft',
  'pending_dept_manager',
  'pending_general_manager',
  'pending_director',
  'approved',
  'rejected',
  'returned'
);

CREATE TABLE purchase_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  department_id   UUID NOT NULL REFERENCES departments(id),
  applicant_id    UUID NOT NULL REFERENCES profiles(id),
  purpose         TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  estimated_cost  NUMERIC(15,2) NOT NULL,
  status          request_status NOT NULL DEFAULT 'draft',
  -- denorm for fast approval routing
  current_approver_role user_role,
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Request Images ───────────────────────────────────────────
CREATE TABLE request_images (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name   TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Request Attachments ──────────────────────────────────────
CREATE TABLE request_attachments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id   UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  file_type    TEXT,
  file_size    INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Product URLs + Previews ──────────────────────────────────
CREATE TABLE request_urls (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  title       TEXT,
  description TEXT,
  thumbnail   TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Vendor Comparison ────────────────────────────────────────
CREATE TABLE vendors (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id     UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  vendor_name    TEXT NOT NULL,
  price          NUMERIC(15,2),
  delivery_days  INTEGER,
  payment_terms  TEXT,
  warranty       TEXT,
  remarks        TEXT,
  sort_order     INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── AI Analyses ──────────────────────────────────────────────
CREATE TABLE ai_analyses (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id       UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  summary          TEXT,
  business_purpose TEXT,
  advantages       TEXT[],
  risks            TEXT[],
  recommendation   TEXT,
  vendor_summary   JSONB,  -- {lowest_price, fastest_delivery, best_warranty, recommended}
  generated_at     TIMESTAMPTZ DEFAULT NOW(),
  generated_by     UUID REFERENCES profiles(id)
);

-- ── Approvals (audit trail) ──────────────────────────────────
CREATE TYPE approval_action AS ENUM ('approve','reject','return');

CREATE TABLE approvals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES profiles(id),
  role        user_role NOT NULL,
  action      approval_action NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Comments ─────────────────────────────────────────────────
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER purchase_requests_updated_at
  BEFORE UPDATE ON purchase_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Approval routing function ────────────────────────────────
-- Determines which role should approve next based on amount
CREATE OR REPLACE FUNCTION next_approver_role(amount NUMERIC, current_status request_status)
RETURNS user_role LANGUAGE plpgsql AS $$
BEGIN
  IF current_status = 'draft' THEN
    RETURN 'dept_manager';
  ELSIF current_status = 'pending_dept_manager' THEN
    IF amount > 5000000 THEN RETURN 'general_manager';
    ELSE RETURN NULL; -- goes to approved
    END IF;
  ELSIF current_status = 'pending_general_manager' THEN
    IF amount > 20000000 THEN RETURN 'director';
    ELSE RETURN NULL;
    END IF;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, edit only own
CREATE POLICY "profiles_read_all"   ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Departments: everyone can read
CREATE POLICY "departments_read" ON departments FOR SELECT USING (true);

-- Purchase Requests: complex rules via helper
CREATE POLICY "requests_select" ON purchase_requests FOR SELECT USING (
  applicant_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('dept_manager','general_manager','director','purchasing'))
);
CREATE POLICY "requests_insert" ON purchase_requests FOR INSERT WITH CHECK (applicant_id = auth.uid());
CREATE POLICY "requests_update" ON purchase_requests FOR UPDATE USING (
  applicant_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('dept_manager','general_manager','director'))
);

-- Related tables: inherit from request visibility
CREATE POLICY "images_select"      ON request_images      FOR SELECT USING (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND (r.applicant_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('dept_manager','general_manager','director','purchasing')))));
CREATE POLICY "images_insert"      ON request_images      FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND r.applicant_id = auth.uid()));
CREATE POLICY "images_delete"      ON request_images      FOR DELETE USING (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND r.applicant_id = auth.uid()));

CREATE POLICY "attachments_select" ON request_attachments FOR SELECT USING (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND (r.applicant_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('dept_manager','general_manager','director','purchasing')))));
CREATE POLICY "attachments_insert" ON request_attachments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND r.applicant_id = auth.uid()));

CREATE POLICY "urls_select"        ON request_urls        FOR SELECT USING (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND (r.applicant_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('dept_manager','general_manager','director','purchasing')))));
CREATE POLICY "urls_insert"        ON request_urls        FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND r.applicant_id = auth.uid()));
CREATE POLICY "urls_delete"        ON request_urls        FOR DELETE USING (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND r.applicant_id = auth.uid()));

CREATE POLICY "vendors_select"     ON vendors             FOR SELECT USING (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND (r.applicant_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('dept_manager','general_manager','director','purchasing')))));
CREATE POLICY "vendors_all"        ON vendors             FOR ALL    USING (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND r.applicant_id = auth.uid()));

CREATE POLICY "ai_select"          ON ai_analyses         FOR SELECT USING (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND (r.applicant_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('dept_manager','general_manager','director','purchasing')))));
CREATE POLICY "ai_insert"          ON ai_analyses         FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "approvals_select"   ON approvals           FOR SELECT USING (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND (r.applicant_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('dept_manager','general_manager','director','purchasing')))));
CREATE POLICY "approvals_insert"   ON approvals           FOR INSERT WITH CHECK (approver_id = auth.uid());

CREATE POLICY "comments_select"    ON comments            FOR SELECT USING (EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = request_id AND (r.applicant_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('dept_manager','general_manager','director','purchasing')))));
CREATE POLICY "comments_insert"    ON comments            FOR INSERT WITH CHECK (author_id = auth.uid());

-- ── Storage buckets (run in dashboard or via API) ─────────────
-- INSERT INTO storage.buckets (id, name, public) VALUES ('request-images', 'request-images', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('request-attachments', 'request-attachments', false);
