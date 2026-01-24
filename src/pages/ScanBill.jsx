import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  QrCode,
  Upload,
  ArrowLeft,
  Search,
  RefreshCw,
  CheckCircle2,
  Truck,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:10000";
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

  // Persistent reference to the scanner instance
  const qrInstanceRef = useRef(null);

  /* =========================================================
       ✅ HELPERS
  ========================================================= */
  const getOrderStatus = (order) => String(order?.orderStatus || "").toUpperCase();
  const isReadyBill = (order) => getOrderStatus(order) === "READY";
  const isDeliveredBill = (order) => getOrderStatus(order) === "DELIVERED";
  const canSelectItems = (order) => isReadyBill(order) && !isDeliveredBill(order);

  const allItemsSelectedDelivered = (order) => {
    const items = order?.items || [];
    return items.length > 0 && items.every((it) => it.delivered === true);
  };

  const overlayMessageForStatus = (order) => {
    const st = getOrderStatus(order);
    if (!order) return null;
    if (st === "DELIVERED") {
      return {
        title: "✅ Already Delivered",
        desc: "This bill is already delivered.",
        icon: <CheckCircle2 className="w-6 h-6 text-green-400" />,
        color: "border-green-600 bg-green-900/40 text-green-200",
      };
    }
    if (st === "READY") return null;
    return {
      title: `⚠️ Status: ${st}`,
      desc: "Only READY bills can be delivered.",
      icon: <Ban className="w-6 h-6 text-red-400" />,
      color: "border-red-600 bg-red-900/40 text-red-200",
    };
  };

  /* =========================================================
       ✅ SCANNER ENGINE (FIXED SPLIT-SCREEN)
  ========================================================= */
  const stopScanner = async () => {
    if (qrInstanceRef.current && qrInstanceRef.current.isScanning) {
      try {
        await qrInstanceRef.current.stop();
        qrInstanceRef.current.clear();
        qrInstanceRef.current = null;
      } catch (err) {
        console.warn("Scanner stop error:", err);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      // 1. Always stop existing scanner first
      await stopScanner();

      if (!isScanning || !isMounted) return;

      // 2. Small delay to ensure the DOM node #qr-reader is rendered and ready
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
                setIsScanning(false); // This triggers the cleanup via dependency array
              }
            },
            () => {} // Ignore frame errors
          );
        } catch (err) {
          console.error("Scanner Start Error:", err);
          if (isMounted) setError("❌ Camera access failed. Try manual input.");
        }
      }, 300); // 300ms buffer for React DOM stability
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isScanning]);

  /* =========================================================
       ✅ API CALLS
  ========================================================= */
  const fetchBillByQrNumber = async (num) => {
    setLoadingBill(true);
    setError("");
    try {
      const res = await axios.get(`${API_BASE_URL}/orders/details/${num}`);
      setBillDetails(res.data);
    } catch (e) {
      setError("❌ Bill not found.");
    } finally {
      setLoadingBill(false);
    }
  };

  const fetchBillByBillNumber = async (num) => {
    setLoadingBill(true);
    setError("");
    try {
      const res = await axios.get(`${API_BASE_URL}/orders/details-by-bill/${num}`);
      setBillDetails(res.data);
    } catch (e) {
      setError("❌ Invalid Bill Number.");
    } finally {
      setLoadingBill(false);
    }
  };

  useEffect(() => {
    if (!qrData) return;
    const parts = qrData.split("/api/orders/bill/");
    const num = parts.length === 2 ? parts[1].trim() : null;
    if (num) fetchBillByQrNumber(num);
    else setError("❌ Invalid QR Content.");
  }, [qrData]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (code) { setQrData(code.data); setIsScanning(false); }
        else setError("❌ No QR found in image.");
      };
    };
    reader.readAsDataURL(file);
  };

  const handleSearch = () => {
    const input = billNoInput.trim();
    if (!input) return;
    const normalized = /^\d+$/.test(input) ? `BILL-${input}` : input.toUpperCase();
    setIsScanning(false);
    fetchBillByBillNumber(normalized);
  };

  const resetAll = () => {
    setQrData("");
    setBillNoInput("");
    setBillDetails(null);
    setError("");
    setDeliverError("");
    setIsScanning(true);
  };

  /* =========================================================
       ✅ DELIVERY LOGIC
  ========================================================= */
  const getAuth = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("chefToken") || localStorage.getItem("admin_token")}` }
  });

  const deliverItem = async (idx) => {
    if (deliveringIndex !== null || !canSelectItems(billDetails)) return;
    setDeliveringIndex(idx);
    try {
      const res = await axios.patch(`${API_BASE_URL}/orders/admin/${billDetails.billNumber}/items/${idx}/deliver`, {}, getAuth());
      setBillDetails(res.data.order);
    } catch (e) {
      setDeliverError("❌ Failed to deliver item.");
    } finally { setDeliveringIndex(null); }
  };

  const markBillDelivered = async () => {
    setDelivering(true);
    try {
      const res = await axios.patch(`${API_BASE_URL}/orders/admin/${billDetails.billNumber}/mark-delivered`, {}, getAuth());
      setBillDetails(res.data.order);
    } catch (e) {
      setDeliverError("❌ Mark delivered failed.");
    } finally { setDelivering(false); }
  };

  const overlay = overlayMessageForStatus(billDetails);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 mb-4 text-orange-400"><ArrowLeft size={18}/> Back</button>
        
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><QrCode className="text-indigo-400"/> Bill Scanner</h1>

        {/* Manual Search */}
        <div className="bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700">
          <div className="flex gap-2">
            <input 
              value={billNoInput} 
              onChange={e => setBillNoInput(e.target.value)}
              placeholder="Enter Bill Number"
              className="flex-1 bg-slate-900 border border-slate-600 p-2 rounded-lg outline-none focus:border-green-500"
            />
            <button onClick={handleSearch} className="bg-green-600 px-4 py-2 rounded-lg font-bold"><Search size={20}/></button>
          </div>
        </div>

        {/* Live Camera */}
        {isScanning && (
          <div className="bg-slate-800 p-2 rounded-xl mb-4 border border-slate-700">
            <div id="qr-reader" className="w-full rounded-lg overflow-hidden bg-black min-h-[250px]" />
          </div>
        )}

        {/* File Upload */}
        <div className="bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700 text-center">
          <label className="cursor-pointer bg-indigo-600 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2">
            <Upload size={18}/> Upload QR Image
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        </div>

        {loadingBill && <p className="text-center text-orange-400 animate-pulse">Fetching Bill...</p>}

        {/* Bill Result */}
        {billDetails && !loadingBill && (
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            {overlay && (
              <div className={`p-3 rounded-lg border mb-4 flex gap-2 ${overlay.color}`}>
                {overlay.icon} <div><p className="font-bold">{overlay.title}</p><p className="text-xs">{overlay.desc}</p></div>
              </div>
            )}

            <div className="bg-white text-black p-4 rounded-lg relative">
              {!canSelectItems(billDetails) && <div className="absolute inset-0 bg-black/10 z-10 rounded-lg pointer-events-none" />}
              <h2 className="text-center font-bold border-b pb-2">🧾 JJ CANTEEN</h2>
              <div className="text-xs py-2">
                <p><b>Bill:</b> {billDetails.billNumber}</p>
                <p><b>Status:</b> {billDetails.orderStatus}</p>
              </div>

              <table className="w-full text-xs border-t">
                <thead><tr className="bg-slate-100"><th className="p-1 border">S</th><th className="p-1 border text-left">Item</th><th className="p-1 border">Qty</th></tr></thead>
                <tbody>
                  {(billDetails.items || []).map((it, i) => (
                    <tr key={i} className={it.delivered ? "bg-green-100" : ""}>
                      <td className="p-1 border text-center">
                        <button 
                          disabled={it.delivered || !canSelectItems(billDetails)}
                          onClick={() => deliverItem(i)}
                          className={`w-6 h-6 rounded ${it.delivered ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'}`}
                        >
                          {it.delivered ? "✓" : "•"}
                        </button>
                      </td>
                      <td className="p-1 border">{it.name}</td>
                      <td className="p-1 border text-center">{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {allItemsSelectedDelivered(billDetails) && !isDeliveredBill(billDetails) && (
                <button onClick={markBillDelivered} disabled={delivering} className="w-full bg-green-600 text-white py-2 mt-4 rounded-lg font-bold">
                  {delivering ? "Marking..." : "Mark Fully Delivered"}
                </button>
              )}
            </div>
            <button onClick={resetAll} className="w-full bg-slate-700 py-2 mt-4 rounded-lg font-bold flex items-center justify-center gap-2">
              <RefreshCw size={18}/> Scan Another
            </button>
          </div>
        )}

        {error && <p className="mt-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded-lg text-sm">{error}</p>}
      </div>
    </div>
  );
}