# -*- coding: utf-8 -*-
"""
ICD_GIAI_TRINH_V1.py
--------------------
Xuất bảng ICD phục vụ giải trình chi phí KCB BHYT.

LOGIC:
- Chỉ lấy bảng khám bệnh: <schema>.bhytkb
- Schema tháng dạng HGSOFT_BVDmmyy, ví dụ HGSOFT_BVD0126.
- Không lọc madoituong trong bhytkb.
- Không lấy dữ liệu từ v_ttrvds/v_ttrvll.
- ICD chính lấy từ maicd.
- ICD_GOC = phần trước dấu "." (ví dụ E11.9 -> E11).
- Không join các bảng dịch vụ nên không bị nhân lượt do 1 lượt có nhiều DVKT/thuốc.
- Xuất Excel:
    01_ICD_THANG      : bảng rộng ICD10/Tên bệnh/BN/Lượt-đợt/T01/25...T06/26...
    02_ICD_TOP_TANG   : Top ICD tăng trong kỳ so sánh
    03_ICD_LOAI_KCB  : cơ cấu khám bệnh/ngoại trú/nội trú
    04_ICD_RAW        : dữ liệu ICD đã gom để kiểm tra

YÊU CẦU:
    pip install oracledb pandas openpyxl

Kết nối Oracle:
- Điền các biến ORACLE_* bên dưới.
- Có thể dùng DSN dạng:
      192.168.1.10:1521/ORCL
  hoặc Easy Connect tương ứng hệ thống của anh.

LƯU Ý:
- Script tự sinh schema theo mẫu HGSOFT_BVMMYY.
- Nếu có tháng chưa tồn tại, script sẽ bỏ qua và báo cảnh báo.
- Tên bệnh: nếu có bảng danh mục ICD, khai báo ICD_TABLE/ICD_CODE_COL/ICD_NAME_COL.
  Nếu chưa khai báo, script vẫn xuất ICD_GOC nhưng cột Tên bệnh để trống.
"""

import os
import re
import sys
from datetime import date, datetime
from pathlib import Path

import pandas as pd
import oracledb
from openpyxl import load_workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter


def configure_console_encoding():
    """Giúp script in tiếng Việt ổn định trên Windows console/codepage cũ."""
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream and hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


configure_console_encoding()


# ============================================================
# 1. CẤU HÌNH
# ============================================================

ORACLE_USER = os.getenv("ORACLE_USER", "hgsoft_bv")
ORACLE_PASSWORD = os.getenv("ORACLE_PASSWORD", "hgsoft_bv")
ORACLE_DSN = os.getenv("ORACLE_DSN", "192.168.2.250:1521/hgsoft")

# Oracle server này có thể dùng password verifier cũ. Khi gặp DPY-3015,
# python-oracledb cần chạy thick mode với Oracle Instant Client/Oracle Client.
# Có thể set trực tiếp:
#   $env:ORACLE_CLIENT_LIB_DIR="C:\app\Admin\product\11.1.0\client_3\bin"
ORACLE_CLIENT_LIB_DIR = os.getenv("ORACLE_CLIENT_LIB_DIR")
ORACLE_CLIENT_INIT_ERROR = None

# Khoảng thời gian. Có thể override bằng biến môi trường:
#   $env:START_DATE="01/01/2026"
#   $env:END_DATE="31/01/2026"
START_DATE = os.getenv("START_DATE", "01/01/2025")
END_DATE = os.getenv("END_DATE", "31/08/2026") or None

# Schema prefix:
#   bhytkb -> HGSOFT_BVDmmyy
# Có thể override:
#   $env:BHYTKB_SCHEMA_PREFIX="HGSOFT_BVD"
BHYTKB_SCHEMA_PREFIX = os.getenv("BHYTKB_SCHEMA_PREFIX", "HGSOFT_BVD")

# Số ICD muốn lấy trong bảng Top tăng
TOP_N = 15

# Nếu muốn xuất câu query Oracle để chạy trực tiếp trong SQL Developer/
# PLSQL Developer thay vì để Python kết nối Oracle:
#   $env:EXPORT_SQL_ONLY="1"
#   python .\ICD_GIAI_TRINH_V1.py
EXPORT_SQL_ONLY = os.getenv("EXPORT_SQL_ONLY", "").strip().lower() in (
    "1",
    "true",
    "yes",
    "y",
)
SQL_OUTPUT_DIR = os.getenv("SQL_OUTPUT_DIR", "output")

