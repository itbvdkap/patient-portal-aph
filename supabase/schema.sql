create extension if not exists "pgcrypto";

create table patients (
  id uuid primary key default gen_random_uuid(),
  his_patient_code varchar not null unique,
  full_name varchar not null,
  birth_date date not null,
  gender varchar not null,
  phone varchar not null,
  address text,
  created_at timestamptz not null default now()
);

create table patient_accounts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  auth_user_id uuid,
  phone varchar not null,
  status varchar not null default 'active',
  created_at timestamptz not null default now()
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  his_visit_id varchar not null,
  visit_date timestamptz not null,
  department_name varchar not null,
  doctor_name varchar not null,
  status varchar not null,
  notes text,
  created_at timestamptz not null default now()
);

create table diagnoses (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  icd10_code varchar not null,
  diagnosis_name varchar not null,
  diagnosis_type varchar not null
);

create table vital_signs (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  blood_pressure varchar,
  pulse int,
  temperature numeric(4,1),
  weight numeric(5,2),
  height numeric(5,2),
  bmi numeric(4,1)
);

create table services (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  service_name varchar not null,
  performed_at timestamptz,
  status varchar not null
);

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  prescribed_at timestamptz not null,
  doctor_name varchar not null
);

create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  medicine_name varchar not null,
  active_ingredient varchar,
  strength varchar,
  route varchar,
  quantity varchar,
  dosage varchar,
  instruction text
);

create table lab_results (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  test_name varchar not null,
  result numeric not null,
  unit varchar,
  reference_range varchar,
  performed_at timestamptz not null,
  flag varchar not null
);

create table imaging_results (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  date timestamptz not null,
  technique_name varchar not null,
  doctor_name varchar not null,
  description text,
  conclusion text
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  appointment_date timestamptz not null,
  department_name varchar not null,
  doctor_name varchar not null,
  content text
);

create table insurance_cards (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  card_number varchar not null,
  benefit_code varchar,
  registered_clinic varchar,
  valid_from date not null,
  valid_to date not null,
  status varchar not null
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  patient_id uuid references patients(id) on delete set null,
  action varchar not null,
  resource varchar not null,
  created_at timestamptz not null default now(),
  ip_address inet
);

alter table patients enable row level security;
alter table patient_accounts enable row level security;
alter table visits enable row level security;
alter table diagnoses enable row level security;
alter table vital_signs enable row level security;
alter table services enable row level security;
alter table prescriptions enable row level security;
alter table prescription_items enable row level security;
alter table lab_results enable row level security;
alter table imaging_results enable row level security;
alter table appointments enable row level security;
alter table insurance_cards enable row level security;
alter table audit_logs enable row level security;
