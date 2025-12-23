import React, { useState, useEffect, useCallback } from 'react';
import {
    Utensils,
    Clock,
    Check,
    Loader,
    AlertTriangle,
    LogOut,
    RefreshCw,
    Timer,
    X
} from 'lucide-react';
import axios from 'axios';

// === CONFIGURATION ===
// This is the fix: It now uses your Vercel Environment Variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';


// Simple slide-up animation for the modal & Sparkle styles
const GlobalStyles = () => (
    <style>{`
        @keyframes slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.2s ease-out forwards; }

        /* Sparkle Styles */
        @keyframes sparkle-animation {
            0% { transform: scale(0) translate(0, 0); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: scale(1) translate(var(--x), var(--y)); opacity: 0; }
        }
        .sparkle-container {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; z-index: 0; overflow: hidden;
        }
        .spark {
            position: absolute; top: 50%; left: 50%; width: var(--size); height: var(--size);
            background-color: #fbbF24; /* yellow-400 */ border-radius: 50%;
            animation: sparkle-animation var(--duration) var(--delay) infinite linear;
            box-shadow: 0 0 4px #fbbF24, 0 0 8px #fbbF24;
        }
    `}</style>
);

// --- SparkleOverlay Component ---
const SparkleOverlay = () => {
    const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const sparks = Array.from({ length: 40 }).map((_, i) => {
        const style = {
            '--x': `${random(-150, 150)}vw`, '--y': `${random(-150, 150)}vh`,
            '--duration': `${random(8, 20)}s`, '--delay': `${random(1, 10)}s`,
            '--size': `${random(1, 3)}px`,
        };
        return <div key={i} className="spark" style={style}></div>;
    });
    return <div className="sparkle-container">{sparks}</div>;
};


const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// ===============================================
// API INTEGRATION FUNCTIONS
// ===============================================