# Nếu đã chạy file SQL trực tiếp và export RAW ra CSV, set biến này để Python
# chỉ xử lý CSV thành Excel, không kết nối Oracle:
#   $env:ICD_RAW_CSV="E:\HIS\APP_BENHAN\output\ICD_GIAI_TRINH_RAW.csv"
ICD_RAW_CSV = os.getenv("ICD_RAW_CSV")

# So sánh mặc định: tháng hiện tại và tháng trước.
# Ví dụ chạy trong tháng 07/2026 -> T06/2026 so với T05/2026.
# Nếu muốn cố định T06/2026 so với T05/2026:
COMPARE_CURRENT_MONTH = "06/2026"
COMPARE_PREVIOUS_MONTH = "05/2026"

# ------------------------------------------------------------
# Danh mục ICD.
#
# Nếu anh biết bảng danh mục ICD trong HGSOFT, điền:
#
# ICD_TABLE = "HGSOFT_BV.D_ICD10"
# ICD_CODE_COL = "MA"
# ICD_NAME_COL = "TEN"
#
# Nếu để None, script vẫn chạy và Tên bệnh sẽ để trống.
# ------------------------------------------------------------
ICD_TABLE = None
ICD_CODE_COL = None
ICD_NAME_COL = None


# ============================================================
# 2. HÀM TIỆN ÍCH
# ============================================================

def parse_date_ddmmyyyy(s):
    return datetime.strptime(s, "%d/%m/%Y").date()


def month_first(d):
    return d.replace(day=1)


def add_months(d, n):
    y = d.year + (d.month - 1 + n) // 12
    m = (d.month - 1 + n) % 12 + 1
    return date(y, m, 1)


def month_label(d):
    return d.strftime("%m/%y")


def schema_for_month(d, prefix):
    return f"{prefix}{d.strftime('%m%y')}".upper()


def bhytkb_schema_for_month(d):
    return schema_for_month(d, BHYTKB_SCHEMA_PREFIX)


def safe_ident(value):
    """Kiểm tra identifier Oracle để tránh đưa chuỗi tùy ý vào SQL."""
    if value is None:
        return None
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_$#]*(\.[A-Za-z][A-Za-z0-9_$#]*)?", value):
        raise ValueError(f"Identifier không hợp lệ: {value}")
    return value.upper()


def get_months(start_date, end_date):
    cur = month_first(start_date)
    last = month_first(end_date)
    out = []
    while cur <= last:
        out.append(cur)
        cur = add_months(cur, 1)
    return out


def table_exists(conn, owner, table_name):
    sql = """
        SELECT COUNT(*)
        FROM ALL_TABLES
        WHERE OWNER = :owner
          AND TABLE_NAME = :table_name
    """
    with conn.cursor() as cur:
        cur.execute(sql, owner=owner.upper(), table_name=table_name.upper())
        return cur.fetchone()[0] > 0


def view_exists(conn, owner, object_name):
    sql = """
        SELECT COUNT(*)
        FROM ALL_OBJECTS
        WHERE OWNER = :owner
          AND OBJECT_NAME = :object_name
          AND OBJECT_TYPE IN ('TABLE','VIEW','MATERIALIZED VIEW')
    """
    with conn.cursor() as cur:
        cur.execute(sql, owner=owner.upper(), object_name=object_name.upper())
        return cur.fetchone()[0] > 0


def object_exists(conn, owner, object_name):
    return view_exists(conn, owner, object_name)


def fetch_df(conn, sql, params=None):
    return pd.read_sql(sql, conn, params=params or {})


def sql_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def render_sql_with_literals(sql, params):
    rendered = sql
    for name in sorted(params, key=len, reverse=True):
        rendered = re.sub(
            rf":{re.escape(name)}\b",
            sql_literal(params[name]),
            rendered,
        )
    return rendered


