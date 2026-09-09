set define off

declare
  v_count number;
begin
  select count(*)
    into v_count
    from all_tab_columns
   where owner = 'HGSOFT_SOYBA'
     and table_name = 'DANGKYKHAM'
     and column_name = 'CCCD';

  if v_count = 0 then
    execute immediate 'alter table hgsoft_soyba.dangkykham add (cccd varchar2(20))';
  end if;
end;
/

declare
  v_count number;
begin
  select count(*)
    into v_count
    from all_tab_columns
   where owner = 'HGSOFT_SOYBA'
     and table_name = 'DANGKYKHAM'
     and column_name = 'MAVAOVIEN';

  if v_count = 0 then
    execute immediate 'alter table hgsoft_soyba.dangkykham add (mavaovien number)';
  end if;
end;
/

declare
  v_count number;
begin
  select count(*)
    into v_count
    from all_tab_columns
   where owner = 'HGSOFT_SOYBA'
     and table_name = 'DANGKYKHAM'
     and column_name = 'TRANGTHAI_ZALO';

  if v_count = 0 then
    execute immediate 'alter table hgsoft_soyba.dangkykham add (trangthai_zalo varchar2(20) default ''CHUA_GUI'')';
  end if;
end;
/

declare
  v_count number;
begin
  select count(*)
    into v_count
    from all_tab_columns
   where owner = 'HGSOFT_SOYBA'
     and table_name = 'DANGKYKHAM'
     and column_name = 'NGAYGUI_ZALO';

  if v_count = 0 then
    execute immediate 'alter table hgsoft_soyba.dangkykham add (ngaygui_zalo date)';
  end if;
end;
/

declare
  v_count number;
begin
  select count(*)
    into v_count
    from all_tab_columns
   where owner = 'HGSOFT_SOYBA'
     and table_name = 'DANGKYKHAM'
     and column_name = 'LOI_ZALO';

  if v_count = 0 then
    execute immediate 'alter table hgsoft_soyba.dangkykham add (loi_zalo varchar2(1000))';
  end if;
end;
/
