[CmdletBinding()]
param([string]$EnvPath='E:\HIS\APP_BENHAN\artifacts\patientapi-service.env',
  [string]$OracleDll='E:\HIS\APP_BENHAN\backend\PatientApi\bin\Debug\net9.0\Oracle.ManagedDataAccess.dll')
$ErrorActionPreference='Stop'
$taskSettings=@{}
Get-Content -LiteralPath $EnvPath | ForEach-Object {if($_ -match '^([^#=\s]+)=(.*)$'){$taskSettings[$matches[1]]=$matches[2].Trim().Trim('"')}}
if($taskSettings['PatientPortal__BranchCode'] -ne 'CN1'){throw 'Refusing non-CN1 configuration.'}
Add-Type -Path $OracleDll
$taskBuilder=[Oracle.ManagedDataAccess.Client.OracleConnectionStringBuilder]::new($taskSettings['ConnectionStrings__OracleHis'])
$taskBuilder.Pooling=$false
$taskConnection=[Oracle.ManagedDataAccess.Client.OracleConnection]::new($taskBuilder.ConnectionString)
function Read-Metadata([string]$Sql){
  if($Sql -notmatch '^\s*select\b' -or $Sql -match '(?i)\b(nextval|for\s+update)\b'){throw 'Only non-locking SELECT allowed.'}
  $taskCommand=$taskConnection.CreateCommand();$taskCommand.CommandText=$Sql;$taskCommand.CommandTimeout=10
  try{$taskReader=$taskCommand.ExecuteReader();try{while($taskReader.Read()){
    $taskRow=[ordered]@{};for($i=0;$i -lt $taskReader.FieldCount;$i++){$taskRow[$taskReader.GetName($i)]=if($taskReader.IsDBNull($i)){$null}else{$taskReader.GetValue($i)}};[pscustomobject]$taskRow
  }}finally{$taskReader.Dispose()}}finally{$taskCommand.Dispose()}
}
try{
  $taskConnection.Open()
  $taskGuard=$taskConnection.CreateCommand();$taskGuard.CommandText='SET TRANSACTION READ ONLY';$null=$taskGuard.ExecuteNonQuery();$taskGuard.Dispose()
  $taskTables="'KSK_KHACHHANG','KSKDOAN','KSKDONVI','KSKBTDBN','KSKMUC','KSKMUCCT','V_GIAVP'"
  $taskColumns=@(Read-Metadata "select table_name,column_name,data_type,data_length,char_length,data_precision,data_scale,nullable from all_tab_columns where owner='HGSOFT_BV' and table_name in ($taskTables) order by table_name,column_id")
  $taskKeys=@(Read-Metadata "select c.table_name,c.constraint_name,c.constraint_type,k.column_name,k.position,c.r_owner,c.r_constraint_name from all_constraints c join all_cons_columns k on k.owner=c.owner and k.constraint_name=c.constraint_name where c.owner='HGSOFT_BV' and c.table_name in ($taskTables) order by c.table_name,c.constraint_name,k.position")
  $taskTriggers=@(Read-Metadata "select table_name,trigger_name,status,triggering_event from all_triggers where table_owner='HGSOFT_BV' and table_name in ($taskTables)")
  $taskTypes=@(Read-Metadata "select table_name from all_tables where owner='HGSOFT_BV' and (table_name like '%KSK%' or table_name='MABN') order by table_name")
  $taskValues=@(Read-Metadata "select phai,tt,namsinh_tu,namsinh_den,tinhtrang_honnhan,count(*) row_count from hgsoft_bv.kskmuc group by phai,tt,namsinh_tu,namsinh_den,tinhtrang_honnhan order by row_count desc fetch first 20 rows only")
  $taskVisits=@(Read-Metadata "select owner,listagg(column_name,',') within group(order by column_name) cols from all_tab_columns where table_name='BASK_DONVI' and regexp_like(owner,'^HGSOFT_BV[0-9]{4}$') group by owner order by owner")
  $taskReport=[pscustomobject]@{Columns=$taskColumns;Keys=$taskKeys;Triggers=$taskTriggers;RelatedTables=$taskTypes;PackageEnums=$taskValues;VisitColumns=$taskVisits}
  $taskReport | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $PSScriptRoot '..\artifacts\ksk-management-metadata.json') -Encoding UTF8
  $taskVisits | Format-Table -AutoSize
}catch{
  $taskError=$_.Exception;while($taskError.InnerException){$taskError=$taskError.InnerException}
  if($taskError -is [Oracle.ManagedDataAccess.Client.OracleException]){throw "Metadata unavailable: ORA-$($taskError.Number). No credentials logged."}
  throw "Metadata unavailable ($($taskError.GetType().Name)); no credentials logged."
}finally{$taskConnection.Dispose()}
