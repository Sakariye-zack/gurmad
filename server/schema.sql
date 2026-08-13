-- Gurmad Waste Management System — Live Database Schema
-- Auto-generated snapshot of the ACTUAL live Supabase schema (public schema), not a hand-maintained file.
-- Generated: 2026-08-13T14:38:54.005Z
--
-- Why this file exists: the live schema was previously spread across 30+ one-off scripts
-- (migrate_*.js, fix_*.js) with no single source of truth. This file is that source of truth --
-- it reflects exactly what is live right now. Regenerate it any time the schema changes with:
--   cd server && node scripts/dump_schema.js
--
-- This does NOT replace server/index.js's runMigrations() — that function is still what
-- actually applies changes to the live database on every server start (idempotent
-- CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS statements). This file is
-- read-only documentation of the result, regenerated periodically, not an executable migration.

-- Table: archives
CREATE TABLE IF NOT EXISTS archives (
  id INTEGER NOT NULL DEFAULT nextval('archives_id_seq'::regclass) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_size BIGINT,
  uploaded_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  doc_ref VARCHAR(100),
  description TEXT
);

-- Table: attendance
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER NOT NULL DEFAULT nextval('attendance_id_seq'::regclass) PRIMARY KEY,
  employee_id INTEGER,
  date DATE DEFAULT CURRENT_DATE,
  clock_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  clock_out TIMESTAMP,
  clock_in_photo TEXT,
  clock_out_photo TEXT,
  status VARCHAR(20) DEFAULT 'Present'::character varying
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER NOT NULL DEFAULT nextval('audit_logs_id_seq'::regclass) PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(50),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NOTE: blog_comments / blog_posts / blog_users below are NOT part of the Gurmad application.
-- They share the same Supabase project but belong to an unrelated project/experiment.
-- Table: blog_comments
CREATE TABLE IF NOT EXISTS blog_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES blog_posts(id),
  user_id UUID REFERENCES blog_users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: blog_posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES blog_users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMPTZ DEFAULT now()
);

-- Table: blog_users
CREATE TABLE IF NOT EXISTS blog_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: cashier_assignments
CREATE TABLE IF NOT EXISTS cashier_assignments (
  id INTEGER NOT NULL DEFAULT nextval('cashier_assignments_id_seq'::regclass) PRIMARY KEY,
  zone_group VARCHAR(50),
  cashier_id INTEGER REFERENCES users(id),
  zone_id_str VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  collector_id INTEGER REFERENCES employees(id)
);

-- Table: cashouts
CREATE TABLE IF NOT EXISTS cashouts (
  id INTEGER NOT NULL DEFAULT nextval('cashouts_id_seq'::regclass) PRIMARY KEY,
  collector_name VARCHAR(100) NOT NULL,
  expected_amount NUMERIC NOT NULL,
  actual_amount NUMERIC NOT NULL,
  zaad_amount NUMERIC DEFAULT 0,
  edahab_amount NUMERIC DEFAULT 0,
  cash_amount NUMERIC DEFAULT 0,
  slsh_amount NUMERIC DEFAULT 0,
  shortage NUMERIC DEFAULT 0,
  reason TEXT,
  processed_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  zone VARCHAR(100)
);

-- Table: collector_assignments
CREATE TABLE IF NOT EXISTS collector_assignments (
  id INTEGER NOT NULL DEFAULT nextval('collector_assignments_id_seq'::regclass) PRIMARY KEY,
  zone_group VARCHAR(50),
  collector_id INTEGER REFERENCES employees(id),
  collector_code VARCHAR(50),
  zone_id_str VARCHAR(100),
  truck_id INTEGER REFERENCES trucks(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: complaints
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER NOT NULL DEFAULT nextval('complaints_id_seq'::regclass) PRIMARY KEY,
  customer_id INTEGER,
  title VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'Pending'::character varying,
  priority VARCHAR(20) DEFAULT 'Medium'::character varying,
  assigned_to INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: customers
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER NOT NULL DEFAULT nextval('customers_id_seq'::regclass) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  house_no VARCHAR(20),
  street VARCHAR(100),
  area VARCHAR(50),
  status VARCHAR(20) DEFAULT 'Unpaid'::character varying,
  lat NUMERIC,
  lng NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  whatsapp VARCHAR(20),
  neighborhood VARCHAR(100),
  zone VARCHAR(100),
  category VARCHAR(100),
  fee NUMERIC,
  collector_id INTEGER,
  route_order INTEGER,
  collection_frequency VARCHAR(50),
  collection_mode VARCHAR(50),
  payment_status VARCHAR(50),
  registered_by INTEGER REFERENCES users(id),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: debts
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER NOT NULL DEFAULT nextval('debts_id_seq'::regclass) PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  debtor_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  amount NUMERIC NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD'::character varying,
  description TEXT,
  status VARCHAR(20) DEFAULT 'Unpaid'::character varying,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  zone VARCHAR(100),
  house_no VARCHAR(50),
  collector_name VARCHAR(100)
);

-- Table: employees
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER NOT NULL DEFAULT nextval('employees_id_seq'::regclass) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50),
  phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'Active'::character varying,
  salary NUMERIC,
  join_date DATE DEFAULT CURRENT_DATE,
  photo VARCHAR(255),
  id_document VARCHAR(255),
  guarantor_name VARCHAR(100),
  guarantor_phone VARCHAR(20)
);

