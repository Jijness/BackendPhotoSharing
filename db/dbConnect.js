import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const dbConnect = async () => {
    try {
        await mongoose.connect(process.env.DB_URL, {
            dbName: "photo_sharing",
        });
        console.log("✅ Successfully connected to MongoDB Atlas!");
    } catch (err) {
        console.log("❌ Unable to connect to MongoDB Atlas!");
        console.error(error);
    }
}

export default dbConnect;
