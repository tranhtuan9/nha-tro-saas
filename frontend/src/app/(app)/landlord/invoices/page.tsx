"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  apiFetcher,
  cancelInvoice,
  createInvoice,
  getActiveServices,
  getMeterSheet,
  previewInvoice,
  type InvoiceListParams,
} from "@/lib/api";
import { getApiErrorMessage, notifyApp } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, SearchInput } from "@/components/ui/FilterBar";
import { Field, Select, TextInput } from "@/components/ui/form";
import { KpiCard } from "@/components/ui/KpiCard";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton, RowActions } from "@/components/ui/RowActions";
import { useAuth } from "@/lib/auth-context";
import {
  currentBillingMonth,
  formatBillingMonth,
  formatCurrency,
  formatDate,
} from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type {
  Contract,
  CreateInvoiceInput,
  InvoiceDetail,
  InvoiceListItem,
  InvoicePreview,
  InvoiceStatus,
  InvoiceSummary,
  Property,
  Renter,
  Room,
  ServiceItem,
} from "@/lib/types";

const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  CANCELLED: "Đã hủy",
};

const INVOICE_STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  UNPAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

function useDebouncedValue(value: string, delayMs = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function parseQuantity(value: string): number | null {
  const raw = value.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!raw) return null;
  const quantity = Number(raw);
  return Number.isFinite(quantity) ? quantity : null;
}

interface InvoiceCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<unknown>;
}

