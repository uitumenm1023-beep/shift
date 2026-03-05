export default function Card({ title, subtitle, right, children }) {
  return (
    <div className="card">
      {(title || right) && (
        <div className="cardHeader">
          <div>
            {title && <h2 className="h2">{title}</h2>}
            {subtitle && <p className="p">{subtitle}</p>}
          </div>
          {right || null}
        </div>
      )}
      {children}
    </div>
  );
}