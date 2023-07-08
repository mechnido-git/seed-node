// This is your test secret API key.

require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const serviceAC = require("./cert.json");
var crypto = require("crypto");

const shortId = require('shortid');
const path = require('path');


const { generateInvoicePdf } = require("./utils/pdf-generator");
const { sendGmail } = require("./utils/email-sender");

const {
  initializeApp,
  applicationDefault,
  cert,
} = require("firebase-admin/app");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");
initializeApp({
  credential: cert(serviceAC),
});

const Razorpay = require("razorpay");
var instance = new Razorpay({
  key_id: process.env.RAZOR_ID,
  key_secret: process.env.RAZOR_SECRET,
});

const db = getFirestore();


// var whitelist = ["http://localhost:3000", "https://gregarious-griffin-da22a3.netlify.app"];
// var corsOptions = {
//   origin: function (origin, callback) {
//     if (whitelist.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true, //access-control-allow-credentials:true
//   optionSuccessStatus: 200,
// };

app.use(cors());

const courses = new Map([[0, { items: [20000, 35000, 45000] }]]);

const YOUR_DOMAIN = "http://localhost:3000";

const get = async (index, id) => {
  const item = courses.get(index);
  console.log("id ->" + id);
  console.log(index);
  try {
    const cityRef = db.collection("courses").doc(index);
    const doc = await cityRef.get();
    if (!doc.exists) {
      console.log("No such document!");
    } else {
      console.log("Document data:", doc.data().fee[id].price);
    }
    return parseInt(doc.data().fee[id].price * 100);
  } catch (error) {
    console.log(error);
  }
};

app.use(express.json());

app.post("/order", async (req, res) => {
  try {
    //res.header("Access-Control-Allow-Origin", "*");

    const amount = await get(req.body.id, req.body.range);
    console.log(amount);

    var options = {
      amount: amount, // amount in the smallest currency unit
      currency: "INR",
    };
    instance.orders.create(options, function (err, order) {
      if (err) return res.status(500).json({ error: err });

      return res.status(200).json({ order });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  //res.redirect(303, session.url);
});

app.post("/verify", async (req, res) => {
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
  if (expectedSignature === req.body.response.razorpay_signature){
    try {
      const course = db.collection("courses").doc(req.body.courseId);
    const unionRes = await course.update({
      enrolled: FieldValue.arrayUnion({
        userId: req.body.userId,
        payRange: req.body.range,
      }),
    });

    await course.update({
      enrolled_arr: FieldValue.arrayUnion(req.body.userId),
    });

    const payment = await instance.payments.fetch(req.body.response.razorpay_payment_id)
    const order = await instance.orders.fetch(req.body.response.razorpay_order_id)
    console.log({...payment});
    console.log({...order});
    const clientId = req.body.userId
    const destinationEmail = req.body.email;

    const invoiceId = shortId.generate();
    const invoiceNumber = 'FACT-' + invoiceId + '-' + req.body.response.razorpay_payment_id;

    const fileName = invoiceNumber + '.pdf'
        const filePath = `/tmp/${fileName}`;
        const client = {
          name: req.body.userName,
          email: req.body.email,
          clientId: req.body.uid,
          pricePerSession: 1,
          address: "",
          city: "",
          state: "",
          postal_code: ""
        }
        const invoiceDetails = { client, items: [{item: req.body.item, quantity: 1, amountSum: order.amount/100, subtotal: order.amount/100}], invoiceNumber, paid: order.amount/100, subtotal: order.amount/100 };

        generateInvoicePdf(invoiceDetails, filePath);

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
      )

    response = { signatureIsValid: "true" };
    } catch (error) {
      console.log(error);
    }
  }
  res.json({response});
});

app.post("/event/email", async(req, res) => {
  const id = req.body.eventId;
  console.log(req);
  try {
    const cityRef = db.collection('events').doc(id);
    const doc = await cityRef.get();
    if (!doc.exists) {
      console.log('No such document!');
      res.status(500).json({error: 'No such document!'})
    } else {
      console.log('Document data:', doc.data());
      const data = doc.data()
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
        `Registration success`,
    )
    res.status(200).json({ok:"ok"})
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({error})
  }
})
app.listen(4242, () => console.log("Running on port 4242"));
