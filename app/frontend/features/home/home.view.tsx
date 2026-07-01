// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export interface HomeData { title: string; cta: string }
export function Home({ data }: { data: HomeData }) {
  return (<div className="card"><h1>{data.title}</h1><a href="/todos" className="btn">{data.cta}</a></div>);
}
export default Home;
