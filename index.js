const fs = require("fs");
require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const crypto = require("crypto");
const axios = require('axios');

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
    const mti = uid.rnd()
    const amount = await get(req.body.id, req.body.range);
    const data =
    {
      merchantId: process.env.MERCHID,
      merchantTransactionId: mti,
      merchantUserId: req.body.userId,
      amount: amount,
      redirectUrl: process.env.CLIENT + "/#/menu/dashboard",
      redirectMode: "REDIRECT",
      callbackUrl: process.env.SERVER + "/verify",
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    }

    const key = process.env.MERCHKEY
    const index = process.env.MERCHINDEX

    const buf = JSON.stringify(data)
    const payload = Buffer.from(buf).toString('base64');
    const code = payload + "/pg/v1/pay" + key
    var hash = crypto.createHash('sha256');
    originalValue = hash.update(code, 'utf-8');
    hashValue = originalValue.digest('hex');
    const xverify = hashValue + "###" + index
    const config = {
      headers: {
        accept: 'application/json',
        "Content-Type": "application/json",
        "X-VERIFY": xverify,
      }
    };

    const url = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay"

    const pay = {
      request: payload
    }

    const response = await axios.post(url, pay, config)
    if (response.data.success) res.status(200).json({ url: response.data.data.instrumentResponse.redirectInfo.url })

    console.log(response.data.data)
  } catch (error) {
    console.log(error.message);
    res.status(error.response.status).json({ error: error.message });
  }
})

app.get("/", (req, res) => {
  res.send("server is live")
})

