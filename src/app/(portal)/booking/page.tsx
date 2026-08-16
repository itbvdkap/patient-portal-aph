import { ExternalLink } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui";

const bookingUrl = "https://benhvienanphu.vn/dang-ky-kham";

export default function BookingPage() {
  return (
    <>
      <PageHeader
        title="Đăng ký khám"
        description="Mở biểu mẫu đăng ký khám của Bệnh viện Đa khoa An Phú ngay trong app."
        actions={
          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary-700 px-3 text-sm font-bold text-white hover:bg-primary-900"
          >
            Mở ngoài
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        }
      />

      <Panel className="overflow-hidden p-0 sm:p-0">
        <iframe
          title="Đăng ký khám Bệnh viện An Phú"
          src={bookingUrl}
          className="h-[calc(100vh-190px)] min-h-[620px] w-full bg-white"
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </Panel>
    </>
  );
}