-- Table: expenses
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER NOT NULL DEFAULT nextval('expenses_id_seq'::regclass) PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: inventory
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER NOT NULL DEFAULT nextval('inventory_id_seq'::regclass) PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL,
  quantity INTEGER DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'Pcs'::character varying,
  price_per_unit NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'In Stock'::character varying,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER NOT NULL DEFAULT nextval('invoices_id_seq'::regclass) PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  amount NUMERIC NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD'::character varying,
  status VARCHAR(20) DEFAULT 'Unpaid'::character varying,
  payment_method VARCHAR(50) DEFAULT '-'::character varying,
  collector_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  collector_id INTEGER,
  invoice_house_no VARCHAR(50),
  slsh_amount NUMERIC,
  discount_amount NUMERIC,
  cash_amount NUMERIC,
  zaad_amount NUMERIC,
  edahab_amount NUMERIC,
  debt_amount NUMERIC,
  is_split BOOLEAN DEFAULT false,
  truck_name VARCHAR(100),
  invoice_zone VARCHAR(100),
  cashier_id INTEGER REFERENCES users(id),
  cashier_name VARCHAR(100)
);

-- Table: leave_requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER NOT NULL DEFAULT nextval('leave_requests_id_seq'::regclass) PRIMARY KEY,
  employee_id INTEGER,
  leave_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'Pending'::character varying,
  approved_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: messages
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER NOT NULL DEFAULT nextval('messages_id_seq'::regclass) PRIMARY KEY,
  sender_id INTEGER,
  receiver_id INTEGER,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER NOT NULL DEFAULT nextval('notifications_id_seq'::regclass) PRIMARY KEY,
  user_id INTEGER,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: payroll
CREATE TABLE IF NOT EXISTS payroll (
  id INTEGER NOT NULL DEFAULT nextval('payroll_id_seq'::regclass) PRIMARY KEY,
  employee_id INTEGER,
  month VARCHAR(7) NOT NULL,
  base_salary NUMERIC DEFAULT 0,
  total_days_present INTEGER DEFAULT 0,
  bonuses NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Pending'::character varying,
  payment_method VARCHAR(50),
  payment_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  needs_review BOOLEAN DEFAULT false
);

-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER NOT NULL DEFAULT nextval('settings_id_seq'::regclass) PRIMARY KEY,
  setting_key VARCHAR(50) NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: task_customers
CREATE TABLE IF NOT EXISTS task_customers (
  task_id INTEGER NOT NULL PRIMARY KEY REFERENCES tasks(id),
  customer_id INTEGER NOT NULL PRIMARY KEY REFERENCES customers(id),
  collected BOOLEAN DEFAULT false,
  collected_at TIMESTAMP,
  collected_lat NUMERIC,
  collected_lng NUMERIC
);

-- Table: tasks
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER NOT NULL DEFAULT nextval('tasks_id_seq'::regclass) PRIMARY KEY,
  driver_name VARCHAR(100) NOT NULL,
  collector_name VARCHAR(100),
  vehicle_plate VARCHAR(50),
  route_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Pending'::character varying,
  scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  zone_id INTEGER,
  truck_id INTEGER
);

-- Table: truck_fuel_logs
CREATE TABLE IF NOT EXISTS truck_fuel_logs (
  id INTEGER NOT NULL DEFAULT nextval('truck_fuel_logs_id_seq'::regclass) PRIMARY KEY,
  truck_id INTEGER,
  date DATE DEFAULT CURRENT_DATE,
  liters NUMERIC NOT NULL,
  cost NUMERIC NOT NULL,
  odometer_reading INTEGER,
  recorded_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: truck_location_history
CREATE TABLE IF NOT EXISTS truck_location_history (
  id INTEGER NOT NULL DEFAULT nextval('truck_location_history_id_seq'::regclass) PRIMARY KEY,
  task_id INTEGER NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: truck_maintenance_logs
CREATE TABLE IF NOT EXISTS truck_maintenance_logs (
  id INTEGER NOT NULL DEFAULT nextval('truck_maintenance_logs_id_seq'::regclass) PRIMARY KEY,
  truck_id INTEGER,
  date DATE DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  cost NUMERIC NOT NULL,
  next_service_date DATE,
  recorded_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: trucks
CREATE TABLE IF NOT EXISTS trucks (
  id INTEGER NOT NULL DEFAULT nextval('trucks_id_seq'::regclass) PRIMARY KEY,
  plate_number VARCHAR(50) NOT NULL,
  model VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Active'::character varying,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  driver_id INTEGER,
  collector_id INTEGER
);

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER NOT NULL DEFAULT nextval('users_id_seq'::regclass) PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'cashier'::character varying,
  profile_image VARCHAR(255),
  two_factor_secret TEXT,
  two_factor_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  zone VARCHAR(100)
);

-- Table: zones
CREATE TABLE IF NOT EXISTS zones (
  id INTEGER NOT NULL DEFAULT nextval('zones_id_seq'::regclass) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  assigned_driver VARCHAR(100),
  assigned_collector VARCHAR(100),
  assigned_truck VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  truck_id INTEGER,
  collection_days JSONB,
  collection_time VARCHAR(100),
  coordinates JSONB,
  area VARCHAR(100),
  neighborhood VARCHAR(100),
  zone_code VARCHAR(50),
  sub_zone VARCHAR(100)
);

