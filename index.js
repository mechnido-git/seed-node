// This is your test secret API key.

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_KEY);
const express = require("express");
const app = express();
const cors = require("cors");
const serviceAC = require("./cert.json");

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

var whitelist = ["http://localhost:3000", "https://gregarious-griffin-da22a3.netlify.app"];
var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, //access-control-allow-credentials:true
  optionSuccessStatus: 200,
};

app.use(cors());

const courses = new Map([[0, { items: [20000, 35000, 45000] }]]);

const YOUR_DOMAIN = "https://gregarious-griffin-da22a3.netlify.app";

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

const read = async (data) => {
  console.log(data);
  const course = db.collection("courses").doc(data.courseId);
  const unionRes = await course.update({
    enrolled: FieldValue.arrayUnion({
      userId: data.userId,
      payRange: data.range,
    }),
  });
};

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (request, response) => {
    let event = request.body;
    let data;
    // Only verify the event if you have an endpoint secret defined.
    // Otherwise use the basic event deserialized with JSON.parse
    if (endpointSecret) {
      // Get the signature sent by Stripe
      const signature = request.headers["stripe-signature"];
      try {
        event = stripe.webhooks.constructEvent(
          request.body,
          signature,
          endpointSecret
        );
      } catch (err) {
        console.log(`⚠️  Webhook signature verification failed.`, err.message);
        return response.sendStatus(400);
      }
      // data = request.body.data.object;
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        console.log("compleate");
        console.log(event);
        stripe.customers
          .retrieve(event.data.object.customer)
          .then((customer) => {
            console.log(customer);
            read(customer.metadata);
          })
          .catch((err) => console.log(err));
        //console.log(event.data);
        // Then define and call a method to handle the successful payment intent.
        // handlePaymentIntentSucceeded(paymentIntent);
        break;
      case "payment_method.attached":
        const paymentMethod = event.data.object;
        // Then define and call a method to handle the successful attachment of a PaymentMethod.
        // handlePaymentMethodAttached(paymentMethod);
        break;
      default:
        // Unexpected event type
        console.log(`Unhandled event type ${event.type}.`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  try {
    const customer = await stripe.customers.create({
      metadata: {
        userId: req.body.userId,
        courseId: req.body.id,
        range: req.body.range,
      },
    });
    const amount = await get(req.body.id, req.body.range)
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: req.body.name,
            },
            unit_amount: amount,
          },
          // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
          quantity: 1,
        },
      ],
      customer: customer.id,
      mode: "payment",
      success_url: `${YOUR_DOMAIN}/menu/courses`,
      cancel_url: `${YOUR_DOMAIN}/menu/courses`,
    });
    res.status(200).json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  //res.redirect(303, session.url);
});

app.listen(4242, () => console.log("Running on port 4242"));
