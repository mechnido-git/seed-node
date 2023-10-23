const fs = require("fs");
require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const crypto = require("crypto");
const axios = require('axios');
const shortId = require('shortid')

const { generateInvoicePdf } = require("./utils/pdf-generator");
const { sendGmail } = require("./utils/email-sender");

const { initializeApp } = require("firebase/app");
const { firebaseConfig } = require("./config");
const {
  doc,
  updateDoc,
  getFirestore,
  collection,
  addDoc,
  getDoc,
  arrayUnion,
  serverTimestamp,
  query,
  where,
  getDocs,
} = require("firebase/firestore");

initializeApp(firebaseConfig);

const {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  uploadString,
} = require("firebase/storage");
const ShortUniqueId = require("short-unique-id");

const uid = new ShortUniqueId({
  dictionary: "number",
  length: 22,
});

const storage = getStorage();
const db = getFirestore();

app.use(cors());

const get = async (index, id) => {
  console.log("id ->" + id);
  console.log(index);
  try {
    const cityRef = doc(db, "courses", index);
    const docSnap = await getDoc(cityRef);
    if (!docSnap.exists) {
      console.log("No such document!");
    } else {
      console.log("Document data:", docSnap.data().fee[id].price);
    }
    return parseInt(docSnap.data().fee[id].price * 100);
  } catch (error) {
    console.log(error);
  }
};

app.use(express.json());

// to send the request to the phonepay initaition
app.post("/order", async (req, res) => {

  try {
    const mti = uid.rnd() //merchend transaction ID
    const amount = await get(req.body.id, req.body.range);

    //setting data as in the phonepe documentation
    const data =
    {
      merchantId: process.env.MERCHID,
      merchantTransactionId: mti,
      merchantUserId: req.body.userId,
      amount: amount,
      redirectUrl: process.env.CLIENT + "/#/processing",
      redirectMode: "REDIRECT",
      callbackUrl: process.env.SERVER + "/verify",
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    }

    //storing the initiated transaction details for feature use
    await addDoc(collection(db, "transactions"), {
      amount: amount / 100,
      userId: req.body.userId,
      name: req.body.name,
      transactionId: mti,
      courseId: req.body.id,
      email: req.body.email,
      username: req.body.username,
      range: req.body.range,
      type: 'course'
    });

    const key = process.env.MERCHKEY
    const index = process.env.MERCHINDEX

    //convering the data to base64
    const buf = JSON.stringify(data)
    const payload = Buffer.from(buf).toString('base64');

    //genrating hash for the phonepe payment initiation
    const code = payload + "/pg/v1/pay" + key
    var hash = crypto.createHash('sha256');
    originalValue = hash.update(code, 'utf-8');
    hashValue = originalValue.digest('hex');
    const xverify = hashValue + "###" + index

    //necessary headers for payment initiation
    const config = {
      headers: {
        accept: 'application/json',
        "Content-Type": "application/json",
        "X-VERIFY": xverify,
      }
    };
    const url = process.env.PHONEPE

    //request body
    const pay = {
      request: payload
    }

    const response = await axios.post(url, pay, config)

    //sending the URL for the payment gateway to the client
    if (response.data.success) res.status(200).json({ url: response.data.data.instrumentResponse.redirectInfo.url })

  } catch (error) {
    console.log(error.message);
    res.status(error.response.status).json({ error: error.message });
  }
})

app.get("/", (req, res) => {
  res.send("server is live")
})

