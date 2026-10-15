[CmdletBinding()]
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Add-Type -Path (Join-Path $root 'artifacts\patientapi-agent-win-x64\Oracle.ManagedDataAccess.dll')

function Open-Branch([string]$EnvFile, [string]$Branch, [string]$Endpoint) {
    $settings = @{}
    Get-Content -LiteralPath (Join-Path $root $EnvFile) | ForEach-Object {
        if ($_ -match '^([^#=\s]+)=(.*)$') {
            if ($settings.ContainsKey($matches[1])) { throw 'Duplicate env setting.' }
            $settings[$matches[1]] = $matches[2].Trim().Trim('"')
        }
    }
    if ($settings['PatientPortal__BranchCode'] -ne $Branch) { throw 'Wrong branch env.' }
    $builder = [Oracle.ManagedDataAccess.Client.OracleConnectionStringBuilder]::new($settings['ConnectionStrings__OracleHis'])
    if ($builder.DataSource -ne $Endpoint) { throw 'Wrong Oracle endpoint.' }
    if ($Branch -eq 'CN3' -and $builder.UserID.ToUpperInvariant() -ne 'HGSOFT') { throw 'Wrong target login.' }
    $builder.Pooling = $false
    $connection = [Oracle.ManagedDataAccess.Client.OracleConnection]::new($builder.ConnectionString)
    try { $connection.Open(); return $connection } catch { $connection.Dispose(); throw 'Oracle connection failed; credentials not logged.' }
}
function Read-Rows($Connection, [string]$Sql) {
    if ($Sql -notmatch '^\s*select\b' -or $Sql -match '(?i)\b(nextval|for\s+update)\b') { throw 'Only read-only SELECT allowed.' }
    $command = $Connection.CreateCommand(); $command.CommandText = $Sql; $command.CommandTimeout = 15
    try {
        $reader = $command.ExecuteReader()
        try {
            while ($reader.Read()) {
                $row = [ordered]@{}
                for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                    $value = if ($reader.IsDBNull($i)) { $null } else { $reader.GetValue($i) }
                    if ($value -is [Oracle.ManagedDataAccess.Types.OracleClob]) { $value = $value.Value }
                    $row[$reader.GetName($i)] = $value
                }
                [pscustomobject]$row
            }
        } finally { $reader.Dispose() }
    } finally { $command.Dispose() }
}
$columnsSql = "select column_name,data_type,data_length,char_length,char_used,data_precision,data_scale,nullable,column_id from dba_tab_columns where owner='HGSOFT_SOYBA' and table_name='DLOGIN_BENHNHAN' order by column_id"
function Signatures($Columns) {
    @($Columns | ForEach-Object { ($_.COLUMN_NAME,$_.DATA_TYPE,$_.DATA_LENGTH,$_.CHAR_LENGTH,$_.CHAR_USED,$_.DATA_PRECISION,$_.DATA_SCALE,$_.NULLABLE,$_.COLUMN_ID) -join '|' })
}
function Assert-Table($Connection, $ExpectedColumns) {
    $actual = @(Read-Rows $Connection $columnsSql)
    if ($actual.Count -ne 7 -or @(Compare-Object (Signatures $ExpectedColumns) (Signatures $actual)).Count) { throw 'Target columns differ from CN1; no destructive correction allowed.' }
    $indexes = @(Read-Rows $Connection "select index_name,uniqueness,status from dba_indexes where table_owner='HGSOFT_SOYBA' and table_name='DLOGIN_BENHNHAN'")
    $keys = @(Read-Rows $Connection "select column_name,column_position,descend from dba_ind_columns where table_owner='HGSOFT_SOYBA' and table_name='DLOGIN_BENHNHAN' order by column_position")
    $pk = @(Read-Rows $Connection "select constraint_name,status from dba_constraints where owner='HGSOFT_SOYBA' and table_name='DLOGIN_BENHNHAN' and constraint_type='P'")
    if ($indexes.Count -ne 1 -or $indexes[0].INDEX_NAME -ne 'PK_HGSOYBA_DLOGIN_BENHNHAN' -or $indexes[0].UNIQUENESS -ne 'UNIQUE' -or $indexes[0].STATUS -ne 'VALID' -or $keys.Count -ne 1 -or $keys[0].COLUMN_NAME -ne 'ID' -or $keys[0].DESCEND -ne 'ASC' -or $pk.Count -ne 1 -or $pk[0].STATUS -ne 'ENABLED') { throw 'Unexpected target primary key/index.' }
    $ddl = @(Read-Rows $Connection "select dbms_metadata.get_ddl('TABLE','DLOGIN_BENHNHAN','HGSOFT_SOYBA') DDL from dual")[0].DDL
    if ($ddl -notmatch '(?i)"NGAYTAO"\s+DATE\s+DEFAULT\s+sysdate') { throw 'Missing NGAYTAO default.' }
    $triggers = @(Read-Rows $Connection "select trigger_name from dba_triggers where table_owner='HGSOFT_SOYBA' and table_name='DLOGIN_BENHNHAN'")
    if ($triggers.Count) { throw 'Unexpected trigger: refusing synthetic DML.' }
}
$source = $null; $target = $null
try {
    $source = Open-Branch 'artifacts\patientapi-service.env' 'CN1' '192.168.2.250:1521/hgsoft'
    $target = Open-Branch 'artifacts\patientapi-service.CN3.env' 'CN3' '192.168.50.250:1521/hgsoft'
    $identitySql = "select sys_context('USERENV','SERVER_HOST') HOST,sys_context('USERENV','SERVICE_NAME') SERVICE,sys_context('USERENV','SESSION_USER') AGENT_USER from dual"
    $sourceIdentity = @(Read-Rows $source $identitySql)[0]
    $targetIdentity = @(Read-Rows $target $identitySql)[0]
    if ($sourceIdentity.HOST -ne 'dbserver' -or $targetIdentity.HOST -ne 'serverhg_cs2' -or $targetIdentity.SERVICE -ne 'hgsoft' -or $targetIdentity.AGENT_USER -ne 'HGSOFT') { throw 'Live Oracle identity mismatch.' }
    $sourceColumns = @(Read-Rows $source $columnsSql)
    $expectedNames = @('ID','HOTEN','SDT','EMAIL','USERNAME','MABN','NGAYTAO')
    if ($sourceColumns.Count -ne 7 -or ($sourceColumns.COLUMN_NAME -join '|') -ne ($expectedNames -join '|')) { throw 'Unexpected CN1 column baseline.' }
    $expectedSignatures = @(
        'ID|NUMBER|22|0||18|0|N|1',
        'HOTEN|NVARCHAR2|400|200|C|||Y|2',
        'SDT|VARCHAR2|30|30|B|||Y|3',
        'EMAIL|VARCHAR2|200|200|B|||Y|4',
        'USERNAME|VARCHAR2|100|100|B|||Y|5',
        'MABN|VARCHAR2|20|20|B|||Y|6',
        'NGAYTAO|DATE|7|0||||Y|7'
    )
    if (@(Compare-Object $expectedSignatures (Signatures $sourceColumns)).Count) { throw 'CN1 types changed from reviewed DDL.' }
    Assert-Table $source $sourceColumns
    $ddl = @(Read-Rows $source "select dbms_metadata.get_ddl('TABLE','DLOGIN_BENHNHAN','HGSOFT_SOYBA') DDL from dual")[0].DDL
    $owner = @(Read-Rows $target "select account_status from dba_users where username='HGSOFT_SOYBA'")
    if ($owner.Count -ne 1 -or $owner[0].ACCOUNT_STATUS -notmatch 'LOCKED') { throw 'Expected locked target owner.' }
    $objects = @(Read-Rows $target "select object_type,status from dba_objects where owner='HGSOFT_SOYBA' and object_name='DLOGIN_BENHNHAN'")
    if ($objects.Count) {
        if ($objects.Count -ne 1 -or $objects[0].OBJECT_TYPE -ne 'TABLE') { throw 'Unexpected existing target object.' }
        Assert-Table $target $sourceColumns
    }

    # Assemble the form query before applying any DDL so source-shape errors
    # cannot leave a partially completed migration.
    $form = Get-Content -LiteralPath (Join-Path $root 'reverse\BenhNhan\HGSoft\frmDanhSachDatKham_Online.cs') -Raw
    $methodStart = $form.IndexOf('private void Load_DSDK(')
    if ($methodStart -lt 0) { throw 'Form method missing.' }
    $form = $form.Substring($methodStart)
    $end = $form.IndexOf('text = text + " and to_date(')
    if ($end -lt 0) { throw 'Form date boundary missing.' }
    $literals = [regex]::Matches($form.Substring(0,$end),'(?m)^\s*(?:string text =|text \+=) "([^"\r\n]*)";')
    if ($literals.Count -ne 6) { throw 'Unexpected form SQL shape.' }
    $formSql = (($literals | ForEach-Object { $_.Groups[1].Value }) -join '') + ' and 1=0'
    $preflight = [ordered]@{CheckedAt=(Get-Date -Format 'o');Source=$sourceIdentity;Target=$targetIdentity;SourceColumns=$sourceColumns;SourceDDL=$ddl;TargetTableExists=($objects.Count -gt 0);TargetOwnerStatus=$owner[0].ACCOUNT_STATUS;PatientRowsReadOrCopied=$false}
    $preflight | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $root 'artifacts\cn3-online-form-table-preflight-20261010.json') -Encoding utf8
    Write-Output 'Preflight PASS: CN1 metadata, CN3 identity and locked owner verified.'
    if (-not $Apply) { Write-Output 'Plan only. -Apply creates missing table; never overwrites existing data.'; return }
    $sql = Get-Content -LiteralPath (Join-Path $root 'deploy\oracle\cn3_add_dlogin_benhnhan.sql') -Raw
    $sql = [regex]::Replace($sql,'(?m)^/\s*$','')
    $command = $target.CreateCommand(); $command.CommandText = $sql; $command.CommandTimeout = 60
    try { $null = $command.ExecuteNonQuery() } catch { throw 'CN3 DDL failed; inspect partial committed state before retry.' } finally { $command.Dispose() }
    Assert-Table $target $sourceColumns

    # AND 1=0 tests all form tables, columns and JOIN expressions without patient rows.
    $null = @(Read-Rows $target $formSql)

    # Synthetic row is never committed, visible to other sessions or sent to Zalo.
    $testId = -2026101001
    if (@(Read-Rows $target "select count(*) CNT from HGSOFT_SOYBA.DLOGIN_BENHNHAN where ID=$testId")[0].CNT -ne 0) { throw 'Synthetic ID already exists.' }
    $transaction = $target.BeginTransaction()
    try {
        $command = $target.CreateCommand(); $command.Transaction = $transaction; $command.CommandTimeout = 15; $command.BindByName = $true
        $command.CommandText = 'insert into HGSOFT_SOYBA.DLOGIN_BENHNHAN (ID,HOTEN) values (:Id,:Hoten)'
        $null = $command.Parameters.Add('Id',[Oracle.ManagedDataAccess.Client.OracleDbType]::Decimal); $command.Parameters['Id'].Value = $testId
        $null = $command.Parameters.Add('Hoten',[Oracle.ManagedDataAccess.Client.OracleDbType]::NVarchar2); $command.Parameters['Hoten'].Value = 'KIỂM THỬ CN3 — KHÔNG PHẢI BN'
        try { if ($command.ExecuteNonQuery() -ne 1) { throw 'Synthetic insert failed.' } } finally { $command.Dispose() }
        $command = $target.CreateCommand(); $command.Transaction = $transaction; $command.CommandTimeout = 15
        $command.CommandText = "select HOTEN,NGAYTAO from HGSOFT_SOYBA.DLOGIN_BENHNHAN where ID=$testId"
        try {
            $reader = $command.ExecuteReader()
            try { if (-not $reader.Read() -or $reader.GetString(0) -ne 'KIỂM THỬ CN3 — KHÔNG PHẢI BN' -or $reader.IsDBNull(1)) { throw 'Unicode/default roundtrip failed.' } } finally { $reader.Dispose() }
        } finally { $command.Dispose() }
    } finally { $transaction.Rollback(); $transaction.Dispose() }
    if (@(Read-Rows $target "select count(*) CNT from HGSOFT_SOYBA.DLOGIN_BENHNHAN where ID=$testId")[0].CNT -ne 0) { throw 'Synthetic row remains!' }
    $count = @(Read-Rows $target 'select count(*) CNT from HGSOFT_SOYBA.DLOGIN_BENHNHAN')[0].CNT
    $report = [ordered]@{Branch='CN3';AppliedAt=(Get-Date -Format 'o');Identity=$targetIdentity;CreatedNewTable=($objects.Count -eq 0);ColumnMetadataMatchesCN1=$true;ColumnCount=7;PrimaryKeyIndex='PK_HGSOYBA_DLOGIN_BENHNHAN';FormSelectAndJoinsZeroRow='PASS';SyntheticUnicodeDefaultAndRollback='PASS';RowsAfter=$count;PatientDataCopied=$false;EnvServiceExeOrZaloChanged=$false;NewGrants=$false;Limitations='Form SQL validated with AND 1=0 under HGSOFT; actual HIS UI and its connection not exercised. DDL implicitly committed.'}
    $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $root 'artifacts\cn3-online-form-table-result-20261010.json') -Encoding utf8
    Write-Output ($report | ConvertTo-Json -Depth 6)
} finally { if ($source) { $source.Dispose() }; if ($target) { $target.Dispose() } }
