-- Gurmad Waste Management System Database Schema & Seed Data

-- Drop tables if they exist
DROP TABLE IF EXISTS task_customers CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS debts CASCADE;
DROP TABLE IF EXISTS trucks CASCADE;
DROP TABLE IF EXISTS zones CASCADE;

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'cashier',
    profile_image VARCHAR(255),
    two_factor_secret TEXT,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees Table (HRM)
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50),
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'Active',
    salary DECIMAL(15,2),
    join_date DATE DEFAULT CURRENT_DATE
);

-- Trucks Table
CREATE TABLE trucks (
    id SERIAL PRIMARY KEY,
    plate_number VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zones Table
CREATE TABLE zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    assigned_driver VARCHAR(100),
    assigned_collector VARCHAR(100),
    assigned_truck VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers Table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    house_no VARCHAR(20),
    street VARCHAR(100),
    area VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Unpaid',
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices Table
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'Unpaid',
    payment_method VARCHAR(50) DEFAULT '-',
    collector_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses Table
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks (Driver Jobs)
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    driver_name VARCHAR(100) NOT NULL,
    collector_name VARCHAR(100),
    vehicle_plate VARCHAR(50),
    route_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Pending',
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Task_Customers (Mapping customers to tasks)
CREATE TABLE task_customers (
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    collected BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (task_id, customer_id)
);

-- Settings Table
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Table
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    quantity INTEGER DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'Pcs',
    price_per_unit DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'In Stock',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Debts Table (Daymaha)
CREATE TABLE debts (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    debtor_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    description TEXT,
    status VARCHAR(20) DEFAULT 'Unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cashouts Table (Taariikhda Xisaab-celinta)
CREATE TABLE cashouts (
    id SERIAL PRIMARY KEY,
    collector_name VARCHAR(100) NOT NULL,
    expected_amount DECIMAL(15, 2) NOT NULL,
    actual_amount DECIMAL(15, 2) NOT NULL,
    shortage DECIMAL(15, 2) DEFAULT 0,
    reason TEXT,
    processed_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- SEED DATA ---

-- Initial Users & Settings
INSERT INTO users (username, password, full_name, role) VALUES 
('admin', 'admin123', 'System Admin', 'admin'),
('jamac', 'jamac123', 'Jamac (Cashier)', 'cashier'),
('faarax', 'faarax123', 'Faarax (Collector)', 'collector');
INSERT INTO settings (setting_key, setting_value) VALUES ('exchange_rate', '8500');
INSERT INTO settings (setting_key, setting_value) VALUES ('landing_hero_title', 'Gurmad Waste Management');
INSERT INTO settings (setting_key, setting_value) VALUES ('landing_hero_subtitle', 'Leading the way in sustainable waste collection and urban sanitation in Burao.');
INSERT INTO settings (setting_key, setting_value) VALUES ('landing_about_text', 'Gurmad is committed to providing efficient, reliable, and environmentally friendly waste management solutions. Our mission is to keep our cities clean and safe for everyone.');
INSERT INTO settings (setting_key, setting_value) VALUES ('landing_contact_email', 'info@gurmad.so');
INSERT INTO settings (setting_key, setting_value) VALUES ('landing_contact_phone', '063-4444444');
INSERT INTO settings (setting_key, setting_value) VALUES ('landing_contact_address', 'Main Office, Burao, Somaliland');
INSERT INTO settings (setting_key, setting_value) VALUES ('landing_services', '[{"icon":"Truck", "title":"Waste Collection", "desc":"Daily doorstep collection for households and businesses."}, {"icon":"Shield", "title":"Sanitation", "desc":"Professional cleaning and disinfection services."}, {"icon":"BarChart", "title":"Reporting", "desc":"Detailed analytics on waste reduction and disposal."}]');
INSERT INTO settings (setting_key, setting_value) VALUES ('landing_navbar_links', '[{"label":"Home", "target":"home", "type":"scroll"}, {"label":"Services", "target":"services", "type":"scroll"}, {"label":"News", "target":"news", "type":"scroll"}, {"label":"About Us", "target":"about", "type":"scroll"}, {"label":"Contact", "target":"contact", "type":"scroll"}]');
INSERT INTO settings (setting_key, setting_value) VALUES ('landing_news', '[{"id":1, "title":"Adeegga Cusub ee Gurmad", "date":"2024-04-15", "excerpt":"Waxaan bilownay adeeg cusub oo casri ah oo ku saabsan nadaafadda magaalada Burao.", "content":"Waxaan si farxad leh ugu laabnay adeegga cusub ee Gurmad Waste Management. Adeeggan wuxuu sahlayaa in si degdeg ah oo hufan looga gurto qashinka guryaha iyo meheradaha magaalada Burao.", "images":[], "coverImage":"", "videoUrl":""}]');
INSERT INTO settings (setting_key, setting_value) VALUES ('landing_social_links', '[{"platform":"Facebook", "url":"https://facebook.com/gurmad", "icon":"Facebook"}, {"platform":"Twitter", "url":"https://twitter.com/gurmad", "icon":"Twitter"}, {"platform":"Instagram", "url":"https://instagram.com/gurmad", "icon":"Instagram"}, {"platform":"LinkedIn", "url":"https://linkedin.com/company/gurmad", "icon":"Linkedin"}, {"platform":"YouTube", "url":"https://youtube.com/gurmad", "icon":"Youtube"}, {"platform":"WhatsApp", "url":"https://wa.me/252634444444", "icon":"WhatsApp"}]');

-- Initial Trucks
INSERT INTO trucks (plate_number, model) VALUES 
('SL-1025', 'Isuzu NPR'),
('SL-9080', 'Mitsubishi Fuso'),
('SL-4410', 'Tata LPT');

-- Initial Zones
INSERT INTO zones (name, assigned_driver, assigned_collector, assigned_truck) VALUES 
('Burao North - Zone A', 'Ahmed Ali', 'Faarax (Collector)', 'SL-1025'),
('Burao East - Zone B', 'Hassan Omar', 'Hassan (Collector)', 'SL-9080'),
('Burao Central', 'Abdi Jama', 'Mahad (Collector)', 'SL-4410');

-- Realistic Customers
INSERT INTO customers (name, phone, house_no, street, area, status, lat, lng) VALUES 
('Jaamac Cali', '063-4455667', 'H-204', 'Wada-jic', 'Burao North', 'Paid', 9.5222, 45.5342),
('Hodman Axmed', '063-8899001', 'H-512', 'Sheikh Ibrahim', 'Oodweyne', 'Unpaid', 9.5255, 45.5312),
('Mustafe Cabdi', '063-1234567', 'H-99', 'Jaayga', 'Burao East', 'Paid', 9.5198, 45.5367),
('Sahra Yusuf', '063-7112233', 'H-401', 'Sayidka', 'Burao Central', 'Paid', 9.5282, 45.5399),
('Maxamed Cumar', '063-5544332', 'H-12', 'Iftin', 'Burao West', 'Unpaid', 9.5242, 45.5352);

-- Realistic Invoices
INSERT INTO invoices (customer_id, amount, currency, status, payment_method, created_at) VALUES 
(1, 15.00, 'USD', 'Paid', 'ZAAD', CURRENT_TIMESTAMP - INTERVAL '1 day'),
(3, 15.00, 'USD', 'Paid', 'eDahab', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(4, 15.00, 'USD', 'Paid', 'ZAAD', CURRENT_TIMESTAMP - INTERVAL '3 days'),
(2, 120000, 'SLSH', 'Unpaid', '-', CURRENT_TIMESTAMP - INTERVAL '4 days');

-- Realistic Expenses
INSERT INTO expenses (category, description, amount, expense_date) VALUES 
('Fuel', 'Truck-01 Weekly Refuel', 450.00, CURRENT_DATE - 1),
('Salaries', 'Driver Weekly Payment', 1200.00, CURRENT_DATE - 2),
('Maintenance', 'Tire replacement Truck-02', 85.00, CURRENT_DATE - 5),
('Other', 'Office Electricity Bill', 120.00, CURRENT_DATE - 7);

-- Realistic Tasks
INSERT INTO tasks (driver_name, route_name, status, scheduled_at) VALUES 
('Abdikariim', 'Burao North - Zone A', 'In Progress', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
('Guuleed', 'Burao East - Zone B', 'Pending', CURRENT_TIMESTAMP + INTERVAL '1 hour'),
('Safiia', 'Burao Central', 'Completed', CURRENT_TIMESTAMP - INTERVAL '5 hours');

-- Link some customers to tasks
INSERT INTO task_customers (task_id, customer_id, collected) VALUES 
(1, 1, TRUE),
(1, 5, FALSE),
(3, 3, TRUE),
(3, 4, TRUE);
