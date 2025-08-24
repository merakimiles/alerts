import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, LayoutGrid, Building2, Network, Settings, Search } from 'lucide-react';
import dayjs from 'dayjs';
import { Toaster, toast } from 'sonner';

type Event = {
  id: string;
  occurredAt: string;
  alertType: string;
  severity?: string | null;
  networkId?: string | null;
  deviceSerial?: string | null;
  deviceName?: string | null;
  clientMac?: string | null;
  details?: string | null;
  imageUrl?: string | null;
  raw: any;
};

const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || '';

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function LeftNav() {
  const Item = ({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) => (
    <div className={classNames(
      'flex items-center gap-3 px-4 py-2 rounded-xl cursor-pointer',
      active ? 'bg-white text-indigo-600 shadow-sm' : 'hover:bg-white/60 text-gray-700'
    )}>
      <Icon className="h-5 w-5" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
  return (
    <aside className="hidden md:flex md:w-60 flex-col gap-1 p-4 bg-gray-50 border-r border-gray-200">
      <div className="text-xl font-semibold px-2 py-1 text-gray-900">Miles</div>
      <Item icon={LayoutGrid} label="Global Overview" />
      <Item icon={Building2} label="Organization" />
      <Item icon={Network} label="Network" />
      <Item icon={Bell} label="Alerts" active />
      <Item icon={Settings} label="Settings" />
    </aside>
  );
}

function TopBar({ q, setQ }: { q: string; setQ: (s: string) => void }) {
  return (
    <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60 border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="md:hidden text-xl font-semibold text-gray-900">Miles</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search alerts..."
              className="pl-9 pr-3 py-2 rounded-xl border border-gray-300 bg-white w-72 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200" />
        </div>
      </div>
    </div>
  );
}

function ImageThumb({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        src={`${API_BASE}/api/img?url=${encodeURIComponent(url)}`}
        className="h-[45px] w-[80px] object-cover rounded border border-gray-200 cursor-pointer"
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setOpen(false)}
        >
          <img src={`${API_BASE}/api/img?url=${encodeURIComponent(url)}`} className="max-h-[80vh] rounded shadow-2xl" />
        </div>
      )}
    </>
  );
}

export function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [q, setQ] = useState('');
  const [newCount, setNewCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Load initial page
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    fetch(`${API_BASE}/api/events?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.items || []))
      .catch(() => {});
  }, [q]);

  // SSE
  useEffect(() => {
    const ev = new EventSource(`${API_BASE}/api/stream`);
    ev.addEventListener('event', (m: MessageEvent) => {
      const e = JSON.parse(m.data) as Event;
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
    if (!q) return events;
    const needle = q.toLowerCase();
    return events.filter((e) =>
      [e.alertType, e.severity, e.networkId, e.deviceSerial, e.deviceName, e.details]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [events, q]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <LeftNav />
      <div className="flex-1 min-w-0">
        <TopBar q={q} setQ={setQ} />
        <main className="p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4">
            <div className="text-lg font-semibold text-gray-900">Miles Alerts</div>
            <div className="text-sm text-gray-500">Live Meraki webhook events</div>
          </div>

          <div ref={listRef} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-auto max-h-[70vh]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Occurred At</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Alert Type</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Network</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Device</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Client MAC</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Details</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Image</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span className={classNames(
                        'inline-block h-2.5 w-2.5 rounded-full',
                        e.severity === 'Critical' ? 'bg-red-500' : e.severity === 'Warning' ? 'bg-amber-500' : 'bg-emerald-500'
                      )} />
                    </td>
                    <td className="px-3 py-2 text-gray-900 whitespace-nowrap">{dayjs(e.occurredAt).format('YYYY-MM-DD HH:mm:ss')}</td>
                    <td className="px-3 py-2 text-gray-900">{e.alertType}</td>
                    <td className="px-3 py-2 text-gray-900">{e.networkId}</td>
                    <td className="px-3 py-2 text-gray-900">{e.deviceName || e.deviceSerial}</td>
                    <td className="px-3 py-2 text-gray-900">{e.clientMac}</td>
                    <td className="px-3 py-2 text-gray-700">{e.details}</td>
                    <td className="px-3 py-2">{e.imageUrl ? <ImageThumb url={e.imageUrl} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
      <Toaster position="bottom-center" richColors />
    </div>
  );
}


