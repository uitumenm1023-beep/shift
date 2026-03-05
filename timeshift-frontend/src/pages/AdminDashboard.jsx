import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { api } from "../api";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminDashboard() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // create worker
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rate, setRate] = useState(15000);

  // payroll
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());
  const [payroll, setPayroll] = useState([]);
  const [payErr, setPayErr] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  // adjustments
  const [selWorkerId, setSelWorkerId] = useState("");
  const [adjHours, setAdjHours] = useState(1);
  const [adjReason, setAdjReason] = useState("");

  async function refresh() {
    setErr(""); setMsg("");
    setLoading(true);
    try {
      const data = await api.adminListWorkers();
      setWorkers(data.workers || []);
      if (!selWorkerId && data.workers?.[0]?.id) setSelWorkerId(String(data.workers[0].id));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function createWorker(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      await api.adminCreateWorker({ name, email, password, hourly_rate_mnt: Number(rate) });
      setName(""); setEmail(""); setPassword(""); setRate(15000);
      setMsg("Ажилтан нэмэгдлээ ✅");
      await refresh();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  async function updateWorker(id, patch) {
    setErr(""); setMsg("");
    try {
      await api.adminUpdateWorker(id, patch);
      setMsg("Хадгаллаа ✅");
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function deleteWorker(id, workerName) {
    setErr(""); setMsg("");
    const ok = confirm(`"${workerName}" ажилтныг бүх бүртгэлтэй нь устгах уу?`);
    if (!ok) return;
    try {
      await api.adminDeleteWorker(id);
      setMsg("Устгалаа ✅");
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function loadPayroll() {
    setPayErr("");
    setPayLoading(true);
    try {
      const data = await api.adminPayroll(from, to);
      setPayroll(data.payroll || []);
    } catch (e) {
      setPayErr(e.message);
      setPayroll([]);
    } finally {
      setPayLoading(false);
    }
  }

  async function applyAdjustment(sign) {
    setErr(""); setMsg("");
    const wid = Number(selWorkerId);
    const hours = Number(adjHours) * (sign === "-" ? -1 : 1);

    try {
      await api.adminAdjustTime(wid, hours, adjReason);
      setAdjReason("");
      setMsg(hours > 0 ? "Цаг нэмэгдлээ ✅" : "Цаг хасагдлаа ✅");
      await loadPayroll(); // refresh payroll view
    } catch (e) {
      setErr(e.message);
    }
  }

  const activeCount = useMemo(() => workers.filter(w => w.is_active === 1).length, [workers]);

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 14 }}>
        <h1 className="h1" style={{ margin: 0 }}>Админ</h1>
        <span className="badge">{loading ? "..." : `${activeCount} идэвхтэй`}</span>
        <span className="badge">Амралт: 60 мин</span>
        <span className="badge">Цаг: Asia/Ulaanbaatar</span>
      </div>

      <div className="grid cols-2">
        <Card title="Ажилтан нэмэх" subtitle=" ">
          <form onSubmit={createWorker} className="col">
            <div className="grid cols-2">
              <div className="col">
                <span className="label">Нэр</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="col">
                <span className="label">Цагийн хөлс (₮)</span>
                <input className="input" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            </div>
            <div className="col">
              <span className="label">И-мэйл</span>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="col">
              <span className="label">Нууц үг</span>
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <button className="btn btnPrimary">Нэмэх</button>
            {err && <div className="error">{err}</div>}
            {msg && <div className="success">{msg}</div>}
          </form>
        </Card>

        <Card title="Ажилласан цаг засах" subtitle="Ажилтны нийт цалингийн цагийг нэмэх/хасах">
          <div className="col">
            <div className="col">
              <span className="label">Ажилтан</span>
              <select className="select" value={selWorkerId} onChange={(e) => setSelWorkerId(e.target.value)}>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.email})</option>
                ))}
              </select>
            </div>

            <div className="grid cols-2">
              <div className="col">
                <span className="label">Цаг (hours)</span>
                <input className="input" type="number" step="0.25" value={adjHours} onChange={(e) => setAdjHours(e.target.value)} />
              </div>
              <div className="col">
                <span className="label">Тайлбар (заавал биш)</span>
                <input className="input" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} />
              </div>
            </div>

            <div className="row">
              <button className="btn btnGood" onClick={() => applyAdjustment("+")} type="button">
                + Нэмэх
              </button>
              <button className="btn btnDanger" onClick={() => applyAdjustment("-")} type="button">
                − Хасах
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ height: 16 }} />

      <Card title="Цалингийн тайлан" subtitle="Нийт цалин (засвар орсон хугацаатай)">
        <div className="grid cols-2" style={{ alignItems: "end" }}>
          <div className="col">
            <span className="label">Эхлэх өдөр</span>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="col">
            <span className="label">Дуусах өдөр</span>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btnPrimary" onClick={loadPayroll} disabled={payLoading}>
            {payLoading ? "..." : "Тайлан гаргах"}
          </button>
          {payErr && <span className="error">{payErr}</span>}
        </div>

        <div className="hr" />

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Ажилтан</th>
                <th>₮/цаг</th>
                <th>Цалин бодох (мин)</th>
                <th>Засвар (мин)</th>
                <th>Эцсийн (мин)</th>
                <th>Цаг</th>
                <th>Нийт цалин</th>
              </tr>
            </thead>
            <tbody>
              {payroll.length === 0 ? (
                <tr><td colSpan="7" className="small">Мэдээлэл алга.</td></tr>
              ) : payroll.map(p => (
                <tr key={p.worker_id}>
                  <td>
                    <div>{p.name}</div>
                    <div className="small">{p.email}</div>
                  </td>
                  <td>{p.hourly_rate_mnt.toLocaleString()}</td>
                  <td>{p.total_paid_minutes ?? 0}</td>
                  <td>{p.adjustment_minutes ?? 0}</td>
                  <td><b>{p.final_paid_minutes ?? 0}</b></td>
                  <td>{p.total_hours}</td>
                  <td><b>{p.total_pay_mnt.toLocaleString()} ₮</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Ажилтнууд" subtitle=" ">
        {loading ? (
          <div className="p">...</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Нэр</th>
                  <th>И-мэйл</th>
                  <th>Цагийн хөлс</th>
                  <th>Төлөв</th>
                  <th>Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => (
                  <WorkerRow key={w.id} worker={w} onSave={updateWorker} onDelete={deleteWorker} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {err && <div className="error" style={{ marginTop: 10 }}>{err}</div>}
        {msg && <div className="success" style={{ marginTop: 10 }}>{msg}</div>}
      </Card>
    </div>
  );
}

function WorkerRow({ worker, onSave, onDelete }) {
  const [rate, setRate] = useState(worker.hourly_rate_mnt);
  const [active, setActive] = useState(worker.is_active === 1);
  const [newPass, setNewPass] = useState("");

  return (
    <tr>
      <td><b>{worker.name}</b></td>
      <td>{worker.email}</td>
      <td style={{ width: 170 }}>
        <input className="input" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
      </td>
      <td style={{ width: 140 }}>
        <span className="badge">{active ? "Идэвхтэй" : "Идэвхгүй"}</span>
      </td>
      <td style={{ width: 520 }}>
        <div className="row">
          <button className="btn btnGood" onClick={() => onSave(worker.id, { hourly_rate_mnt: Number(rate), is_active: active ? 1 : 0 })}>
            Хадгалах
          </button>
          <button className="btn" onClick={() => setActive(v => !v)}>
            Идэвх солих
          </button>
          <input className="input" style={{ width: 180 }} value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Шинэ нууц үг" />
          <button className="btn btnDanger" onClick={() => { if (!newPass.trim()) return; onSave(worker.id, { password: newPass.trim() }); setNewPass(""); }}>
            Нууц үг солих
          </button>
          <button className="btn btnDanger" onClick={() => onDelete(worker.id, worker.name)}>
            Устгах
          </button>
        </div>
      </td>
    </tr>
  );
}