app.post("/verify", async (req, res) => {

  try {
    //decripting the response
    const request = req.body.response;
    const string64 = Buffer.from(request, 'base64').toString('ascii')
    const data = JSON.parse(string64)

    //checking for the transaction details initiated by the client and mathing the current transaction id that recieved
    const q = query(collection(db, "transactions"), where("transactionId", "==", data.data.merchantTransactionId));
    let order = false
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      order = doc.data()
    });

    if (!order) return res.status(500).json({ error: "server error" })

    // email for sending invoice
    const destinationEmail = order.email;

    //setting the data for the invoice pdf
    const invoiceNumber = uid.rnd();
    //display college/phone if it is in the database
    let college = "";
    let phone = "";
    const cityRef = doc(db, "users", order.userId);
    const docSnap = await getDoc(cityRef);
    if (!docSnap.exists) {
      console.log("No such document!");
    } else {
      college = docSnap.data().college;
      phone = docSnap.data().mobile;
    }

    const fileName = invoiceNumber + ".pdf";
    const filePath = `/tmp/${fileName}`; //local file path for generating pdf

    //client deatils for generating invoice
    const client = {
      name: order.username,
      email: order.email,
      clientId: order.userId,
      pricePerSession: 1,
      college,
      phone,
      address: "",
      city: "",
      state: "",
      postal_code: "",
    };

    //setting other invoice details
    const invoiceDetails = {
      client,
      items: [
        {
          item: order.name,
          quantity: 1,
          amountSum: order.amount,
          subtotal: order.amount,
        },
      ],
      invoiceNumber,
      paid: order.amount,
      subtotal: order.amount,
    };

    //genarting invoice pdf
    await generateInvoicePdf(invoiceDetails, filePath);

    //storing the generated pdf into firebase storage
    const storageRef = ref(
      storage,
      `invoices/${invoiceNumber}/${fileName}`
    );
    const file = fs.readFileSync(filePath, "base64");
    const snapshot = await uploadString(storageRef, file, "base64")
    console.log("Uploaded a base64 string!");
    const downloadURL = await getDownloadURL(snapshot.ref)
    console.log("File available at", downloadURL);

    //updating the database to finalize the payment
    await addDoc(collection(db, "payments"), {
      amount: order.amount / 100,
      invoice: downloadURL,
      item: "course",
      itemName: order.name,
      transactionId: order.transactionId,
      satus: "purchased",
      userId: order.userId,
      userName: order.username,
      timestamp: serverTimestamp(),
    });

    //assigning the purachsed userid to the course
    const course = doc(db, "courses", order.courseId);
    await updateDoc(course, {
      enrolled: arrayUnion({
        userId: order.userId,
        payRange: order.range,
        invoice: downloadURL,
      }),
    });
    await updateDoc(course, {
      enrolled_arr: arrayUnion(order.userId),
    });

    //sending response to the client after necessary updates
    response = { signatureIsValid: "true" };
    res.json({ response });

    const files = [filePath];

    //sendign email with attached pdf invoice
    await sendGmail(
      destinationEmail,
      `
              <!-- HTML Codes by Quackit.com -->
              <!DOCTYPE html>
              <title>Text Example</title>
              <style>
              div.container {
              background-color: #ffffff;
              }
              div.container p {
              font-family: Arial;
              font-size: 14px;
              font-style: normal;
              font-weight: normal;
              text-decoration: none;
              text-transform: none;
              color: #000000;
              background-color: #ffffff;
              }
              </style>

              <div class="container">
              <p>Hello,</p>
              <p></p>
              <p>I hope everything is good from your side. As per our session no. <b>${invoiceNumber}</b> , please find below the invoice.</p>
              <p>Thanks.</p>
              <p><b>Note -> This is an automatic email.</b>
              </div>

              `,
      `Invoice: ${invoiceNumber}`,
      files
    );
  } catch (error) {
    console.log(error)
    res.status(500).json(error)
  }
});

const getRegisterFee = async (id) => {
  try {
    const cityRef = doc(db, "events", id);
    const docSnap = await getDoc(cityRef);
    if (!docSnap.exists) {
      console.log("No such document!");
    } else {
      console.log("Document data:", docSnap.data().registerFee);
    }
    return parseInt(docSnap.data().registerFee * 100);
  } catch (error) {
    console.log(error);
  }
};

app.post("/register", async (req, res) => {
  try {
    const mti = uid.rnd() //merchend transaction ID
    const fee = await getRegisterFee(req.body.eventId);

    //setting data as in the phonepe documentation
    const data =
    {
      merchantId: process.env.MERCHID,
      merchantTransactionId: mti,
      merchantUserId: req.body.userId,
      amount: fee,
      redirectUrl: process.env.CLIENT + "/#/processing",
      redirectMode: "REDIRECT",
      callbackUrl: process.env.SERVER + "/register-verify",
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    }

    //storing the initiated transaction details for feature use
    await addDoc(collection(db, "transactions"), {
      amount: fee / 100,
      userId: req.body.userId,
      name: req.body.name,
      transactionId: mti,
      eventId: req.body.eventId,
      email: req.body.teamEmail,
      username: req.body.username,
      teamName: req.body.teamName,
      teamMembers: req.body.teamMembers,
      capName: req.body.capName,
      kartType: req.body.kartType,
      contact: req.body.contact,
      collegeName: req.body.collegeName,
      fac: req.body.fac,
      adress: req.body.adress,
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.pincode,
      members: req.body.members,
      faculty: req.body.faculty,
      type: 'event'
    });

    const key = process.env.MERCHKEY
    const index = process.env.MERCHINDEX

    //convering the data to base64
    const buf = JSON.stringify(data)
    const payload = Buffer.from(buf).toString('base64');

    //genrating hash for the phonepe payment initiation
    const code = payload + "/pg/v1/pay" + key
    var hash = crypto.createHash('sha256');
    originalValue = hash.update(code, 'utf-8');
    hashValue = originalValue.digest('hex');
    const xverify = hashValue + "###" + index

    //necessary headers for payment initiation
    const config = {
      headers: {
        accept: 'application/json',
        "Content-Type": "application/json",
        "X-VERIFY": xverify,
      }
    };
    const url = process.env.PHONEPE

    //request body
    const pay = {
      request: payload
    }

    const response = await axios.post(url, pay, config)

    //sending the URL for the payment gateway to the client
    if (response.data.success) res.status(200).json({ url: response.data.data.instrumentResponse.redirectInfo.url })

  } catch (error) {
    console.log(error);
    return res.status(500).json({ error });
  }
});

