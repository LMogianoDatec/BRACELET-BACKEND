import { Router } from "express";
import db from "./firebase.js";
const routerUser = Router();
const user = db.collection("user_registrations");


//getUsers
routerUser.get("/", async (req, res) => {
    try {
        const snapshot = await user.get();
        const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(allUsers);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

//getUsersByPhone
routerUser.get("/:phoneNumber", async (req, res) => {
    try {      
        const phoneNumber = req.params.phoneNumber;
        const snapshot = await user.where('phoneNumber', '==', phoneNumber).get();
        const allUsers = snapshot.docs.map(doc=>({id:doc.id, ...doc.data()}));
        res.json(allUsers);
     
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});
//putUsers
routerUser.post("/:phoneNumber", async (req, res) => {
    try {      
        const phoneNumber = req.params.phoneNumber;
        var {createdAt,documentId,documentType, email, isPhoneVerified,isPinSet,pin,socialReason,updatedAt} = req.body;
        updatedAt=new Date().toISOString();
        const snapshot = (await user.where('phoneNumber', '==', phoneNumber).get());
        if (snapshot.size==0) {
            createdAt = new Date().toISOString();
         await user.add({createdAt,documentId,documentType, email, isPhoneVerified,isPinSet,pin,socialReason,updatedAt})   
            res.json({ message: "Usuario insertado correctamente." });
        }else
        {
            const doc = snapshot.docs[0];
            const userId = doc.id;            
            await user.doc(userId).update({documentId,documentType, email, isPhoneVerified,isPinSet,pin,socialReason,updatedAt });
            res.json({ message: "Usuario actualizado correctamente." });
        }        
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});



export default routerUser;