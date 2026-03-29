export default function EmptyState({ title, description, action }) {
  return (
    <div className="panel soft-ring px-6 py-10 text-center">
      <p className="font-display text-2xl text-ink">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[color:var(--muted)]">
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
