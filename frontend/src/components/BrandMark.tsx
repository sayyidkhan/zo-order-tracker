export function BrandMark({
  businessName,
  markLetter,
  onHomeClick
}: {
  businessName: string;
  markLetter: string;
  onHomeClick?: () => void;
}) {
  const content = (
    <>
      <span className="brand-glyph" aria-hidden="true">
        {markLetter.charAt(0).toUpperCase()}
      </span>
      <span className="brand-name">{businessName}</span>
    </>
  );

  if (onHomeClick) {
    return (
      <button className="auth-brand brand-mark-button" type="button" onClick={onHomeClick}>
        {content}
      </button>
    );
  }

  return <div className="auth-brand">{content}</div>;
}