app.post("/verify", async (req, res) => {
  console.log(req)

  // console.log(req);
  // let body =
  //   req.body.response.razorpay_order_id +
  //   "|" +
  //   req.body.response.razorpay_payment_id;
  // console.log(req.body);

  // var expectedSignature = crypto
  //   .createHmac("sha256", process.env.RAZOR_SECRET)
  //   .update(body.toString())
  //   .digest("hex");
  // var response = { signatureIsValid: "false" };
  // if (expectedSignature === req.body.response.razorpay_signature) {
  //   try {
  //     const payment = await instance.payments.fetch(
  //       req.body.response.razorpay_payment_id
  //     );
  //     const order = await instance.orders.fetch(
  //       req.body.response.razorpay_order_id
  //     );

  //     console.log({ ...payment });
  //     console.log({ ...order });
  //     const clientId = req.body.userId;
  //     const destinationEmail = req.body.email;

  //     // const invoiceId = shortId.generate();
  //     // const invoiceNumber = 'FACT-' + invoiceId + '-' + req.body.response.razorpay_payment_id;

  //     const invoiceNumber = uid.rnd();
  //     let college = "";
  //     let phone = "";
  //     const cityRef = doc(db, "users", req.body.userId);
  //     const docSnap = await getDoc(cityRef);
  //     if (!docSnap.exists) {
  //       console.log("No such document!");
  //     } else {
  //       college = docSnap.data().college;
  //       phone = docSnap.data().mobile;
  //     }

  //     const fileName = invoiceNumber + ".pdf";
  //     const filePath = `/tmp/${fileName}`;
  //     const client = {
  //       name: req.body.userName,
  //       email: req.body.email,
  //       clientId: req.body.userId,
  //       pricePerSession: 1,
  //       college,
  //       phone,
  //       address: "",
  //       city: "",
  //       state: "",
  //       postal_code: "",
  //     };
  //     const invoiceDetails = {
  //       client,
  //       items: [
  //         {
  //           item: req.body.item,
  //           quantity: 1,
  //           amountSum: order.amount / 100,
  //           subtotal: order.amount / 100,
  //         },
  //       ],
  //       invoiceNumber,
  //       paid: order.amount / 100,
  //       subtotal: order.amount / 100,
  //     };

  //     await generateInvoicePdf(invoiceDetails, filePath, after, res);

  //     async function after(res) {
  //       try {
  //         const storageRef = ref(
  //           storage,
  //           `invoices/${req.body.response.razorpay_payment_id}/${fileName}`
  //         );
  //         const file = fs.readFileSync(filePath, "base64");
  //         uploadString(storageRef, file, "base64").then((snapshot) => {
  //           console.log("Uploaded a base64 string!");
  //           getDownloadURL(snapshot.ref).then(async (downloadURL) => {
  //             console.log("File available at", downloadURL);
  //             await update(db, order, downloadURL, res);
  //           });
  //         });

  //         async function update(db, order, downloadURL, res) {
  //           await addDoc(collection(db, "payments"), {
  //             amount: order.amount / 100,
  //             invoice: downloadURL,
  //             item: "course",
  //             itemName: req.body.item,
  //             razorId: req.body.response.razorpay_payment_id,
  //             satus: "purchased",
  //             userId: req.body.userId,
  //             userName: req.body.userName,
  //             timestamp: serverTimestamp(),
  //           });
  //           const course = doc(db, "courses", req.body.courseId);
  //           const unionRes = await updateDoc(course, {
  //             enrolled: arrayUnion({
  //               userId: req.body.userId,
  //               payRange: req.body.range,
  //               invoice: downloadURL,
  //             }),
  //           });
  //           await updateDoc(course, {
  //             enrolled_arr: arrayUnion(req.body.userId),
  //           });
  //           response = { signatureIsValid: "true" };
  //           res.json({ response });
  //         }

  //         const files = [filePath];

  //         // const pdf = [`https://cyclic-grumpy-puce-frog-us-east-1.s3.amazonaws.com/some_files/${invoiceNumber}.pdf`]
  //         // console.log(pdf);

  //         await sendGmail(
  //           destinationEmail,
  //           `
  //             <!-- HTML Codes by Quackit.com -->
  //             <!DOCTYPE html>
  //             <title>Text Example</title>
  //             <style>
  //             div.container {
  //             background-color: #ffffff;
  //             }
  //             div.container p {
  //             font-family: Arial;
  //             font-size: 14px;
  //             font-style: normal;
  //             font-weight: normal;
  //             text-decoration: none;
  //             text-transform: none;
  //             color: #000000;
  //             background-color: #ffffff;
  //             }
  //             </style>

  //             <div class="container">
  //             <p>Hello,</p>
  //             <p></p>
  //             <p>I hope everything is good from your side. As per our session no. <b>${invoiceNumber}</b> , please find below the invoice.</p>
  //             <p>Thanks.</p>
  //             <p><b>Note -> This is an automatic email.</b>
  //             </div>

  //             `,
  //           `Invoice: ${invoiceNumber}`,
  //           files
  //         );
  // } catch (error) {
  //   console.log(error);
  //   res.status(500).json({ error });
  // }
  // }
  // } catch (error) {
  //   console.log(error);
  //   res.status(500).json({ error });
  // }
  // } else {
  //   res.status(500).json({ error: "signature Error" });
  // }
});