function InvoiceCreateModal({ open, onClose, onCreated }: InvoiceCreateModalProps) {
  const [propertyId, setPropertyId] = useState("");
  const [contractId, setContractId] = useState("");
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth());
  const [dueDate, setDueDate] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const properties = usePagedList<Property>("/properties", { pageSize: 100 });
  const activeContracts = usePagedList<Contract>("/contracts", {
    pageSize: 100,
    status: "ACTIVE",
    propertyId: propertyId || undefined,
  });
  const rooms = usePagedList<Room>("/rooms", { pageSize: 100 });
  const renters = usePagedList<Renter>("/renters", { pageSize: 100 });

  const { data: servicesEnvelope } = useSWR(
    propertyId ? ["/services", propertyId] : null,
    () => getActiveServices(propertyId).then((data) => ({ data })),
    { revalidateOnFocus: false },
  );
  const services = useMemo<ServiceItem[]>(() => servicesEnvelope?.data ?? [], [servicesEnvelope]);

  const { data: meterSheet, isLoading: meterLoading } = useSWR(
    propertyId && billingMonth ? ["/meter-readings/sheet", propertyId, billingMonth] : null,
    () => getMeterSheet(propertyId, billingMonth),
    { revalidateOnFocus: false },
  );

  const activeProperties = useMemo(
    () => properties.rows.filter((property) => property.isActive),
    [properties.rows],
  );
  const roomById = useMemo(() => new Map(rooms.rows.map((room) => [room.id, room])), [rooms.rows]);
  const renterById = useMemo(
    () => new Map(renters.rows.map((renter) => [renter.id, renter])),
    [renters.rows],
  );
  const contractById = useMemo(
    () => new Map(activeContracts.rows.map((contract) => [contract.id, contract])),
    [activeContracts.rows],
  );

  const selectedContract = contractId ? contractById.get(contractId) : undefined;

  const meterRow = useMemo(() => {
    if (!selectedContract || !meterSheet) return null;
    return meterSheet.data.find((row) => row.roomId === selectedContract.roomId) ?? null;
  }, [selectedContract, meterSheet]);

  const serviceInputs = useMemo<CreateInvoiceInput["services"]>(() => {
    const items: CreateInvoiceInput["services"] = [];
    for (const service of services) {
      const raw = quantities[service.id];
      if (raw === undefined || raw.trim() === "") continue;
      const quantity = parseQuantity(raw);
      if (quantity !== null && quantity > 0) {
        items.push({ serviceId: service.id, quantity });
      }
    }
    return items;
  }, [services, quantities]);

  function buildInput(): CreateInvoiceInput {
    return {
      contractId,
      billingMonth,
      services: serviceInputs,
      ...(dueDate ? { dueDate } : {}),
    };
  }

  async function handlePreview() {
    if (!contractId) {
      setError("Vui lòng chọn phòng và hợp đồng");
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const result = await previewInvoice(buildInput());
      setPreview(result);
    } catch (err) {
      setPreview(null);
      setError(getApiErrorMessage(err));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) {
      setError("Vui lòng xem trước hóa đơn trước khi phát hành");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createInvoice(buildInput());
      notifyApp({ tone: "success", message: "Đã lập hóa đơn thành công" });
      await onCreated();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const noMeterReading = Boolean(selectedContract) && !meterLoading && meterRow !== null && !meterRow.current;

  return (
    <Modal
      open={open}
      onClose={submitting || previewing ? () => undefined : onClose}
      title="Lập hóa đơn"
      description="Tiền phòng, điện nước và dịch vụ được tính theo chỉ số đã ghi nhận và đơn giá hiện hành."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting || previewing}>
            Hủy
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handlePreview()}
            loading={previewing}
            disabled={submitting}
          >
            <Icon name="refresh" className="h-4 w-4" />
            Xem trước
          </Button>
          <Button
            type="submit"
            form="invoice-create-form"
            loading={submitting}
            disabled={!preview || previewing}
          >
            Phát hành hóa đơn
          </Button>
        </>
      }
    >
      <form id="invoice-create-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {noMeterReading && (
          <Alert tone="warning">
            Phòng này chưa ghi nhận chỉ số điện nước cho kỳ {formatBillingMonth(billingMonth)}. Vui lòng
            ghi chỉ số trước khi lập hóa đơn.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nhà trọ" htmlFor="invoice-property" required>
            <Select
              id="invoice-property"
              value={propertyId}
              onChange={(event) => {
                setPropertyId(event.target.value);
                setContractId("");
                setQuantities({});
                setPreview(null);
              }}
            >
              <option value="">Chọn nhà trọ</option>
              {activeProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Phòng & hợp đồng" htmlFor="invoice-contract" required>
            <Select
              id="invoice-contract"
              value={contractId}
              onChange={(event) => {
                setContractId(event.target.value);
                setQuantities({});
                setPreview(null);
              }}
              disabled={!propertyId}
            >
              <option value="">Chọn hợp đồng</option>
              {activeContracts.rows.map((contract) => {
                const room = roomById.get(contract.roomId);
                const renter = renterById.get(contract.renterId);
                return (
                  <option key={contract.id} value={contract.id}>
                    {room?.roomCode ?? "Phòng"} — {renter?.fullName ?? "Người thuê"}
                  </option>
                );
              })}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kỳ hóa đơn" htmlFor="invoice-month" required>
            <TextInput
              id="invoice-month"
              type="month"
              value={billingMonth}
              onChange={(event) => {
                setBillingMonth(event.target.value);
                setPreview(null);
              }}
            />
          </Field>
          <Field label="Hạn thanh toán" htmlFor="invoice-due">
            <TextInput
              id="invoice-due"
              type="date"
              value={dueDate}
              onChange={(event) => {
                setDueDate(event.target.value);
                setPreview(null);
              }}
            />
          </Field>
        </div>

        {selectedContract && (
          <div className="rounded-lg border border-border bg-canvas p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Chỉ số điện nước đã ghi nhận
            </p>
            {meterLoading ? (
              <p className="mt-1 text-muted">Đang tải chỉ số…</p>
            ) : meterRow?.current ? (
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                <p className="text-ink">
                  Điện: <span className="font-semibold">{meterRow.current.electricityUsage} kWh</span>
                </p>
                <p className="text-ink">
                  Nước: <span className="font-semibold">{meterRow.current.waterUsage} m³</span>
                </p>
              </div>
            ) : (
              <p className="mt-1 text-warning-text">Chưa có chỉ số cho kỳ này.</p>
            )}
          </div>
        )}

        {propertyId && (
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Dịch vụ áp dụng
            </p>
            {services.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted">
                Nhà trọ chưa có dịch vụ nào đang hoạt động.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{service.name}</p>
                      <p className="text-xs text-muted">
                        {formatCurrency(service.unitPrice)}/{service.unit}
                      </p>
                    </div>
                    <div className="w-28">
                      <TextInput
                        inputMode="decimal"
                        aria-label={`Số lượng ${service.name}`}
                        placeholder="SL"
                        value={quantities[service.id] ?? ""}
                        onChange={(event) => {
                          setQuantities((prev) => ({ ...prev, [service.id]: event.target.value }));
                          setPreview(null);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {preview && (
          <div className="rounded-lg border border-border">
            <div className="border-b border-border bg-surface-container px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Hóa đơn tạm tính
            </div>
            <div className="space-y-1.5 px-3 py-3 text-sm">
              <SummaryRow label="Tiền phòng" value={preview.rentAmount} />
              <SummaryRow label="Tiền điện" value={preview.electricityAmount} />
              <SummaryRow label="Tiền nước" value={preview.waterAmount} />
              <SummaryRow label="Dịch vụ" value={preview.serviceAmount} />
              {preview.lineItems.map((item) => (
                <div key={item.serviceId} className="flex justify-between pl-4 text-xs text-muted">
                  <span>
                    {item.serviceName} ({item.quantity} {item.unit})
                  </span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold text-ink">
                <span>Tổng cộng</span>
                <span>{formatCurrency(preview.totalAmount)}</span>
              </div>
              <p className="text-xs text-muted">
                Hạn thanh toán: {formatDate(preview.dueDate)}
              </p>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{formatCurrency(value)}</span>
    </div>
  );
}

interface InvoiceDetailModalProps {
  invoiceId: string | null;
  onClose: () => void;
}

function InvoiceDetailModal({ invoiceId, onClose }: InvoiceDetailModalProps) {
  const { data, isLoading } = useSWR(
    invoiceId ? ["/invoices", invoiceId] : null,
    () => apiFetcher<InvoiceDetail>(`/invoices/${invoiceId}`).then((res) => res.data),
    { revalidateOnFocus: false },
  );

  return (
    <Modal
      open={invoiceId !== null}
      onClose={onClose}
      title="Chi tiết hóa đơn"
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      {isLoading || !data ? (
        <p className="text-sm text-muted">Đang tải chi tiết…</p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">
                Phòng {data.room.roomCode} · {data.room.propertyName}
              </p>
              <p className="text-xs text-muted">{data.renter.fullName}</p>
            </div>
            <Badge tone={INVOICE_STATUS_TONE[data.status]} dot>
              {INVOICE_STATUS_LABEL[data.status]}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted">
            <p>Kỳ: {formatBillingMonth(data.billingMonth)}</p>
            <p>Ngày lập: {formatDate(data.issueDate)}</p>
            <p>Hạn thanh toán: {formatDate(data.dueDate)}</p>
            {data.paidAt && <p>Đã trả: {formatDate(data.paidAt)}</p>}
          </div>
          <div className="rounded-lg border border-border">
            <div className="space-y-1.5 px-3 py-3">
              <SummaryRow label="Tiền phòng" value={data.rentAmount} />
              <SummaryRow label="Tiền điện" value={data.electricityAmount} />
              <SummaryRow label="Tiền nước" value={data.waterAmount} />
              <SummaryRow label="Dịch vụ" value={data.serviceAmount} />
              {data.lineItems.map((item) => (
                <div key={item.id} className="flex justify-between pl-4 text-xs text-muted">
                  <span>
                    {item.serviceName} ({item.quantity} {item.unit})
                  </span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold text-ink">
                <span>Tổng cộng</span>
                <span>{formatCurrency(data.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function InvoicesPage() {
  const { canCreate } = useAuth();

  const [month, setMonth] = useState(currentBillingMonth());
  const [status, setStatus] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const listQuery: InvoiceListParams = {
    page,
    pageSize: 10,
    billingMonth: month || undefined,
    status: status || undefined,
    propertyId: propertyId || undefined,
  };
  const invoicesList = usePagedList<InvoiceListItem>("/invoices", listQuery);

  const properties = usePagedList<Property>("/properties", { pageSize: 100 });
  const summary = useSWR(
    ["/invoices/summary", month],
    () =>
      apiFetcher<InvoiceSummary>(`/invoices/summary${month ? `?month=${month}` : ""}`).then(
        (res) => res.data,
      ),
    { revalidateOnFocus: false },
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<InvoiceListItem | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();
    if (!keyword) return invoicesList.rows;
    return invoicesList.rows.filter((invoice) => {
      const code = `${invoice.room.roomCode} ${invoice.room.propertyName} ${invoice.renter.fullName}`;
      return code.toLowerCase().includes(keyword);
    });
  }, [invoicesList.rows, debouncedSearch]);

  async function refreshAll() {
    await Promise.all([invoicesList.mutate(), summary.mutate()]);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      await cancelInvoice(cancelTarget.id);
      notifyApp({ tone: "success", message: "Đã hủy hóa đơn" });
      setCancelTarget(null);
      await refreshAll();
    } catch (err) {
      setCancelError(getApiErrorMessage(err));
    } finally {
      setCancelBusy(false);
    }
  }

  const summaryData = summary.data;

  const columns: Column<InvoiceListItem>[] = [
    {
      key: "room",
      header: "Phòng",
      cell: (invoice) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{invoice.room.roomCode}</p>
          <p className="text-xs text-muted">{invoice.room.propertyName}</p>
        </div>
      ),
    },
    {
      key: "renter",
      header: "Người thuê",
      cell: (invoice) => <span className="text-ink">{invoice.renter.fullName}</span>,
    },
    {
      key: "billingMonth",
      header: "Kỳ",
      cell: (invoice) => <span>{formatBillingMonth(invoice.billingMonth)}</span>,
    },
    {
      key: "total",
      header: "Tổng tiền",
      align: "right",
      cell: (invoice) => (
        <span className="whitespace-nowrap font-medium text-ink">
          {formatCurrency(invoice.totalAmount)}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Hạn thanh toán",
      align: "right",
      cell: (invoice) => <span className="whitespace-nowrap">{formatDate(invoice.dueDate)}</span>,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (invoice) => (
        <Badge tone={INVOICE_STATUS_TONE[invoice.status]} dot>
          {INVOICE_STATUS_LABEL[invoice.status]}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      align: "right",
      cell: (invoice) => (
        <RowActions>
          <ActionButton
            icon={<Icon name="eye" className="h-3.5 w-3.5" />}
            onClick={() => setDetailId(invoice.id)}
          >
            Xem
          </ActionButton>
          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
            <ActionButton
              tone="danger"
              onClick={() => {
                setCancelError(null);
                setCancelTarget(invoice);
              }}
            >
              Hủy
            </ActionButton>
          )}
        </RowActions>
      ),
    },
  ];

  const summaryValue = (value: string | undefined, count: number | undefined) =>
    summary.isLoading ? "…" : `${formatCurrency(value)} · ${count ?? 0}`;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Tài chính / Sổ Hóa đơn"
        title="Quản lý hóa đơn"
        description="Lập hóa đơn hàng tháng và theo dõi trạng thái thanh toán của từng phòng."
        actions={
          canCreate ? (
            <Link href="/landlord/invoices/new">
              <Button className="h-9 px-3.5 text-xs font-semibold">
                <Icon name="add" className="h-4 w-4" />
                Lập hóa đơn
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Đã phát hành"
          value={summaryValue(summaryData?.issuedTotal, summaryData?.issuedCount)}
          hint="Tổng hóa đơn trong kỳ"
        />
        <KpiCard
          label="Đã thu"
          value={summaryValue(summaryData?.paidTotal, summaryData?.paidCount)}
          hint="Hóa đơn đã thanh toán"
          tone="success"
        />
        <KpiCard
          label="Chưa thu"
          value={summaryValue(summaryData?.unpaidTotal, summaryData?.unpaidCount)}
          hint="Hóa đơn còn chờ thanh toán"
          tone="warning"
        />
        <KpiCard
          label="Quá hạn"
          value={summaryValue(summaryData?.overdueTotal, summaryData?.overdueCount)}
          hint="Hóa đơn đã quá hạn"
          tone="danger"
        />
      </div>

      <div className="space-y-3">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Tìm theo phòng, nhà trọ hoặc người thuê..."
            className="sm:w-80"
          />
          <div className="w-full sm:w-44">
            <TextInput
              type="month"
              aria-label="Lọc theo kỳ"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              aria-label="Lọc theo trạng thái"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="UNPAID">Chưa thanh toán</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="OVERDUE">Quá hạn</option>
              <option value="CANCELLED">Đã hủy</option>
            </Select>
          </div>
          <div className="w-full sm:w-52">
            <Select
              aria-label="Lọc theo nhà trọ"
              value={propertyId}
              onChange={(event) => {
                setPropertyId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả nhà trọ</option>
              {properties.rows
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
          columns={columns}
          rows={filteredRows}
          rowKey={(invoice) => invoice.id}
          isLoading={invoicesList.isLoading}
          error={invoicesList.error}
          onRetry={() => void invoicesList.mutate()}
          pagination={debouncedSearch ? null : invoicesList.pagination}
          onPageChange={setPage}
          emptyTitle="Chưa có hóa đơn nào"
          emptyDescription="Lập hóa đơn cho phòng đang thuê để bắt đầu theo dõi thanh toán."
          emptyIcon={<Icon name="receipt_long" className="h-5 w-5" />}
        />
      </div>

      {createOpen && (
        <InvoiceCreateModal
          open
          onClose={() => setCreateOpen(false)}
          onCreated={refreshAll}
        />
      )}

      {detailId && <InvoiceDetailModal invoiceId={detailId} onClose={() => setDetailId(null)} />}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Hủy hóa đơn"
        tone="danger"
        confirmLabel="Hủy hóa đơn"
        loading={cancelBusy}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void confirmCancel()}
        message={
          <>
            <p>
              Hóa đơn phòng{" "}
              <span className="font-semibold">{cancelTarget?.room.roomCode}</span> kỳ{" "}
              {formatBillingMonth(cancelTarget?.billingMonth)} sẽ bị hủy và không thể khôi phục.
            </p>
            {cancelError && (
              <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
                {cancelError}
              </p>
            )}
          </>
        }
      />
    </div>
  );
}
