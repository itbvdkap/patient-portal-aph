-- CN3 only. Structure copied from CN1 metadata, never account/patient rows.
-- Oracle DDL commits implicitly. No DROP, ALTER of existing tables or new grants.
DECLARE
  n NUMBER;
BEGIN
  IF SYS_CONTEXT('USERENV','SERVER_HOST') <> 'serverhg_cs2'
     OR SYS_CONTEXT('USERENV','SERVICE_NAME') <> 'hgsoft'
     OR SYS_CONTEXT('USERENV','SESSION_USER') <> 'HGSOFT' THEN
    RAISE_APPLICATION_ERROR(-20001, 'Refusing unexpected Oracle target');
  END IF;
  SELECT COUNT(*) INTO n FROM dba_users
    WHERE username = 'HGSOFT_SOYBA' AND account_status LIKE '%LOCKED%';
  IF n <> 1 THEN
    RAISE_APPLICATION_ERROR(-20002, 'Expected existing locked schema owner');
  END IF;
  SELECT COUNT(*) INTO n FROM dba_objects
    WHERE owner = 'HGSOFT_SOYBA' AND object_name = 'DLOGIN_BENHNHAN';
  IF n = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE HGSOFT_SOYBA.DLOGIN_BENHNHAN (
        ID NUMBER(18,0) NOT NULL,
        HOTEN NVARCHAR2(200),
        SDT VARCHAR2(30 BYTE),
        EMAIL VARCHAR2(200 BYTE),
        USERNAME VARCHAR2(100 BYTE),
        MABN VARCHAR2(20 BYTE),
        NGAYTAO DATE DEFAULT sysdate,
        CONSTRAINT PK_HGSOYBA_DLOGIN_BENHNHAN PRIMARY KEY (ID)
          USING INDEX TABLESPACE HGSOFT
      ) TABLESPACE HGSOFT';
  END IF;
END;
/
