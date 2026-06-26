import { makeServer } from "./server_factory";
const PORT = Number(process.env.PORT) || 5180;
makeServer(process.env.FLUXE_BACKEND).listen(PORT, () =>
  console.log(`fluxe @ http://localhost:${PORT} (backend: ${process.env.FLUXE_BACKEND || "memory"})`));
