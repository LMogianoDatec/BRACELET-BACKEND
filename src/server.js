import express from "express";
import cors from "cors";
import router from "./routes.js";
import routerUser from "./user_registrations.js";
const app = express();
app.use(express.json());
app.use(cors());

app.use("/api/bracelets", router);
app.use("/api/user_registrations", routerUser);
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor en http://0.0.0.0:${PORT}`);
});