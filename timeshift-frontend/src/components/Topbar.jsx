import { Link, useNavigate } from "react-router-dom";
import { clearAuth, getUser } from "../auth";

export default function Topbar() {
  const nav = useNavigate();
  const user = getUser();

  function logout() {
    clearAuth();
    nav("/login");
  }

  return (
    <div className="topbar">
      <div className="topbarInner">
        <div className="brand">
          <span className="dot" />
          <span>Цаг бүртгэл</span>
          <span className="badge">MNT</span>
        </div>

        <div className="row">
          {user?.role === "admin" && <Link className="btn" to="/admin">Админ</Link>}
          {user?.role === "worker" && <Link className="btn" to="/worker">Ажилтан</Link>}

          {user ? (
            <>
              <span className="small">{user.name} • {user.role === "admin" ? "Админ" : "Ажилтан"}</span>
              <button className="btn btnDanger" onClick={logout}>Гарах</button>
            </>
          ) : (
            <Link className="btn btnPrimary" to="/login">Нэвтрэх</Link>
          )}
        </div>
      </div>
    </div>
  );
}