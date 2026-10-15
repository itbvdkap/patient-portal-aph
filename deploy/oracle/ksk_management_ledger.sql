-- RUN ONLY AFTER IT APPROVAL, on the selected TEST schema first. No automatic migration.
-- Connect as the intended CN1 KSK master owner (HGSOFT_BV). Never run against CN3 by substitution.
-- Schema contains patient change audit: restrict SELECT and protect backups.
-- DDL commits in Oracle. Back up / inspect existing objects first; no DROP/TRUNCATE here.
create table PORTAL_KSK_COMMANDS (
  COMMAND_ID varchar2(36) not null,
  COMMAND_HASH varchar2(64) not null,
  COHORT_ID varchar2(20),
  ACTOR nvarchar2(50) not null,
  REVIEWER nvarchar2(50) not null,
  APPLIED_BY nvarchar2(50) not null,
  REQUEST_JSON clob not null,
  BEFORE_JSON clob not null,
  RESULT_JSON varchar2(4000) not null,
  CREATED_AT timestamp with time zone not null,
  constraint PK_PORTAL_KSK_COMMANDS primary key (COMMAND_ID)
);
-- Separate configuration IDs only. NEVER use this sequence for MABN, MAQL or MAVAOVIEN.
create sequence PORTAL_KSK_ID_SEQ start with 900000000000000000 increment by 1 maxvalue 999999999999999999 nocycle cache 20;
-- Grant only required SELECT/INSERT/UPDATE/DELETE for the management tables to a dedicated agent principal.
-- SHARE/EXCLUSIVE safety locks require suitable ownership/LOCK privileges; do not grant blanket ANY TABLE to solve this.
