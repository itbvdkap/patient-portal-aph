-- Portal Reporting DB schema draft
-- Purpose: Patient portal reads this reporting database, not the primary HIS database.
-- Style: PostgreSQL-oriented draft. If using Oracle/SQL Server reporting DB,
-- translate data types and partial indexes accordingly.

create table portal_patients (
  mabn varchar(20) primary key,
  full_name varchar(255) not null,
  birth_date date,
  gender varchar(20),
  phone varchar(30),
  address text,
  source_updated_at timestamp,
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create table portal_patient_identities (
  id bigserial primary key,
  mabn varchar(20) not null references portal_patients(mabn),
  identity_type varchar(30) not null, -- cccd, cmnd, passport, other
  identity_number varchar(30) not null,
  phone varchar(30),
  source_table varchar(80),
  source_column varchar(80),
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp,
  unique (mabn, identity_type, identity_number)
);

create index idx_portal_patient_identities_lookup
  on portal_patient_identities (phone, identity_number);

create table portal_insurance_cards (
  id bigserial primary key,
  mabn varchar(20) not null references portal_patients(mabn),
  card_number varchar(50),
  benefit_code varchar(10),
  valid_from date,
  valid_to date,
  registered_clinic varchar(255),
  status varchar(50),
  source_mavaovien varchar(30),
  source_updated_at timestamp,
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index idx_portal_insurance_cards_mabn_valid
  on portal_insurance_cards (mabn, valid_to desc);

create table portal_encounters (
  mavaovien varchar(30) primary key,
  mabn varchar(20) not null references portal_patients(mabn),
  encounter_type varchar(50), -- outpatient, inpatient, emergency, unknown
  registered_at timestamp,
  discharged_at timestamp,
  paid_at timestamp,
  status varchar(100),
  primary_icd varchar(50),
  secondary_icd varchar(255),
  diagnosis_in text,
  diagnosis_out text,
  diagnosis_detail text,
  reason text,
  treatment_method text,
  notes text,
  follow_up_at timestamp,
  source_updated_at timestamp,
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index idx_portal_encounters_mabn_date
  on portal_encounters (mabn, registered_at desc);

create table portal_care_segments (
  maql varchar(30) primary key,
  mavaovien varchar(30) not null references portal_encounters(mavaovien),
  mabn varchar(20) not null references portal_patients(mabn),
  makp varchar(20),
  department_name varchar(255),
  doctor_code varchar(50),
  doctor_name varchar(255),
  segment_type varchar(80), -- clinic, inpatient, procedure, other
  started_at timestamp,
  ended_at timestamp,
  status varchar(100),
  primary_icd varchar(50),
  diagnosis text,
  notes text,
  source_table varchar(80),
  source_updated_at timestamp,
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index idx_portal_care_segments_encounter
  on portal_care_segments (mavaovien, started_at);

create index idx_portal_care_segments_patient
  on portal_care_segments (mabn, started_at desc);

create table portal_orders (
  order_id varchar(80) primary key,
  mabn varchar(20) not null references portal_patients(mabn),
  mavaovien varchar(30) references portal_encounters(mavaovien),
  maql varchar(30) references portal_care_segments(maql),
  order_type varchar(50) not null, -- lab, imaging, service, procedure
  service_code varchar(80),
  service_name varchar(500),
  service_group varchar(255),
  ordered_at timestamp,
  started_at timestamp,
  result_at timestamp,
  status varchar(100),
  ordering_department varchar(255),
  performing_department varchar(255),
  doctor_code varchar(50),
  doctor_name varchar(255),
  source_table varchar(80),
  source_id varchar(80),
  source_updated_at timestamp,
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index idx_portal_orders_encounter
  on portal_orders (mavaovien, order_type, ordered_at);

create index idx_portal_orders_patient
  on portal_orders (mabn, ordered_at desc);

create table portal_lab_results (
  result_id varchar(100) primary key,
  order_id varchar(80) references portal_orders(order_id),
  mabn varchar(20) not null references portal_patients(mabn),
  mavaovien varchar(30) references portal_encounters(mavaovien),
  maql varchar(30) references portal_care_segments(maql),
  lab_form_id varchar(80),
  service_name varchar(500),
  test_code varchar(80),
  test_name varchar(500),
  result_value text,
  unit varchar(100),
  reference_range varchar(255),
  flag varchar(80),
  performed_at timestamp,
  source_table varchar(80),
  source_id varchar(100),
  source_updated_at timestamp,
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index idx_portal_lab_results_encounter
  on portal_lab_results (mavaovien, lab_form_id, performed_at);

create index idx_portal_lab_results_patient
  on portal_lab_results (mabn, performed_at desc);

create table portal_imaging_results (
  result_id varchar(100) primary key,
  order_id varchar(80) references portal_orders(order_id),
  mabn varchar(20) not null references portal_patients(mabn),
  mavaovien varchar(30) references portal_encounters(mavaovien),
  maql varchar(30) references portal_care_segments(maql),
  technique_code varchar(80),
  technique_name varchar(500),
  performed_at timestamp,
  doctor_code varchar(50),
  doctor_name varchar(255),
  description text,
  conclusion text,
  source_table varchar(80),
  source_id varchar(100),
  source_updated_at timestamp,
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index idx_portal_imaging_results_encounter
  on portal_imaging_results (mavaovien, performed_at);

create index idx_portal_imaging_results_patient
  on portal_imaging_results (mabn, performed_at desc);

create table portal_prescriptions (
  prescription_id varchar(100) primary key,
  mabn varchar(20) not null references portal_patients(mabn),
  mavaovien varchar(30) references portal_encounters(mavaovien),
  maql varchar(30) references portal_care_segments(maql),
  payer_type varchar(50), -- bhyt, service, other
  prescribed_at timestamp,
  doctor_code varchar(50),
  doctor_name varchar(255),
  source_table varchar(80),
  source_id varchar(100),
  source_updated_at timestamp,
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index idx_portal_prescriptions_encounter
  on portal_prescriptions (mavaovien, prescribed_at);

create table portal_prescription_items (
  item_id varchar(120) primary key,
  prescription_id varchar(100) not null references portal_prescriptions(prescription_id),
  mabn varchar(20) not null references portal_patients(mabn),
  mavaovien varchar(30) references portal_encounters(mavaovien),
  maql varchar(30) references portal_care_segments(maql),
  medicine_code varchar(80),
  medicine_name varchar(500),
  active_ingredient varchar(500),
  strength varchar(255),
  route varchar(255),
  quantity varchar(100),
  dosage text,
  instruction text,
  payer_type varchar(50),
  source_table varchar(80),
  source_id varchar(120),
  source_updated_at timestamp,
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create table portal_appointments (
  appointment_id varchar(100) primary key,
  mabn varchar(20) not null references portal_patients(mabn),
  mavaovien varchar(30),
  maql varchar(30),
  appointment_at timestamp not null,
  department_code varchar(20),
  department_name varchar(255),
  doctor_code varchar(50),
  doctor_name varchar(255),
  content text,
  status varchar(100),
  source_table varchar(80),
  source_id varchar(100),
  source_updated_at timestamp,
  synced_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index idx_portal_appointments_patient_date
  on portal_appointments (mabn, appointment_at);

create table portal_sync_state (
  id bigserial primary key,
  mabn varchar(20) not null,
  resource_name varchar(80) not null,
  mavaovien varchar(30),
  maql varchar(30),
  status varchar(30) not null, -- never, queued, running, success, failed
  last_synced_at timestamp,
  next_sync_after timestamp,
  source_from_date timestamp,
  source_to_date timestamp,
  source_schema varchar(80),
  source_version varchar(100),
  error_message text,
  locked_by varchar(100),
  locked_until timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp,
  unique (mabn, resource_name, mavaovien, maql)
);

create index idx_portal_sync_state_due
  on portal_sync_state (status, next_sync_after);

create table portal_sync_jobs (
  job_id bigserial primary key,
  mabn varchar(20) not null,
  resource_name varchar(80) not null,
  mavaovien varchar(30),
  maql varchar(30),
  priority integer not null default 100,
  status varchar(30) not null default 'queued', -- queued, running, success, failed, cancelled
  requested_by varchar(100),
  requested_reason varchar(255),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamp not null default current_timestamp,
  started_at timestamp,
  finished_at timestamp,
  locked_by varchar(100),
  locked_until timestamp,
  error_message text,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index idx_portal_sync_jobs_pickup
  on portal_sync_jobs (status, priority, run_after);

create index idx_portal_sync_jobs_patient
  on portal_sync_jobs (mabn, resource_name, mavaovien, maql, status);

-- JSON snapshot used by the current PatientApi contract during migration.
-- Normalized tables above remain the reporting source of truth target; this
-- table lets endpoints move off Oracle without changing the frontend payloads.
create table portal_resource_snapshots (
  cache_key varchar(255) primary key,
  mabn varchar(20) not null,
  resource_name varchar(80) not null,
  resource_id varchar(100),
  payload_json jsonb not null,
  synced_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index idx_portal_resource_snapshots_patient
  on portal_resource_snapshots (mabn, resource_name, resource_id);

create table portal_login_lookup (
  lookup_hash char(64) primary key,
  mabn varchar(20) not null,
  payload_json jsonb not null,
  synced_at timestamptz not null,
  expires_at timestamptz not null
);

create unique index ux_portal_sync_state_key
  on portal_sync_state (mabn, resource_name, coalesce(mavaovien, ''), coalesce(maql, ''));

create table portal_audit_logs (
  audit_id bigserial primary key,
  user_id varchar(100),
  mabn varchar(20),
  action varchar(100) not null,
  resource_name varchar(100),
  resource_id varchar(120),
  ip_address varchar(80),
  user_agent text,
  metadata_json text,
  created_at timestamp not null default current_timestamp
);

create index idx_portal_audit_logs_patient_time
  on portal_audit_logs (mabn, created_at desc);
