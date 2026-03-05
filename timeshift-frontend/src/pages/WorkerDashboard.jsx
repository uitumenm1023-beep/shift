import { useEffect, useState } from "react";
import Card from "../components/Card";
import { api } from "../api";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function WorkerDashboard() {
  const [me, setMe] = useState(null);
  const [openShift, setOpenShift] = useState(null);

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());
  const [shifts, setShifts] = useState([]);
  const [summary, setSummary] = useState(null);

  const [notes, setNotes] = useState("");

  async function loadAll() {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const meRes = await api.workerMe();
      setMe(meRes.user);

      const openRes = await api.workerOpenShift();
      setOpenShift(openRes.openShift);

      const [shiftRes, sumRes] = await Promise.all([
        api.workerListShifts(from, to),
        api.workerSummary(from, to),
      ]);

      setShifts(shiftRes.shifts || []);
      setSummary(sumRes);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function applyRange() {
    await loadAll();
  }

  async function checkIn() {
    setErr(""); setMsg("");
    try {
      await api.workerCheckIn(notes);
      setNotes("");
      setMsg("Ирсэн цаг бүртгэгдлээ ✅");
      await loadAll();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function checkOut() {
    setErr(""); setMsg("");
    try {
      await api.workerCheckOut();
      setMsg("Тарсан цаг бүртгэгдлээ ✅");
      await loadAll();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 14 }}>
        <h1 className="h1" style={{ margin: 0 }}>Ажилтан</h1>
        {me && <span className="badge">{me.hourly_rate_mnt.toLocaleString()} ₮/цаг</span>}
        <span className="badge">Амралт: 60 мин (автоматаар)</span>
        {openShift ? <span className="badge">АЖИЛЛАЖ БАЙНА</span> : <span className="badge">ЧӨЛӨӨТЭЙ</span>}
      </div>

      <div className="grid cols-2">
        <Card title="Цаг бүртгэл" subtitle=" ">
          <div className="col">
            {openShift ? (
              <>
                <div className="row">
                  <span className="badge">Ирсэн: {openShift.check_in_at || "-"}</span>
                  <span className="badge">Өдөр: {openShift.work_date}</span>
                </div>

                <button className="btn btnPrimary" onClick={checkOut} disabled={loading}>
                  {loading ? "..." : "Тарах (Check Out)"}
                </button>
              </>
            ) : (
              <>
                <div className="col">
                  <span className="label">Тэмдэглэл (заавал биш)</span>
                  <input
                    className="input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Тэмдэглэл"
                  />
                </div>

                <button className="btn btnPrimary" onClick={checkIn} disabled={loading}>
                  {loading ? "..." : "Ирэх (Check In)"}
                </button>
              </>
            )}

            {err && <div className="error">{err}</div>}
            {msg && <div className="success">{msg}</div>}
          </div>
        </Card>

        <Card title="Нийт дүн" subtitle=" ">
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
            <button className="btn btnPrimary" onClick={applyRange} disabled={loading}>
              {loading ? "..." : "Шүүх"}
            </button>
          </div>

          <div className="hr" />

          {!summary ? (
            <div className="p">Мэдээлэл алга.</div>
          ) : (
            <div className="col">
              <div className="row">
                <span className="badge">Ажилласан: {summary.total_worked_minutes} мин</span>
                <span className="badge">Цалин бодох: {summary.total_paid_minutes} мин</span>
              </div>
              <div className="row">
                <span className="badge">Цаг: {summary.total_hours}</span>
                <span className="badge">Хөлс: {summary.hourly_rate_mnt.toLocaleString()} ₮/цаг</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
                {summary.total_pay_mnt.toLocaleString()} ₮
              </div>
            </div>
          )}
        </Card>
      </div>

      <div style={{ height: 16 }} />

      <Card title="Миний бүртгэлүүд" subtitle=" ">
        {loading ? (
          <div className="p">Уншиж байна...</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Өдөр</th>
                  <th>Ирсэн</th>
                  <th>Тарсан</th>
                  <th>Ажилласан</th>
                  <th>Цалин бодох</th>
                  <th>Цалин</th>
                </tr>
              </thead>
              <tbody>
                {shifts.length === 0 ? (
                  <tr><td colSpan="6" className="small">Бүртгэл алга.</td></tr>
                ) : shifts.map(s => (
                  <tr key={s.id}>
                    <td>{s.work_date}</td>
                    <td>{s.check_in_at || "-"}</td>
                    <td>{s.check_out_at || "-"}</td>
                    <td>{s.computed?.worked_minutes ?? 0} мин</td>
                    <td>{s.computed?.paid_minutes ?? 0} мин</td>
                    <td><b>{(s.computed?.pay_mnt ?? 0).toLocaleString()} ₮</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}