def build_month_sql_for_sql_tool(month_value):
    bhytkb_schema = bhytkb_schema_for_month(month_value)
    next_month = add_months(month_value, 1)
    sql, params = build_month_sql(
        bhytkb_schema,
        month_value,
        next_month,
    )
    return (
        bhytkb_schema,
        render_sql_with_literals(sql, params).strip(),
    )


def build_schema_check_sql(months):
    rows = []
    for month_value in months:
        bhytkb_schema = bhytkb_schema_for_month(month_value)
        label = month_label(month_value)
        rows.append(
            f"SELECT '{label}' AS THANG, "
            f"'{bhytkb_schema}' AS OWNER_BHYTKB FROM DUAL"
        )

    month_rows_sql = "\nUNION ALL\n".join(rows)

    return f"""-- Kiểm tra schema/bảng trước khi chạy query ICD.
-- Nếu dòng nào có HAS_BHYTKB = 0
-- thì query lớn sẽ lỗi ORA-00942 ở tháng đó.

WITH months AS (
{month_rows_sql}
),
objects AS (
    SELECT owner, object_name
    FROM all_objects
    WHERE object_type IN ('TABLE', 'VIEW', 'MATERIALIZED VIEW')
      AND object_name IN ('BHYTKB')
)
SELECT
    m.thang,
    m.owner_bhytkb,
    MAX(CASE WHEN o.owner = m.owner_bhytkb AND o.object_name = 'BHYTKB' THEN 1 ELSE 0 END) AS has_bhytkb
FROM months m
LEFT JOIN objects o
       ON o.owner = m.owner_bhytkb
GROUP BY m.thang, m.owner_bhytkb
ORDER BY m.thang;
"""


def write_direct_query_files(months):
    output_dir = Path(SQL_OUTPUT_DIR)
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    combined_output = output_dir / f"ICD_GIAI_TRINH_QUERY_{timestamp}.sql"
    aggregate_output = output_dir / f"ICD_GIAI_TRINH_GOP_MAICD_{timestamp}.sql"
    check_output = output_dir / f"ICD_GIAI_TRINH_CHECK_SCHEMA_{timestamp}.sql"
    raw_csv_hint = output_dir / f"ICD_GIAI_TRINH_RAW_{timestamp}.csv"

    query_blocks = []
    for month_value in months:
        bhytkb_schema, month_sql = build_month_sql_for_sql_tool(
            month_value
        )
        query_blocks.append(
            f"-- {month_label(month_value)} - "
            f"bhytkb={bhytkb_schema}\n"
            f"SELECT * FROM (\n{month_sql}\n)"
        )

    combined_sql = "\nUNION ALL\n".join(query_blocks)

    text = f"""-- ICD_GIAI_TRINH_V1 - Query trực tiếp Oracle
-- Sinh lúc: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
-- Khoảng dữ liệu: {month_label(months[0])} -> {month_label(months[-1])}
--
-- Cách dùng:
-- 1. Mở file này trong SQL Developer/PLSQL Developer bằng user có quyền đọc schema tháng.
-- 2. Nếu schema tháng nào không tồn tại, xóa block tháng đó khỏi query.
-- 3. Chạy query và export kết quả ra CSV, ví dụ:
--    {raw_csv_hint.name}
--
-- Lưu ý: file này chỉ xuất RAW ICD. Các sheet tổng hợp Excel vẫn do Python xử lý
-- sau khi đã có dữ liệu, hoặc có thể pivot trực tiếp trong Excel.

SELECT q.*
FROM (
{combined_sql}
) q
ORDER BY q.THANG, q.LOAI_KCB, q.ICD_GOC, q.MABN
;
"""

    aggregate_text = f"""-- ICD_GIAI_TRINH_V1 - Gộp số lượng theo ICD_GOC
-- Sinh lúc: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
-- Khoảng dữ liệu: {month_label(months[0])} -> {month_label(months[-1])}
--
-- Kết quả:
--   ICD_GOC  : phần trước dấu chấm của ICD10
--   CHANDOAN : một chẩn đoán đại diện theo ICD_GOC
--   SOLUONG  : số dòng bhytkb gộp từ các schema tháng

SELECT
    q.ICD_GOC,
    MAX(q.CHANDOAN) AS CHANDOAN,
    COUNT(*) AS SOLUONG
FROM (
{combined_sql}
) q
GROUP BY q.ICD_GOC
ORDER BY SOLUONG DESC, q.ICD_GOC
;
"""

    combined_output.write_text(text, encoding="utf-8")
    aggregate_output.write_text(aggregate_text, encoding="utf-8")
    check_output.write_text(build_schema_check_sql(months), encoding="utf-8")
    return combined_output, aggregate_output, check_output


