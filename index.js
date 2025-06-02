import express from "express";
import fileUpload from "express-fileupload";
import cors from "cors";
import dbConnect from "./db/dbConnect.js";
import {port, hostname} from "./config/env.js";
import userRoute from "./routes/UserRouter.js";
import photoRoute from "./routes/PhotoRouter.js";




const app = express();
await dbConnect();
app.use(express.json());

app.use(cors({
    credentials: true
}));

app.use(fileUpload());

app.use('/images', express.static('images'));

app.use("/api/user", userRoute);
app.use("/api/photo", photoRoute);

app.get("/", (request, response) => {
    response.send({message: "Hello from photo-sharing app API!"});
});

app.listen(port, hostname, () => {
    console.log(`Server is running on http://${hostname}:${port}`);
});

export default app;


