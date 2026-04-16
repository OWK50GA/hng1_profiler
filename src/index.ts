import express from "express";
import cors from "cors";
import profileRoutes from "./routes/profiles"

const app = express();

app.use(express.json());
app.use(cors());

app.use("/api/profiles", profileRoutes);

app.listen(3001, () => {
  console.log("server is running on port 3001");
});