def find_oracle_client_lib_dir():
    if ORACLE_CLIENT_LIB_DIR:
        return ORACLE_CLIENT_LIB_DIR

    for raw_dir in os.getenv("PATH", "").split(os.pathsep):
        if not raw_dir:
            continue

        lib_dir = Path(raw_dir.strip('"'))
        if (lib_dir / "oci.dll").exists():
            return str(lib_dir)

    return None


def init_oracle_client_if_available():
    global ORACLE_CLIENT_INIT_ERROR

    if not sys.platform.startswith("win"):
        return

    lib_dir = find_oracle_client_lib_dir()
    if not lib_dir:
        print(
            "Không thấy Oracle Client/Instant Client trong PATH; "
            "sẽ thử kết nối thin mode."
        )
        return

    try:
        oracledb.init_oracle_client(lib_dir=lib_dir)
        print(f"Đã bật Oracle thick mode: {lib_dir}")
    except Exception as exc:
        ORACLE_CLIENT_INIT_ERROR = exc
        print(f"Không bật được Oracle thick mode từ {lib_dir}: {exc}")
        print("Sẽ thử kết nối thin mode.")


def connect_oracle():
    init_oracle_client_if_available()

    try:
        return oracledb.connect(
            user=ORACLE_USER,
            password=ORACLE_PASSWORD,
            dsn=ORACLE_DSN,
        )
    except oracledb.NotSupportedError as exc:
        message = str(exc)
        if "DPY-3015" in message:
            detail = ""
            if ORACLE_CLIENT_INIT_ERROR:
                detail = f" Lỗi thick mode trước đó: {ORACLE_CLIENT_INIT_ERROR}"
            raise RuntimeError(
                "Oracle từ chối thin mode vì password verifier cũ (DPY-3015). "
                "Cài Oracle Instant Client 19/21/23 hoặc trỏ "
                "ORACLE_CLIENT_LIB_DIR tới thư mục chứa oci.dll 64-bit, rồi chạy lại."
                + detail
            ) from exc
        raise


# ============================================================
# 3. KIỂM TRA CẤU TRÚC
# ============================================================

def validate_required_objects(conn, bhytkb_schema):
    bhytkb_schema = bhytkb_schema.upper()

    if not object_exists(conn, bhytkb_schema, "BHYTKB"):
        return False, f"Thiếu {bhytkb_schema}.BHYTKB"

    return True, ""


# ============================================================
# 4. TRUY VẤN MỘT THÁNG
# ============================================================

def build_month_sql(bhytkb_schema, start_month, next_month):
    """
    Trả về 1 SELECT:
      THANG
      LOAI_KCB
      ID_KCB
      MABN
      ICD10
      ICD_GOC
      CHANDOAN
      NGAY_KCB

    Không join dịch vụ/thuốc.
    """

    bhytkb_schema = safe_ident(bhytkb_schema)

    start_str = start_month.strftime("%Y-%m-%d")
    next_str = next_month.strftime("%Y-%m-%d")

    # Khám bệnh
    sql_kham = f"""
        SELECT
            :thang AS THANG,
            'KHAM_BENH' AS LOAI_KCB,
            kb.id AS ID_KCB,
            TRIM(kb.mabn) AS MABN,
            UPPER(TRIM(kb.maicd)) AS ICD10,
            CASE
                WHEN INSTR(TRIM(kb.maicd), '.') > 0
                THEN SUBSTR(
                    UPPER(TRIM(kb.maicd)),
                    1,
                    INSTR(TRIM(kb.maicd), '.') - 1
                )
                ELSE UPPER(TRIM(kb.maicd))
            END AS ICD_GOC,
            TRIM(kb.chandoan) AS CHANDOAN,
            kb.ngay AS NGAY_KCB
        FROM {bhytkb_schema}.bhytkb kb
        WHERE kb.maicd IS NOT NULL
          AND kb.ngay >= TO_DATE(:start_date, 'YYYY-MM-DD')
          AND kb.ngay <  TO_DATE(:next_date,  'YYYY-MM-DD')
    """

    return f"""
        {sql_kham}
    """, {
        "thang": month_label(start_month),
        "start_date": start_str,
        "next_date": next_str,
    }


