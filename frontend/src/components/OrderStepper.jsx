import { useLang } from "../i18n";
const STAGES = ["pending", "cutting", "stitching", "ready", "delivered"];
const LABELS = { pending: "Pending", cutting: "Cutting", stitching: "Stitching", ready: "Ready", delivered: "Delivered" };

export default function OrderStepper({ status }) {
  const { t } = useLang();
  if (status === "cancelled") {
    return <span className="pill cancelled">{t("Cancelled")}</span>;
  }
  const currentIndex = STAGES.indexOf(status);

  return (
    <div className="stepper">
      {STAGES.map((stage, i) => (
        <span key={stage} style={{ display: "flex", alignItems: "center" }}>
          <span className={`step ${i <= currentIndex ? "done" : ""}`}>
            <span className="step-dot" />
            {t(LABELS[stage])}
          </span>
          {i < STAGES.length - 1 && (
            <span className={`step-line ${i < currentIndex ? "done" : ""}`} />
          )}
        </span>
      ))}
    </div>
  );
}
