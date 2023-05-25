// This is your test secret API key.

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_KEY);
const express = require("express");
const app = express();
const cors = require("cors");
const serviceAC = require("./cert.json");
var crypto = require("crypto");

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

const db = getFirestore();

const endpointSecret = process.env.END_SECRET;

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
    const Razorpay = require("razorpay");
    var instance = new Razorpay({
      key_id: "rzp_test_NWomFOohCdnvuS",
      key_secret: "6VEmG14FummMq3riQwcR48Hk",
    });

    const amount = await get(req.body.id, req.body.range);

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
    .createHmac("sha256", "6VEmG14FummMq3riQwcR48Hk")
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
    response = { signatureIsValid: "true" };
    } catch (error) {
      console.log(error);
    }
  }
  res.json({response});
});

app.listen(4242, () => console.log("Running on port 4242"));
