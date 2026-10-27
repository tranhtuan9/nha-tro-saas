"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getApiErrorMessage, notifyApp } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, SearchInput } from "@/components/ui/FilterBar";
import { Field, Select, TextInput, Textarea } from "@/components/ui/form";
import { FormModal } from "@/components/ui/FormModal";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton, RowActions } from "@/components/ui/RowActions";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { Contract, Property, Renter, Room } from "@/lib/types";

const ROOM_STATUS_LABEL: Record<Room["status"], string> = {
  AVAILABLE: "Còn trống",
  OCCUPIED: "Đang thuê",
  MAINTENANCE: "Bảo trì",
};

const ROOM_STATUS_TONE: Record<Room["status"], "neutral" | "success" | "warning"> = {
  AVAILABLE: "neutral",
  OCCUPIED: "success",
  MAINTENANCE: "warning",
};

function parseAmount(value: string): number | null {
  const raw = value.trim().replace(/\s/g, "");
  if (!raw) return null;
  let text = raw;
  if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  } else {
    text = text.replace(/,/g, ".");
  }
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

function useDebouncedValue(value: string, delayMs = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface PropertyFormModalProps {
  mode: "create" | "edit" | "unit-price";
  property: Property | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}

function PropertyFormModal({ mode, property, open, onClose, onSaved }: PropertyFormModalProps) {
  const unitPriceOnly = mode === "unit-price";
  const [name, setName] = useState(property?.name ?? "");
  const [address, setAddress] = useState(property?.address ?? "");
  const [description, setDescription] = useState(property?.description ?? "");
  const [electricity, setElectricity] = useState(property?.electricityUnitPrice ?? "");
  const [water, setWater] = useState(property?.waterUnitPrice ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title =
    mode === "create" ? "Thêm nhà trọ" : mode === "edit" ? "Chỉnh sửa nhà trọ" : "Chỉnh sửa đơn giá";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!unitPriceOnly) {
      if (name.trim().length < 2) nextErrors.name = "Tên nhà trọ phải từ 2 ký tự trở lên";
      if (address.trim().length < 2) nextErrors.address = "Địa chỉ phải từ 2 ký tự trở lên";
    }
    const elec = parseAmount(electricity);
    const waterAmount = parseAmount(water);
    if (electricity.trim() === "") nextErrors.electricity = "Vui lòng nhập đơn giá điện";
    else if (elec === null || elec < 0) nextErrors.electricity = "Đơn giá không hợp lệ";
    if (water.trim() === "") nextErrors.water = "Vui lòng nhập đơn giá nước";
    else if (waterAmount === null || waterAmount < 0) nextErrors.water = "Đơn giá không hợp lệ";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      if (mode === "create") {
        await api.post("/properties", {
          name: name.trim(),
          address: address.trim(),
          description: description.trim() || undefined,
          electricityUnitPrice: elec,
          waterUnitPrice: waterAmount,
        });
        notifyApp({ tone: "success", message: "Đã thêm nhà trọ mới" });
      } else if (mode === "edit") {
        await api.patch(`/properties/${property?.id}`, {
          name: name.trim(),
          address: address.trim(),
          description: description.trim(),
          electricityUnitPrice: elec,
          waterUnitPrice: waterAmount,
        });
        notifyApp({ tone: "success", message: "Đã lưu thay đổi nhà trọ" });
      } else {
        await api.patch(`/properties/${property?.id}`, {
          electricityUnitPrice: elec,
          waterUnitPrice: waterAmount,
        });
        notifyApp({ tone: "success", message: "Đã cập nhật đơn giá" });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      submitLabel={mode === "create" ? "Thêm nhà trọ" : "Lưu"}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    >
      {!unitPriceOnly && (
        <>
          <Field label="Tên nhà trọ" htmlFor="property-name" required error={errors.name}>
            <TextInput
              id="property-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Nhà trọ Hoa Mai"
              error={Boolean(errors.name)}
            />
          </Field>
          <Field label="Địa chỉ" htmlFor="property-address" required error={errors.address}>
            <TextInput
              id="property-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Ví dụ: Số 12 Ngõ 45 Cầu Giấy, Hà Nội"
              error={Boolean(errors.address)}
            />
          </Field>
          <Field label="Mô tả" htmlFor="property-description" hint="Không bắt buộc">
            <Textarea
              id="property-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </Field>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Đơn giá điện (đ/kWh)"
          htmlFor="property-electricity"
          required
          error={errors.electricity}
        >
          <TextInput
            id="property-electricity"
            inputMode="decimal"
            value={electricity}
            onChange={(event) => setElectricity(event.target.value)}
            placeholder="Ví dụ: 3500"
            error={Boolean(errors.electricity)}
          />
        </Field>
        <Field label="Đơn giá nước (đ/m³)" htmlFor="property-water" required error={errors.water}>
          <TextInput
            id="property-water"
            inputMode="decimal"
            value={water}
            onChange={(event) => setWater(event.target.value)}
            placeholder="Ví dụ: 15000"
            error={Boolean(errors.water)}
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

interface RoomFormModalProps {
  mode: "create" | "edit";
  room: Room | null;
  properties: Property[];
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}

function RoomFormModal({ mode, room, properties, open, onClose, onSaved }: RoomFormModalProps) {
  const options = useMemo(() => {
    const list = properties.filter((property) => property.isActive || property.id === room?.propertyId);
    return list;
  }, [properties, room?.propertyId]);

  const [propertyId, setPropertyId] = useState(room?.propertyId ?? "");
  const [roomCode, setRoomCode] = useState(room?.roomCode ?? "");
  const [area, setArea] = useState(room?.areaM2 ?? "");
  const [basePrice, setBasePrice] = useState(room?.basePrice ?? "");
  const [description, setDescription] = useState(room?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!propertyId) nextErrors.propertyId = "Vui lòng chọn nhà trọ";
    if (!roomCode.trim()) nextErrors.roomCode = "Vui lòng nhập mã phòng";
    const price = parseAmount(basePrice);
    if (basePrice.trim() === "") nextErrors.basePrice = "Vui lòng nhập giá thuê";
    else if (price === null || price < 0) nextErrors.basePrice = "Giá thuê không hợp lệ";
    const areaValue = area.trim() === "" ? null : parseAmount(area);
    if (area.trim() !== "" && (areaValue === null || areaValue < 0)) {
      nextErrors.area = "Diện tích không hợp lệ";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const descriptionValue = description.trim();
      if (mode === "create") {
        await api.post("/rooms", {
          propertyId,
          roomCode: roomCode.trim(),
          basePrice: price,
          ...(areaValue !== null && { areaM2: areaValue }),
          ...(descriptionValue && { description: descriptionValue }),
        });
        notifyApp({ tone: "success", message: "Đã thêm phòng mới" });
      } else {
        await api.patch(`/rooms/${room?.id}`, {
          propertyId,
          roomCode: roomCode.trim(),
          basePrice: price,
          areaM2: areaValue,
          description: descriptionValue,
        });
        notifyApp({ tone: "success", message: "Đã lưu thay đổi phòng" });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const noProperties = options.length === 0;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Thêm phòng" : "Chỉnh sửa phòng"}
      submitLabel={mode === "create" ? "Thêm phòng" : "Lưu"}
      submitting={submitting}
      error={error ?? (noProperties ? "Chưa có nhà trọ hoạt động. Hãy thêm nhà trọ trước." : null)}
      onSubmit={handleSubmit}
    >
      <Field label="Nhà trọ" htmlFor="room-property" required error={errors.propertyId}>
        <Select
          id="room-property"
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          error={Boolean(errors.propertyId)}
          disabled={noProperties}
        >
          <option value="">Chọn nhà trọ</option>
          {options.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mã phòng" htmlFor="room-code" required error={errors.roomCode}>
          <TextInput
            id="room-code"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            placeholder="Ví dụ: P.101"
            error={Boolean(errors.roomCode)}
          />
        </Field>
        <Field label="Giá thuê (đ/tháng)" htmlFor="room-price" required error={errors.basePrice}>
          <TextInput
            id="room-price"
            inputMode="decimal"
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
            placeholder="Ví dụ: 3500000"
            error={Boolean(errors.basePrice)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Diện tích (m²)" htmlFor="room-area" hint="Không bắt buộc" error={errors.area}>
          <TextInput
            id="room-area"
            inputMode="decimal"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            placeholder="Ví dụ: 22"
            error={Boolean(errors.area)}
          />
        </Field>
        <Field label="Mô tả" htmlFor="room-description" hint="Không bắt buộc">
          <TextInput
            id="room-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ví dụ: Tầng 1 - Cửa sổ lớn"
          />
        </Field>
      </div>
      {mode === "edit" && (
        <p className="text-xs text-muted">
          Chỉ được chuyển phòng sang nhà trọ khác khi phòng chưa phát sinh hợp đồng, chỉ số điện nước
          hoặc hóa đơn.
        </p>
      )}
    </FormModal>
  );
}

export default function PropertiesPage() {
  const { canCreate, plan } = useAuth();

  const [tab, setTab] = useState("properties");

  const [propertySearch, setPropertySearch] = useState("");
  const [propertyStatus, setPropertyStatus] = useState("");
  const [propertyPage, setPropertyPage] = useState(1);
  const debouncedPropertySearch = useDebouncedValue(propertySearch);

  const [roomSearch, setRoomSearch] = useState("");
  const [roomStatus, setRoomStatus] = useState("");
  const [roomPropertyId, setRoomPropertyId] = useState("");
  const [roomPage, setRoomPage] = useState(1);
  const debouncedRoomSearch = useDebouncedValue(roomSearch);

  const propertiesList = usePagedList<Property>("/properties", {
    page: propertyPage,
    pageSize: 10,
    search: debouncedPropertySearch || undefined,
    isActive: propertyStatus || undefined,
  });
  const roomsList = usePagedList<Room>("/rooms", {
    page: roomPage,
    pageSize: 10,
    search: debouncedRoomSearch || undefined,
    status: roomStatus || undefined,
    propertyId: roomPropertyId || undefined,
  });

  const allProperties = usePagedList<Property>("/properties", { pageSize: 100 });
  const rentersMap = usePagedList<Renter>("/renters", { pageSize: 100 });
  const activeContracts = usePagedList<Contract>("/contracts", { pageSize: 100, status: "ACTIVE" });

  const totalProperties = usePagedList<Property>("/properties", { pageSize: 1 });
  const totalRooms = usePagedList<Room>("/rooms", { pageSize: 1 });
  const occupiedRooms = usePagedList<Room>("/rooms", { pageSize: 1, status: "OCCUPIED" });
  const availableRooms = usePagedList<Room>("/rooms", { pageSize: 1, status: "AVAILABLE" });
  const maintenanceRooms = usePagedList<Room>("/rooms", { pageSize: 1, status: "MAINTENANCE" });

  const [propertyModal, setPropertyModal] = useState<
    { mode: "create" | "edit" | "unit-price"; property: Property | null } | null
  >(null);
  const [roomModal, setRoomModal] = useState<{ mode: "create" | "edit"; room: Room | null } | null>(
    null,
  );
  const [deactivateTarget, setDeactivateTarget] = useState<Property | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<
    { room: Room; next: "AVAILABLE" | "MAINTENANCE" } | null
  >(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function refreshAll() {
    await Promise.all([
      propertiesList.mutate(),
      roomsList.mutate(),
      allProperties.mutate(),
      rentersMap.mutate(),
      activeContracts.mutate(),
      totalProperties.mutate(),
      totalRooms.mutate(),
      occupiedRooms.mutate(),
      availableRooms.mutate(),
      maintenanceRooms.mutate(),
    ]);
  }

  const propertyById = useMemo(
    () => new Map(allProperties.rows.map((property) => [property.id, property])),
    [allProperties.rows],
  );
  const renterById = useMemo(
    () => new Map(rentersMap.rows.map((renter) => [renter.id, renter])),
    [rentersMap.rows],
  );
  const contractByRoom = useMemo(
    () => new Map(activeContracts.rows.map((contract) => [contract.roomId, contract])),
    [activeContracts.rows],
  );

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateBusy(true);
    setDeactivateError(null);
    try {
      await api.patch(`/properties/${deactivateTarget.id}/deactivate`);
      notifyApp({ tone: "success", message: `Đã ẩn nhà trọ "${deactivateTarget.name}"` });
      setDeactivateTarget(null);
      await refreshAll();
    } catch (err) {
      setDeactivateError(getApiErrorMessage(err));
    } finally {
      setDeactivateBusy(false);
    }
  }

  async function confirmRoomStatus() {
    if (!statusTarget) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      await api.patch(`/rooms/${statusTarget.room.id}/status`, { status: statusTarget.next });
      notifyApp({
        tone: "success",
        message:
          statusTarget.next === "MAINTENANCE"
            ? `Đã đưa phòng ${statusTarget.room.roomCode} vào bảo trì`
            : `Đã hoàn tất bảo trì phòng ${statusTarget.room.roomCode}`,
      });
      setStatusTarget(null);
      await refreshAll();
    } catch (err) {
      setStatusError(getApiErrorMessage(err));
    } finally {
      setStatusBusy(false);
    }
  }

  const propertyColumns: Column<Property>[] = [
    {
      key: "name",
      header: "Nhà trọ",
      cell: (property) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{property.name}</p>
          <p className="text-xs text-muted">{property.address}</p>
        </div>
      ),
    },
    {
      key: "electricity",
      header: "Đơn giá điện",
      align: "right",
      cell: (property) => (
        <span className="whitespace-nowrap font-medium text-ink">
          {formatCurrency(property.electricityUnitPrice)}/kWh
        </span>
      ),
    },
    {
      key: "water",
      header: "Đơn giá nước",
      align: "right",
      cell: (property) => (
        <span className="whitespace-nowrap font-medium text-ink">
          {formatCurrency(property.waterUnitPrice)}/m³
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (property) =>
        property.isActive ? (
          <Badge tone="success" dot>
            Đang hoạt động
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Đã ẩn
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "Thao tác",
      align: "right",
      cell: (property) => (
        <RowActions>
          <ActionButton
            icon={<Icon name="edit" className="h-3.5 w-3.5" />}
            onClick={() => setPropertyModal({ mode: "edit", property })}
          >
            Sửa
          </ActionButton>
          <ActionButton
            icon={<Icon name="bolt" className="h-3.5 w-3.5" />}
            onClick={() => setPropertyModal({ mode: "unit-price", property })}
          >
            Đơn giá
          </ActionButton>
          {property.isActive && (
            <ActionButton
              tone="danger"
              onClick={() => {
                setDeactivateError(null);
                setDeactivateTarget(property);
              }}
            >
              Ẩn
            </ActionButton>
          )}
        </RowActions>
      ),
    },
  ];

  const roomColumns: Column<Room>[] = [
    {
      key: "roomCode",
      header: "Phòng",
      cell: (room) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{room.roomCode}</p>
          <p className="text-xs text-muted">{propertyById.get(room.propertyId)?.name ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "area",
      header: "Diện tích",
      align: "right",
      cell: (room) => <span className="whitespace-nowrap">{room.areaM2 ? `${room.areaM2} m²` : "—"}</span>,
    },
    {
      key: "price",
      header: "Giá thuê",
      align: "right",
      cell: (room) => (
        <span className="whitespace-nowrap font-medium text-ink">
          {formatCurrency(room.basePrice)}
          <span className="text-xs font-normal text-muted">/tháng</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (room) => <Badge tone={ROOM_STATUS_TONE[room.status]}>{ROOM_STATUS_LABEL[room.status]}</Badge>,
    },
    {
      key: "renter",
      header: "Người thuê & hợp đồng",
      cell: (room) => {
        const contract = contractByRoom.get(room.id);
        if (!contract) return <span className="text-muted">Chưa có khách thuê</span>;
        const renter = renterById.get(contract.renterId);
        return (
          <div className="min-w-0">
            <p className="font-medium text-ink">{renter?.fullName ?? "—"}</p>
            <p className="text-xs text-muted">HĐ đến {formatDate(contract.endDate)}</p>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Thao tác",
      align: "right",
      cell: (room) => (
        <RowActions>
          <ActionButton
            icon={<Icon name="edit" className="h-3.5 w-3.5" />}
            onClick={() => setRoomModal({ mode: "edit", room })}
          >
            Sửa
          </ActionButton>
          {room.status === "AVAILABLE" && (
            <ActionButton
              onClick={() => {
                setStatusError(null);
                setStatusTarget({ room, next: "MAINTENANCE" });
              }}
            >
              Đưa vào bảo trì
            </ActionButton>
          )}
          {room.status === "MAINTENANCE" && (
            <ActionButton
              tone="primary"
              onClick={() => {
                setStatusError(null);
                setStatusTarget({ room, next: "AVAILABLE" });
              }}
            >
              Hoàn tất bảo trì
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
          breadcrumb="Vận hành / Nhà trọ & Phòng"
          title="Quản lý nhà trọ & phòng"
          description="Quản lý danh sách cơ sở, chi tiết từng phòng trọ và tình trạng cho thuê."
          actions={
            canCreate ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="h-9 px-3.5 text-xs"
                  onClick={() => setPropertyModal({ mode: "create", property: null })}
                >
                  <Icon name="domain" className="h-4 w-4" />
                  Thêm nhà trọ
                </Button>
                <Button
                  className="h-9 px-3.5 text-xs font-semibold"
                  onClick={() => setRoomModal({ mode: "create", room: null })}
                >
                  <Icon name="add" className="h-4 w-4" />
                  Thêm phòng
                </Button>
              </div>
            ) : undefined
          }
        />
        {plan && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-container/70 px-3.5 py-2.5 text-xs text-muted">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <p>
              Gói <span className="font-semibold text-ink">{plan.name}</span>: tối đa{" "}
              {plan.maxProperties} nhà trọ đang hoạt động và {plan.maxRooms} phòng thuộc nhà trọ đang
              hoạt động.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Nhà trọ" value={countValue(totalProperties)} hint="Cơ sở đang quản lý" />
        <KpiCard label="Tổng phòng" value={countValue(totalRooms)} hint="Tất cả phòng" />
        <KpiCard
          label="Đang thuê"
          value={countValue(occupiedRooms)}
          hint="Phòng có khách thuê"
          tone="success"
        />
        <KpiCard label="Còn trống" value={countValue(availableRooms)} hint="Sẵn sàng cho thuê" />
        <KpiCard
          label="Bảo trì"
          value={countValue(maintenanceRooms)}
          hint="Tạm ngừng cho thuê"
          tone="warning"
        />
      </div>

      <Tabs
        items={[
          { id: "properties", label: "Danh sách nhà trọ" },
          { id: "rooms", label: "Danh sách phòng" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "properties" && (
        <div className="space-y-3">
          <FilterBar>
            <SearchInput
              value={propertySearch}
              onChange={(value) => {
                setPropertySearch(value);
                setPropertyPage(1);
              }}
              placeholder="Tìm theo tên hoặc địa chỉ..."
              className="sm:w-80"
            />
            <div className="w-full sm:w-52">
              <Select
                aria-label="Lọc trạng thái nhà trọ"
                value={propertyStatus}
                onChange={(event) => {
                  setPropertyStatus(event.target.value);
                  setPropertyPage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="true">Đang hoạt động</option>
                <option value="false">Đã ẩn</option>
              </Select>
            </div>
          </FilterBar>
          <DataTable
            columns={propertyColumns}
            rows={propertiesList.rows}
            rowKey={(property) => property.id}
            isLoading={propertiesList.isLoading}
            error={propertiesList.error}
            onRetry={() => void propertiesList.mutate()}
            pagination={propertiesList.pagination}
            onPageChange={setPropertyPage}
            emptyTitle="Chưa có nhà trọ nào"
            emptyDescription="Thêm nhà trọ đầu tiên để bắt đầu quản lý phòng trọ."
            emptyIcon={<Icon name="apartment" className="h-5 w-5" />}
          />
        </div>
      )}

      {tab === "rooms" && (
        <div className="space-y-3">
          <FilterBar>
            <SearchInput
              value={roomSearch}
              onChange={(value) => {
                setRoomSearch(value);
                setRoomPage(1);
              }}
              placeholder="Tìm theo mã phòng..."
              className="sm:w-72"
            />
            <div className="w-full sm:w-56">
              <Select
                aria-label="Lọc theo nhà trọ"
                value={roomPropertyId}
                onChange={(event) => {
                  setRoomPropertyId(event.target.value);
                  setRoomPage(1);
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
                aria-label="Lọc trạng thái phòng"
                value={roomStatus}
                onChange={(event) => {
                  setRoomStatus(event.target.value);
                  setRoomPage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="AVAILABLE">Còn trống</option>
                <option value="OCCUPIED">Đang thuê</option>
                <option value="MAINTENANCE">Bảo trì</option>
              </Select>
            </div>
          </FilterBar>
          <DataTable
            columns={roomColumns}
            rows={roomsList.rows}
            rowKey={(room) => room.id}
            isLoading={roomsList.isLoading}
            error={roomsList.error}
            onRetry={() => void roomsList.mutate()}
            pagination={roomsList.pagination}
            onPageChange={setRoomPage}
            emptyTitle="Chưa có phòng nào"
            emptyDescription="Thêm phòng cho nhà trọ để bắt đầu ghi nhận khách thuê."
            emptyIcon={<Icon name="meeting_room" className="h-5 w-5" />}
          />
        </div>
      )}

      {propertyModal && (
        <PropertyFormModal
          key={`${propertyModal.mode}-${propertyModal.property?.id ?? "new"}`}
          mode={propertyModal.mode}
          property={propertyModal.property}
          open
          onClose={() => setPropertyModal(null)}
          onSaved={refreshAll}
        />
      )}

      {roomModal && (
        <RoomFormModal
          key={`${roomModal.mode}-${roomModal.room?.id ?? "new"}`}
          mode={roomModal.mode}
          room={roomModal.room}
          properties={allProperties.rows}
          open
          onClose={() => setRoomModal(null)}
          onSaved={refreshAll}
        />
      )}

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Ẩn nhà trọ"
        tone="danger"
        confirmLabel="Ẩn nhà trọ"
        loading={deactivateBusy}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => void confirmDeactivate()}
        message={
          <>
            <p>
              Nhà trọ <span className="font-semibold">{deactivateTarget?.name}</span> sẽ không nhận
              thêm phòng hay hợp đồng mới. Hành động này không thể hoàn tác.
            </p>
            {deactivateError && (
              <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
                {deactivateError}
              </p>
            )}
          </>
        }
      />

      <ConfirmDialog
        open={statusTarget !== null}
        title={statusTarget?.next === "MAINTENANCE" ? "Đưa vào bảo trì" : "Hoàn tất bảo trì"}
        confirmLabel={statusTarget?.next === "MAINTENANCE" ? "Đưa vào bảo trì" : "Hoàn tất"}
        loading={statusBusy}
        onCancel={() => setStatusTarget(null)}
        onConfirm={() => void confirmRoomStatus()}
        message={
          <>
            {statusTarget?.next === "MAINTENANCE" ? (
              <p>
                Phòng <span className="font-semibold">{statusTarget?.room.roomCode}</span> sẽ chuyển
                sang trạng thái bảo trì và không thể tạo hợp đồng mới.
              </p>
            ) : (
              <p>
                Phòng <span className="font-semibold">{statusTarget?.room.roomCode}</span> sẽ trở
                lại trạng thái còn trống.
              </p>
            )}
            {statusError && (
              <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
                {statusError}
              </p>
            )}
          </>
        }
      />
    </div>
  );
}