# ============================================================
# 5. LẤY DỮ LIỆU ICD
# ============================================================

def load_icd_data(conn, months):
    frames = []
    missing = []

    for m in months:
        bhytkb_schema = bhytkb_schema_for_month(m)
        ok, reason = validate_required_objects(conn, bhytkb_schema)

        if not ok:
            missing.append((month_label(m), bhytkb_schema, reason))
            continue

        next_m = add_months(m, 1)
        sql, params = build_month_sql(bhytkb_schema, m, next_m)

        print(f"  Đang lấy {month_label(m)} - bhytkb={bhytkb_schema} ...")

        try:
            df = fetch_df(conn, sql, params)
            if not df.empty:
                frames.append(df)
                print(f"      {len(df):,} dòng")
            else:
                print("      0 dòng")
        except Exception as exc:
            print(f"      LỖI: {exc}")
            missing.append((month_label(m), bhytkb_schema, f"SQL error: {exc}"))

    if missing:
        print("\nCẢNH BÁO các tháng không lấy được:")
        for x in missing:
            print("  -", x)

    if not frames:
        raise RuntimeError("Không lấy được dữ liệu từ bất kỳ schema tháng nào.")

    df = pd.concat(frames, ignore_index=True)

    # Chuẩn hóa
    df["THANG"] = df["THANG"].astype(str)
    df["LOAI_KCB"] = df["LOAI_KCB"].astype(str)
    df["MABN"] = df["MABN"].astype(str).str.strip()
    df["ICD10"] = df["ICD10"].astype(str).str.strip().str.upper()
    df["ICD_GOC"] = df["ICD_GOC"].astype(str).str.strip().str.upper()
    if "CHANDOAN" not in df.columns:
        df["CHANDOAN"] = ""
    df["CHANDOAN"] = df["CHANDOAN"].fillna("").astype(str).str.strip()

    # Loại các ICD rỗng/NULL giả
    df = df[
        df["ICD_GOC"].notna()
        & (df["ICD_GOC"] != "")
        & (df["ICD_GOC"].str.lower() != "nan")
    ].copy()

    return df


def normalize_icd_raw_df(df):
    df.columns = [str(c).strip().upper() for c in df.columns]

    required = ["THANG", "LOAI_KCB", "ID_KCB", "MABN", "ICD10", "ICD_GOC"]
    missing_cols = [c for c in required if c not in df.columns]
    if missing_cols:
        raise ValueError(
            "File RAW thiếu cột bắt buộc: " + ", ".join(missing_cols)
        )

    df["THANG"] = df["THANG"].astype(str).str.strip()
    df["LOAI_KCB"] = df["LOAI_KCB"].astype(str).str.strip()
    df["ID_KCB"] = df["ID_KCB"].astype(str).str.strip()
    df["MABN"] = df["MABN"].astype(str).str.strip()
    df["ICD10"] = df["ICD10"].astype(str).str.strip().str.upper()
    df["ICD_GOC"] = df["ICD_GOC"].astype(str).str.strip().str.upper()
    if "CHANDOAN" not in df.columns:
        df["CHANDOAN"] = ""
    df["CHANDOAN"] = df["CHANDOAN"].fillna("").astype(str).str.strip()

    df = df[
        df["ICD_GOC"].notna()
        & (df["ICD_GOC"] != "")
        & (df["ICD_GOC"].str.lower() != "nan")
    ].copy()

    return df


def load_icd_data_from_csv(csv_path):
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Không thấy file RAW CSV: {path}")

    try:
        df = pd.read_csv(path, dtype=str, encoding="utf-8-sig")
    except UnicodeDecodeError:
        df = pd.read_csv(path, dtype=str, encoding="cp1258")

    return normalize_icd_raw_df(df)


# ============================================================
# 6. DANH MỤC TÊN BỆNH
# ============================================================

