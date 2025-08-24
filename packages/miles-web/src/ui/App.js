import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, LayoutGrid, Building2, Network, Settings, Search } from 'lucide-react';
import dayjs from 'dayjs';
import { Toaster, toast } from 'sonner';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
function classNames(...xs) {
    return xs.filter(Boolean).join(' ');
}
function LeftNav() {
    const Item = ({ icon: Icon, label, active = false }) => (_jsxs("div", { className: classNames('flex items-center gap-3 px-4 py-2 rounded-xl cursor-pointer', active ? 'bg-white text-indigo-600 shadow-sm' : 'hover:bg-white/60 text-gray-700'), children: [_jsx(Icon, { className: "h-5 w-5" }), _jsx("span", { className: "text-sm font-medium", children: label })] }));
    return (_jsxs("aside", { className: "hidden md:flex md:w-60 flex-col gap-1 p-4 bg-gray-50 border-r border-gray-200", children: [_jsx("div", { className: "text-xl font-semibold px-2 py-1 text-gray-900", children: "Miles" }), _jsx(Item, { icon: LayoutGrid, label: "Global Overview" }), _jsx(Item, { icon: Building2, label: "Organization" }), _jsx(Item, { icon: Network, label: "Network" }), _jsx(Item, { icon: Bell, label: "Alerts", active: true }), _jsx(Item, { icon: Settings, label: "Settings" })] }));
}
function TopBar({ q, setQ }) {
    return (_jsx("div", { className: "sticky top-0 z-10 bg-gray-50/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60 border-b border-gray-200", children: _jsxs("div", { className: "flex items-center justify-between px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "md:hidden text-xl font-semibold text-gray-900", children: "Miles" }), _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" }), _jsx("input", { value: q, onChange: (e) => setQ(e.target.value), placeholder: "Search alerts...", className: "pl-9 pr-3 py-2 rounded-xl border border-gray-300 bg-white w-72 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" })] })] }), _jsx("div", { className: "flex items-center gap-3", children: _jsx("div", { className: "h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200" }) })] }) }));
}
function ImageThumb({ url }) {
    const [open, setOpen] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsx("img", { src: `${API_BASE}/api/img?url=${encodeURIComponent(url)}`, className: "h-[45px] w-[80px] object-cover rounded border border-gray-200 cursor-pointer", onClick: () => setOpen(true) }), open && (_jsx("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-50", onClick: () => setOpen(false), children: _jsx("img", { src: `${API_BASE}/api/img?url=${encodeURIComponent(url)}`, className: "max-h-[80vh] rounded shadow-2xl" }) }))] }));
}
export function App() {
    const [events, setEvents] = useState([]);
    const [q, setQ] = useState('');
    const [newCount, setNewCount] = useState(0);
    const listRef = useRef(null);
    // Load initial page
    useEffect(() => {
        const params = new URLSearchParams();
        if (q)
            params.set('q', q);
        fetch(`${API_BASE}/api/events?${params.toString()}`)
            .then((r) => r.json())
            .then((d) => setEvents(d.items || []))
            .catch(() => { });
    }, [q]);
    // SSE
    useEffect(() => {
        const ev = new EventSource(`${API_BASE}/api/stream`);
        ev.addEventListener('event', (m) => {
            const e = JSON.parse(m.data);
            setEvents((prev) => [e, ...prev]);
            setNewCount((n) => n + 1);
        });
        return () => ev.close();
    }, []);
    useEffect(() => {
        if (newCount > 0) {
            toast(`New alerts (${newCount}) — Show`, {
                action: {
                    label: 'Show',
                    onClick: () => {
                        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        setNewCount(0);
                    },
                },
            });
        }
    }, [newCount]);
    const filtered = useMemo(() => {
        if (!q)
            return events;
        const needle = q.toLowerCase();
        return events.filter((e) => [e.alertType, e.severity, e.networkId, e.deviceSerial, e.deviceName, e.details]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle)));
    }, [events, q]);
    return (_jsxs("div", { className: "min-h-screen flex bg-gray-50", children: [_jsx(LeftNav, {}), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx(TopBar, { q: q, setQ: setQ }), _jsxs("main", { className: "p-4", children: [_jsxs("div", { className: "bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4", children: [_jsx("div", { className: "text-lg font-semibold text-gray-900", children: "Miles Alerts" }), _jsx("div", { className: "text-sm text-gray-500", children: "Live Meraki webhook events" })] }), _jsx("div", { ref: listRef, className: "bg-white rounded-2xl border border-gray-200 shadow-sm overflow-auto max-h-[70vh]", children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { className: "bg-gray-50 sticky top-0", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Status" }), _jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Occurred At" }), _jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Alert Type" }), _jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Network" }), _jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Device" }), _jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Client MAC" }), _jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Details" }), _jsx("th", { className: "text-left px-3 py-2 font-medium text-gray-700", children: "Image" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: filtered.map((e) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-3 py-2", children: _jsx("span", { className: classNames('inline-block h-2.5 w-2.5 rounded-full', e.severity === 'Critical' ? 'bg-red-500' : e.severity === 'Warning' ? 'bg-amber-500' : 'bg-emerald-500') }) }), _jsx("td", { className: "px-3 py-2 text-gray-900 whitespace-nowrap", children: dayjs(e.occurredAt).format('YYYY-MM-DD HH:mm:ss') }), _jsx("td", { className: "px-3 py-2 text-gray-900", children: e.alertType }), _jsx("td", { className: "px-3 py-2 text-gray-900", children: e.networkId }), _jsx("td", { className: "px-3 py-2 text-gray-900", children: e.deviceName || e.deviceSerial }), _jsx("td", { className: "px-3 py-2 text-gray-900", children: e.clientMac }), _jsx("td", { className: "px-3 py-2 text-gray-700", children: e.details }), _jsx("td", { className: "px-3 py-2", children: e.imageUrl ? _jsx(ImageThumb, { url: e.imageUrl }) : null })] }, e.id))) })] }) })] })] }), _jsx(Toaster, { position: "bottom-center", richColors: true })] }));
}
