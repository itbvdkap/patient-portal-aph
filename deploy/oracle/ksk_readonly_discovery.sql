-- KSK read-only reporting: metadata only; no patient records, no DDL/DML.
-- Run each SELECT using a read-only Oracle account on the intended branch.
-- Bind :OwnerKhaoSat to a verified master/monthly/clinical owner, repeat as needed.
-- Empty results may mean insufficient metadata privileges, not absent tables.

select owner, object_name, object_type, status
from all_objects
where object_type in ('TABLE', 'VIEW', 'MATERIALIZED VIEW')
  and (substr(object_name,1,3)='KSK' or substr(object_name,1,5)='BASK_'
    or object_name in ('BTDBN','TIEPDON','V_CHIDINH','V_GIAVP',
      'XN_PHIEU','XN_KETQUA','XN_BV_CHITIET','XN_BV_TEN','XN_TEN','XN_DONVI',
      'SA_BNCDHA','SA_BNCDHA_CT','SA_BNCDHA_CTVP','XQ_BNCDHA_CTXQ','SA_KTCDHA',
      'V_VIENPHILL','V_VIENPHICT','V_TTRVDS','V_TTRVLL','V_TTRVCT',
      'V_MIENNGTRU','V_MIENNOITRU','V_HOANTRA','V_HOANTRACT','V_TAMUNG'))
order by owner, object_name;

select owner, table_name, column_id, column_name, data_type,
       data_precision, data_scale, nullable
from all_tab_columns
where owner=upper(trim(:OwnerKhaoSat))
  and (substr(table_name,1,3)='KSK' or substr(table_name,1,5)='BASK_'
    or table_name in ('BTDBN','TIEPDON','V_CHIDINH','V_GIAVP',
      'XN_PHIEU','XN_KETQUA','XN_BV_CHITIET','XN_BV_TEN','XN_TEN','XN_DONVI',
      'SA_BNCDHA','SA_BNCDHA_CT','SA_BNCDHA_CTVP','XQ_BNCDHA_CTXQ','SA_KTCDHA'))
order by table_name, column_id;

select c.owner, c.table_name, c.constraint_name, c.constraint_type,
       cc.position, cc.column_name, p.owner referenced_owner,
       p.table_name referenced_table, pc.column_name referenced_column
from all_constraints c
join all_cons_columns cc on cc.owner=c.owner and cc.constraint_name=c.constraint_name
left join all_constraints p on p.owner=c.r_owner and p.constraint_name=c.r_constraint_name
left join all_cons_columns pc on pc.owner=p.owner and pc.constraint_name=p.constraint_name and pc.position=cc.position
where c.owner=upper(trim(:OwnerKhaoSat)) and c.constraint_type in ('P','U','R')
  and (substr(c.table_name,1,3)='KSK' or substr(c.table_name,1,5)='BASK_'
    or c.table_name in ('TIEPDON','V_CHIDINH','XN_PHIEU','XN_KETQUA','SA_BNCDHA','SA_BNCDHA_CT','XQ_BNCDHA_CTXQ'))
order by c.table_name, c.constraint_name, cc.position;

select owner, synonym_name, table_owner, table_name, db_link
from all_synonyms
where owner in (upper(trim(:OwnerKhaoSat)),'PUBLIC')
  and (substr(synonym_name,1,3)='KSK' or substr(synonym_name,1,5)='BASK_'
    or synonym_name in ('XN_PHIEU','XN_KETQUA','SA_BNCDHA','SA_BNCDHA_CT','XQ_BNCDHA_CTXQ'))
order by synonym_name, owner;
