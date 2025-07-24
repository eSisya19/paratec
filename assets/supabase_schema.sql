--
-- Company Activity Manager - Supabase Schema
--

-- Users Table
-- Stores user information, credentials, and roles.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- This will store the SHA-256 hash
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Employee' CHECK (role IN ('Admin', 'Employee')),
    is_active BOOLEAN DEFAULT true,
    leave_balance INT DEFAULT 20
);

-- Bulletins Table
-- For internal announcements from Admins.
CREATE TABLE bulletins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    author_id UUID REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL
);

-- Bulletin Reads Table
-- Tracks which user has read which bulletin.
CREATE TABLE bulletin_reads (
    id BIGSERIAL PRIMARY KEY,
    bulletin_id UUID REFERENCES bulletins(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(bulletin_id, user_id)
);

-- Comments Table
-- For comments on bulletins or other items.
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES users(id),
    bulletin_id UUID REFERENCES bulletins(id) ON DELETE CASCADE, -- Example FK
    content TEXT NOT NULL
);

-- Activity Reports Table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT,
    photo_url TEXT -- URL from Supabase Storage
);

-- Requests Table (for money, leave, etc.)
CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES users(id),
    request_type TEXT NOT NULL CHECK (request_type IN ('Money', 'Leave', 'Off-Day')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Denied')),
    details JSONB, -- Flexible field for request-specific data
    -- Example for 'Leave': {"start_date": "...", "end_date": "...", "leave_type": "..."}
    -- Example for 'Money': {"amount": 500, "reason": "..."}
    admin_comment TEXT,
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMPTZ
);

-- Attendance Table
CREATE TABLE attendance (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    check_in_time TIMESTAMPTZ DEFAULT now(),
    check_in_location GEOGRAPHY(POINT, 4326),
    check_out_time TIMESTAMPTZ,
    check_out_location GEOGRAPHY(POINT, 4326)
);

-- Trips Table
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES users(id),
    destination TEXT NOT NULL,
    trip_date DATE NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected'))
);

-- Login History Table
CREATE TABLE login_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    login_time TIMESTAMPTZ DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

-- Audit Logs Table
-- Records significant actions, primarily by Admins.
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT now(),
    admin_id UUID REFERENCES users(id),
    action TEXT NOT NULL, -- e.g., 'USER_CREATED', 'REQUEST_APPROVED'
    target_table TEXT,
    target_record_id TEXT,
    details JSONB
);

-- Assets Table
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_name TEXT NOT NULL,
    asset_type TEXT,
    serial_number TEXT UNIQUE,
    assigned_to UUID REFERENCES users(id),
    checkout_date DATE,
    return_date DATE
);

-- Documents Library Table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    uploaded_by UUID REFERENCES users(id),
    file_name TEXT NOT NULL,
    description TEXT,
    storage_path TEXT NOT NULL -- Path in Supabase Storage
);

-- Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES users(id), -- The user who receives the notification
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    link TEXT -- Optional link to the relevant item (e.g., a request)
);

-- KPIs and Reviews are complex and can be split
-- Key Performance Indicators (KPIs)
CREATE TABLE kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Employee Reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    reviewer_id UUID REFERENCES users(id),
    review_date DATE NOT NULL,
    overall_rating INT CHECK (overall_rating BETWEEN 1 AND 5),
    comments TEXT
);

-- A linking table between reviews and KPIs
CREATE TABLE review_kpis (
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    score INT,
    notes TEXT,
    PRIMARY KEY (review_id, kpi_id)
);

-- Example: Create a storage bucket for photos and documents
-- NOTE: This cannot be done via SQL in the editor.
-- You must go to the Storage section in the Supabase dashboard and create these buckets manually.
-- Suggested bucket names: 'report-photos', 'documents'
-- Make them public if you want easy access via URL, but secure them with policies in production.