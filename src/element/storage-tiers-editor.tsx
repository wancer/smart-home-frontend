import { Button, Form, InputGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import { StorageTier } from "../api/types/device";
import { formatDuration } from "../format";

// Mirrors model.StorageSteps in the backend: seconds, 0 = raw readings.
export const STORAGE_STEPS = [0, 60, 300, 600, 900, 1800, 3600, 86400];
export const DEFAULT_STORAGE_TIERS: StorageTier[] = [{ step: 300, keep: 0 }];
const MAX_TIERS = 5;
const HOUR = 3600;
const DAY = 86400;

type KeepUnit = "h" | "d" | "forever";

function keepUnit(keep: number): KeepUnit {
  if (keep === 0) return "forever";
  return keep % DAY === 0 ? "d" : "h";
}

/** "5 min", "1 h", "1 d", or "raw" for step 0. */
export function formatStep(t: TFunction, step: number): string {
  return step === 0 ? t("storageTiers.raw") : formatDuration(t, step);
}

/** One line per device for the admin table, e.g. "raw 1 d → 5 min 30 d → 1 h ∞". */
export function formatTiers(t: TFunction, tiers: StorageTier[]): string {
  return tiers.map(tier => `${formatStep(t, tier.step)} ${tier.keep === 0 ? "∞" : formatDuration(t, tier.keep)}`).join(" → ");
}

/** Same rules as model.ValidateStorageTiers in the backend; returns an i18n key or null. */
export function validateTiers(tiers: StorageTier[]): string | null {
  if (tiers.length === 0 || tiers.length > MAX_TIERS) return "storageTiers.err_count";
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const last = i === tiers.length - 1;
    if (tier.keep === 0 && !last) return "storageTiers.err_forever";
    if (tier.keep !== 0 && tier.keep < tier.step) return "storageTiers.err_keepShort";
    if (i === 0) continue;
    const prev = tiers[i - 1];
    if (tier.step <= prev.step) return "storageTiers.err_stepGrow";
    if (prev.step !== 0 && tier.step % prev.step !== 0) return "storageTiers.err_stepMultiple";
    if (tier.keep !== 0 && tier.keep <= prev.keep) return "storageTiers.err_keepGrow";
  }
  return null;
}

type Props = {
  tiers: StorageTier[];
  onChange: (tiers: StorageTier[]) => void;
};

export default function StorageTiersEditor({ tiers, onChange }: Props) {
  const { t } = useTranslation();

  const update = (i: number, patch: Partial<StorageTier>) =>
    onChange(tiers.map((tier, j) => (j === i ? { ...tier, ...patch } : tier)));

  const setKeep = (i: number, value: number, unit: KeepUnit) => {
    if (unit === "forever") {
      update(i, { keep: 0 });
      return;
    }
    const amount = Math.max(1, Math.floor(value || 0));
    update(i, { keep: amount * (unit === "d" ? DAY : HOUR) });
  };

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const step = STORAGE_STEPS.find(s => s > last.step && (last.step === 0 || s % last.step === 0)) ?? DAY;
    // the previous last tier stops keeping forever: default to 30 days (or longer than it is)
    const prevKeep = last.keep === 0 ? 30 * DAY : last.keep;
    onChange([...tiers.slice(0, -1), { ...last, keep: prevKeep }, { step, keep: 0 }]);
  };

  const removeTier = (i: number) => {
    const rest = tiers.filter((_, j) => j !== i);
    onChange(rest.length > 0 ? rest : DEFAULT_STORAGE_TIERS);
  };

  const error = validateTiers(tiers);

  return (
    <>
      {tiers.map((tier, i) => {
        const unit = keepUnit(tier.keep);
        const amount = unit === "forever" ? "" : tier.keep / (unit === "d" ? DAY : HOUR);
        const last = i === tiers.length - 1;
        return (
          <InputGroup size="sm" className="mb-2" key={i}>
            <InputGroup.Text>{i === 0 ? t("storageTiers.first") : t("storageTiers.then")}</InputGroup.Text>
            <Form.Select
              value={tier.step}
              onChange={(e) => update(i, { step: +e.target.value })}
              aria-label={t("storageTiers.step")}
            >
              {STORAGE_STEPS.map(s => <option key={s} value={s}>{formatStep(t, s)}</option>)}
            </Form.Select>
            <InputGroup.Text>{t("storageTiers.for")}</InputGroup.Text>
            {unit !== "forever" && (
              <Form.Control
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setKeep(i, +e.target.value, unit)}
                aria-label={t("storageTiers.keep")}
              />
            )}
            <Form.Select
              value={unit}
              onChange={(e) => setKeep(i, unit === "forever" ? 30 : +amount, e.target.value as KeepUnit)}
              aria-label={t("storageTiers.keepUnit")}
            >
              <option value="h">{t("storageTiers.unit_h")}</option>
              <option value="d">{t("storageTiers.unit_d")}</option>
              {last && <option value="forever">{t("storageTiers.forever")}</option>}
            </Form.Select>
            <Button
              variant="outline-danger"
              onClick={() => removeTier(i)}
              disabled={tiers.length === 1}
              title={t("storageTiers.remove")}
            >
              <i className="fa-solid fa-xmark"></i>
            </Button>
          </InputGroup>
        );
      })}
      {tiers.length < MAX_TIERS && (
        <Button variant="outline-secondary" size="sm" onClick={addTier}>
          <i className="fa-solid fa-plus me-1"></i> {t("storageTiers.add")}
        </Button>
      )}
      {error && <div className="text-danger small mt-2">{t(error)}</div>}
      <Form.Text className="text-muted d-block mt-2">
        {t("storageTiers.help")}
      </Form.Text>
    </>
  );
}
