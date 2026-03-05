import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import { api } from "../api";
import { setAuth } from "../auth";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await api.login(email, password);
      setAuth(data);
      nav(data.user.role === "admin" ? "/admin" : "/worker");
    } catch (e2) {
      setErr(e2.message || "Нэвтрэлт амжилтгүй");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="grid">
        <Card title="Нэвтрэх" subtitle=" ">
          <form onSubmit={onSubmit} className="col">
            <div className="col">
              <span className="label">И-мэйл</span>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="И-мэйл"
                autoComplete="username"
              />
            </div>

            <div className="col">
              <span className="label">Нууц үг</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Нууц үг"
                autoComplete="current-password"
              />
            </div>

            {err && <div className="error">{err}</div>}

            <button className="btn btnPrimary" disabled={loading}>
              {loading ? "Түр хүлээнэ үү..." : "Нэвтрэх"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}