def load_icd_dictionary(conn):
    if not ICD_TABLE:
        return pd.DataFrame(columns=["ICD_GOC", "TEN_BENH"])

    table = safe_ident(ICD_TABLE)
    code_col = safe_ident(ICD_CODE_COL)
    name_col = safe_ident(ICD_NAME_COL)

    sql = f"""
        SELECT
            UPPER(TRIM({code_col})) AS ICD_GOC,
            TRIM({name_col}) AS TEN_BENH
        FROM {table}
        WHERE {code_col} IS NOT NULL
    """

    try:
        dm = fetch_df(conn, sql)
        dm["ICD_GOC"] = dm["ICD_GOC"].astype(str).str.strip().str.upper()
        dm["TEN_BENH"] = dm["TEN_BENH"].astype(str).str.strip()
        dm = dm.drop_duplicates("ICD_GOC")
        return dm
    except Exception as exc:
        print(f"\nKhông đọc được danh mục ICD: {exc}")
        print("Excel vẫn được xuất nhưng cột Tên bệnh sẽ để trống.")
        return pd.DataFrame(columns=["ICD_GOC", "TEN_BENH"])


# ============================================================
# 7. TẠO BẢNG RỘNG:
# ICD10 | Tên bệnh | Chẩn đoán | BN | Lượt/đợt | T01/25 | T02/25...
# ============================================================

def first_nonempty(values):
    for value in values:
        text = "" if pd.isna(value) else str(value).strip()
        if text:
            return text
    return ""


def create_main_wide(df, icd_dm):
    # BN và lượt/đợt tính trên toàn kỳ
    base = (
        df.groupby(["ICD_GOC"], as_index=False)
          .agg(
              BN=("MABN", "nunique"),
              CHANDOAN=("CHANDOAN", first_nonempty),
              **{"Lượt/đợt": ("ID_KCB", "nunique")}
          )
    )

    # Số lượt/đợt theo từng tháng
    monthly = (
        df.groupby(["ICD_GOC", "THANG"])["ID_KCB"]
          .nunique()
          .unstack(fill_value=0)
          .reset_index()
    )

    result = base.merge(monthly, on="ICD_GOC", how="left")

    if not icd_dm.empty:
        result = result.merge(icd_dm, on="ICD_GOC", how="left")
    else:
        result["TEN_BENH"] = ""

    result.rename(
        columns={
            "ICD_GOC": "ICD10",
            "TEN_BENH": "Tên bệnh",
            "CHANDOAN": "Chẩn đoán",
        },
        inplace=True,
    )

    # Sắp xếp đúng thứ tự tháng
    month_cols = [month_label(m) for m in MONTHS]

    for c in month_cols:
        if c not in result.columns:
            result[c] = 0

    result = result[
        ["ICD10", "Tên bệnh", "Chẩn đoán", "BN", "Lượt/đợt"] + month_cols
    ].copy()

    # Sort theo tổng lượt/đợt giảm dần
    result.sort_values(
        by="Lượt/đợt",
        ascending=False,
        inplace=True,
    )

    result.reset_index(drop=True, inplace=True)

    return result


# ============================================================
# 8. TOP ICD TĂNG
# ============================================================

def create_top_increase(df):
    cur_label = COMPARE_CURRENT_MONTH
    prev_label = COMPARE_PREVIOUS_MONTH

    a = (
        df[df["THANG"].isin([prev_label, cur_label])]
        .groupby(["ICD_GOC", "THANG"])["ID_KCB"]
        .nunique()
        .unstack(fill_value=0)
        .reset_index()
    )

    if prev_label not in a.columns:
        a[prev_label] = 0
    if cur_label not in a.columns:
        a[cur_label] = 0

    a["CHENH_LUOT"] = a[cur_label] - a[prev_label]

    # BN theo tháng
    bn = (
        df[df["THANG"].isin([prev_label, cur_label])]
        .groupby(["ICD_GOC", "THANG"])["MABN"]
        .nunique()
        .unstack(fill_value=0)
        .reset_index()
    )

    if prev_label not in bn.columns:
        bn[prev_label] = 0
    if cur_label not in bn.columns:
        bn[cur_label] = 0

    bn = bn.rename(
        columns={
            prev_label: "BN_" + prev_label,
            cur_label: "BN_" + cur_label,
        }
    )

    a = a.merge(bn, on="ICD_GOC", how="left")

    a["TY_LE_TANG"] = a.apply(
        lambda r: round(
            (r[cur_label] - r[prev_label])
            / r[prev_label] * 100, 2
        ) if r[prev_label] else None,
        axis=1,
    )

    a = a[a["CHENH_LUOT"] > 0].copy()

    a.sort_values("CHENH_LUOT", ascending=False, inplace=True)
    a = a.head(TOP_N).copy()
    a.insert(0, "STT", range(1, len(a) + 1))

    return a


