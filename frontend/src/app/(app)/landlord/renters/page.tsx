"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, apiFetcher, getApiErrorMessage, notifyApp } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, SearchInput } from "@/components/ui/FilterBar";
import { Field, Select, Textarea, TextInput } from "@/components/ui/form";
import { FormModal } from "@/components/ui/FormModal";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton, RowActions } from "@/components/ui/RowActions";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/lib/auth-context";
import { daysUntilDate, formatCurrency, formatDate, formatPhone, isValidEmail, toDateInputValue } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { ApiEnvelope, Contract, Property, Renter, Room } from "@/lib/types";
import useSWR from "swr";

const CONTRACT_STATUS_LABEL: Record<Contract["status"], string> = {
  ACTIVE: "Đang hiệu lực",
  ENDED: "Đã kết thúc",
  TERMINATED: "Chấm dứt",
};

const CONTRACT_STATUS_TONE: Record<Contract["status"], "success" | "neutral" | "danger"> = {
  ACTIVE: "success",
  ENDED: "neutral",
  TERMINATED: "danger",
};

function useDebouncedValue(value: string, delayMs = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

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

interface RenterFormModalProps {
  mode: "create" | "edit";
  renter: Renter | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}

function RenterFormModal({ mode, renter, open, onClose, onSaved }: RenterFormModalProps) {
  const isEdit = mode === "edit";
  const detailKey = isEdit && renter ? `/renters/${renter.id}` : null;
  const { data, error: detailError, isLoading: detailLoading, mutate: reloadDetail } = useSWR<
    ApiEnvelope<Renter>
  >(detailKey, detailKey ? (url: string) => apiFetcher<Renter>(url) : null, {
    revalidateOnFocus: false,
  });
  const detail = data?.data ?? null;

  const seeded = useRef(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit && detail && !seeded.current) {
      seeded.current = true;
      setFullName(detail.fullName);
      setPhone(detail.phone ?? "");
      setNationalId(detail.nationalId ?? "");
    }
  }, [isEdit, detail]);

  const blocked = isEdit && (detailLoading || Boolean(detailError) || !detail);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked) return;

    const nextErrors: Record<string, string> = {};
    if (fullName.trim().length < 2) nextErrors.fullName = "Họ và tên phải từ 2 ký tự trở lên";
    if (!isEdit) {
      if (!email.trim()) nextErrors.email = "Vui lòng nhập email";
      else if (!isValidEmail(email)) nextErrors.email = "Email không đúng định dạng";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      if (!isEdit) {
        await api.post("/renters", {
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          nationalId: nationalId.trim() || undefined,
        });
        notifyApp({
          tone: "success",
          message: "Đã tạo người thuê và gửi email mời đặt mật khẩu",
        });
      } else {
        await api.patch(`/renters/${renter?.id}`, {
          fullName: fullName.trim(),
          phone: phone.trim(),
          nationalId: nationalId.trim(),
        });
        notifyApp({ tone: "success", message: "Đã lưu thông tin người thuê" });
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
      title={isEdit ? "Chỉnh sửa người thuê" : "Thêm người thuê"}
      submitLabel={isEdit ? "Lưu" : "Thêm người thuê"}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    >
      {isEdit && detailLoading && <p className="text-sm text-muted">Đang tải thông tin chi tiết...</p>}
      {isEdit && detailError && (
        <Alert tone="error">
          Không tải được thông tin chi tiết người thuê.{" "}
          <button
            type="button"
            onClick={() => void reloadDetail()}
            className="font-semibold underline"
          >
            Thử lại
          </button>
        </Alert>
      )}
      <Field label="Họ và tên" htmlFor="renter-fullname" required error={errors.fullName}>
        <TextInput
          id="renter-fullname"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          disabled={blocked}
          error={Boolean(errors.fullName)}
        />
      </Field>
      <Field label="Email" htmlFor="renter-email" required error={errors.email}>
        {isEdit ? (
          <TextInput id="renter-email" value={detail?.email ?? ""} disabled />
        ) : (
          <TextInput
            id="renter-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vidu@gmail.com"
            error={Boolean(errors.email)}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Số điện thoại" htmlFor="renter-phone" hint="Không bắt buộc">
          <TextInput
            id="renter-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={blocked}
            placeholder="0987 123 456"
          />
        </Field>
        <Field label="Số CCCD" htmlFor="renter-nationalid" hint="Không bắt buộc">
          <TextInput
            id="renter-nationalid"
            value={nationalId}
            onChange={(event) => setNationalId(event.target.value)}
            disabled={blocked}
          />
        </Field>
      </div>
      {!isEdit && (
        <p className="text-xs text-muted">
          Hệ thống sẽ gửi email mời người thuê đặt mật khẩu để đăng nhập xem hóa đơn và gửi phản ánh.
        </p>
      )}
    </FormModal>
  );
}

interface ContractFormModalProps {
  mode: "create" | "edit";
  contract: Contract | null;
  rooms: Room[];
  renters: Renter[];
  properties: Property[];
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}

function ContractFormModal({
  mode,
  contract,
  rooms,
  renters,
  properties,
  open,
  onClose,
  onSaved,
}: ContractFormModalProps) {
  const isEdit = mode === "edit";
  const activePropertyIds = useMemo(
    () => new Set(properties.filter((property) => property.isActive).map((property) => property.id)),
    [properties],
  );
  const availableRooms = useMemo(
    () => rooms.filter((room) => room.status === "AVAILABLE" && activePropertyIds.has(room.propertyId)),
    [rooms, activePropertyIds],
  );
  const activeRenters = useMemo(() => renters.filter((renter) => renter.status === "ACTIVE"), [renters]);

  const [roomId, setRoomId] = useState(contract?.roomId ?? "");
  const [renterId, setRenterId] = useState(contract?.renterId ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(contract?.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(contract?.endDate));
  const [monthlyRent, setMonthlyRent] = useState(contract?.monthlyRent ?? "");
  const [deposit, setDeposit] = useState(contract?.deposit ?? "0");
  const [terms, setTerms] = useState(contract?.terms ?? "");
  const [rentTouched, setRentTouched] = useState(isEdit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleRoomChange(value: string) {
    setRoomId(value);
    if (!rentTouched && !isEdit) {
      const room = rooms.find((item) => item.id === value);
      if (room) setMonthlyRent(room.basePrice);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!isEdit) {
      if (!roomId) nextErrors.roomId = "Vui lòng chọn phòng";
      if (!renterId) nextErrors.renterId = "Vui lòng chọn người thuê";
    }
    if (!startDate) nextErrors.startDate = "Vui lòng chọn ngày bắt đầu";
    if (!endDate) nextErrors.endDate = "Vui lòng chọn ngày kết thúc";
    if (startDate && endDate && endDate <= startDate) {
      nextErrors.endDate = "Ngày kết thúc phải lớn hơn ngày bắt đầu";
    }
    const rentAmount = parseAmount(monthlyRent);
    if (monthlyRent.trim() === "") nextErrors.monthlyRent = "Vui lòng nhập tiền thuê";
    else if (rentAmount === null || rentAmount < 0) nextErrors.monthlyRent = "Tiền thuê không hợp lệ";
    const depositAmount = parseAmount(deposit);
    if (deposit.trim() === "") nextErrors.deposit = "Vui lòng nhập tiền cọc";
    else if (depositAmount === null || depositAmount < 0) nextErrors.deposit = "Tiền cọc không hợp lệ";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      if (!isEdit) {
        await api.post("/contracts", {
          roomId,
          renterId,
          startDate,
          endDate,
          monthlyRent: rentAmount,
          deposit: depositAmount,
          terms: terms.trim() || undefined,
        });
        notifyApp({ tone: "success", message: "Đã tạo hợp đồng và chuyển phòng sang trạng thái đang thuê" });
      } else {
        await api.patch(`/contracts/${contract?.id}`, {
          endDate,
          monthlyRent: rentAmount,
          deposit: depositAmount,
          terms: terms.trim(),
        });
        notifyApp({ tone: "success", message: "Đã lưu thay đổi hợp đồng" });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const noRooms = !isEdit && availableRooms.length === 0;
  const noRenters = !isEdit && activeRenters.length === 0;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Chỉnh sửa hợp đồng" : "Tạo hợp đồng"}
      submitLabel={isEdit ? "Lưu" : "Tạo hợp đồng"}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
      size="lg"
    >
      {!isEdit && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phòng" htmlFor="contract-room" required error={errors.roomId}>
            <Select
              id="contract-room"
              value={roomId}
              onChange={(event) => handleRoomChange(event.target.value)}
              error={Boolean(errors.roomId)}
              disabled={noRooms}
            >
              <option value="">Chọn phòng trống</option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.roomCode} — {room.basePrice} đ/tháng
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Người thuê" htmlFor="contract-renter" required error={errors.renterId}>
            <Select
              id="contract-renter"
              value={renterId}
              onChange={(event) => setRenterId(event.target.value)}
              error={Boolean(errors.renterId)}
              disabled={noRenters}
            >
              <option value="">Chọn người thuê</option>
              {activeRenters.map((renter) => (
                <option key={renter.id} value={renter.id}>
                  {renter.fullName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      {!isEdit && (noRooms || noRenters) && (
        <Alert tone="info">
          {noRooms
            ? "Chưa có phòng trống thuộc nhà trọ đang hoạt động. Hãy kiểm tra danh sách phòng."
            : "Chưa có người thuê đang hoạt động. Hãy thêm người thuê trước khi tạo hợp đồng."}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ngày bắt đầu" htmlFor="contract-start" required error={errors.startDate}>
          <TextInput
            id="contract-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            error={Boolean(errors.startDate)}
          />
        </Field>
        <Field label="Ngày kết thúc" htmlFor="contract-end" required error={errors.endDate}>
          <TextInput
            id="contract-end"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            error={Boolean(errors.endDate)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tiền thuê (đ/tháng)" htmlFor="contract-rent" required error={errors.monthlyRent}>
          <TextInput
            id="contract-rent"
            inputMode="decimal"
            value={monthlyRent}
            onChange={(event) => {
              setMonthlyRent(event.target.value);
              setRentTouched(true);
            }}
            error={Boolean(errors.monthlyRent)}
          />
        </Field>
        <Field label="Tiền cọc (đ)" htmlFor="contract-deposit" required error={errors.deposit}>
          <TextInput
            id="contract-deposit"
            inputMode="decimal"
            value={deposit}
            onChange={(event) => setDeposit(event.target.value)}
            error={Boolean(errors.deposit)}
          />
        </Field>
      </div>
      <Field label="Điều khoản" htmlFor="contract-terms" hint="Không bắt buộc">
        <Textarea
          id="contract-terms"
          value={terms}
          onChange={(event) => setTerms(event.target.value)}
          rows={3}
          placeholder="Thời hạn, quy định nội trú..."
        />
      </Field>
      {!isEdit && (
        <p className="text-xs text-muted">
          Tạo hợp đồng sẽ tự động chuyển phòng sang trạng thái đang thuê.
        </p>
      )}
    </FormModal>
  );
}

export default function RentersPage() {
  const { canCreate } = useAuth();

  const [tab, setTab] = useState("renters");

  const [renterSearch, setRenterSearch] = useState("");
  const [renterStatus, setRenterStatus] = useState("");
  const [renterPage, setRenterPage] = useState(1);
  const debouncedRenterSearch = useDebouncedValue(renterSearch);

  const [contractStatus, setContractStatus] = useState("");
  const [contractPropertyId, setContractPropertyId] = useState("");
  const [contractPage, setContractPage] = useState(1);

  const rentersList = usePagedList<Renter>("/renters", {
    page: renterPage,
    pageSize: 10,
    search: debouncedRenterSearch || undefined,
    status: renterStatus || undefined,
  });
  const contractsList = usePagedList<Contract>("/contracts", {
    page: contractPage,
    pageSize: 10,
    status: contractStatus || undefined,
    propertyId: contractPropertyId || undefined,
  });

  const allRooms = usePagedList<Room>("/rooms", { pageSize: 100 });
  const allRenters = usePagedList<Renter>("/renters", { pageSize: 100 });
  const allProperties = usePagedList<Property>("/properties", { pageSize: 100 });
  const activeContracts = usePagedList<Contract>("/contracts", { pageSize: 100, status: "ACTIVE" });

  const totalRenters = usePagedList<Renter>("/renters", { pageSize: 1 });
  const totalContracts = usePagedList<Contract>("/contracts", { pageSize: 1 });
  const activeContractCount = usePagedList<Contract>("/contracts", { pageSize: 1, status: "ACTIVE" });

  const [renterModal, setRenterModal] = useState<
    { mode: "create" | "edit"; renter: Renter | null } | null
  >(null);
  const [contractModal, setContractModal] = useState<
    { mode: "create" | "edit"; contract: Contract | null } | null
  >(null);
  const [inviteTarget, setInviteTarget] = useState<Renter | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [endTarget, setEndTarget] = useState<Contract | null>(null);
  const [endBusy, setEndBusy] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<Contract | null>(null);
  const [terminateReason, setTerminateReason] = useState("");
  const [terminateBusy, setTerminateBusy] = useState(false);
  const [terminateError, setTerminateError] = useState<string | null>(null);

  async function refreshAll() {
    await Promise.all([
      rentersList.mutate(),
      contractsList.mutate(),
      allRooms.mutate(),
      allRenters.mutate(),
      allProperties.mutate(),
      activeContracts.mutate(),
      totalRenters.mutate(),
      totalContracts.mutate(),
      activeContractCount.mutate(),
    ]);
  }

  const roomById = useMemo(() => new Map(allRooms.rows.map((room) => [room.id, room])), [allRooms.rows]);
  const renterById = useMemo(
    () => new Map(allRenters.rows.map((renter) => [renter.id, renter])),
    [allRenters.rows],
  );
  const propertyById = useMemo(
    () => new Map(allProperties.rows.map((property) => [property.id, property])),
    [allProperties.rows],
  );

  const expiringSoon = useMemo(
    () =>
      activeContracts.rows.filter((contract) => {
        const days = daysUntilDate(contract.endDate);
        return days !== null && days <= 30;
      }).length,
    [activeContracts.rows],
  );
  const totalDeposit = useMemo(
    () =>
      activeContracts.rows.reduce((sum, contract) => sum + (Number(contract.deposit) || 0), 0),
    [activeContracts.rows],
  );

  async function confirmInvite() {
    if (!inviteTarget) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      await api.post(`/renters/${inviteTarget.id}/resend-invite`);
      notifyApp({ tone: "success", message: "Đã gửi lại email mời đặt mật khẩu" });
      setInviteTarget(null);
      await refreshAll();
    } catch (err) {
      setInviteError(getApiErrorMessage(err));
    } finally {
      setInviteBusy(false);
    }
  }

  async function confirmEnd() {
    if (!endTarget) return;
    setEndBusy(true);
    setEndError(null);
    try {
      await api.patch(`/contracts/${endTarget.id}/end`);
      notifyApp({ tone: "success", message: "Đã kết thúc hợp đồng" });
      setEndTarget(null);
      await refreshAll();
    } catch (err) {
      setEndError(getApiErrorMessage(err));
    } finally {
      setEndBusy(false);
    }
  }

  async function confirmTerminate() {
    if (!terminateTarget) return;
    setTerminateBusy(true);
    setTerminateError(null);
    try {
      await api.patch(`/contracts/${terminateTarget.id}/terminate`, {
        reason: terminateReason.trim() || undefined,
      });
      notifyApp({ tone: "success", message: "Đã chấm dứt hợp đồng" });
      setTerminateTarget(null);
      setTerminateReason("");
      await refreshAll();
    } catch (err) {
      setTerminateError(getApiErrorMessage(err));
    } finally {
      setTerminateBusy(false);
    }
  }

  const renterColumns: Column<Renter>[] = [
    {
      key: "name",
      header: "Người thuê",
      cell: (renter) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{renter.fullName}</p>
          <p className="text-xs text-muted">{renter.email}</p>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Số điện thoại",
      cell: (renter) => <span className="whitespace-nowrap">{formatPhone(renter.phone)}</span>,
    },
    {
      key: "nationalId",
      header: "CCCD",
      cell: (renter) => (
        <span className="whitespace-nowrap" title="Số CCCD được che bớt khi hiển thị danh sách">
          {renter.nationalId ?? "—"}
        </span>
      ),
    },
    {
      key: "invite",
      header: "Tài khoản",
      cell: (renter) =>
        renter.lastLoginAt ? (
          <Badge tone="success" dot>
            Đã đăng nhập
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            Chưa đặt mật khẩu
          </Badge>
        ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (renter) =>
        renter.status === "ACTIVE" ? (
          <Badge tone="success">Đang hoạt động</Badge>
        ) : (
          <Badge tone="danger">Đã khóa</Badge>
        ),
    },
    {
      key: "actions",
      header: "Thao tác",
      align: "right",
      cell: (renter) => (
        <RowActions>
          <ActionButton
            icon={<Icon name="edit" className="h-3.5 w-3.5" />}
            onClick={() => setRenterModal({ mode: "edit", renter })}
          >
            Sửa
          </ActionButton>
          {!renter.lastLoginAt && canCreate && (
            <ActionButton
              tone="primary"
              icon={<Icon name="mail" className="h-3.5 w-3.5" />}
              onClick={() => {
                setInviteError(null);
                setInviteTarget(renter);
              }}
            >
              Gửi lại lời mời
            </ActionButton>
          )}
        </RowActions>
      ),
    },
  ];

  const contractColumns: Column<Contract>[] = [
    {
      key: "room",
      header: "Phòng",
      cell: (contract) => {
        const room = roomById.get(contract.roomId);
        const property = room ? propertyById.get(room.propertyId) : undefined;
        return (
          <div className="min-w-0">
            <p className="font-semibold text-ink">{room?.roomCode ?? "—"}</p>
            <p className="text-xs text-muted">{property?.name ?? "—"}</p>
          </div>
        );
      },
    },
    {
      key: "renter",
      header: "Người thuê",
      cell: (contract) => {
        const renter = renterById.get(contract.renterId);
        return (
          <div className="min-w-0">
            <p className="font-medium text-ink">{renter?.fullName ?? "—"}</p>
            <p className="text-xs text-muted">{formatPhone(renter?.phone)}</p>
          </div>
        );
      },
    },
    {
      key: "startDate",
      header: "Bắt đầu",
      cell: (contract) => <span className="whitespace-nowrap">{formatDate(contract.startDate)}</span>,
    },
    {
      key: "endDate",
      header: "Kết thúc",
      cell: (contract) => {
        const days = daysUntilDate(contract.endDate);
        return (
          <div className="min-w-0">
            <p className="whitespace-nowrap">{formatDate(contract.endDate)}</p>
            {contract.status === "ACTIVE" && days !== null && days <= 30 && (
              <p className={days >= 0 ? "text-xs font-medium text-warning-text" : "text-xs font-medium text-danger-text"}>
                {days >= 0 ? `Sắp hết hạn (${days} ngày)` : `Đã quá hạn (${Math.abs(days)} ngày)`}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "monthlyRent",
      header: "Tiền thuê / tháng",
      align: "right",
      cell: (contract) => <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(contract.monthlyRent)}</span>,
    },
    {
      key: "deposit",
      header: "Tiền cọc",
      align: "right",
      cell: (contract) => <span className="whitespace-nowrap">{formatCurrency(contract.deposit)}</span>,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (contract) => (
        <div className="min-w-0">
          <Badge tone={CONTRACT_STATUS_TONE[contract.status]}>{CONTRACT_STATUS_LABEL[contract.status]}</Badge>
          {contract.status === "TERMINATED" && contract.terminatedReason && (
            <p className="mt-1 max-w-48 text-xs text-muted" title={contract.terminatedReason}>
              Lý do: {contract.terminatedReason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      align: "right",
      cell: (contract) =>
        contract.status === "ACTIVE" ? (
          <RowActions>
            <ActionButton
              icon={<Icon name="edit" className="h-3.5 w-3.5" />}
              onClick={() => setContractModal({ mode: "edit", contract })}
            >
              Sửa
            </ActionButton>
            <ActionButton
              onClick={() => {
                setEndError(null);
                setEndTarget(contract);
              }}
            >
              Kết thúc
            </ActionButton>
            <ActionButton
              tone="danger"
              onClick={() => {
                setTerminateError(null);
                setTerminateReason("");
                setTerminateTarget(contract);
              }}
            >
              Chấm dứt
            </ActionButton>
          </RowActions>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  const countValue = (list: { pagination: { total: number } | null; isLoading: boolean }) =>
    list.isLoading ? "…" : (list.pagination?.total ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Người thuê & hợp đồng"
        description="Quản lý thông tin khách thuê, thời hạn hợp đồng và tiền đặt cọc của nhà trọ."
        actions={
          canCreate ? (
            tab === "renters" ? (
              <Button onClick={() => setRenterModal({ mode: "create", renter: null })}>
                <Icon name="add" className="h-4 w-4" />
                Thêm người thuê
              </Button>
            ) : (
              <Button onClick={() => setContractModal({ mode: "create", contract: null })}>
                <Icon name="add" className="h-4 w-4" />
                Tạo hợp đồng
              </Button>
            )
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Người thuê" value={countValue(totalRenters)} />
        <KpiCard label="Hợp đồng" value={countValue(totalContracts)} />
        <KpiCard label="Hiệu lực" value={countValue(activeContractCount)} tone="success" />
        <KpiCard
          label="Sắp hết hạn (< 30 ngày)"
          value={activeContracts.isLoading ? "…" : expiringSoon}
          tone={expiringSoon > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Tổng tiền cọc"
          value={activeContracts.isLoading ? "…" : formatCurrency(totalDeposit)}
        />
      </div>

      <Tabs
        items={[
          { id: "renters", label: "Người thuê" },
          { id: "contracts", label: "Hợp đồng" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "renters" && (
        <div className="space-y-3">
          <FilterBar>
            <SearchInput
              value={renterSearch}
              onChange={(value) => {
                setRenterSearch(value);
                setRenterPage(1);
              }}
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              className="sm:w-80"
            />
            <div className="w-full sm:w-52">
              <Select
                aria-label="Lọc trạng thái người thuê"
                value={renterStatus}
                onChange={(event) => {
                  setRenterStatus(event.target.value);
                  setRenterPage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="LOCKED">Đã khóa</option>
              </Select>
            </div>
          </FilterBar>
          <DataTable
            columns={renterColumns}
            rows={rentersList.rows}
            rowKey={(renter) => renter.id}
            isLoading={rentersList.isLoading}
            error={rentersList.error}
            onRetry={() => void rentersList.mutate()}
            pagination={rentersList.pagination}
            onPageChange={setRenterPage}
            emptyTitle="Chưa có người thuê nào"
            emptyDescription="Thêm người thuê để gửi lời mời đặt mật khẩu và tạo hợp đồng."
            emptyIcon={<Icon name="manage_accounts" className="h-5 w-5" />}
          />
        </div>
      )}

      {tab === "contracts" && (
        <div className="space-y-3">
          <FilterBar>
            <div className="w-full sm:w-56">
              <Select
                aria-label="Lọc trạng thái hợp đồng"
                value={contractStatus}
                onChange={(event) => {
                  setContractStatus(event.target.value);
                  setContractPage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hiệu lực</option>
                <option value="ENDED">Đã kết thúc</option>
                <option value="TERMINATED">Chấm dứt</option>
              </Select>
            </div>
            <div className="w-full sm:w-56">
              <Select
                aria-label="Lọc theo nhà trọ"
                value={contractPropertyId}
                onChange={(event) => {
                  setContractPropertyId(event.target.value);
                  setContractPage(1);
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
          </FilterBar>
          <DataTable
            columns={contractColumns}
            rows={contractsList.rows}
            rowKey={(contract) => contract.id}
            isLoading={contractsList.isLoading}
            error={contractsList.error}
            onRetry={() => void contractsList.mutate()}
            pagination={contractsList.pagination}
            onPageChange={setContractPage}
            emptyTitle="Chưa có hợp đồng nào"
            emptyDescription="Tạo hợp đồng để ghi nhận khách thuê và tự động chuyển phòng sang trạng thái đang thuê."
            emptyIcon={<Icon name="badge" className="h-5 w-5" />}
          />
        </div>
      )}

      {renterModal && (
        <RenterFormModal
          key={`${renterModal.mode}-${renterModal.renter?.id ?? "new"}`}
          mode={renterModal.mode}
          renter={renterModal.renter}
          open
          onClose={() => setRenterModal(null)}
          onSaved={refreshAll}
        />
      )}

      {contractModal && (
        <ContractFormModal
          key={`${contractModal.mode}-${contractModal.contract?.id ?? "new"}`}
          mode={contractModal.mode}
          contract={contractModal.contract}
          rooms={allRooms.rows}
          renters={allRenters.rows}
          properties={allProperties.rows}
          open
          onClose={() => setContractModal(null)}
          onSaved={refreshAll}
        />
      )}

      <ConfirmDialog
        open={inviteTarget !== null}
        title="Gửi lại lời mời"
        confirmLabel="Gửi lại lời mời"
        loading={inviteBusy}
        onCancel={() => setInviteTarget(null)}
        onConfirm={() => void confirmInvite()}
        message={
          <>
            <p>
              Gửi lại email mời đặt mật khẩu tới{" "}
              <span className="font-semibold">{inviteTarget?.email}</span>? Token mời cũ sẽ bị vô hiệu
              hóa.
            </p>
            {inviteError && (
              <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
                {inviteError}
              </p>
            )}
          </>
        }
      />

      <ConfirmDialog
        open={endTarget !== null}
        title="Kết thúc hợp đồng"
        confirmLabel="Kết thúc hợp đồng"
        loading={endBusy}
        onCancel={() => setEndTarget(null)}
        onConfirm={() => void confirmEnd()}
        message={
          <>
            <p>
              Hợp đồng của phòng{" "}
              <span className="font-semibold">
                {roomById.get(endTarget?.roomId ?? "")?.roomCode ?? ""}
              </span>{" "}
              sẽ kết thúc theo kỳ và phòng trở lại trạng thái còn trống.
            </p>
            {endError && (
              <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">{endError}</p>
            )}
          </>
        }
      />

      <FormModal
        open={terminateTarget !== null}
        onClose={() => setTerminateTarget(null)}
        title="Chấm dứt hợp đồng"
        description="Chấm dứt sớm hợp đồng đang hiệu lực. Phòng sẽ trở lại trạng thái còn trống."
        submitLabel="Chấm dứt hợp đồng"
        submitting={terminateBusy}
        error={terminateError}
        onSubmit={(event) => {
          event.preventDefault();
          void confirmTerminate();
        }}
      >
        <Field label="Lý do chấm dứt" htmlFor="terminate-reason" hint="Không bắt buộc, tối đa 500 ký tự">
          <Textarea
            id="terminate-reason"
            value={terminateReason}
            onChange={(event) => setTerminateReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ví dụ: Người thuê vi phạm nội quy..."
          />
        </Field>
      </FormModal>
    </div>
  );
}
