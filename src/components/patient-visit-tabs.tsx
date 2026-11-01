"use client";

import { useId, useState, type ReactNode, type KeyboardEvent } from "react";
import { ChevronRight, FileText, Pill, ScanSearch } from "lucide-react";

const tabs = [
  { key: "overview", label: "Tổng quan" },
  { key: "labs", label: "Xét nghiệm" },
  { key: "imaging", label: "CĐHA" },
  { key: "medications", label: "Thuốc" },
] as const;
type TabKey = (typeof tabs)[number]["key"];

export function PatientVisitTabs({
  sections,
  hasLabs,
  imagingCount,
  medicineCount,
}: {
  sections: Record<TabKey, ReactNode>;
  hasLabs: boolean;
  imagingCount: number;
  medicineCount: number;
}) {
  const id = useId();
  const [active, setActive] = useState<TabKey>(hasLabs ? "labs" : "overview");
  const [showAll, setShowAll] = useState(false);
  function select(key: TabKey) {
    setActive(key);
    setShowAll(false);
  }
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offset =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!offset && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + offset + tabs.length) % tabs.length;
    select(tabs[next].key);
    document.getElementById(`${id}-tab-${tabs[next].key}`)?.focus();
  }
  return (
    <>
      <div className="visit-tabs" role="tablist" aria-label="Nội dung lần khám">
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.key}`}
            aria-selected={active === tab.key}
            aria-controls={`${id}-panel-${tab.key}`}
            tabIndex={active === tab.key ? 0 : -1}
            onClick={() => select(tab.key)}
            onKeyDown={(event) => move(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={`${id}-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${tab.key}`}
          tabIndex={0}
          hidden={!showAll && active !== tab.key}
          className="visit-tab-content"
        >
          {sections[tab.key]}
        </div>
      ))}
      {!showAll && active === "labs" && (
        <div className="visit-related">
          <button type="button" onClick={() => select("imaging")}>
            <ScanSearch aria-hidden="true" />
            <span>
              <strong>Chẩn đoán hình ảnh</strong>
              <small>
                {imagingCount
                  ? `${imagingCount} kết quả trong lần khám này`
                  : "Chưa có kết quả trong lần khám này"}
              </small>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
          <button type="button" onClick={() => select("medications")}>
            <Pill aria-hidden="true" />
            <span>
              <strong>Đơn thuốc</strong>
              <small>
                {medicineCount
                  ? `${medicineCount} thuốc trong lần khám này`
                  : "Chưa có đơn thuốc trong lần khám này"}
              </small>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
      <button
        type="button"
        className="visit-show-all"
        aria-expanded={showAll}
        onClick={() => setShowAll((value) => !value)}
      >
        <FileText className="h-5 w-5" aria-hidden="true" />
        {showAll ? "Thu gọn lần khám" : "Xem toàn bộ lần khám"}
      </button>
    </>
  );
}
