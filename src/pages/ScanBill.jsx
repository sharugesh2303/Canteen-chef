import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  QrCode,
  Upload,
  ArrowLeft,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:10000/api";

export default function ScanBill() {
  const navigate = useNavigate();
  const [qrData, setQrData] = useState("");
  const [billNoInput, setBillNoInput] = useState("");
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);
  const [billDetails, setBillDetails] = useState(null);
  const [deliveringIndex, setDeliveringIndex] = useState(null);
  const [delivering, setDelivering] = useState(false);
  const [deliverError, setDeliverError] = useState("");

  const qrInstanceRef = useRef(null);

  /* ================= STATUS HELPERS ================= */
  const getOrderStatus = (order) => String(order?.status || "").toUpperCase();
  const isReadyBill = (order) => getOrderStatus(order) === "READY";
  const isDeliveredBill = (order) => getOrderStatus(order) === "DELIVERED";
  const canSelectItems = (order) => isReadyBill(order);

  const allItemsSelectedDelivered = (order) => {
    const items = order?.items || [];
    return items.length > 0 && items.every((it) => it.delivered === true);
  };

  const overlayMessageForStatus = (order) => {
    if (!order) return null;
    const st = getOrderStatus(order);

    if (st === "DELIVERED") {
      return {
        title: "⚠️ Already Delivered",
        desc: order.message || "This bill is already delivered.",
        icon: <CheckCircle2 className="w-6 h-6 text-green-400" />,
        color: "border-green-600 bg-green-900/40 text-green-200",
      };
    }

    if (st === "PLACED") {
      return {
        title: "⏳ Not Ready Yet",
        desc: order.message || "Order is not ready for delivery.",
        icon: <AlertTriangle className="w-6 h-6 text-yellow-400" />,
        color: "border-yellow-600 bg-yellow-900/40 text-yellow-200",
      };
    }

    return null; // READY
  };

  /* ================= SCANNER ================= */
  const stopScanner = async () => {
    if (qrInstanceRef.current && qrInstanceRef.current.isScanning) {
      try {
        await qrInstanceRef.current.stop();
        qrInstanceRef.current.clear();
        qrInstanceRef.current = null;
      } catch {}
    }
  };

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      await stopScanner();
      if (!isScanning || !isMounted) return;

      setTimeout(async () => {
        try {
          const scanner = new Html5Qrcode("qr-reader");
          qrInstanceRef.current = scanner;

          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              if (isMounted) {
                setQrData(decodedText);
                setIsScanning(false);
              }
            }
          );
        } catch {
          if (isMounted) setError("❌ Camera access failed. Try manual input.");
        }
      }, 300);
    };

    startScanner();
    return () => { isMounted = false; stopScanner(); };
  }, [isScanning]);

  /* ================= API CALLS ================= */
  const fetchBill = async (num) => {
    setLoadingBill(true);
    setError("");
    try {
      const res = await axios.get(`${API_BASE_URL}/orders/scan/${num}`);
      setBillDetails(res.data);
    } catch {
      setError("❌ Bill not found.");
    } finally {
      setLoadingBill(false);
    }
  };

  useEffect(() => {
    if (!qrData) return;
    const parts = qrData.split("/api/orders/bill/");
    const num = parts.length === 2 ? parts[1].trim() : null;
    if (num) fetchBill(num);
    else setError("❌ Invalid QR Content.");
  }, [qrData]);

  const handleSearch = () => {
    const input = billNoInput.trim();
    if (!input) return;
    const normalized = input.toUpperCase();
    setIsScanning(false);
    fetchBill(normalized);
  };

  const resetAll = () => {
    setQrData("");
    setBillNoInput("");
    setBillDetails(null);
    setError("");
    setDeliverError("");
    setIsScanning(true);
  };

  /* ================= DELIVERY ================= */
  const getAuth = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("chefToken")}` }
  });

  const deliverItem = async (idx) => {
    if (deliveringIndex !== null || !canSelectItems(billDetails)) return;
    setDeliveringIndex(idx);
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/orders/admin/${billDetails.billNumber}/items/${idx}/deliver`,
        {},
        getAuth()
      );
      setBillDetails(res.data.order);
    } catch {
      setDeliverError("❌ Failed to deliver item.");
    } finally {
      setDeliveringIndex(null);
    }
  };

  const markBillDelivered = async () => {
    setDelivering(true);
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/orders/admin/${billDetails.billNumber}/mark-delivered`,
        {},
        getAuth()
      );
      setBillDetails(res.data.order);
    } catch {
      setDeliverError("❌ Mark delivered failed.");
    } finally {
      setDelivering(false);
    }
  };

  const overlay = overlayMessageForStatus(billDetails);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 mb-4 text-orange-400">
          <ArrowLeft size={18}/> Back
        </button>

        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <QrCode className="text-indigo-400"/> Bill Scanner
        </h1>

        {/* Manual Search */}
        <div className="bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700 flex gap-2">
          <input
            value={billNoInput}
            onChange={e => setBillNoInput(e.target.value)}
            placeholder="Enter Bill Number"
            className="flex-1 bg-slate-900 border border-slate-600 p-2 rounded-lg"
          />
          <button onClick={handleSearch} className="bg-green-600 px-4 py-2 rounded-lg font-bold">
            <Search size={20}/>
          </button>
        </div>

        {isScanning && <div id="qr-reader" className="w-full rounded-lg bg-black min-h-[250px]" />}

        {loadingBill && <p className="text-center text-orange-400 animate-pulse">Fetching Bill...</p>}

        {billDetails && !loadingBill && (
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            {overlay && (
              <div className={`p-3 rounded-lg border mb-4 flex gap-2 ${overlay.color}`}>
                {overlay.icon}
                <div>
                  <p className="font-bold">{overlay.title}</p>
                  <p className="text-xs">{overlay.desc}</p>
                </div>
              </div>
            )}

            <div className="bg-white text-black p-4 rounded-lg relative">
              <h2 className="text-center font-bold border-b pb-2">🧾 JJ CANTEEN</h2>
              <p className="text-xs py-2"><b>Bill:</b> {billDetails.billNumber}</p>
              <p className="text-xs"><b>Status:</b> {billDetails.status}</p>

              <table className="w-full text-xs border-t mt-2">
                <tbody>
                  {isReadyBill(billDetails) ? (
                    billDetails.items.map((it, i) => (
                      <tr key={i}>
                        <td>
                          <button
                            disabled={it.delivered}
                            onClick={() => deliverItem(i)}
                            className="w-6 h-6 bg-orange-500 text-white rounded"
                          >
                            {it.delivered ? "✓" : "•"}
                          </button>
                        </td>
                        <td>{it.name}</td>
                        <td>{it.quantity}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center p-2 text-gray-500">
                        No items to display
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {allItemsSelectedDelivered(billDetails) && !isDeliveredBill(billDetails) && (
                <button onClick={markBillDelivered} className="w-full bg-green-600 text-white py-2 mt-4 rounded-lg font-bold">
                  {delivering ? "Marking..." : "Mark Fully Delivered"}
                </button>
              )}
            </div>

            <button onClick={resetAll} className="w-full bg-slate-700 py-2 mt-4 rounded-lg font-bold flex justify-center gap-2">
              <RefreshCw size={18}/> Scan Another
            </button>
          </div>
        )}

        {error && <p className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-lg">{error}</p>}
        {deliverError && <p className="mt-2 text-red-400 text-sm">{deliverError}</p>}
      </div>
    </div>
  );
}
