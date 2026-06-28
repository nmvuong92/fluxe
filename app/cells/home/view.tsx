export interface HomeData { title: string; backend: string; static: string; cta: string; cta2: string }

export function Home({ data }: { data: HomeData }) {
  return (
    <div className="card">
      <h1>{data.title}</h1>
      <p className="muted">{data.backend}</p>
      <p>{data.static}</p>
      <div className="row" style={{ gap: 10 }}>
        <a href="/lots" className="btn">{data.cta}</a>
        <a href="/todos" className="muted">{data.cta2}</a>
      </div>
    </div>
  );
}

export default Home;
