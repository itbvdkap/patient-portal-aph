[CmdletBinding()]
param(
    [string]$EnvPath = 'E:\HIS\APP_BENHAN\artifacts\patientapi-service.CN3.env',
    [ValidatePattern('^\d{4}$')][string]$MonthCode = '1026',
    [string]$ReportPath = 'E:\HIS\APP_BENHAN\artifacts\cn3-oracle-table-audit-20261010.json'
)
$ErrorActionPreference = 'Stop'
Add-Type -Path 'E:\HIS\APP_BENHAN\artifacts\patientapi-agent-win-x64\Oracle.ManagedDataAccess.dll'
$settings = @{}
Get-Content -LiteralPath $EnvPath | ForEach-Object {
    if ($_ -match '^([^#=\s]+)=(.*)$') { $settings[$matches[1]] = $matches[2].Trim().Trim('"') }
}
if ($settings['PatientPortal__BranchCode'] -ne 'CN3') { throw 'Refusing non-CN3 env.' }
$master = $settings['PatientPortal__OracleMasterSchema']
$prefix = $settings['PatientPortal__OracleMonthlySchemaPrefix']
foreach ($identifier in @($master, $prefix)) {
    if ($identifier -notmatch '^[A-Z][A-Z0-9_]{0,25}$') { throw 'Invalid or missing Oracle schema config.' }
}
$monthly = $prefix + $MonthCode
$builder = [Oracle.ManagedDataAccess.Client.OracleConnectionStringBuilder]::new($settings['ConnectionStrings__OracleHis'])
$builder.Pooling = $false
$connection = [Oracle.ManagedDataAccess.Client.OracleConnection]::new($builder.ConnectionString)
function Invoke-AuditSelect([string]$Sql) {
    if ($Sql -notmatch '^\s*select\b' -or $Sql -match '(?i)\b(nextval|for\s+update)\b') { throw 'Only non-locking SELECT queries are permitted.' }
    $command = $connection.CreateCommand()
    $command.CommandText = $Sql
    $command.CommandTimeout = 15
    try {
        $reader = $command.ExecuteReader()
        try {
            while ($reader.Read()) {
                $row = [ordered]@{}
                for ($i=0; $i -lt $reader.FieldCount; $i++) {
                    $row[$reader.GetName($i)] = if ($reader.IsDBNull($i)) { $null } else { $reader.GetValue($i) }
                }
                [pscustomobject]$row
            }
        } finally { $reader.Dispose() }
    } finally { $command.Dispose() }
}
function Probe-Columns([string]$Name, [string[]]$Columns, [string]$Category) {
    if ($Name -notmatch '^[A-Z][A-Z0-9_]*(\.[A-Z][A-Z0-9_]*)?$') { throw 'Unsafe object name.' }
    foreach ($identifier in $Columns) { if ($identifier -ne '*' -and $identifier -notmatch '^[A-Z][A-Z0-9_]*$') { throw 'Unsafe column.' } }
    try {
        $null = @(Invoke-AuditSelect ("select " + ($Columns -join ',') + " from $Name where 1=0"))
        [pscustomobject]@{Object=$Name;Category=$Category;Columns=$Columns;Readable=$true;OracleError=$null}
    } catch {
        $err = $_.Exception
        while ($err.InnerException) { $err = $err.InnerException }
        if ($err -isnot [Oracle.ManagedDataAccess.Client.OracleException]) { throw }
        [pscustomobject]@{Object=$Name;Category=$Category;Columns=$Columns;Readable=$false;OracleError=('ORA-'+$err.Number)}
    }
}
try {
    $connection.Open()
    $identity = @(Invoke-AuditSelect "select sys_context('USERENV','SERVER_HOST') as SERVER_HOST, sys_context('USERENV','SERVICE_NAME') as SERVICE_NAME, sys_context('USERENV','SESSION_USER') as SESSION_USER, sys_context('USERENV','CURRENT_SCHEMA') as CURRENT_SCHEMA from dual")[0]
    $columns = @(Invoke-AuditSelect "select owner, table_name, column_name, data_type, data_length, nullable from all_tab_columns where owner in ('$master','$monthly','HGSOFT_SOYBA') order by owner, table_name, column_id")
    $onlineColumns = @('ID','NGAYDANGKY','MADATCHO','MABN','HOTEN','NGAYSINH','PHAI','MABHYT','CCCD','SDT','SDT_NGUOITHAN','EMAIL','MANN','MADANTOC','CHOLAM','SONHA','THON','MAPHUONGXA','MATT','TRIEUCHUNG','CHUYENKHOA_DANGKY','PHONGKHAM','BACSI_DANGKY','BACSI','CANNANG','CHIEUCAO','ID_USERTAO','ID_USER','TRANGTHAI','TRANGTHAI_ZALO','MAQL_TIEPDON','MAVAOVIEN','NGAYTAO','NGAYCAPNHAT','NGAYGUI_ZALO','LOI_ZALO')
    $actualOnline = @($columns | Where-Object { $_.OWNER -eq 'HGSOFT_SOYBA' -and $_.TABLE_NAME -eq 'DANGKYKHAM' })
    $missingOnline = @($onlineColumns | Where-Object { $_ -notin $actualOnline.COLUMN_NAME })
    $probes = @(
        Probe-Columns 'HGSOFT_SOYBA.DANGKYKHAM' $onlineColumns 'online-booking-zalo'
        Probe-Columns 'HGSOFT_SOYBA.DLOGIN_BENHNHAN' @('ID','HOTEN','SDT') 'online-his-form-registration-helper'
        Probe-Columns 'BTDKP_BV' @('MAKP','TENKP','LOAI','DANGKY_ONLINE') 'online-catalog-unqualified'
        Probe-Columns 'BTDKP_NHOM' @('ID','TEN') 'online-his-form-catalog-unqualified'
        Probe-Columns 'DMBS' @('MA','HOTEN','MAKP') 'online-catalog-unqualified'
        Probe-Columns 'DM_TT' @('MA_TT','TEN_TT') 'online-catalog-unqualified'
        Probe-Columns 'DM_PX' @('MA_PX','TEN_PX','MA_TT') 'online-catalog-unqualified'
        Probe-Columns 'BTDNN_BV' @('MANN','TENNN') 'online-catalog-unqualified'
        Probe-Columns 'BTDDT' @('MADANTOC','DANTOC') 'online-catalog-unqualified'
        Probe-Columns "$master.BTDBN" @('MABN','CMND','CMND_BN') 'patient-identity'
        Probe-Columns "$master.DIENTHOAI" @('MABN','CMND') 'patient-identity'
        Probe-Columns "$monthly.TIEPDON" @('MAQL','MAVAOVIEN','NGAY','STT_KHAM','MAKP','MABS','MABN','LY_DO_VV','GHICHU') 'his-match-current-month'
    )
    $sequence = @(Invoke-AuditSelect "select sequence_owner, sequence_name, increment_by, cycle_flag from all_sequences where sequence_owner='HGSOFT_SOYBA' and sequence_name='SEQ_DANGKYKHAM'")
    $grants = @(Invoke-AuditSelect "select grantee, table_schema, table_name, privilege from all_tab_privs where table_schema='HGSOFT_SOYBA' and table_name in ('DANGKYKHAM','SEQ_DANGKYKHAM','DLOGIN_BENHNHAN') and (grantee=user or grantee='PUBLIC' or grantee in (select role from session_roles)) order by table_name, privilege")
    $systemPrivileges = @(Invoke-AuditSelect "select privilege from session_privs where privilege in ('SELECT ANY TABLE','INSERT ANY TABLE','UPDATE ANY TABLE','SELECT ANY SEQUENCE')")
    $indexes = @(Invoke-AuditSelect "select owner, index_name, uniqueness, status from all_indexes where table_owner='HGSOFT_SOYBA' and table_name='DANGKYKHAM'")
    $indexColumns = @(Invoke-AuditSelect "select index_name,column_name,column_position,descend from all_ind_columns where table_owner='HGSOFT_SOYBA' and table_name='DANGKYKHAM' order by index_name,column_position")
    $onlineRowCount = $null
    if($probes[0].Readable) { $onlineRowCount = @(Invoke-AuditSelect 'select count(*) as CNT from HGSOFT_SOYBA.DANGKYKHAM')[0].CNT }
    $onlineOwner = @(Invoke-AuditSelect "select username from all_users where username='HGSOFT_SOYBA'")
    $roles = @(Invoke-AuditSelect "select role from session_roles")
    $dbaObjects = @()
    $dbaMetadataError = $null
    try {
        $dbaObjects = @(Invoke-AuditSelect "select owner, object_name, object_type, status from dba_objects where owner='HGSOFT_SOYBA' and object_name in ('DANGKYKHAM','SEQ_DANGKYKHAM','DLOGIN_BENHNHAN')")
    } catch {
        $err = $_.Exception
        while ($err.InnerException) { $err = $err.InnerException }
        if ($err -isnot [Oracle.ManagedDataAccess.Client.OracleException]) { throw }
        $dbaMetadataError = 'ORA-' + $err.Number
    }
    # Additional portal resource dependencies: presence/readability only, not full
    # column validation or execution of patient queries.
    $repository = Get-Content -LiteralPath 'E:\HIS\APP_BENHAN\backend\PatientApi\Repositories\OracleHisPatientRepository.cs' -Raw
    $masterTables = @([regex]::Matches($repository,'\{_oracleMasterSchema\}\.([A-Za-z_][A-Za-z0-9_]*)') | ForEach-Object { $_.Groups[1].Value.ToUpperInvariant() } | Sort-Object -Unique)
    $monthTables = @([regex]::Matches($repository,'\{schema\}\.([A-Za-z_][A-Za-z0-9_]*)') | ForEach-Object { $_.Groups[1].Value.ToUpperInvariant() } | Sort-Object -Unique)
    $resources = @(
        foreach ($table in $masterTables) { Probe-Columns "$master.$table" @('*') 'portal-resource-master' }
        foreach ($table in $monthTables) { Probe-Columns "$monthly.$table" @('*') 'portal-resource-month' }
    )
    $result = [ordered]@{
        Branch='CN3'; CheckedAt=(Get-Date -Format 'o'); ConnectionIdentity=$identity
        MasterSchema=$master; MonthSchema=$monthly; MissingOnlineColumns=$missingOnline
        OnlineColumnMetadata=$actualOnline; EssentialProbes=$probes
        Sequence=$sequence; EffectiveObjectGrants=$grants; RelevantSystemPrivileges=$systemPrivileges
        OnlineSchemaVisibleInAllUsers=($onlineOwner.Count -gt 0); SessionRoles=$roles
        DbaOnlineObjects=$dbaObjects; DbaMetadataError=$dbaMetadataError
        OnlineIndexes=$indexes; OnlineIndexColumns=$indexColumns; OnlineRowCount=$onlineRowCount; ResourceTablePresenceOnly=$resources
        Limitations='No DDL/DML/NEXTVAL; no patient rows read; write privileges inferred from grants, not tested by writes; resource columns/clinical flows not comprehensively validated.'
    }
    $result | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $ReportPath -Encoding utf8
    Write-Output ('IDENTITY '+($identity | ConvertTo-Json -Compress))
    Write-Output ('MISSING ONLINE COLUMNS: '+$(if($missingOnline.Count){$missingOnline -join ','}else{'none'}))
    $probes | Select-Object Object,Readable,OracleError | Format-Table -AutoSize
    $sequence | Format-Table -AutoSize
    $grants | Format-Table -AutoSize
    Write-Output ('HGSOFT_SOYBA schema exists='+($onlineOwner.Count -gt 0)+' DBA metadata error='+$dbaMetadataError)
    $dbaObjects | Format-Table -AutoSize
    $resources | Where-Object { -not $_.Readable } | Select-Object Object,OracleError | Format-Table -AutoSize
    Write-Output "Report: $ReportPath"
} finally { $connection.Dispose() }
