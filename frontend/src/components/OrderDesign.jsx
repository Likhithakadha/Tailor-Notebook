import { hasDesign, photoUrl } from "../utils/orders";
import { useLang } from "../i18n";

// Read-only view of an order's saved design: photo thumbnail, neck / sleeve / style tags and instructions
export default function OrderDesign({ order }) {
  const { t } = useLang();
  if (!hasDesign(order)) return null;
  return (
    <div className="order-design">
      {order.design_photo ? (
        <a href={photoUrl(order.design_photo)} target="_blank" rel="noreferrer" title={t("Open full photo")}>
          <img className="order-design-photo" src={photoUrl(order.design_photo)} alt={t("Dress design")} loading="lazy" />
        </a>
      ) : null}
      <div className="order-design-body">
        <div className="tag-row" style={{ marginTop: 0 }}>
          {order.neck_design && <span className="tag design-tag">Neck: {order.neck_design}</span>}
          {order.sleeve_design && <span className="tag design-tag">Sleeve: {order.sleeve_design}</span>}
          {order.stitching_style && <span className="tag design-tag">Style: {order.stitching_style}</span>}
        </div>
        {order.instructions && <p className="order-instructions">“{order.instructions}”</p>}
      </div>
    </div>
  );
}
