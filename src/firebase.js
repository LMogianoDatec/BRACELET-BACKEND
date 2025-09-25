import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

try {
    console.log("Contenido de GOOGLE_SERVICE_ACCOUNT_JSON:", process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    console.log("Service Account cargado correctamente:", serviceAccount);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
} catch (error) {
    console.error("Error al cargar GOOGLE_SERVICE_ACCOUNT_JSON:", error.message);
}

const db = admin.firestore();
export default db;