# ============================================================
# 9. CƠ CẤU LOẠI KCB
# ============================================================

def create_kcb_structure(df):
    x = (
        df.groupby(["ICD_GOC", "LOAI_KCB"])
          .agg(
              BN=("MABN", "nunique"),
              **{"Lượt/đợt": ("ID_KCB", "nunique")}
          )
          .reset_index()
    )

    p = x.pivot(
        index="ICD_GOC",
        columns="LOAI_KCB",
        values=["BN", "Lượt/đợt"]
    )

    p.columns = [
        f"{a}_{b}"
        for a, b in p.columns
    ]

    p = p.reset_index()

    expected = [
        "BN_KHAM_BENH",
        "Lượt/đợt_KHAM_BENH",
        "BN_NGOAI_TRU",
        "Lượt/đợt_NGOAI_TRU",
        "BN_NOI_TRU",
        "Lượt/đợt_NOI_TRU",
    ]

    for c in expected:
        if c not in p.columns:
            p[c] = 0

    p = p[
        ["ICD_GOC"] + expected
    ]

    p.rename(
        columns={"ICD_GOC": "ICD10"},
        inplace=True
    )

    return p


# ============================================================
# 10. RAW ĐỂ KIỂM TRA
# ============================================================

def create_raw_summary(df):
    x = (
        df.groupby(
            ["THANG", "LOAI_KCB", "ICD_GOC", "CHANDOAN"],
            as_index=False
        )
        .agg(
            BN=("MABN", "nunique"),
            **{"Lượt/đợt": ("ID_KCB", "nunique")}
        )
    )

    return x.sort_values(
        ["THANG", "Lượt/đợt"],
        ascending=[True, False]
    )


# ============================================================
# 11. FORMAT EXCEL
# ============================================================

def format_sheet(ws, freeze="A2"):
    ws.freeze_panes = freeze
    ws.auto_filter.ref = ws.dimensions

    # Header
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
            wrap_text=True
        )

    ws.row_dimensions[1].height = 32

    # Borders + alignment
    thin = Side(style="thin")
    border = Border(
        left=thin,
        right=thin,
        top=thin,
        bottom=thin
    )

    for row in ws.iter_rows():
        for cell in row:
            cell.border = border
            cell.alignment = Alignment(
                vertical="center",
                wrap_text=True
            )

    # Width
    for col_idx, column_cells in enumerate(ws.columns, start=1):
        max_len = 0
        for cell in column_cells:
            value = "" if cell.value is None else str(cell.value)
            max_len = max(max_len, len(value))

        width = min(max(max_len + 2, 10), 40)
        ws.column_dimensions[get_column_letter(col_idx)].width = width


def format_number_columns(ws):
    headers = {
        cell.value: cell.column
        for cell in ws[1]
    }

    for name, col_idx in headers.items():
        if name in (
            "BN",
            "Lượt/đợt",
            "Lượt/đợt_KHAM_BENH",
            "Lượt/đợt_NGOAI_TRU",
            "Lượt/đợt_NOI_TRU",
        ) or (
            isinstance(name, str)
            and re.fullmatch(r"\d{2}/\d{2}", name)
        ):
            for row in range(2, ws.max_row + 1):
                ws.cell(row, col_idx).number_format = '#,##0'


