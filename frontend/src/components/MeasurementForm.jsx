import { useState } from "react";
import { emptyValues, fieldLabel, slugField, templateFields, typeOptions } from "../utils/measurementTemplates";
import { useLang } from "../i18n";

// Controlled form body for one measurement: dress type, profile name, fields (inches), notes.
// `draft` = { garmentType, profileName, values, notes }. The parent owns the <form> and the save button.
export default function MeasurementForm({
  draft,
  onChange,
  lockGarment = false,
  lockProfile = false,
  profileSuggestions = [],
}) {
  const { t } = useLang();
  const [customName, setCustomName] = useState("");
  const listId = "profile-suggestions-" + (draft.garmentType || "x");
  const baseFields = templateFields(draft.garmentType);
  const keys = Object.keys(draft.values);

  function setGarment(type) {
    onChange({ ...draft, garmentType: type, values: emptyValues(type, draft.values) });
  }

  function setValue(key, value) {
    onChange({ ...draft, values: { ...draft.values, [key]: value } });
  }

  function addCustom() {
    const key = slugField(customName);
    if (!key || key in draft.values) {
      setCustomName("");
      return;
    }
    onChange({ ...draft, values: { ...draft.values, [key]: "" } });
    setCustomName("");
  }

  function removeCustom(key) {
    const next = { ...draft.values };
    delete next[key];
    onChange({ ...draft, values: next });
  }

  return (
    <>
      <div className="field-row">
        <div className="field">
          <label>{t("Dress type")}</label>
          <select
            value={draft.garmentType}
            disabled={lockGarment}
            onChange={(e) => setGarment(e.target.value)}
          >
            {typeOptions(draft.garmentType).map((tp) => (
              <option key={tp.key} value={tp.key}>
                {t(tp.label)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("Profile name")}</label>
          <input
            value={draft.profileName}
            disabled={lockProfile}
            maxLength={60}
            list={listId}
            onChange={(e) => onChange({ ...draft, profileName: e.target.value })}
            placeholder={t("e.g. Wedding fit, Casual fit (blank = Default)")}
          />
          <datalist id={listId}>
            {profileSuggestions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      </div>

      {keys.length === 0 && (
        <p className="hint">{t("This dress type has no preset fields. Add your own measurements below.")}</p>
      )}

      <div className="fields-grid">
        {keys.map((key) => {
          const isCustom = !baseFields.includes(key);
          return (
            <div className="field" key={key}>
              <label>
                {fieldLabel(key)} ({t("in")})
                {isCustom && (
                  <button
                    type="button"
                    className="link-btn"
                    title={t("Remove this custom field")}
                    onClick={() => removeCustom(key)}
                  >
                    {t("remove")}
                  </button>
                )}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                value={draft.values[key]}
                onChange={(e) => setValue(key, e.target.value)}
              />
            </div>
          );
        })}
      </div>

      <div className="custom-add">
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={t("Add another measurement, e.g. Back neck depth")}
          maxLength={40}
        />
        <button type="button" className="btn secondary" onClick={addCustom} disabled={!customName.trim()}>
          {t("+ Add field")}
        </button>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>{t("Notes (optional)")}</label>
        <input
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          placeholder={t("e.g. Loose fit at the waist, customer is left-handed")}
          maxLength={200}
        />
      </div>
    </>
  );
}
