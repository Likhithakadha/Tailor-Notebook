import { useRef, useState } from "react";
import { NECK_OPTIONS, SLEEVE_OPTIONS, STYLE_OPTIONS, fileToResizedDataUrl, photoUrl } from "../utils/orders";
import { useLang } from "../i18n";

export function emptyDesign() {
  return { neckDesign: "", sleeveDesign: "", stitchingStyle: "", instructions: "", photo: "", newPhoto: "", removePhoto: false };
}

export function designFromOrder(o) {
  return {
    neckDesign: o.neck_design || "",
    sleeveDesign: o.sleeve_design || "",
    stitchingStyle: o.stitching_style || "",
    instructions: o.instructions || "",
    photo: o.design_photo || "",
    newPhoto: "",
    removePhoto: false,
  };
}

// Fields sent to the API (photo is only sent when it changed)
export function designPayload(d) {
  const out = {
    neckDesign: d.neckDesign,
    sleeveDesign: d.sleeveDesign,
    stitchingStyle: d.stitchingStyle,
    instructions: d.instructions,
  };
  if (d.newPhoto) out.designPhoto = d.newPhoto;
  else if (d.removePhoto) out.removeDesignPhoto = true;
  return out;
}

// Dress photo + neck / sleeve / stitching style + customer instructions
export default function DesignFields({ value, onChange, idPrefix = "design" }) {
  const { t } = useLang();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const set = (patch) => onChange({ ...value, ...patch });
  const preview = value.newPhoto || (!value.removePhoto && value.photo ? photoUrl(value.photo) : "");

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    setBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      set({ newPhoto: dataUrl, removePhoto: false });
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="design-fields">
      <div className="design-photo-box">
        {preview ? (
          <img src={preview} alt={t("Dress design")} className="design-photo-preview" />
        ) : (
          <button type="button" className="design-photo-empty" onClick={() => fileRef.current?.click()}>
            <span className="design-photo-icon">+</span>
            <span>{busy ? t("Preparing photo…") : t("Add dress photo")}</span>
            <small>{t("Reference picture from the customer")}</small>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={pick} hidden />
        {preview && (
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()}>
              {t("Change photo")}
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => set({ newPhoto: "", removePhoto: true })}
            >
              {t("Remove")}
            </button>
          </div>
        )}
        {photoError && <p className="hint" style={{ color: "var(--chalk-red)" }}>{photoError}</p>}
      </div>

      <div className="design-text">
        <div className="field-row">
          <div className="field">
            <label>{t("Neck design")}</label>
            <input
              list={`${idPrefix}-neck`}
              value={value.neckDesign}
              onChange={(e) => set({ neckDesign: e.target.value })}
              placeholder={t("e.g. Boat neck")}
            />
            <datalist id={`${idPrefix}-neck`}>
              {NECK_OPTIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>{t("Sleeve design")}</label>
            <input
              list={`${idPrefix}-sleeve`}
              value={value.sleeveDesign}
              onChange={(e) => set({ sleeveDesign: e.target.value })}
              placeholder={t("e.g. Elbow length")}
            />
            <datalist id={`${idPrefix}-sleeve`}>
              {SLEEVE_OPTIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="field">
          <label>{t("Stitching style")}</label>
          <input
            list={`${idPrefix}-style`}
            value={value.stitchingStyle}
            onChange={(e) => set({ stitchingStyle: e.target.value })}
            placeholder={t("e.g. Lining + piping, hooks at front")}
          />
          <datalist id={`${idPrefix}-style`}>
            {STYLE_OPTIONS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>{t("Customer instructions")}</label>
          <textarea
            rows={3}
            value={value.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
            placeholder={t("Anything the customer asked for - fit, margins, matching, deadline reasons…")}
          />
        </div>
      </div>
    </div>
  );
}
