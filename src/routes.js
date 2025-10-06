import { Router } from "express";
import db from "./firebase.js";

const router = Router();
const bracelets = db.collection("bracelets");


//getBracelets
router.get("/", async (req, res) => {
    try {
        const snapshot = await bracelets.get();
        const allBracelets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(allBracelets);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.post("/enable/:braceletId", async (req, res) => {
    try {
        const { braceletId } = req.params;
        const docRef = bracelets.doc(braceletId);
        const doc = await docRef.get();

        if (doc.exists) {
            // Si la manilla ya existe, actualiza su estado a isActive: true
            await docRef.update({ isActive: true });
            const updatedDoc = await docRef.get();
            return res.json({ message: "Manilla ya existía, estado actualizado a habilitada", data: updatedDoc.data() });
        }

        // Si no existe, crea una nueva manilla con isActive: true
        const newData = { isActive: true };
        await docRef.set(newData);

        const updatedDoc = await docRef.get();
        res.json({ message: "Manilla habilitada", data: updatedDoc.data() });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.post("/disable/:braceletId", async (req, res) => {
    try {
        const { braceletId } = req.params;
        const docRef = bracelets.doc(braceletId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw new Error("Manilla no encontrada");
        }

        const updatedData = { isActive: false };
        await docRef.update(updatedData);

        const updatedDoc = await docRef.get();
        res.json({ message: "Manilla deshabilitada", data: updatedDoc.data() });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});


router.delete("/remove/:braceletId", async (req, res) => {
    try {
        const docRef = bracelets.doc(req.params.braceletId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: "Manilla no encontrada" });
        }

        await docRef.delete();
        res.json({ message: "Manilla eliminada" });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});


router.put("/affiliate/:braceletId", async (req, res) => {
    try {
        const { userId } = req.body;
        const { braceletId } = req.params;
        const ref = bracelets.doc(braceletId);
        const doc = await ref.get();

        if (!doc.exists) {
            throw new Error("Manilla no habilitada para ser afiliada");
        }

        const data = doc.data();

        // Verificar si ya está afiliada a un usuario
        if (data.userId) {
            if (data.userId === userId) {
                throw new Error("La manilla ya está afiliada a su cuenta");
            } else {
                throw new Error("La manilla ya se encuentra afiliada");
            }
        }

        if (!data.isActive) {
            throw new Error("La manilla no está activa y no puede ser afiliada");
        }

        const linkedAt = new Date().toISOString(); // Fecha y hora actual en formato ISO
        await ref.update({ userId, linkedAt });
        res.json({ message: "Manilla afiliada al usuario", data: { braceletId, userId, linkedAt } });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});


router.post("/payWithBracelet", async (req, res) => {
    try {
        const { amount, braceletId } = req.body;

        // Validaciones iniciales
        if (amount <= 0) {
            return res.status(400).json({ error: "El monto debe ser mayor a 0" });
        }

        const receiverId = "4bzZOjYzsKPimaylIUkt"; // ID fijo del receptor
        const braceletRef = bracelets.doc(braceletId);
        const braceletDoc = await braceletRef.get();

        if (!braceletDoc.exists) {
            return res.status(404).json({ error: "Manilla no encontrada" });
        }

        const braceletData = braceletDoc.data();

        if (!braceletData.isActive) {
            return res.status(400).json({ error: "La manilla no está habilitada para realizar pagos" });
        }

        // Verificar que la manilla tenga un userId asociado
        const senderId = braceletData.userId;
        if (!senderId) {
            return res.status(400).json({ error: "La manilla no está afiliada a ningún usuario" });
        }

        // Verificar saldo del remitente
        const senderRef = db.collection("balances").doc(senderId);
        const senderDoc = await senderRef.get();

        let senderBalance = 0;
        if (senderDoc.exists) {
            senderBalance = senderDoc.data().currentBalance || 0;
        }

        if (senderBalance < amount) {
            return res.status(400).json({ error: `Saldo insuficiente. Balance actual: $${senderBalance.toFixed(2)}` });
        }

        // Verificar saldo del receptor
        const receiverRef = db.collection("balances").doc(receiverId);
        const receiverDoc = await receiverRef.get();

        let receiverBalance = 0;
        if (receiverDoc.exists) {
            receiverBalance = receiverDoc.data().currentBalance || 0;
        }

        // Ejecutar la transferencia atómica
        await db.runTransaction(async (transaction) => {
            const newSenderBalance = senderBalance - amount;
            const newReceiverBalance = receiverBalance + amount;

            // Actualizar saldo del remitente
            transaction.update(senderRef, { currentBalance: newSenderBalance });

            // Actualizar saldo del receptor
            transaction.update(receiverRef, { currentBalance: newReceiverBalance });

            // Registrar las transacciones individuales
            const now = new Date();
            const transferId = `txn_${now.getTime()}`;

            // Transacción del remitente (sent)
            transaction.set(db.collection("transfers").doc(`${transferId}_sent`), {
                userId: senderId,
                amount: -amount,
                type: "sent",
                relatedUserId: receiverId,
                description: "Pago realizado con manilla",
                status: "completed",
                timestamp: now.toISOString(),
                transactionId: transferId,
            });

            // Transacción del receptor (received)
            transaction.set(db.collection("transfers").doc(`${transferId}_received`), {
                userId: receiverId,
                amount: amount,
                type: "received",
                relatedUserId: senderId,
                description: "Pago recibido de manilla",
                status: "completed",
                timestamp: now.toISOString(),
                transactionId: transferId,
            });
        });

        res.json({
            message: "Pago realizado con éxito",
            data: {
                fromUserId: senderId,
                toUserId: receiverId,
                amount: amount,
            },
        });
    } catch (e) {
        console.error("Error en payWithBracelet:", e.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

router.delete("/cleanUserRegistrations", async (req, res) => {
    try {
        const userRegistrationsRef = db.collection("user_registrations");
        const snapshot = await userRegistrationsRef.get();

        if (snapshot.empty) {
            return res.status(404).json({ message: "No se encontraron registros en la tabla user_registrations" });
        }

        const phoneNumbers = new Set();
        const batch = db.batch();

        snapshot.forEach((doc) => {
            const data = doc.data();
            const phoneNumber = data.phoneNumber;

            // Eliminar si el phoneNumber está vacío o si ya existe en el conjunto
            if (!phoneNumber || phoneNumbers.has(phoneNumber)) {
                batch.delete(doc.ref);
            } else {
                phoneNumbers.add(phoneNumber); // Agregar el número al conjunto
            }
        });

        // Ejecutar el batch para eliminar duplicados
        await batch.commit();

        res.json({ message: "Duplicados eliminados y registros con phoneNumber vacío eliminados" });
    } catch (e) {
        console.error("Error en cleanUserRegistrations:", e.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

export default router;
