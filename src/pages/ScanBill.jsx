import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  QrCode,
  ArrowLeft,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";

/* ================= API CONFIG ================= */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:10000/api";

export default function ScanBill() {
  const navigate = useNavigate();
  
  // States
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
  // Unified status checker to handle different backend naming conventions
  const getOrderStatus = (order) =>
    String(order?.orderStatus || order?.status || "").toUpperCase();

  const isReadyBill = (order) => getOrderStatus(order) === "READY";
  const isDeliveredBill = (order) => getOrderStatus(order) === "DELIVERED";
  
  // Checks if all items in the list are marked as delivered
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
        desc: "This bill has already been collected and marked as delivered.",
        icon: <CheckCircle2 className="w-6 h-6 text-green-400" />,
        color: "border-green-600 bg-green-900/40 text-green-200",
      };
    }

    if (st === "PLACED") {
      return {
        title: "⏳ Not Ready Yet",
        desc: "Chef has not marked this order as READY yet.",
        icon: <AlertTriangle className="w-6 h-6 text-yellow-400" />,
        color: "border-yellow-600 bg-yellow-900/40 text-yellow-200",
      };
    }

    return null;
  };

  /* ================= SCANNER LOGIC ================= */
  const stopScanner = async () => {
    if (qrInstanceRef.current && qrInstanceRef.current.isScanning) {
      try {
        await qrInstanceRef.current.stop();
        qrInstanceRef.current.clear();
        qrInstanceRef.current = null;
      } catch (err) {
        console.error("Stop scanner error:", err);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      await stopScanner();
      if (!isScanning || !isMounted) return;

      // Slight delay to ensure DOM element is ready
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
        } catch (err) {
          if (isMounted) setError("❌ Camera access denied or failed.");
        }
      }, 300);
    };

    startScanner();
    return () => { 
      isMounted = false; 
      stopScanner(); 
    };
  }, [isScanning]);

  /* ================= API INTEGRATION ================= */
  const fetchBill = async (num) => {
    setLoadingBill(true);
    setError("");
    setBillDetails(null);
    try {
      // Endpoint handles QR data or raw Bill Number
      const res = await axios.get(`${API_BASE_URL}/orders/scan/${num}`);
      setBillDetails(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "❌ Bill not found.");
    } finally {
      setLoadingBill(false);
    }
  };

  // Trigger fetch when QR is scanned
  useEffect(() => {
    if (!qrData) return;
    // Extract ID if the QR contains a full URL
    const parts = qrData.split("/api/orders/bill/");
    const num = parts.length === 2 ? parts[1].trim() : qrData.trim();
    if (num) fetchBill(num);
    else setError("❌ Invalid QR Content.");
  }, [qrData]);

  const handleManualSearch = () => {
    const input = billNoInput.trim();
    if (!input) return;
    setIsScanning(false);
    fetchBill(input.toUpperCase());
  };

  const resetAll = async () => {
    await stopScanner();
    setQrData("");
    setBillNoInput("");
    setBillDetails(null);
    setError("");
    setDeliverError("");
    setIsScanning(true);
  };

  /* ================= DELIVERY ACTIONS ================= */
  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("chefToken")}` }
  });

  const deliverIndividualItem = async (idx) => {
    if (deliveringIndex !== null || !isReadyBill(billDetails)) return;
    setDeliveringIndex(idx);
    setDeliverError("");
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/orders/admin/${billDetails.billNumber}/items/${idx}/deliver`,
        {},
        getAuthHeaders()
      );

      // Sync local state with updated order from server
      setBillDetails(res.data.order);
    } catch (err) {
      setDeliverError("❌ Failed to lock item.");
    } finally {
      setDeliveringIndex(null);
    }
  };

  const markBillFullyDelivered = async () => {
    setDelivering(true);
    setDeliverError("");
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/orders/admin/${billDetails.billNumber}/mark-delivered`,
        {},
        getAuthHeaders()
      );
      setBillDetails(res.data.order);
    } catch (err) {
      setDeliverError("❌ Failed to complete delivery.");
    } finally {
      setDelivering(false);
    }
  };

  const overlay = overlayMessageForStatus(billDetails);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 mb-4 text-orange-400 font-medium transition-colors hover:text-orange-300">
          <ArrowLeft size={18}/> Back to Home
        </button>

        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <QrCode className="text-indigo-400"/> Bill Delivery Scanner
        </h1>

        {/* Manual Input Section */}
        <div className="bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700 flex gap-2">
          <input
            value={billNoInput}
            onChange={e => setBillNoInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleManualSearch()}
            placeholder="Enter Bill Number (e.g. BILL-12345)"
            className="flex-1 bg-slate-900 border border-slate-600 p-2 rounded-lg focus:outline-none focus:border-indigo-500"
          />
          <button onClick={handleManualSearch} className="bg-indigo-600 px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
            <Search size={20}/>
          </button>
        </div>

        {/* Camera Feed Area */}
        {isScanning && (
          <div className="overflow-hidden rounded-xl border-2 border-slate-700 bg-black relative">
            <div id="qr-reader" className="w-full" />
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
               <div className="w-48 h-48 border-2 border-indigo-500 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            </div>
          </div>
        )}

        {loadingBill && (
          <div className="flex justify-center p-10">
            <Loader2 className="animate-spin text-orange-400" size={32} />
          </div>
        )}

        {/* Bill Result View */}
        {billDetails && !loadingBill && (
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 animate-in fade-in zoom-in duration-200">
            {overlay && (
              <div className={`p-4 rounded-lg border mb-4 flex gap-3 ${overlay.color}`}>
                {overlay.icon}
                <div>
                  <p className="font-bold">{overlay.title}</p>
                  <p className="text-sm opacity-90">{overlay.desc}</p>
                </div>
              </div>
            )}

            <div className="bg-white text-black p-5 rounded-lg shadow-inner">
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-3 mb-3">
                <h2 className="font-black text-xl tracking-tighter">JJ CANTEEN</h2>
                <p className="text-[10px] text-slate-500">Order Verification Slip</p>
              </div>
              
              <div className="flex justify-between text-xs mb-1">
                <span><b>Bill:</b> {billDetails.billNumber}</span>
                <span className="font-bold text-indigo-600">{getOrderStatus(billDetails)}</span>
              </div>

              <table className="w-full text-sm mt-4">
                <thead>
                  <tr className="border-b text-slate-500 text-[10px] uppercase">
                    <th className="text-left pb-1">Delivery</th>
                    <th className="text-left pb-1">Item Name</th>
                    <th className="text-right pb-1">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billDetails.items?.map((it, i) => (
                    <tr key={i} className="py-2">
                      <td className="py-2">
                        <button
                          disabled={it.delivered || !isReadyBill(billDetails) || deliveringIndex !== null}
                          onClick={() => deliverIndividualItem(i)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            it.delivered 
                            ? "bg-green-600 text-white shadow-lg shadow-green-200" 
                            : isReadyBill(billDetails) ? "bg-orange-500 text-white hover:scale-110 active:scale-95" : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          {deliveringIndex === i ? <Loader2 size={14} className="animate-spin"/> : (it.delivered ? "✓" : "+")}
                        </button>
                      </td>
                      <td className="font-medium text-slate-700">{it.name}</td>
                      <td className="text-right font-bold">{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Final Confirmation Action */}
              {allItemsSelectedDelivered(billDetails) && !isDeliveredBill(billDetails) && (
                <button 
                  onClick={markBillFullyDelivered} 
                  disabled={delivering}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 mt-6 rounded-lg font-black uppercase tracking-widest transition-all flex justify-center items-center gap-2 shadow-lg shadow-green-900/20"
                >
                  {delivering ? <Loader2 className="animate-spin"/> : <CheckCircle2 size={20}/>}
                  {delivering ? "Marking..." : "Confirm Delivery"}
                </button>
              )}
            </div>

            <button onClick={resetAll} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 mt-4 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors">
              <RefreshCw size={18}/> Scan Next Bill
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/40 border border-red-500 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-red-500 shrink-0"/>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        
        {deliverError && (
          <div className="mt-2 text-red-400 text-center font-semibold text-sm animate-bounce">
            {deliverError}
          </div>
        )}
      </div>
    </div>
  );
}