app.post("/event/email", async (req, res) => {
  const id = req.body.eventId;
  console.log(req);
  try {
    const cityRef = doc(db, "events", id);
    const docSnap = await getDoc(cityRef);
    if (!docSnap.exists) {
      console.log("No such document!");
      res.status(500).json({ error: "No such document!" });
    } else {
      console.log("Document data:", docSnap.data());
      const data = docSnap.data();
      await sendGmail(
        req.body.email,
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
        <p>Hello, ${req.body.name}</p>
        <p>Your Team ${req.body.teamName} successfully registered to event ${data.name}</p>
        <p>Thanks.</p>
        <p><b>Note -> This is an automatic email.</b>
        </div>
        
        `,
        `Registration success`
      );
      res.status(200).json({ ok: "ok" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
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
  console.log(req.body.id);
  try {
    const fee = await getRegisterFee(req.body.id);
    console.log(fee / 100);

    var options = {
      amount: fee, // amount in the smallest currency unit
      currency: "INR",
    };
    instance.orders.create(options, function (err, order) {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: err });
      }

      return res.status(200).json({ order });
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error });
  }
});

app.post("/register-verify", async (req, res) => {
  let body =
    req.body.response.razorpay_order_id +
    "|" +
    req.body.response.razorpay_payment_id;
  console.log(req.body);

  var expectedSignature = crypto
    .createHmac("sha256", process.env.RAZOR_SECRET)
    .update(body.toString())
    .digest("hex");
  var response = { signatureIsValid: "false" };

  if (expectedSignature === req.body.response.razorpay_signature) {
    try {
      const payment = await instance.payments.fetch(
        req.body.response.razorpay_payment_id
      );
      const order = await instance.orders.fetch(
        req.body.response.razorpay_order_id
      );

      console.log({ ...payment });
      console.log({ ...order });
      const destinationEmail = req.body.email;

      // const invoiceId = shortId.generate();
      // const invoiceNumber = 'FACT-' + invoiceId + '-' + req.body.response.razorpay_payment_id;

      const invoiceNumber = uid.rnd();

      let college = "";
      let phone = "";
      const cityRef = doc(db, "users", req.body.userId);
      const docSnap = await getDoc(cityRef);
      if (!docSnap.exists) {
        console.log("No such document!");
      } else {
        college = docSnap.data().college;
        phone = docSnap.data().mobile;
      }

      const fileName = invoiceNumber + ".pdf";
      const filePath = `/tmp/${fileName}`;
      const client = {
        name: req.body.userName,
        email: req.body.email,
        clientId: req.body.userId,
        pricePerSession: 1,
        college,
        phone,
        address: "",
        city: "",
        state: "",
        postal_code: "",
      };

      const invoiceDetails = {
        client,
        items: [
          {
            item: req.body.item,
            quantity: 1,
            amountSum: order.amount / 100,
            subtotal: order.amount / 100,
          },
        ],
        invoiceNumber,
        paid: order.amount / 100,
        subtotal: order.amount / 100,
      };

      await generateInvoicePdf(invoiceDetails, filePath, after, res);

      async function after(res) {
        try {
          const storageRef = ref(
            storage,
            `invoices/${req.body.response.razorpay_payment_id}/${fileName}`
          );
          const file = fs.readFileSync(filePath, "base64");
          uploadString(storageRef, file, "base64").then((snapshot) => {
            console.log("Uploaded a base64 string!");
            getDownloadURL(snapshot.ref).then(async (downloadURL) => {
              console.log("File available at", downloadURL);
              await update(db, order, downloadURL, res);
            });
          });

          async function update(db, order, downloadURL, res) {
            await addDoc(collection(db, "payments"), {
              amount: order.amount / 100,
              invoice: downloadURL,
              item: "event",
              itemName: req.body.item,
              razorId: req.body.response.razorpay_payment_id,
              satus: "purchased",
              userId: req.body.userId,
              userName: req.body.userName,
              timestamp: serverTimestamp(),
            });
            const event = doc(db, "events", req.body.eventId);
            const unionRes = await updateDoc(event, {
              enrolled: arrayUnion({
                userId: req.body.userId,
                payRange: req.body.range ? req.body.range : "",
                invoice: downloadURL,
              }),
            });
            await updateDoc(event, {
              enrolled_arr: arrayUnion(req.body.userId),
            });

            await addDoc(collection(db, "enrolled"), {
              ...req.body.eventData,
            });

            response = { signatureIsValid: "true" };
            res.json({ response });
          }

          const files = [filePath];

          // const pdf = [`https://cyclic-grumpy-puce-frog-us-east-1.s3.amazonaws.com/some_files/${invoiceNumber}.pdf`]
          // console.log(pdf);

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
          res.status(500).json({ error });
        }
      }
    } catch (error) {
      res.status(500).json({ error: "signature not valid" });
    }
  } else {
    res.json({ error: "signature not valid" });
  }
});

app.listen(4242, () => console.log("Running on port 4242"));
