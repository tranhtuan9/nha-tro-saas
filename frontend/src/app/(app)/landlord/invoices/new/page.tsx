"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  createInvoice,
  getActiveServices,
  getApiErrorMessage,
  getMeterSheet,
  notifyApp,
  previewInvoice,
} from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/form";
import {
  currentBillingMonth,
  formatBillingMonth,
  formatCurrency,
} from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type {
  Contract,
  CreateInvoiceInput,
  InvoicePreview,
  Property,
  Renter,
  Room,
  ServiceItem,
} from "@/lib/types";

export default function CreateInvoicePage() {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState("");
  const [contractId, setContractId] = useState("");
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth());
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
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

  const activeProperties = useMemo(
    () => properties.rows.filter((property) => property.isActive),
    [properties.rows],
  );

  // Mặc định chọn nhà trọ đầu tiên
  useEffect(() => {
    if (!propertyId && activeProperties.length > 0) {
      setPropertyId(activeProperties[0].id);
    }
  }, [activeProperties, propertyId]);

  const { data: servicesEnvelope } = useSWR(
    propertyId ? ["/services", propertyId] : null,
    () => getActiveServices(propertyId).then((data) => ({ data })),
    { revalidateOnFocus: false },
  );
  const services = useMemo<ServiceItem[]>(() => servicesEnvelope?.data ?? [], [servicesEnvelope]);

  // Khởi tạo các dịch vụ mặc định được chọn với số lượng 1
  useEffect(() => {
    if (services.length > 0) {
      const initialSelected: Record<string, boolean> = {};
      const initialQty: Record<string, number> = {};
      services.forEach((s) => {
        initialSelected[s.id] = true;
        initialQty[s.id] = 1;
      });
      setSelectedServices(initialSelected);
      setQuantities(initialQty);
    }
  }, [services]);

  const { data: meterSheet, isLoading: meterLoading } = useSWR(
    propertyId && billingMonth ? ["/meter-readings/sheet", propertyId, billingMonth] : null,
    () => getMeterSheet(propertyId, billingMonth),
    { revalidateOnFocus: false },
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

  // Mặc định chọn hợp đồng/phòng đầu tiên của nhà trọ
  useEffect(() => {
    if (activeContracts.rows.length > 0 && (!contractId || !activeContracts.rows.some((c) => c.id === contractId))) {
      setContractId(activeContracts.rows[0].id);
    }
  }, [activeContracts.rows, contractId]);

  const selectedContract = contractId ? contractById.get(contractId) : undefined;

  const meterRow = useMemo(() => {
    if (!selectedContract || !meterSheet) return null;
    return meterSheet.data.find((row) => row.roomId === selectedContract.roomId) ?? null;
  }, [selectedContract, meterSheet]);

  const serviceInputs = useMemo<CreateInvoiceInput["services"]>(() => {
    const items: CreateInvoiceInput["services"] = [];
    services.forEach((s) => {
      if (selectedServices[s.id]) {
        items.push({
          serviceId: s.id,
          quantity: quantities[s.id] ?? 1,
        });
      }
    });
    return items;
  }, [services, selectedServices, quantities]);

  // Tự động gọi preview khi các thông tin thay đổi
  useEffect(() => {
    if (!contractId || !billingMonth) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    async function loadPreview() {
      setPreviewing(true);
      setError(null);
      try {
        const data = await previewInvoice({
          contractId,
          billingMonth,
          services: serviceInputs,
        });
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) {
          setPreview(null);
          setError(getApiErrorMessage(err));
        }
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }
    const timer = setTimeout(loadPreview, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [contractId, billingMonth, serviceInputs]);

  async function handleConfirmCreate() {
    if (!contractId || !billingMonth) {
      setError("Vui lòng chọn đầy đủ nhà trọ, phòng và kỳ hóa đơn");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createInvoice({
        contractId,
        billingMonth,
        services: serviceInputs,
      });
      notifyApp({ tone: "success", message: "Đã lập hóa đơn thành công" });
      router.push("/landlord/invoices");
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSubmitting(false);
    }
  }

  const toggleService = (id: string) => {
    setSelectedServices((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Trang chủ / Hóa đơn / Lập hóa đơn"
        title="Lập hóa đơn"
        description="Lập hóa đơn thu tiền phòng, điện nước và các phí dịch vụ hàng tháng."
      />

      {error && <Alert tone="error">{error}</Alert>}

      {/* Bố cục 2 cột Split-Screen chuẩn theo thiết kế (Ảnh 1) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* CỘT TRÁI (8 Cột): CÁC BƯỚC THIẾT LẬP */}
        <div className="lg:col-span-8 space-y-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          {/* 1. Chọn phòng và kỳ */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">1. Chọn phòng và kỳ</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nhà trọ</label>
                <Select
                  value={propertyId}
                  onChange={(e) => {
                    setPropertyId(e.target.value);
                    setContractId("");
                  }}
                >
                  <option value="">-- Chọn nhà trọ --</option>
                  {activeProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phòng</label>
                <Select
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  disabled={!propertyId || activeContracts.rows.length === 0}
                >
                  <option value="">-- Chọn phòng --</option>
                  {activeContracts.rows.map((c) => {
                    const room = roomById.get(c.roomId);
                    const renter = renterById.get(c.renterId);
                    return (
                      <option key={c.id} value={c.id}>
                        Phòng {room?.roomCode ?? "—"} ({renter?.fullName ?? "Khách"})
                      </option>
                    );
                  })}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Kỳ hóa đơn</label>
                <Select
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                >
                  <option value={currentBillingMonth()}>{formatBillingMonth(currentBillingMonth())}</option>
                  <option value="2026-11">Kỳ 11/2026</option>
                  <option value="2026-09">Kỳ 09/2026</option>
                </Select>
              </div>
            </div>
          </section>

          {/* 2. Chỉ số điện nước đã ghi nhận */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">2. Chỉ số điện nước đã ghi nhận</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs text-slate-500 font-medium">Chỉ số điện:</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {meterLoading ? (
                    "Đang kiểm tra..."
                  ) : meterRow?.current ? (
                    `Điện: ${meterRow.previous?.electricityIndex ?? 0} → ${meterRow.current.electricityIndex} (${meterRow.current.electricityUsage} kWh)`
                  ) : (
                    <span className="text-amber-600 font-normal">Chưa chốt số kỳ này</span>
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs text-slate-500 font-medium">Chỉ số nước:</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {meterLoading ? (
                    "Đang kiểm tra..."
                  ) : meterRow?.current ? (
                    `Nước: ${meterRow.previous?.waterIndex ?? 0} → ${meterRow.current.waterIndex} (${meterRow.current.waterUsage} m³)`
                  ) : (
                    <span className="text-amber-600 font-normal">Chưa chốt số kỳ này</span>
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* 3. Dịch vụ áp dụng */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">3. Dịch vụ áp dụng</h2>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600">
                    <th className="w-12 px-4 py-3 text-center"></th>
                    <th className="px-4 py-3">Dịch vụ</th>
                    <th className="px-4 py-3">Đơn giá</th>
                    <th className="px-4 py-3">Số lượng</th>
                    <th className="px-4 py-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {services.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Nhà trọ chưa có dịch vụ nào đang hoạt động
                      </td>
                    </tr>
                  ) : (
                    services.map((s) => {
                      const isChecked = Boolean(selectedServices[s.id]);
                      const qty = quantities[s.id] ?? 1;
                      const subtotal = Number(s.unitPrice) * qty;

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleService(s.id)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-900">{s.name}</td>
                          <td className="px-4 py-3.5 text-slate-600">
                            {formatCurrency(s.unitPrice)} / {s.unit}
                          </td>
                          <td className="px-4 py-3.5">
                            <input
                              type="number"
                              min="1"
                              value={qty}
                              disabled={!isChecked}
                              onChange={(e) =>
                                setQuantities((prev) => ({
                                  ...prev,
                                  [s.id]: Math.max(1, Number(e.target.value) || 1),
                                }))
                              }
                              className="w-16 h-8 text-center rounded border border-slate-300 px-2 text-sm disabled:bg-slate-100"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                            {isChecked ? formatCurrency(subtotal) : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* CỘT PHẢI (4 Cột): HÓA ĐƠN TẠM TÍNH (STICKY PANEL) */}
        <div className="lg:col-span-4 sticky top-24">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Hóa đơn tạm tính
            </h3>

            {previewing ? (
              <div className="py-8 text-center text-xs text-slate-400">Đang tính toán lại...</div>
            ) : preview ? (
              <div className="space-y-3.5 text-sm">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Tiền phòng:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(preview.rentAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Tiền điện ({meterRow?.current?.electricityUsage ?? 0} kWh):</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(preview.electricityAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Tiền nước ({meterRow?.current?.waterUsage ?? 0} m³):</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(preview.waterAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Dịch vụ ({preview.lineItems.length}):</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(preview.serviceAmount)}</span>
                </div>

                <div className="border-t border-slate-200 pt-4 flex justify-between items-baseline">
                  <span className="font-bold text-slate-900 text-base">Tổng cộng:</span>
                  <span className="text-2xl font-extrabold text-blue-600">
                    {formatCurrency(preview.totalAmount)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Chưa có dữ liệu tạm tính. Vui lòng chọn nhà trọ và phòng.
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Link href="/landlord/invoices" className="flex-1">
                <Button variant="secondary" className="w-full h-10 text-sm">
                  Hủy
                </Button>
              </Link>
              <Button
                className="flex-1 h-10 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => void handleConfirmCreate()}
                disabled={!preview || previewing}
                loading={submitting}
              >
                Xác nhận tạo hóa đơn
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