def write_excel(main_df, top_df, kcb_df, raw_df, output):
    with pd.ExcelWriter(
        output,
        engine="openpyxl"
    ) as writer:

        main_df.to_excel(
            writer,
            sheet_name="01_ICD_THANG",
            index=False
        )

        top_df.to_excel(
            writer,
            sheet_name="02_ICD_TOP_TANG",
            index=False
        )

        kcb_df.to_excel(
            writer,
            sheet_name="03_ICD_LOAI_KCB",
            index=False
        )

        raw_df.to_excel(
            writer,
            sheet_name="04_ICD_RAW",
            index=False
        )

    wb = load_workbook(output)

    for ws in wb.worksheets:
        format_sheet(ws)
        format_number_columns(ws)

    # Tên sheet chính: tô nổi bật các cột quan trọng
    ws = wb["01_ICD_THANG"]
    ws.freeze_panes = "F2"

    # Cố định 5 cột đầu
    fixed_widths = {
        1: 16,
        2: 24,
        3: 40,
        4: 12,
        5: 12,
    }
    for col, width in fixed_widths.items():
        ws.column_dimensions[get_column_letter(col)].width = width

    wb.save(output)


def create_report_excel(df, icd_dm=None):
    if icd_dm is None:
        icd_dm = pd.DataFrame(columns=["ICD_GOC", "TEN_BENH"])

    main_df = create_main_wide(df, icd_dm)
    top_df = create_top_increase(df)
    kcb_df = create_kcb_structure(df)
    raw_df = create_raw_summary(df)

    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)

    output = (
        output_dir
        / f"ICD_GIAI_TRINH_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    )

    write_excel(
        main_df,
        top_df,
        kcb_df,
        raw_df,
        output
    )

    return output, main_df, top_df


# ============================================================
# 12. MAIN
# ============================================================

def main():
    global MONTHS

    print("=" * 70)
    print("ICD_GIAI_TRINH_V1 - XUẤT EXCEL PHÂN TÍCH ICD")
    print("=" * 70)

    start = parse_date_ddmmyyyy(START_DATE)

    if END_DATE:
        end = parse_date_ddmmyyyy(END_DATE)
    else:
        end = date.today()

    MONTHS = get_months(start, end)

    print(
        f"\nKhoảng dữ liệu: "
        f"{month_label(MONTHS[0])} -> {month_label(MONTHS[-1])}"
    )

    print(f"Số tháng cần đọc: {len(MONTHS)}")

    if EXPORT_SQL_ONLY:
        output, aggregate_output, check_output = write_direct_query_files(MONTHS)
        print("\nĐã sinh query Oracle trực tiếp.")
        print(f"File check schema: {check_output.resolve()}")
        print(f"File gộp MAICD: {aggregate_output.resolve()}")
        print(f"File SQL: {output.resolve()}")
        print(
            "Chạy file gộp MAICD để lấy bảng ICD_GOC/CHANDOAN/SOLUONG. "
            "Nếu tháng nào thiếu bảng, chạy file check schema trước."
        )
        return

    if ICD_RAW_CSV:
        print(f"\nĐang đọc RAW CSV: {ICD_RAW_CSV}")
        df = load_icd_data_from_csv(ICD_RAW_CSV)

        print(
            f"\nTổng dòng dữ liệu ICD đọc từ CSV: "
            f"{len(df):,}"
        )

        output, main_df, top_df = create_report_excel(df)

        print("\n" + "=" * 70)
        print("HOÀN TẤT")
        print("=" * 70)
        print(f"File Excel: {output.resolve()}")
        print(f"Số ICD: {len(main_df):,}")
        print(f"Top ICD tăng: {len(top_df):,}")
        print("=" * 70)
        return

    # Kết nối
    print("\nĐang kết nối Oracle...")

    conn = connect_oracle()

    try:
        print("Kết nối thành công.")

        # 1. Dữ liệu
        df = load_icd_data(conn, MONTHS)

        print(
            f"\nTổng dòng dữ liệu ICD lấy được: "
            f"{len(df):,}"
        )

        # 2. Danh mục ICD
        icd_dm = load_icd_dictionary(conn)

        output, main_df, top_df = create_report_excel(df, icd_dm)

        print("\n" + "=" * 70)
        print("HOÀN TẤT")
        print("=" * 70)
        print(f"File Excel: {output.resolve()}")
        print(f"Số ICD: {len(main_df):,}")
        print(
            f"Top ICD tăng: {len(top_df):,}"
        )
        print("=" * 70)

    finally:
        conn.close()


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, FileNotFoundError) as exc:
        print("\nLỖI: " + str(exc))
        sys.exit(1)
