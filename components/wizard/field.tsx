export function FieldLabel({ children, htmlFor, optional }: { children: React.ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="kicker mb-2 flex items-center justify-between">
      <span>{children}</span>
      {optional ? <span className="normal-case tracking-normal text-muted/80">facultatif</span> : null}
    </label>
  );
}

export function StepTitle({ index, title, hint }: { index: number; title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <div className="kicker mb-1">Étape {index + 1} sur 4</div>
      <h1 className="display text-[clamp(46px,15vw,72px)]">{title}</h1>
      {hint ? <p className="mt-2 text-[15px] text-muted">{hint}</p> : null}
    </div>
  );
}
