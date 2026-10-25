"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, getApiErrorMessage, notifyApp } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, SearchInput } from "@/components/ui/FilterBar";
import { Field, Select, TextInput } from "@/components/ui/form";
import { FormModal } from "@/components/ui/FormModal";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton, RowActions } from "@/components/ui/RowActions";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/lib/auth-context";
import { currentBillingMonth, formatBillingMonth, formatCurrency, shiftBillingMonth } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { MeterSheetResponse, MeterSheetRow, Property, ServiceItem } from "@/lib/types";
import useSWR from "swr";

type DraftMap = Record<string, { electricityIndex: string; waterIndex: string }>;

interface SaveItem {
  row: MeterSheetRow;
  electricityIndex: string;
  waterIndex: string;
}

interface SaveFailure {
  roomCode: string;
  message: string;
}

function parseAmount(value: string): number | null {
  const raw = value.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
}

function formatIndex(value: number): string {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function useDebouncedValue(value: string, delayMs = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function collectSaveItem(row: MeterSheetRow, draft: DraftMap[string] | undefined): SaveItem | null {
  const current = row.current;
  const rawElec = draft?.electricityIndex.trim() ?? "";
  const rawWater = draft?.waterIndex.trim() ?? "";
  const electricityIndex = rawElec !== "" ? rawElec : (current?.electricityIndex ?? "");
  const waterIndex = rawWater !== "" ? rawWater : (current?.waterIndex ?? "");
  if (!current) {
    if (rawElec === "" && rawWater === "") return null;
    return { row, electricityIndex, waterIndex };
  }
  if (electricityIndex === current.electricityIndex && waterIndex === current.waterIndex) return null;
  return { row, electricityIndex, waterIndex };
}

function validateSaveItem(item: SaveItem): string | null {
  const elec = parseAmount(item.electricityIndex);
  const water = parseAmount(item.waterIndex);
  if (item.electricityIndex === "" || elec === null || elec < 0) {
    return "Chỉ số điện chưa hợp lệ (phải là số không âm)";
  }
  if (item.waterIndex === "" || water === null || water < 0) {
    return "Chỉ số nước chưa hợp lệ (phải là số không âm)";
  }
  return null;
}

function computeUsage(row: MeterSheetRow, draft: DraftMap[string] | undefined): {
  electricity: number | null;
  water: number | null;
} {
  const item = collectSaveItem(row, draft);
  const previousElec = row.previous ? Number(row.previous.electricityIndex) : null;
  const previousWater = row.previous ? Number(row.previous.waterIndex) : null;
  if (item) {
    const elec = parseAmount(item.electricityIndex);
    const water = parseAmount(item.waterIndex);
    return {
      electricity: elec !== null && previousElec !== null ? elec - previousElec : null,
      water: water !== null && previousWater !== null ? water - previousWater : null,
    };
  }
  if (row.current) {
    return {
      electricity: Number(row.current.electricityUsage),
      water: Number(row.current.waterUsage),
    };
  }
  return { electricity: null, water: null };
}

interface ServiceFormModalProps {
  mode: "create" | "edit";
  service: ServiceItem | null;
  properties: Property[];
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}

function ServiceFormModal({ mode, service, properties, open, onClose, onSaved }: ServiceFormModalProps) {
  const isCreate = mode === "create";
  const activeProperties = useMemo(
    () => properties.filter((property) => property.isActive),
    [properties],
  );
  const [propertyId, setPropertyId] = useState(service?.propertyId ?? "");
  const [name, setName] = useState(service?.name ?? "");
  const [unit, setUnit] = useState(service?.unit ?? "");
  const [unitPrice, setUnitPrice] = useState(service?.unitPrice ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (isCreate && !propertyId) nextErrors.propertyId = "Vui lòng chọn nhà trọ";
    if (!name.trim()) nextErrors.name = "Vui lòng nhập tên dịch vụ";
    else if (name.trim().length > 100) nextErrors.name = "Tên dịch vụ tối đa 100 ký tự";
    if (!unit.trim()) nextErrors.unit = "Vui lòng nhập đơn vị tính";
    else if (unit.trim().length > 30) nextErrors.unit = "Đơn vị tính tối đa 30 ký tự";
    const price = parseAmount(unitPrice);
    if (unitPrice.trim() === "") nextErrors.unitPrice = "Vui lòng nhập đơn giá";
    else if (price === null || price < 0) nextErrors.unitPrice = "Đơn giá không hợp lệ";
    else if (!Number.isInteger(price)) nextErrors.unitPrice = "Đơn giá phải là số nguyên (VND)";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      if (isCreate) {
        await api.post("/services", {
          propertyId,
          name: name.trim(),
          unit: unit.trim(),
          unitPrice: price,
        });
        notifyApp({ tone: "success", message: "Đã thêm dịch vụ mới" });
      } else {
        await api.patch(`/services/${service?.id}`, {
          name: name.trim(),
          unit: unit.trim(),
          unitPrice: price,
        });
        notifyApp({ tone: "success", message: "Đã lưu thay đổi dịch vụ" });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const noProperties = isCreate && activeProperties.length === 0;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isCreate ? "Thêm dịch vụ" : "Chỉnh sửa dịch vụ"}
      submitLabel={isCreate ? "Thêm dịch vụ" : "Lưu"}
      submitting={submitting}
      error={error ?? (noProperties ? "Chưa có nhà trọ hoạt động. Hãy thêm nhà trọ trước." : null)}
      onSubmit={handleSubmit}
    >
      {isCreate && (
        <Field label="Nhà trọ" htmlFor="service-property" required error={errors.propertyId}>
          <Select
            id="service-property"
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
            error={Boolean(errors.propertyId)}
            disabled={noProperties}
          >
            <option value="">Chọn nhà trọ</option>
            {activeProperties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Tên dịch vụ" htmlFor="service-name" required error={errors.name}>
        <TextInput
          id="service-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ví dụ: Internet wifi"
          error={Boolean(errors.name)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Đơn vị tính" htmlFor="service-unit" required error={errors.unit}>
          <TextInput
            id="service-unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="Ví dụ: tháng"
            error={Boolean(errors.unit)}
          />
        </Field>
        <Field label="Đơn giá (đ)" htmlFor="service-price" required error={errors.unitPrice}>
          <TextInput
            id="service-price"
            inputMode="numeric"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
            placeholder="Ví dụ: 100000"
            error={Boolean(errors.unitPrice)}
          />
        </Field>
      </div>
      <p className="text-xs text-muted">
        Đơn giá mới chỉ áp dụng cho hóa đơn lập từ kỳ tiếp theo; hóa đơn đã chốt giữ nguyên đơn giá
        tại thời điểm lập.
      </p>
    </FormModal>
  );
}

export default function MetersServicesPage() {
  const { canCreate } = useAuth();

  const [tab, setTab] = useState("meters");

  const allProperties = usePagedList<Property>("/properties", { pageSize: 100 });
  const activeProperties = useMemo(
    () => allProperties.rows.filter((property) => property.isActive),
    [allProperties.rows],
  );

  const [propertyOverride, setPropertyOverride] = useState<string | null>(null);
  const selectedPropertyId = useMemo(() => {
    if (propertyOverride && activeProperties.some((property) => property.id === propertyOverride)) {
      return propertyOverride;
    }
    return activeProperties[0]?.id ?? "";
  }, [propertyOverride, activeProperties]);
  const [billingMonth, setBillingMonth] = useState(() => currentBillingMonth());
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [entryFilter, setEntryFilter] = useState("");
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingAnomaly, setPendingAnomaly] = useState<SaveItem[]>([]);
  const [anomalyError, setAnomalyError] = useState<string | null>(null);

  function resetSheetScope() {
    setDrafts({});
    setSaveErrors([]);
  }

  function changeProperty(value: string) {
    setPropertyOverride(value || null);
    resetSheetScope();
  }

  function changeMonth(offset: number) {
    setBillingMonth((month) => shiftBillingMonth(month, offset));
    resetSheetScope();
  }

  const sheetPath = selectedPropertyId
    ? `/meter-readings/sheet?propertyId=${encodeURIComponent(selectedPropertyId)}&billingMonth=${encodeURIComponent(
        billingMonth,
      )}`
    : null;
  const {
    data: sheetData,
    error: sheetError,
    isLoading: sheetLoading,
    mutate: reloadSheet,
  } = useSWR(
    sheetPath,
    sheetPath
      ? async (url: string) => (await api.get<MeterSheetResponse>(url)).data
      : null,
    { revalidateOnFocus: false },
  );
  const sheetRows = useMemo(() => sheetData?.data ?? [], [sheetData]);

  const selectedProperty = useMemo(
    () => activeProperties.find((property) => property.id === selectedPropertyId) ?? null,
    [activeProperties, selectedPropertyId],
  );

  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePropertyId, setServicePropertyId] = useState("");
  const [serviceStatus, setServiceStatus] = useState("");
  const [servicePage, setServicePage] = useState(1);
  const debouncedServiceSearch = useDebouncedValue(serviceSearch);

  const servicesList = usePagedList<ServiceItem>("/services", {
    page: servicePage,
    pageSize: 10,
    search: debouncedServiceSearch || undefined,
    propertyId: servicePropertyId || undefined,
    isActive: serviceStatus || undefined,
  });
  const totalServices = usePagedList<ServiceItem>("/services", { pageSize: 1 });
  const activeServices = usePagedList<ServiceItem>("/services", { pageSize: 1, isActive: "true" });
  const inactiveServices = usePagedList<ServiceItem>("/services", { pageSize: 1, isActive: "false" });

  const [serviceModal, setServiceModal] = useState<
    { mode: "create" | "edit"; service: ServiceItem | null } | null
  >(null);
  const [serviceStatusTarget, setServiceStatusTarget] = useState<
    { service: ServiceItem; next: "activate" | "deactivate" } | null
  >(null);
  const [serviceStatusBusy, setServiceStatusBusy] = useState(false);
  const [serviceStatusError, setServiceStatusError] = useState<string | null>(null);

  const dirtyItems = useMemo(
    () => sheetRows.map((row) => collectSaveItem(row, drafts[row.roomId])).filter((item): item is SaveItem => item !== null),
    [sheetRows, drafts],
  );

  const filteredSheetRows = useMemo(() => {
    if (entryFilter === "entered") return sheetRows.filter((row) => row.current !== null);
    if (entryFilter === "missing") return sheetRows.filter((row) => row.current === null);
    return sheetRows;
  }, [sheetRows, entryFilter]);

  const enteredCount = useMemo(() => sheetRows.filter((row) => row.current !== null).length, [sheetRows]);

  const usageSummary = useMemo(() => {
    let electricity = 0;
    let water = 0;
    for (const row of sheetRows) {
      const usage = computeUsage(row, drafts[row.roomId]);
      if (usage.electricity !== null) electricity += usage.electricity;
      if (usage.water !== null) water += usage.water;
    }
    return { electricity, water };
  }, [sheetRows, drafts]);

  function setDraft(roomId: string, field: "electricityIndex" | "waterIndex", value: string) {
    setDrafts((previous) => {
      const existing = previous[roomId] ?? { electricityIndex: "", waterIndex: "" };
      return { ...previous, [roomId]: { ...existing, [field]: value } };
    });
  }

  async function performSave(items: SaveItem[], confirmAnomaly: boolean): Promise<{
    saved: string[];
    failed: SaveFailure[];
    anomaly: SaveItem[];
  }> {
    const saved: string[] = [];
    const failed: SaveFailure[] = [];
    const anomaly: SaveItem[] = [];
    for (const item of items) {
      try {
        const body = {
          electricityIndex: parseAmount(item.electricityIndex),
          waterIndex: parseAmount(item.waterIndex),
          ...(confirmAnomaly && { confirmAnomaly: true }),
        };
        if (item.row.current) {
          await api.patch(`/meter-readings/${item.row.current.id}`, body);
        } else {
          await api.post("/meter-readings", {
            roomId: item.row.roomId,
            billingMonth,
            electricityIndex: body.electricityIndex,
            waterIndex: body.waterIndex,
            ...(confirmAnomaly && { confirmAnomaly: true }),
          });
        }
        saved.push(item.row.roomId);
      } catch (err) {
        if (err instanceof ApiError && err.code === "METER_INDEX_DECREASED" && !confirmAnomaly) {
          anomaly.push(item);
        } else {
          failed.push({ roomCode: item.row.roomCode, message: getApiErrorMessage(err) });
        }
      }
    }
    return { saved, failed, anomaly };
  }

  function applySaveResults(result: { saved: string[]; failed: SaveFailure[] }): void {
    if (result.saved.length > 0) {
      setDrafts((previous) => {
        const next = { ...previous };
        for (const roomId of result.saved) delete next[roomId];
        return next;
      });
    }
    setSaveErrors(result.failed.map((failure) => `${failure.roomCode}: ${failure.message}`));
  }

  async function handleSave() {
    const invalid = dirtyItems.find((item) => validateSaveItem(item) !== null);
    if (invalid) {
      setSaveErrors([
        `${invalid.row.roomCode}: ${validateSaveItem(invalid)}`,
      ]);
      return;
    }
    setSaving(true);
    setSaveErrors([]);
    try {
      const first = await performSave(dirtyItems, false);
      applySaveResults(first);
      const savedCount = first.saved.length;
      const totalCount = dirtyItems.length;
      if (first.anomaly.length > 0) {
        setAnomalyError(null);
        setPendingAnomaly(first.anomaly);
        if (savedCount > 0) {
          notifyApp({ tone: "success", message: `Đã lưu ${savedCount}/${totalCount} dòng chỉ số` });
          await reloadSheet();
        }
      } else {
        notifyApp({
          tone: savedCount === totalCount ? "success" : "error",
          message:
            savedCount === totalCount
              ? `Đã lưu ${savedCount} dòng chỉ số`
              : `Chỉ lưu được ${savedCount}/${totalCount} dòng chỉ số`,
        });
        if (savedCount > 0) await reloadSheet();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmAnomaly() {
    setSaving(true);
    setAnomalyError(null);
    try {
      const retry = await performSave(pendingAnomaly, true);
      applySaveResults(retry);
      notifyApp({
        tone: retry.failed.length === 0 ? "success" : "error",
        message:
          retry.failed.length === 0
            ? `Đã lưu ${retry.saved.length} dòng chỉ số (đánh dấu bất thường)`
            : `Chỉ lưu được ${retry.saved.length}/${pendingAnomaly.length} dòng chỉ số`,
      });
      setPendingAnomaly([]);
      await reloadSheet();
    } catch (err) {
      setAnomalyError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleCancelAnomaly() {
    setPendingAnomaly([]);
    setAnomalyError(null);
  }

  async function confirmServiceStatus() {
    if (!serviceStatusTarget) return;
    setServiceStatusBusy(true);
    setServiceStatusError(null);
    try {
      const { service, next } = serviceStatusTarget;
      await api.patch(`/services/${service.id}/${next === "activate" ? "activate" : "deactivate"}`);
      notifyApp({
        tone: "success",
        message: next === "activate" ? `Đã kích hoạt lại "${service.name}"` : `Đã ngừng sử dụng "${service.name}"`,
      });
      setServiceStatusTarget(null);
      await Promise.all([servicesList.mutate(), totalServices.mutate(), activeServices.mutate(), inactiveServices.mutate()]);
    } catch (err) {
      setServiceStatusError(getApiErrorMessage(err));
    } finally {
      setServiceStatusBusy(false);
    }
  }

  function resetDrafts() {
    setDrafts({});
    setSaveErrors([]);
  }

  const nextMonthDisabled = billingMonth >= currentBillingMonth();

  const sheetColumns: Column<MeterSheetRow>[] = [
    {
      key: "room",
      header: "Phòng",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{row.roomCode}</p>
          <p className="text-xs text-muted">{row.renter?.fullName ?? "Không có người thuê"}</p>
        </div>
      ),
    },
    {
      key: "prevElec",
      header: "Điện cũ",
      align: "right",
      cell: (row) => (
        <span className="whitespace-nowrap text-muted">{row.previous ? row.previous.electricityIndex : "—"}</span>
      ),
    },
    {
      key: "newElec",
      header: "Điện mới (kWh)",
      align: "right",
      cell: (row) => {
        const draft = drafts[row.roomId];
        const disabled = row.locked || (!row.current && !canCreate);
        return (
          <input
            type="number"
            min={0}
            step="any"
            aria-label={`Chỉ số điện mới phòng ${row.roomCode}`}
            title={
              row.locked
                ? "Chỉ số đã khóa do có hóa đơn"
                : !row.current && !canCreate
                  ? "Hết hạn gói: chỉ tạo được chỉ số khi thuê lại"
                  : undefined
            }
            disabled={disabled}
            value={draft?.electricityIndex ?? row.current?.electricityIndex ?? ""}
            onChange={(event) => setDraft(row.roomId, "electricityIndex", event.target.value)}
            className="h-9 w-28 rounded-lg border border-border bg-surface px-2 text-right text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-container disabled:text-muted"
          />
        );
      },
    },
    {
      key: "elecUsage",
      header: "Tiêu thụ (kWh)",
      align: "right",
      cell: (row) => {
        const usage = computeUsage(row, drafts[row.roomId]).electricity;
        if (usage === null) return <span className="text-muted">—</span>;
        return (
          <span className={usage < 0 ? "font-semibold text-danger-text" : "whitespace-nowrap"}>
            {formatIndex(usage)}
          </span>
        );
      },
    },
    {
      key: "prevWater",
      header: "Nước cũ",
      align: "right",
      cell: (row) => (
        <span className="whitespace-nowrap text-muted">{row.previous ? row.previous.waterIndex : "—"}</span>
      ),
    },
    {
      key: "newWater",
      header: "Nước mới (m³)",
      align: "right",
      cell: (row) => {
        const draft = drafts[row.roomId];
        const disabled = row.locked || (!row.current && !canCreate);
        return (
          <input
            type="number"
            min={0}
            step="any"
            aria-label={`Chỉ số nước mới phòng ${row.roomCode}`}
            title={
              row.locked
                ? "Chỉ số đã khóa do có hóa đơn"
                : !row.current && !canCreate
                  ? "Hết hạn gói: chỉ tạo được chỉ số khi thuê lại"
                  : undefined
            }
            disabled={disabled}
            value={draft?.waterIndex ?? row.current?.waterIndex ?? ""}
            onChange={(event) => setDraft(row.roomId, "waterIndex", event.target.value)}
            className="h-9 w-28 rounded-lg border border-border bg-surface px-2 text-right text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-container disabled:text-muted"
          />
        );
      },
    },
    {
      key: "waterUsage",
      header: "Tiêu thụ (m³)",
      align: "right",
      cell: (row) => {
        const usage = computeUsage(row, drafts[row.roomId]).water;
        if (usage === null) return <span className="text-muted">—</span>;
        return (
          <span className={usage < 0 ? "font-semibold text-danger-text" : "whitespace-nowrap"}>
            {formatIndex(usage)}
          </span>
        );
      },
    },
    {
      key: "amount",
      header: "Tạm tính tiền",
      align: "right",
      cell: (row) => {
        if (!selectedProperty) return <span className="text-muted">—</span>;
        const usage = computeUsage(row, drafts[row.roomId]);
        if (usage.electricity === null || usage.water === null) return <span className="text-muted">—</span>;
        const amount =
          usage.electricity * Number(selectedProperty.electricityUnitPrice) +
          usage.water * Number(selectedProperty.waterUnitPrice);
        return <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(Math.round(amount))}</span>;
      },
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => {
        const dirty = drafts[row.roomId] !== undefined;
        return (
          <div className="flex flex-col gap-1">
            {row.locked ? (
              <Badge tone="info">Đã khóa (có hóa đơn)</Badge>
            ) : row.current ? (
              <Badge tone={dirty ? "warning" : "success"} dot>
                {dirty ? "Chưa lưu" : "Đã ghi"}
              </Badge>
            ) : (
              <Badge tone={dirty ? "warning" : "neutral"} dot>
                {dirty ? "Chưa lưu" : "Chưa nhập"}
              </Badge>
            )}
            {row.anomaly && <Badge tone="danger">Bất thường</Badge>}
            {!row.current && row.locked === false && dirty && !canCreate && (
              <Badge tone="warning">Cần gói hoạt động</Badge>
            )}
          </div>
        );
      },
    },
  ];

  const serviceColumns: Column<ServiceItem>[] = [
    {
      key: "name",
      header: "Dịch vụ",
      cell: (service) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{service.name}</p>
          <p className="text-xs text-muted">
            {allProperties.rows.find((property) => property.id === service.propertyId)?.name ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "unit",
      header: "Đơn vị tính",
      cell: (service) => <span className="whitespace-nowrap">{service.unit}</span>,
    },
    {
      key: "unitPrice",
      header: "Đơn giá",
      align: "right",
      cell: (service) => (
        <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(service.unitPrice)}</span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (service) =>
        service.isActive ? (
          <Badge tone="success" dot>
            Đang sử dụng
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Ngừng sử dụng
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "Thao tác",
      align: "right",
      cell: (service) => (
        <RowActions>
          <ActionButton
            icon={<Icon name="edit" className="h-3.5 w-3.5" />}
            onClick={() => setServiceModal({ mode: "edit", service })}
          >
            Sửa
          </ActionButton>
          {service.isActive ? (
            <ActionButton
              tone="danger"
              onClick={() => {
                setServiceStatusError(null);
                setServiceStatusTarget({ service, next: "deactivate" });
              }}
            >
              Ngừng sử dụng
            </ActionButton>
          ) : (
            <ActionButton
              tone="primary"
              onClick={() => {
                setServiceStatusError(null);
                setServiceStatusTarget({ service, next: "activate" });
              }}
            >
              Kích hoạt lại
            </ActionButton>
          )}
        </RowActions>
      ),
    },
  ];

  const countValue = (list: { pagination: { total: number } | null; isLoading: boolean }) =>
    list.isLoading ? "…" : (list.pagination?.total ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title="Điện nước & dịch vụ"
          description="Chốt chỉ số điện nước theo kỳ và cấu hình bảng giá dịch vụ tính kèm tiền phòng."
          actions={
            canCreate && tab === "services" ? (
              <Button onClick={() => setServiceModal({ mode: "create", service: null })}>
                <Icon name="add" className="h-4 w-4" />
                Thêm dịch vụ
              </Button>
            ) : undefined
          }
        />
      </div>

      <Tabs
        items={[
          { id: "meters", label: "Chỉ số điện nước" },
          { id: "services", label: "Danh mục dịch vụ" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "meters" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Điện tiêu thụ kỳ"
              value={sheetLoading ? "…" : formatIndex(usageSummary.electricity)}
              hint="kWh"
            />
            <KpiCard
              label="Nước tiêu thụ kỳ"
              value={sheetLoading ? "…" : formatIndex(usageSummary.water)}
              hint="m³"
            />
            <KpiCard
              label="Phòng đã ghi"
              value={sheetLoading ? "…" : `${enteredCount}/${sheetRows.length}`}
              tone={enteredCount === sheetRows.length && sheetRows.length > 0 ? "success" : "default"}
            />
          </div>

          <FilterBar>
            <div className="w-full sm:w-64">
              <Select
                aria-label="Chọn nhà trọ"
                value={selectedPropertyId}
                onChange={(event) => changeProperty(event.target.value)}
                disabled={activeProperties.length === 0}
              >
                <option value="">
                  {activeProperties.length === 0 ? "Chưa có nhà trọ hoạt động" : "Chọn nhà trọ"}
                </option>
                {activeProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => changeMonth(-1)}
              >
                <Icon name="chevron_left" className="h-4 w-4" />
                Tháng trước
              </Button>
              <span className="min-w-28 text-center text-sm font-semibold text-ink">
                Kỳ: {formatBillingMonth(billingMonth)}
              </span>
              <Button
                variant="secondary"
                disabled={nextMonthDisabled}
                title={nextMonthDisabled ? "Không được ghi chỉ số kỳ tương lai" : undefined}
                onClick={() => changeMonth(1)}
              >
                Tháng sau
                <Icon name="chevron_right" className="h-4 w-4" />
              </Button>
            </div>
            <div className="w-full sm:w-52">
              <Select
                aria-label="Lọc theo trạng thái nhập"
                value={entryFilter}
                onChange={(event) => setEntryFilter(event.target.value)}
              >
                <option value="">Tất cả phòng</option>
                <option value="entered">Đã nhập ({enteredCount})</option>
                <option value="missing">Chưa nhập ({sheetRows.length - enteredCount})</option>
              </Select>
            </div>
          </FilterBar>

          {selectedProperty && (
            <div className="flex items-start gap-2 rounded-lg bg-info-soft px-3.5 py-3 text-sm text-info-text ring-1 ring-inset ring-sky-200">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Đơn giá hiện tại: điện {formatCurrency(selectedProperty.electricityUnitPrice)}/kWh và
                nước {formatCurrency(selectedProperty.waterUnitPrice)}/m³. Chỉ số mới phải lớn hơn
                chỉ số kỳ trước; nếu nhỏ hơn, hệ thống yêu cầu xác nhận trước khi lưu. Sửa đơn giá
                trong màn “Quản lý nhà trọ & phòng”.
              </p>
            </div>
          )}

          {saveErrors.length > 0 && (
            <Alert tone="error">
              <p className="font-semibold">Một số dòng chưa được lưu:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {saveErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Alert>
          )}

          <DataTable
            columns={sheetColumns}
            rows={filteredSheetRows}
            rowKey={(row) => row.roomId}
            isLoading={sheetLoading}
            error={sheetError}
            onRetry={() => void reloadSheet()}
            loadingRows={5}
            emptyTitle={selectedPropertyId ? "Chưa có phòng nào trong kỳ này" : "Chọn nhà trọ để ghi chỉ số"}
            emptyDescription={
              selectedPropertyId
                ? "Chỉ các phòng đang có hợp đồng hiệu lực mới hiển thị trong bảng nhập chỉ số."
                : "Chưa có nhà trọ hoạt động để nhập chỉ số điện nước."
            }
            emptyIcon={<Icon name="bolt" className="h-5 w-5" />}
            footer={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {dirtyItems.length > 0 ? (
                    <>
                      <span className="font-medium text-warning-text">{dirtyItems.length} phòng</span>{" "}
                      có thay đổi chưa lưu
                    </>
                  ) : (
                    "Không có thay đổi nào chưa lưu"
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" disabled={dirtyItems.length === 0 || saving} onClick={resetDrafts}>
                    Hủy bỏ
                  </Button>
                  <Button disabled={dirtyItems.length === 0} loading={saving} onClick={() => void handleSave()}>
                    <Icon name="check" className="h-4 w-4" />
                    Lưu chỉ số
                  </Button>
                </div>
              </div>
            }
          />
        </div>
      )}

      {tab === "services" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Tổng số dịch vụ" value={countValue(totalServices)} />
            <KpiCard label="Đang áp dụng" value={countValue(activeServices)} tone="success" />
            <KpiCard label="Ngừng sử dụng" value={countValue(inactiveServices)} />
          </div>

          <FilterBar>
            <SearchInput
              value={serviceSearch}
              onChange={(value) => {
                setServiceSearch(value);
                setServicePage(1);
              }}
              placeholder="Tìm theo tên dịch vụ..."
              className="sm:w-72"
            />
            <div className="w-full sm:w-56">
              <Select
                aria-label="Lọc theo nhà trọ"
                value={servicePropertyId}
                onChange={(event) => {
                  setServicePropertyId(event.target.value);
                  setServicePage(1);
                }}
              >
                <option value="">Tất cả nhà trọ</option>
                {allProperties.rows
                  .filter((property) => property.isActive)
                  .map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="w-full sm:w-52">
              <Select
                aria-label="Lọc trạng thái dịch vụ"
                value={serviceStatus}
                onChange={(event) => {
                  setServiceStatus(event.target.value);
                  setServicePage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="true">Đang sử dụng</option>
                <option value="false">Ngừng sử dụng</option>
              </Select>
            </div>
          </FilterBar>

          <Alert tone="info">
            Các dịch vụ đang sử dụng sẽ tự động được cộng vào phiếu thu hằng tháng của từng phòng khi
            lập hóa đơn. Đơn giá mới chỉ áp dụng cho hóa đơn lập sau.
          </Alert>

          <DataTable
            columns={serviceColumns}
            rows={servicesList.rows}
            rowKey={(service) => service.id}
            isLoading={servicesList.isLoading}
            error={servicesList.error}
            onRetry={() => void servicesList.mutate()}
            pagination={servicesList.pagination}
            onPageChange={setServicePage}
            emptyTitle="Chưa có dịch vụ nào"
            emptyDescription="Thêm dịch vụ (internet, giữ xe...) để tự động cộng vào phiếu thu hằng tháng."
            emptyIcon={<Icon name="receipt_long" className="h-5 w-5" />}
          />
        </div>
      )}

      {serviceModal && (
        <ServiceFormModal
          key={`${serviceModal.mode}-${serviceModal.service?.id ?? "new"}`}
          mode={serviceModal.mode}
          service={serviceModal.service}
          properties={allProperties.rows}
          open
          onClose={() => setServiceModal(null)}
          onSaved={async () => {
            await Promise.all([
              servicesList.mutate(),
              totalServices.mutate(),
              activeServices.mutate(),
              inactiveServices.mutate(),
            ]);
          }}
        />
      )}

      <ConfirmDialog
        open={serviceStatusTarget !== null}
        title={
          serviceStatusTarget?.next === "activate" ? "Kích hoạt lại dịch vụ" : "Ngừng sử dụng dịch vụ"
        }
        confirmLabel={
          serviceStatusTarget?.next === "activate" ? "Kích hoạt lại" : "Ngừng sử dụng"
        }
        tone={serviceStatusTarget?.next === "activate" ? "primary" : "danger"}
        loading={serviceStatusBusy}
        onCancel={() => setServiceStatusTarget(null)}
        onConfirm={() => void confirmServiceStatus()}
        message={
          <>
            {serviceStatusTarget?.next === "activate" ? (
              <p>
                Dịch vụ <span className="font-semibold">{serviceStatusTarget?.service.name}</span> sẽ
                được cộng lại vào phiếu thu từ kỳ lập hóa đơn tiếp theo.
              </p>
            ) : (
              <p>
                Dịch vụ <span className="font-semibold">{serviceStatusTarget?.service.name}</span> sẽ
                ngừng được cộng vào phiếu thu; hóa đơn đã chốt không bị ảnh hưởng.
              </p>
            )}
            {serviceStatusError && (
              <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
                {serviceStatusError}
              </p>
            )}
          </>
        }
      />

      <ConfirmDialog
        open={pendingAnomaly.length > 0}
        title="Xác nhận chỉ số giảm"
        confirmLabel="Xác nhận lưu"
        loading={saving}
        onCancel={handleCancelAnomaly}
        onConfirm={() => void handleConfirmAnomaly()}
        message={
          <>
            <p>
              Chỉ số mới nhỏ hơn chỉ số kỳ trước tại{" "}
              <span className="font-semibold">{pendingAnomaly.length} phòng</span>. Nếu xác nhận,
              hệ thống coi như thay đồng hồ: tiêu thụ kỳ này được tính bằng chính chỉ số mới (đếm
              từ 0, không bao giờ âm) và dòng chỉ số được đánh dấu bất thường.
            </p>
            <ul className="mt-2 max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto text-sm">
              {pendingAnomaly.map((item) => (
                <li key={item.row.roomId}>
                  Phòng {item.row.roomCode}: điện cũ{" "}
                  {item.row.previous?.electricityIndex ?? "—"}, nước cũ {item.row.previous?.waterIndex ?? "—"}
                </li>
              ))}
            </ul>
            {anomalyError && (
              <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
                {anomalyError}
              </p>
            )}
          </>
        }
      />
    </div>
  );
}
