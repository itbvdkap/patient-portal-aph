[CmdletBinding()]
param(
  [string]$EnvPath='E:\HIS\APP_BENHAN\artifacts\patientapi-service.env',
  [string]$OracleDll='E:\HIS\APP_BENHAN\artifacts\patientapi-agent-ksk-readonly-20261014\Oracle.ManagedDataAccess.dll',
  [string]$ReportPath='E:\HIS\APP_BENHAN\artifacts\ksk-cn1-metadata.json'
)
$ErrorActionPreference='Stop'
$taskSettings=@{}
Get-Content -LiteralPath $EnvPath | ForEach-Object {if($_ -match '^([^#=\s]+)=(.*)$'){$taskSettings[$matches[1]]=$matches[2].Trim().Trim('"')}}
if($taskSettings['PatientPortal__BranchCode'] -ne 'CN1'){throw 'Refusing non-CN1 configuration.'}
Add-Type -Path $OracleDll
$taskBuilder=[Oracle.ManagedDataAccess.Client.OracleConnectionStringBuilder]::new($taskSettings['ConnectionStrings__OracleHis'])
$taskBuilder.Pooling=$false
if($taskBuilder.DataSource -match '192\.168\.50\.250'){throw 'Refusing known CN3 host.'}
$taskConnection=[Oracle.ManagedDataAccess.Client.OracleConnection]::new($taskBuilder.ConnectionString)
function Read-KskMetadata([string]$Sql){
  if($Sql -notmatch '^\s*select\b' -or $Sql -match '(?i)\b(nextval|for\s+update)\b'){throw 'Only non-locking SELECT is allowed.'}
  $taskCommand=$taskConnection.CreateCommand(); $taskCommand.CommandText=$Sql; $taskCommand.CommandTimeout=10
  try{
    $taskReader=$taskCommand.ExecuteReader()
    try {while($taskReader.Read()){
      $taskRow=[ordered]@{}
      for($i=0;$i -lt $taskReader.FieldCount;$i++){$taskRow[$taskReader.GetName($i)]=if($taskReader.IsDBNull($i)){$null}else{$taskReader.GetValue($i)}}
      [pscustomobject]$taskRow
    }} finally {$taskReader.Dispose()}
  } finally {$taskCommand.Dispose()}
}
try {
  $taskCancel=[System.Threading.CancellationTokenSource]::new(10000)
  try {$null=$taskConnection.OpenAsync($taskCancel.Token).GetAwaiter().GetResult()} finally {$taskCancel.Dispose()}
  $taskGuard=$taskConnection.CreateCommand(); $taskGuard.CommandText='SET TRANSACTION READ ONLY'; $taskGuard.CommandTimeout=8
  try {$null=$taskGuard.ExecuteNonQuery()} finally {$taskGuard.Dispose()}
  $taskIdentity=@(Read-KskMetadata "select sys_context('USERENV','SERVER_HOST') server_host,sys_context('USERENV','SERVICE_NAME') service_name,sys_context('USERENV','SESSION_USER') session_user from dual")
  $taskPrivileges=@(Read-KskMetadata "select privilege from session_privs where privilege like '%ANY TABLE%' or privilege in ('CREATE SESSION','CREATE TABLE','CREATE PROCEDURE','UNLIMITED TABLESPACE')")
  $taskRoles=@(Read-KskMetadata 'select role from session_roles')
  $taskColumns=@(Read-KskMetadata @"
select owner,table_name,column_name,data_type from all_tab_columns
where table_name in ('KSK_KHACHHANG','KSKDOAN','KSKDONVI','KSKBTDBN','KSKMUC','KSKMUCCT','BTDBN','TIEPDON','V_CHIDINH','V_GIAVP',
'BASK_DONVI','BASK_NOIKHOA','BASK_NGKHOA','BASK_MAT','BASK_RHM','BASK_TMH','BASK_SANPHU','BASK_TONGKET','BASK_CLS',
'XN_PHIEU','XN_KETQUA','XN_BV_CHITIET','XN_TEN','XN_DONVI','SA_BNCDHA','SA_BNCDHA_CT','XQ_BNCDHA_CTXQ','SA_KTCDHA',
'V_VIENPHILL','V_VIENPHICT','V_TTRVDS','V_TTRVLL','V_TTRVCT','V_MIENGNTRU','V_MIENNGTRU','V_MIENOITRU','V_MIENNOITRU',
'V_HOANTRA','V_HOANTRACT','V_HOANTRALL','V_TAMUNG','V_TAMUNG_TTRVLL','V_QUYENSO')
and (owner in ('HGSOFT','HGSOFT_BV','HGSOFT_SOYBA') or owner like 'HGSOFT%0826' or owner like 'HGSOFT%0926' or owner like 'HGSOFT%1026')
order by owner,table_name,column_id
"@)
  $taskSynonyms=@(Read-KskMetadata "select owner,synonym_name,table_owner,table_name from all_synonyms where owner in ('HGSOFT_BV','PUBLIC') and (synonym_name like 'KSK%' or synonym_name like 'BASK%' or synonym_name in ('XN_PHIEU','SA_BNCDHA','V_GIAVP'))")
  [pscustomobject]@{Branch='CN1';Identity=$taskIdentity;Privileges=$taskPrivileges;Roles=$taskRoles;Columns=$taskColumns;Synonyms=$taskSynonyms} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
  Write-Output 'CN1 metadata read succeeded; READ ONLY transaction; no patient records or secrets in report.'
  $taskIdentity | Format-Table -AutoSize
  $taskPrivileges | Format-Table -AutoSize
  $taskRoles | Format-Table -AutoSize
  $taskColumns | Group-Object OWNER,TABLE_NAME | ForEach-Object {[pscustomobject]@{Object=$_.Name;Columns=$_.Count}} | Format-Table -AutoSize
} catch {
  $taskError=$_.Exception; while($taskError.InnerException){$taskError=$taskError.InnerException}
  if($taskError -is [Oracle.ManagedDataAccess.Client.OracleException]){throw "Oracle probe failed (ORA-$($taskError.Number)); credentials not printed."}
  throw "CN1 probe failed ($($taskError.GetType().Name)); credentials not printed."
} finally {$taskConnection.Dispose()}
