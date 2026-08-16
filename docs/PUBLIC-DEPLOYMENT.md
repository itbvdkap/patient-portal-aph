# Public Deployment

## Kien truc

```text
Benh nhan / Internet
  -> DNS + HTTPS (Caddy, chi mo 80/443)
  -> Next.js portal
  -> PatientApi noi bo
  -> PostgreSQL Reporting DB

PatientApi Sync Worker
  -> ket noi read-only toi Oracle HIS qua LAN/VPN
```

Oracle HIS, PatientApi va PostgreSQL khong public port ra Internet. Tai khoan Oracle cua worker chi duoc `SELECT` cac view/table can thiet.

## Chuan bi

- Mot server Linux/Windows co Docker, nam trong DMZ hoac mang co route gioi han toi Oracle HIS.
- DNS, vi du `hosobenhan.benhvienanphu.vn`, tro ve public IP server.
- NAT/firewall chi mo TCP 80, TCP/UDP 443.
- Khong mo 5080, 5432 hoac 1521 ra Internet.
- Copy `.env.production.example` thanh `.env.production` va thay toan bo secret.

## Chay

```powershell
docker compose --env-file .env.production -f docker-compose.public.yml up -d --build
```

Caddy tu xin va gia han chung chi TLS khi DNS/public firewall dung.

## Bao mat truoc khi public

- Doi Oracle sang user `portal_readonly`, khong dung schema owner.
- Them rate limit cho login tai reverse proxy/WAF va khoa tam theo IP + fingerprint.
- Khong ghi SDT, CCCD, token, payload benh an vao application log.
- Backup Reporting DB, ma hoa disk/volume, audit moi lan xem ho so.
- Test xam nhap, quet dependency, kiem tra quy trinh thu hoi session.
- Can nhac OTP hoac xac thuc bo sung: SDT + CCCD don thuan co nguy co lo danh tinh.

## Mo rong tai

Mot instance hien tai gioi han 3 worker Oracle. Khi nhieu benh nhan truy cap, request duoc deduplicate theo `MABN + resource + resource_id`; app doc cache va worker xu ly hang doi. Khi chay nhieu PatientApi instance, can chuyen bo dieu phoi tu channel trong bo nho sang queue PostgreSQL bang `FOR UPDATE SKIP LOCKED` hoac RabbitMQ.
