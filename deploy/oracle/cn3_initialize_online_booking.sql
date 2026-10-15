-- CN3 ONLY. Owner password placeholder is replaced in memory by the runner.
-- DDL commits implicitly. No DROP/TRUNCATE, no patient-data copy, no PUBLIC grants.
-- Mirrors CN1 DANGKYKHAM columns/defaults/PK/indexes inspected 2026-10-10.
declare
  v_count number;
  v_status varchar2(32);
begin
  if sys_context('USERENV','SERVER_HOST') <> 'serverhg_cs2'
     or sys_context('USERENV','SERVICE_NAME') <> 'hgsoft'
     or sys_context('USERENV','SESSION_USER') <> 'HGSOFT' then
    raise_application_error(-20001, 'Wrong CN3 database identity; bootstrap refused.');
  end if;

  select count(*) into v_count from all_users where username='HGSOFT_SOYBA';
  if v_count=0 then
    execute immediate 'create user HGSOFT_SOYBA identified by "__OWNER_PASSWORD__" default tablespace HGSOFT temporary tablespace TEMP quota 256M on HGSOFT account lock';
  end if;
  select account_status into v_status from dba_users where username='HGSOFT_SOYBA';
  if instr(v_status, 'LOCKED')=0 then
    raise_application_error(-20002, 'Existing schema owner is not locked; review before continuing.');
  end if;

  select count(*) into v_count from dba_objects where owner='HGSOFT_SOYBA' and object_name='DANGKYKHAM';
  if v_count=0 then
    execute immediate q'[
      create table HGSOFT_SOYBA.DANGKYKHAM (
        ID number(18,0) not null,
        NGAYDANGKY date default sysdate,
        MADATCHO varchar2(30 byte),
        MABN varchar2(20 byte),
        HOTEN nvarchar2(200),
        NGAYSINH date,
        PHAI number(1,0),
        MABHYT varchar2(30 byte),
        SDT varchar2(30 byte),
        SDT_NGUOITHAN varchar2(30 byte),
        EMAIL varchar2(200 byte),
        MANN varchar2(5 byte),
        MADANTOC varchar2(2 byte),
        CHOLAM nvarchar2(200),
        SONHA nvarchar2(200),
        THON nvarchar2(200),
        MAPHUONGXA varchar2(10 byte),
        MATT varchar2(3 byte),
        TRIEUCHUNG nvarchar2(1000),
        PHONGKHAM varchar2(4 byte),
        BACSI varchar2(4 byte),
        CANNANG number(8,2),
        CHIEUCAO number(8,2),
        ID_USERTAO number(18,0),
        ID_USER number(18,0),
        TRANGTHAI number(3,0) default 0,
        MAQL_TIEPDON number(18,0) default 0,
        NGAYTAO date default sysdate,
        NGAYCAPNHAT date,
        CCCD varchar2(20 byte),
        TRANGTHAI_ZALO varchar2(20 byte) default 'CHUA_GUI',
        NGAYGUI_ZALO date,
        LOI_ZALO varchar2(1000 byte),
        MAVAOVIEN number,
        BACSI_DANGKY nvarchar2(200),
        CHUYENKHOA_DANGKY nvarchar2(200),
        constraint PK_HGSOYBA_DANGKYKHAM primary key (ID) using index tablespace HGSOFT
      ) tablespace HGSOFT
    ]';
  end if;

  select count(*) into v_count from dba_objects where owner='HGSOFT_SOYBA' and object_name='SEQ_DANGKYKHAM';
  if v_count=0 then
    execute immediate 'create sequence HGSOFT_SOYBA.SEQ_DANGKYKHAM start with 1 increment by 1 minvalue 1 maxvalue 9999999999999999999999999999 nocache nocycle noorder';
  end if;
  select count(*) into v_count from dba_objects where owner='HGSOFT_SOYBA' and object_name='IX_DANGKYKHAM_LOAD';
  if v_count=0 then
    execute immediate 'create index HGSOFT_SOYBA.IX_DANGKYKHAM_LOAD on HGSOFT_SOYBA.DANGKYKHAM (NGAYDANGKY,TRANGTHAI,MAQL_TIEPDON) tablespace HGSOFT';
  end if;
  select count(*) into v_count from dba_objects where owner='HGSOFT_SOYBA' and object_name='IX_DANGKYKHAM_MADATCHO';
  if v_count=0 then
    execute immediate 'create index HGSOFT_SOYBA.IX_DANGKYKHAM_MADATCHO on HGSOFT_SOYBA.DANGKYKHAM (MADATCHO) tablespace HGSOFT';
  end if;

  -- This bootstrap is executed by HGSOFT itself. Oracle forbids self-GRANT
  -- (ORA-01749). Confirm the four already-existing effective privileges instead;
  -- do not add global privileges, grant PUBLIC, or unlock the schema owner.
  select count(*) into v_count from session_privs
   where privilege in ('SELECT ANY TABLE','INSERT ANY TABLE','UPDATE ANY TABLE','SELECT ANY SEQUENCE');
  if v_count<>4 then
    raise_application_error(-20003, 'Agent rights insufficient; ask a separate DBA for object-level grants.');
  end if;
end;
/
