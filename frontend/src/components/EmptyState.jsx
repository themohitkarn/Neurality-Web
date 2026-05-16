export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl px-6 py-10 text-center" style={{ background: "var(--surface)" }}>
      <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
