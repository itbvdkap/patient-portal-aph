$ErrorActionPreference='Stop'
Add-Type -Path 'E:\HIS\APP_BENHAN\artifacts\patientapi-agent-win-x64\Oracle.ManagedDataAccess.dll'
function Open-ConfiguredConnection([string]$Path,[string]$Branch) {
    $settings=@{}
    Get-Content -LiteralPath $Path | ForEach-Object {if($_ -match '^([^#=\s]+)=(.*)$'){$settings[$matches[1]]=$matches[2].Trim().Trim('"')}}
    if($settings['PatientPortal__BranchCode'] -ne $Branch){throw 'Unexpected branch in env.'}
    $builder=[Oracle.ManagedDataAccess.Client.OracleConnectionStringBuilder]::new($settings['ConnectionStrings__OracleHis'])
    $builder.Pooling=$false
    $connection=[Oracle.ManagedDataAccess.Client.OracleConnection]::new($builder.ConnectionString)
    $connection.Open()
    return $connection
}
function Read-Rows($Connection,[string]$Sql) {
    $command=$Connection.CreateCommand();$command.CommandText=$Sql;$command.CommandTimeout=15
    try {
        $reader=$command.ExecuteReader()
        try {
            while($reader.Read()) {
                $row=[ordered]@{}
                for($i=0;$i -lt $reader.FieldCount;$i++) {
                    $value=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}
                    if($value -is [Oracle.ManagedDataAccess.Types.OracleClob]){$value=$value.Value}
                    $row[$reader.GetName($i)]=$value
                }
                [pscustomobject]$row
            }
        }finally{$reader.Dispose()}
    }finally{$command.Dispose()}
}
$cn1=$null;$cn3=$null
try {
    $cn1=Open-ConfiguredConnection 'E:\HIS\APP_BENHAN\artifacts\patientapi-service.env' 'CN1'
    $cn3=Open-ConfiguredConnection 'E:\HIS\APP_BENHAN\artifacts\patientapi-service.CN3.env' 'CN3'
    $sourceIdentity=@(Read-Rows $cn1 "select sys_context('USERENV','SERVER_HOST') as HOST,sys_context('USERENV','SERVICE_NAME') as SERVICE from dual")[0]
    $targetIdentity=@(Read-Rows $cn3 "select sys_context('USERENV','SERVER_HOST') as HOST,sys_context('USERENV','SERVICE_NAME') as SERVICE from dual")[0]
    if($sourceIdentity.HOST -eq $targetIdentity.HOST){throw 'Source and target Oracle host are identical.'}
    $table=@(Read-Rows $cn1 "select dbms_metadata.get_ddl('TABLE','DANGKYKHAM','HGSOFT_SOYBA') as DDL from dual")[0]
    $columns=@(Read-Rows $cn1 "select column_name,data_type,data_length,char_length,char_used,data_precision,data_scale,nullable,column_id from all_tab_columns where owner='HGSOFT_SOYBA' and table_name='DANGKYKHAM' order by column_id")
    $indexes=@(Read-Rows $cn1 "select owner,index_name,uniqueness,status,tablespace_name from all_indexes where table_owner='HGSOFT_SOYBA' and table_name='DANGKYKHAM'")
    $indexColumns=@(Read-Rows $cn1 "select index_owner,index_name,column_name,column_position,descend from all_ind_columns where table_owner='HGSOFT_SOYBA' and table_name='DANGKYKHAM' order by index_name,column_position")
    $constraints=@(Read-Rows $cn1 "select constraint_name,constraint_type,status,r_owner,r_constraint_name from all_constraints where owner='HGSOFT_SOYBA' and table_name='DANGKYKHAM'")
    $triggers=@(Read-Rows $cn1 "select owner,trigger_name,status,trigger_type,triggering_event from all_triggers where table_owner='HGSOFT_SOYBA' and table_name='DANGKYKHAM'")
    $sequence=@(Read-Rows $cn1 "select min_value,max_value,increment_by,cycle_flag,order_flag,cache_size from all_sequences where sequence_owner='HGSOFT_SOYBA' and sequence_name='SEQ_DANGKYKHAM'")
    $privileges=@(Read-Rows $cn3 "select privilege from session_privs where privilege in ('CREATE USER','ALTER USER','CREATE ANY TABLE','CREATE ANY INDEX','CREATE ANY SEQUENCE','GRANT ANY OBJECT PRIVILEGE')")
    $tablespaces=@(Read-Rows $cn3 "select tablespace_name,status,contents from dba_tablespaces where contents='PERMANENT'")
    $defaultTablespace=@(Read-Rows $cn3 "select default_tablespace,temporary_tablespace from dba_users where username=user")
    $targetSchemas=@(Read-Rows $cn3 "select username from all_users where username='HGSOFT_SOYBA'")
    $result=[ordered]@{Source=$sourceIdentity;Target=$targetIdentity;SourceTableDDL=$table.DDL;SourceColumns=$columns;SourceIndexes=$indexes;SourceIndexColumns=$indexColumns;SourceConstraints=$constraints;SourceTriggers=$triggers;SourceSequence=$sequence;TargetPrivileges=$privileges;TargetTablespaces=$tablespaces;TargetAgentTablespaces=$defaultTablespace;TargetSchemaAlreadyExists=($targetSchemas.Count -gt 0)}
    $result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath 'E:\HIS\APP_BENHAN\artifacts\cn3-online-bootstrap-preflight-20261010.json' -Encoding utf8
    Write-Output ($result | ConvertTo-Json -Depth 6)
}finally{if($cn1){$cn1.Dispose()};if($cn3){$cn3.Dispose()}}