app.post("/register-verify", async (req, res) => {

  try {
    //decripting the response
    const request = req.body.response;
    const string64 = Buffer.from(request, 'base64').toString('ascii')
    const data = JSON.parse(string64)

    //checking for the transaction details initiated by the client and mathing the current transaction id that recieved
    const q = query(collection(db, "transactions"), where("transactionId", "==", data.data.merchantTransactionId));
    let order = false
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      order = doc.data()
    });

    if (!order) return res.status(500).json({ error: "server error" })

    // email for sending invoice
    const destinationEmail = order.email;

    //setting the data for the invoice pdf
    const invoiceNumber = uid.rnd();
    //display college/phone if it is in the database
    let college = "";
    let phone = "";
    const cityRef = doc(db, "users", order.userId);
    const docSnap = await getDoc(cityRef);
    if (!docSnap.exists) {
      console.log("No such document!");
    } else {
      college = docSnap.data().college;
      phone = docSnap.data().mobile;
    }

    const fileName = invoiceNumber + ".pdf";
    const filePath = `/tmp/${fileName}`; //local file path for generating pdf

    //client deatils for generating invoice
    const client = {
      name: order.username,
      email: order.email,
      clientId: order.userId,
      pricePerSession: 1,
      college,
      phone,
      address: "",
      city: "",
      state: "",
      postal_code: "",
    };

    //setting other invoice details
    const invoiceDetails = {
      client,
      items: [
        {
          item: order.name,
          quantity: 1,
          amountSum: order.amount,
          subtotal: order.amount,
        },
      ],
      invoiceNumber,
      paid: order.amount,
      subtotal: order.amount,
    };

    //genarting invoice pdf
    await generateInvoicePdf(invoiceDetails, filePath);


    //storing the generated pdf into firebase storage
    const storageRef = ref(
      storage,
      `invoices/${invoiceNumber}/${fileName}`
    );
    const file = fs.readFileSync(filePath, "base64");
    const snapshot = await uploadString(storageRef, file, "base64")
    console.log("Uploaded a base64 string!");
    const downloadURL = await getDownloadURL(snapshot.ref)
    console.log("File available at", downloadURL);

    //updating the database to finalize the payment
    await addDoc(collection(db, "payments"), {
      amount: order.amount / 100,
      invoice: downloadURL,
      item: "event",
      itemName: order.name,
      transactionId: order.transactionId,
      satus: "purchased",
      userId: order.userId,
      userName: order.username,
      timestamp: serverTimestamp(),
    });

    const event = doc(db, "events", order.eventId);
    await updateDoc(event, {
      enrolled: arrayUnion({
        userId: order.userId,
        invoice: downloadURL,
      }),
    });

    await updateDoc(event, {
      enrolled_arr: arrayUnion(order.userId),
    });

    await addDoc(collection(db, "enrolled"), {
      userId: order.userId,
      eventId: order.eventId,
      teamName: order.teamName,
      teamEmail: order.teamEmail,
      teamMembers: order.teamMembers,
      capName: order.capName,
      kartType: order.kartType,
      contact: order.contact,
      collegeName: order.collegeName,
      fac: order.fac,
      adress: order.adress,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      members: order.members,
      faculty: order.faculty
    });

    response = { signatureIsValid: "true" };
    res.json({ response });

    const files = [filePath];

    await sendGmail(
      destinationEmail,
      `
            <!-- HTML Codes by Quackit.com -->
            <!DOCTYPE html>
            <title>Text Example</title>
            <style>
            div.container {
            background-color: #ffffff;
            }
            div.container p {
            font-family: Arial;
            font-size: 14px;
            font-style: normal;
            font-weight: normal;
            text-decoration: none;
            text-transform: none;
            color: #000000;
            background-color: #ffffff;
            }
            </style>
  
            <div class="container">
            <p>Hello,</p>
            <p></p>
            <p>I hope everything is good from your side. As per our session no. <b>${invoiceNumber}</b> , please find below the invoice.</p>
            <p>Thanks.</p>
            <p><b>Note -> This is an automatic email.</b>
            </div>
            
            `,
      `Invoice: ${invoiceNumber}`,
      files
    );

  } catch (error) {
    console.log(error);
    return res.status(500).json({ error });
  }
});

app.listen(4242, () => console.log("Running on port 4242"));
