export default function ContributeCTA({
  action,
  description,
  ctaLabel,
  onCta,
  onSecondary,
  secondaryLabel,
}: {
  action: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
}) {
  return (
    <div className="card">
      <h1>devcon-ps3</h1>
      <p className="subtitle">{action}</p>
      <p>{description}</p>
      <div className="cta">
        <button onClick={onCta}>{ctaLabel}</button>
        {onSecondary && secondaryLabel && (
          <button className="secondary" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}