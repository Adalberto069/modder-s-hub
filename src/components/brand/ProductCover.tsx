interface ProductCoverProps {
  category: string;
}

export function ProductCover({ category }: ProductCoverProps) {
  return (
    <div className="home-product-cover" aria-label={`Capa gráfica HiddenMod · ${category}`}>
      <div className="home-cover-geometry" aria-hidden="true"><i /><i /><i /></div>
      <div className="home-cover-brand" aria-hidden="true">H<span>M</span><b>_</b></div>
      <div className="home-cover-caption"><span className="hacker-label">HIDDENMOD</span><span className="hacker-label">{category}</span></div>
    </div>
  );
}