// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export interface HomeData { title: string; cta: string }

export function Home({ data }: { data: HomeData }) {
  return (
    <div className="card">
      <h1>{data.title}</h1>
      <p className="muted">Starter tối giản: backend feature-module + frontend feature.</p>
      <a href="/todos" className="btn">{data.cta}</a>
    </div>
  );
}

export default Home;