const getAuthHeaders = () => {
    const token = localStorage.getItem('chefToken') || localStorage.getItem('admin_token');
    if (!token) {
        throw new Error("Token expired or missing.");
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

const fetchStaffOrders = async (handleLogout) => {
    try {
        const headers = getAuthHeaders();
        const response = await axios.get(`${API_BASE_URL}/staff/orders`, { headers });
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            handleLogout();
            throw new Error("Session expired. Please log in again.");
        }
        console.error("Fetch Orders Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message || 'Failed to fetch new orders.');
    }
};

const markOrderAsReady = async (billNumber) => {
    const headers = getAuthHeaders();
    const response = await axios.patch(`${API_BASE_URL}/admin/orders/${billNumber}/mark-ready`, {}, { headers });
    return response.data;
};

// ===============================================
// BILL MODAL COMPONENT
// ===============================================
const BillModal = ({ order, onClose, onMarkReady }) => {
     const [isUpdating, setIsUpdating] = useState(false);
    const [modalError, setModalError] = useState(null);

    const handleMarkReadyClick = async () => {
        setIsUpdating(true);
        setModalError(null);
        try {
            await onMarkReady(order.billNumber);
            onClose();
        } catch (error) {
            setModalError(error.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const totalItems = order.items.reduce((acc, item) => acc + item.quantity, 0);

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md relative animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
                    Bill Details
                </h2>
                <p className="text-center text-xl font-mono text-orange-600 mb-4">
                    #{order.billNumber ? order.billNumber.substring(3) : 'N/A'}
                </p>

                <div className="mb-4 space-y-1">
                    <p className="text-slate-700 text-lg">
                        <span className="font-semibold">Customer:</span> {order.studentName || (order.student ? order.student.name : 'N/A')}
                    </p>
                    <p className="text-slate-600">
                        <span className="font-semibold">Time:</span> {formatTime(order.orderDate)}
                    </p>
                    <p className="text-slate-600">
                        <span className="font-semibold">Status:</span>
                        <span className="font-bold text-red-600"> PAID (Pending Prep)</span>
                    </p>
                </div>

                <div className="border-t border-b border-slate-200 py-4 my-4">
                    <h3 className="font-bold text-lg text-orange-700 mb-2">
                        ITEMS ({totalItems})
                    </h3>
                    <ul className="text-sm text-slate-800 space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300">
                        {order.items.map((item, index) => (
                            <li key={index} className="flex justify-between items-center text-base">
                                <span className="font-medium">{item.name}</span>
                                <span className="font-extrabold text-orange-600">x {item.quantity}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {modalError && (
                    <p className="text-sm font-medium text-red-700 bg-red-100 p-3 rounded mb-3 flex items-center">
                        <AlertTriangle className='w-4 h-4 mr-2' />{modalError}
                    </p>
                )}

                <button
                    onClick={handleMarkReadyClick}
                    disabled={isUpdating}
                    className={`w-full py-3 text-white font-bold rounded-md transition duration-200 shadow-sm flex items-center justify-center text-base ${
                        isUpdating
                            ? 'bg-slate-400 cursor-not-allowed'
                            : 'bg-orange-600 hover:bg-orange-700'
                    }`}
                >
                    {isUpdating ? <Loader className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                    Mark as Ready
                </button>
            </div>
        </div>
    );
};


// --- Order Card Component ---
const OrderCard = ({ order, updateStatus, loading, onViewBill }) => {
    const statusInfo = { color: 'border-red-500', icon: Timer, action: 'Mark Ready' };

    const [isUpdating, setIsUpdating] = useState(false);
    const [cardError, setCardError] = useState(null);

    const orderIdentifier = order.billNumber;
    const isActionDisabled = loading || isUpdating;

    const handleAction = async () => {
        setIsUpdating(true);
        setCardError(null);
        try {
            await updateStatus(orderIdentifier);
        } catch (error) {
            setCardError(error.message);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className={`bg-slate-800 shadow-lg rounded-lg p-4 flex flex-col justify-between h-full transform transition duration-300 hover:scale-[1.02] hover:shadow-orange-500/30 border-l-4 ${statusInfo.color}`}>
            {/* Card Content */}
            <div>
                <div
                    onClick={onViewBill}
                    className="cursor-pointer"
                >
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-slate-100">BILL <span className="text-orange-400">#{orderIdentifier ? orderIdentifier.substring(3) : 'N/A'}</span></h3>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white bg-red-600 flex-shrink-0">
                            NEW (PAID)
                        </span>
                    </div>

                    {cardError && (
                        <p className="text-sm font-medium text-red-400 bg-red-900/50 p-2 rounded mb-2 flex items-center border border-red-700">
                            <AlertTriangle className='w-4 h-4 mr-2 text-red-400' />{cardError}
                        </p>
                    )}

                    <p className="text-sm font-semibold text-slate-300 truncate">Customer: {order.studentName || (order.student ? order.student.name : 'N/A')}</p>
                    <p className="text-xs font-mono text-slate-400 mb-3">Time: {formatTime(order.orderDate)}</p>

                    <div className="p-2 bg-slate-700/50 rounded-md border border-slate-600">
                        <p className="font-bold text-sm text-orange-300 mb-1">ITEMS ({order.items.length}):</p>
                        <ul className="text-xs text-slate-200 space-y-0.5 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700 pr-1">
                            {order.items && order.items.map((item, index) => (
                                <li key={index} className="flex justify-between">
                                    <span className="font-medium truncate pr-2">{item.name}</span>
                                    <span className="font-extrabold text-orange-400 flex-shrink-0">x{item.quantity}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Action Button - Placed at bottom using flex */}
            <button
                onClick={handleAction}
                disabled={isActionDisabled}
                className={`w-full mt-3 py-2 text-white font-bold rounded-md transition duration-200 shadow-sm flex items-center justify-center ${
                    isActionDisabled
                        ? 'bg-slate-500 cursor-not-allowed'
                        : 'bg-orange-600 hover:bg-orange-700'
                }`}
            >
                {isUpdating ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isUpdating ? 'Updating...' : statusInfo.action}
            </button>
        </div>
    );
};

// --- Main Chef Dashboard Component ---
export default function ChefDashboard({ handleLogout }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const loadOrders = useCallback(async () => {
        if (!loading) setLoading(true);
        setError(null);
        try {
            const fetchedOrders = await fetchStaffOrders(handleLogout);
            const sortedOrders = fetchedOrders.sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
            const paidOrders = sortedOrders.filter(order => order.status === 'Paid');
            setOrders(paidOrders);
        } catch (e) {
            console.error("Dashboard Load Error:", e.message);
            if (!e.message.includes("Session expired")) {
                setError(e.message);
            }
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleLogout]);

    const handleMarkReady = useCallback(async (billNumber) => {
        try {
            await markOrderAsReady(billNumber);
            setOrders(prevOrders => prevOrders.filter(order => order.billNumber !== billNumber));
            setSelectedOrder(prevSelected =>
                prevSelected && prevSelected.billNumber === billNumber ? null : prevSelected
            );
        } catch (error) {
            console.error("Mark Ready Error:", error.message);
            const serverMessage = error.response?.data?.msg || error.message;
            throw new Error(serverMessage);
        }
    }, []);

    // Polling Effect
    useEffect(() => {
        loadOrders();
        const intervalId = setInterval(loadOrders, 10000);
        return () => clearInterval(intervalId);
    }, [loadOrders]);


    if (error && !error.includes("Session expired")) {
         return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
                 <SparkleOverlay />
                 <AlertTriangle className="w-8 h-8 mb-4 text-red-500" />
                 <p className="text-center text-lg font-semibold">Error: {error}</p>
                 <button onClick={loadOrders} className="mt-4 text-orange-400 hover:underline flex items-center">
                     <RefreshCw className="w-4 h-4 mr-1"/> Try Again
                 </button>
                 <button onClick={handleLogout} className="mt-2 text-indigo-400 hover:underline">Go to Login</button>
             </div>
         );
    }

    return (
        <div className="min-h-screen bg-slate-900 font-sans p-4 sm:p-6 relative">
             <SparkleOverlay />
             <GlobalStyles /> {/* Include the corrected GlobalStyles */}
            <div className="relative z-10">
                <header className="mb-6 pb-4 border-b-4 border-orange-400 flex justify-between items-center">
                    <h1 className="text-3xl font-extrabold text-white flex items-center">
                        <Utensils className="w-7 h-7 mr-3 text-orange-400" /> Chef Work Queue
                    </h1>
                    <div className="flex space-x-3">
                        <button
                            onClick={loadOrders}
                            disabled={loading}
                            className="flex items-center text-sm text-white bg-indigo-600 hover:bg-indigo-700 py-2 px-4 rounded-lg font-semibold transition duration-200 shadow-md disabled:bg-slate-500 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Refresh
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center text-sm text-white bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg font-semibold transition duration-200 shadow-md"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                        </button>
                    </div>
                </header>

                {/* --- Title Above List --- */}
                 <h2 className={`text-2xl font-bold text-white text-center mb-4`}>
                    Paid Orders (New) ({orders.length})
                 </h2>

                {/* --- SINGLE COLUMN LAYOUT --- */}
                <div className="max-w-xl mx-auto space-y-4"> {/* Centered container */}
                    {/* Map Order Cards directly */}
                    {orders.map(order => (
                         <OrderCard
                             key={order._id}
                             order={order}
                             updateStatus={handleMarkReady}
                             loading={false}
                             onViewBill={() => setSelectedOrder(order)}
                         />
                     ))}

                     {/* Loading Indicator (Global) */}
                     {loading && orders.length === 0 && (
                         <div className="flex justify-center items-center p-10 mt-6">
                             <Loader className="w-8 h-8 mr-3 animate-spin text-orange-400" />
                             <span className="text-slate-400 text-lg">Loading Orders...</span>
                         </div>
                     )}

                     {/* No Orders Message */}
                     {!loading && orders.length === 0 && (
                         <p className="text-slate-400 text-center text-lg p-10 mt-6 bg-slate-800/50 rounded-lg">No new bills to prepare right now.</p>
                     )}
                 </div>


                {selectedOrder && (
                    <BillModal
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        onMarkReady={handleMarkReady}
                    />
                )}
            </div>
        </div>
    );
}