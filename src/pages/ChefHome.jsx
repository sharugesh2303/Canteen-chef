import React from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, ClipboardCheck, LogOut } from "lucide-react";

export default function ChefHome({ onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      {/* HEADER */}
      <div className="w-full max-w-md flex items-center justify-between mb-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-orange-400">
          JJ Canteen Staff Panel
        </h1>

        {/* ✅ LOGOUT BUTTON */}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold shadow-md transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      {/* OPTIONS */}
      <div className="grid gap-6 w-full max-w-md">
        {/* Make Order Ready */}
        <button
          onClick={() => navigate("/chef")}
          className="bg-orange-600 hover:bg-orange-700 rounded-xl p-6 flex items-center gap-4 shadow-lg transition"
        >
          <ClipboardCheck className="w-10 h-10" />
          <div className="text-left">
            <p className="text-xl font-bold">Make Order Ready</p>
            <p className="text-sm opacity-80">
              View paid orders & mark as READY
            </p>
          </div>
        </button>

        {/* Scan QR */}
        <button
          onClick={() => navigate("/scan")}
          className="bg-indigo-600 hover:bg-indigo-700 rounded-xl p-6 flex items-center gap-4 shadow-lg transition"
        >
          <QrCode className="w-10 h-10" />
          <div className="text-left">
            <p className="text-xl font-bold">Scan QR</p>
            <p className="text-sm opacity-80">
              Scan bill QR and open student bill
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
