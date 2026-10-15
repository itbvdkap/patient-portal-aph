[CmdletBinding()]
param([switch]$Apply)
$ErrorActionPreference='Stop'
$root='E:\HIS\APP_BENHAN'
$preflight=Get-Content -LiteralPath (Join-Path $root 'artifacts\cn3-online-bootstrap-preflight-20261010.json') -Raw | ConvertFrom-Json
if($preflight.Source.HOST -ne 'dbserver' -or $preflight.Target.HOST -ne 'serverhg_cs2' -or $preflight.SourceColumns.Count -ne 36 -or @($preflight.SourceTriggers).Count -ne 0){throw 'Unexpected baseline metadata.'}
Add-Type -Path (Join-Path $root 'artifacts\patientapi-agent-win-x64\Oracle.ManagedDataAccess.dll')
$settings=@{}
Get-Content -LiteralPath (Join-Path $root 'artifacts\patientapi-service.CN3.env') | ForEach-Object {if($_ -match '^([^#=\s]+)=(.*)$'){$settings[$matches[1]]=$matches[2].Trim().Trim('"')}}
if($settings['PatientPortal__BranchCode'] -ne 'CN3' -or $settings['PatientPortal__OracleMasterSchema'] -ne 'HGSOFT'){throw 'Wrong CN3 env.'}
$builder=[Oracle.ManagedDataAccess.Client.OracleConnectionStringBuilder]::new($settings['ConnectionStrings__OracleHis'])
if($builder.DataSource -ne '192.168.50.250:1521/hgsoft' -or $builder.UserID.ToUpperInvariant() -ne 'HGSOFT'){throw 'Wrong target endpoint/user.'}
$builder.Pooling=$false
$connection=[Oracle.ManagedDataAccess.Client.OracleConnection]::new($builder.ConnectionString)
function Read-Rows([string]$Sql) {
    $command=$connection.CreateCommand();$command.CommandText=$Sql;$command.CommandTimeout=15
    try {$reader=$command.ExecuteReader();try {while($reader.Read()){$row=[ordered]@{};for($i=0;$i -lt $reader.FieldCount;$i++){$row[$reader.GetName($i)]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}};[pscustomobject]$row}}finally{$reader.Dispose()}}finally{$command.Dispose()}
}
function Column-Signature($Column) {
    ($Column.COLUMN_NAME,$Column.DATA_TYPE,$Column.DATA_LENGTH,$Column.CHAR_LENGTH,$Column.CHAR_USED,$Column.DATA_PRECISION,$Column.DATA_SCALE,$Column.NULLABLE,$Column.COLUMN_ID) -join '|'
}
try {
    $connection.Open()
    $identity=@(Read-Rows "select sys_context('USERENV','SERVER_HOST') as HOST,sys_context('USERENV','SERVICE_NAME') as SERVICE,sys_context('USERENV','SESSION_USER') as AGENT_USER from dual")[0]
    if($identity.HOST -ne 'serverhg_cs2' -or $identity.SERVICE -ne 'hgsoft' -or $identity.AGENT_USER -ne 'HGSOFT'){throw 'Live DB identity mismatch.'}
    $required=@('CREATE USER','CREATE ANY TABLE','CREATE ANY INDEX','CREATE ANY SEQUENCE','SELECT ANY TABLE','INSERT ANY TABLE','UPDATE ANY TABLE','SELECT ANY SEQUENCE')
    $privileges=@(Read-Rows "select privilege from session_privs")
    if(@($required | Where-Object {$_ -notin $privileges.PRIVILEGE}).Count){throw 'Insufficient bootstrap privileges.'}
    $tableExists=@(Read-Rows "select object_type from dba_objects where owner='HGSOFT_SOYBA' and object_name='DANGKYKHAM'")
    if($tableExists.Count){
        if(@($tableExists | Where-Object {$_.OBJECT_TYPE -ne 'TABLE'}).Count){throw 'Unexpected existing object kind.'}
        $existing=@(Read-Rows "select column_name,data_type,data_length,char_length,char_used,data_precision,data_scale,nullable,column_id from dba_tab_columns where owner='HGSOFT_SOYBA' and table_name='DANGKYKHAM' order by column_id")
        if(@(Compare-Object @($preflight.SourceColumns | ForEach-Object {Column-Signature $_}) @($existing | ForEach-Object {Column-Signature $_})).Count){throw 'Existing target table differs from baseline; no destructive correction allowed.'}
    }
    Write-Output 'Preflight PASS: CN3 identity, bootstrap privileges and baseline checked.'
    if(-not $Apply){Write-Output 'Plan only. Use -Apply to create missing objects and verify transactional DML.';return}
    # Owner is not an app login: strong random password, ACCOUNT LOCK, no CREATE
    # SESSION grant. Password exists only in memory and is never logged/saved.
    $bytes=[byte[]]::new(12);$rng=[Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
    $ownerPassword='A9a'+[Convert]::ToHexString($bytes)
    $sql=Get-Content -LiteralPath (Join-Path $root 'deploy\oracle\cn3_initialize_online_booking.sql') -Raw
    $sql=[regex]::Replace($sql,'(?m)^/\s*$','').Replace('__OWNER_PASSWORD__',$ownerPassword)
    $command=$connection.CreateCommand();$command.CommandText=$sql;$command.CommandTimeout=60
    try {$null=$command.ExecuteNonQuery()}catch {
        $err=$_.Exception;while($err.InnerException){$err=$err.InnerException}
        if($err -is [Oracle.ManagedDataAccess.Client.OracleException]){throw ('Bootstrap DDL failed ORA-'+$err.Number+'; DDL may have partially committed. Reinspect before retry.')}else{throw 'Bootstrap DDL failed; inspect partial state. SQL/password deliberately not logged.'}
    }finally{$command.Dispose();$ownerPassword=$null;$sql=$null;[Array]::Clear($bytes,0,$bytes.Length)}
    $actual=@(Read-Rows "select column_name,data_type,data_length,char_length,char_used,data_precision,data_scale,nullable,column_id from dba_tab_columns where owner='HGSOFT_SOYBA' and table_name='DANGKYKHAM' order by column_id")
    if(@(Compare-Object @($preflight.SourceColumns | ForEach-Object {Column-Signature $_}) @($actual | ForEach-Object {Column-Signature $_})).Count){throw 'Post-create column metadata differs from CN1.'}
    $objects=@(Read-Rows "select object_name,object_type,status from dba_objects where owner='HGSOFT_SOYBA' and object_name in ('DANGKYKHAM','SEQ_DANGKYKHAM','PK_HGSOYBA_DANGKYKHAM','IX_DANGKYKHAM_LOAD','IX_DANGKYKHAM_MADATCHO')")
    if($objects.Count -ne 5 -or @($objects | Where-Object {$_.STATUS -ne 'VALID'}).Count){throw 'Post-create objects invalid/missing.'}
    $owner=@(Read-Rows "select account_status from dba_users where username='HGSOFT_SOYBA'")[0]
    if($owner.ACCOUNT_STATUS -notmatch 'LOCKED'){throw 'Owner account is not locked.'}
    $actualIndexes=@(Read-Rows "select index_name,column_name,column_position,descend from dba_ind_columns where table_owner='HGSOFT_SOYBA' and table_name='DANGKYKHAM' order by index_name,column_position")
    $sourceIndexSignatures=@($preflight.SourceIndexColumns | ForEach-Object {($_.INDEX_NAME,$_.COLUMN_NAME,$_.COLUMN_POSITION,$_.DESCEND) -join '|'})
    $targetIndexSignatures=@($actualIndexes | ForEach-Object {($_.INDEX_NAME,$_.COLUMN_NAME,$_.COLUMN_POSITION,$_.DESCEND) -join '|'})
    if(@(Compare-Object $sourceIndexSignatures $targetIndexSignatures).Count){throw 'Index columns differ from CN1.'}
    # Sequence advances once (not rollback-able); every synthetic row is rolled
    # back, never visible to workers. No calls to Zalo or portal job queues.
    $testId=@(Read-Rows 'select HGSOFT_SOYBA.SEQ_DANGKYKHAM.nextval as ID from dual')[0].ID
    $transaction=$connection.BeginTransaction()
    try {
        $command=$connection.CreateCommand();$command.Transaction=$transaction;$command.BindByName=$true;$command.CommandTimeout=15
        $command.CommandText="insert into HGSOFT_SOYBA.DANGKYKHAM (ID,MADATCHO,NGAYDANGKY,HOTEN) values (:Id,'PORTAL-CN3-BOOTSTRAP-TEST',sysdate,:Hoten)"
        $null=$command.Parameters.Add('Id',[Oracle.ManagedDataAccess.Client.OracleDbType]::Decimal);$command.Parameters['Id'].Value=$testId
        $null=$command.Parameters.Add('Hoten',[Oracle.ManagedDataAccess.Client.OracleDbType]::NVarchar2);$command.Parameters['Hoten'].Value='KIỂM THỬ CN3 — KHÔNG PHẢI BN'
        try {if($command.ExecuteNonQuery() -ne 1){throw 'Synthetic insert failed.'}}finally{$command.Dispose()}
        $command=$connection.CreateCommand();$command.Transaction=$transaction;$command.CommandTimeout=15
        $command.CommandText="select HOTEN,TRANGTHAI_ZALO,TRANGTHAI,MAQL_TIEPDON from HGSOFT_SOYBA.DANGKYKHAM where ID=$testId"
        try {$reader=$command.ExecuteReader();try {if(-not $reader.Read() -or $reader.GetString(0) -ne 'KIỂM THỬ CN3 — KHÔNG PHẢI BN' -or $reader.GetString(1) -ne 'CHUA_GUI' -or $reader.GetDecimal(2) -ne 0 -or $reader.GetDecimal(3) -ne 0){throw 'Defaults or Unicode roundtrip failed.'}}finally{$reader.Dispose()}}finally{$command.Dispose()}
        $command=$connection.CreateCommand();$command.Transaction=$transaction;$command.CommandTimeout=15
        $command.CommandText="update HGSOFT_SOYBA.DANGKYKHAM set TRANGTHAI_ZALO='DA_GUI',NGAYGUI_ZALO=sysdate,LOI_ZALO=null,NGAYCAPNHAT=sysdate where ID=$testId"
        try {if($command.ExecuteNonQuery() -ne 1){throw 'Synthetic status update failed.'}}finally{$command.Dispose()}
    }finally{$transaction.Rollback();$transaction.Dispose()}
    $leftover=@(Read-Rows "select count(*) as CNT from HGSOFT_SOYBA.DANGKYKHAM where ID=$testId and MADATCHO='PORTAL-CN3-BOOTSTRAP-TEST'")[0].CNT
    if($leftover -ne 0){throw 'Synthetic test row remains!'}
    $report=[ordered]@{Branch='CN3';AppliedAt=(Get-Date -Format 'o');Identity=$identity;ColumnCount=$actual.Count;ColumnMetadataMatchesCN1=$true;Objects=$objects;OwnerAccountStatus=$owner.ACCOUNT_STATUS;TransactionalInsertUpdateDefaultsUnicode='PASS';SyntheticRowRollback='PASS';SequenceValuesConsumedByTest=1;PatientDataCopied=$false;EnvOrServicesChanged=$false;IndexColumnsMatchCN1=$true;Access='Existing effective HGSOFT privileges; no self-GRANT or new global rights.'}
    $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $root 'artifacts\cn3-online-bootstrap-result-20261010.json') -Encoding utf8
    Write-Output ($report | ConvertTo-Json -Depth 6)
}finally{$connection.Dispose()}
