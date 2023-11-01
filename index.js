const fs = require("fs");
require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const crypto = require("crypto");
const axios = require('axios');
const shortId = require('shortid')

const { generateInvoicePdf, formatDate } = require("./utils/pdf-generator");
const { sendGmail } = require("./utils/send-email");

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
  getDownloadURL,
  uploadString,
} = require("firebase/storage");

const ShortUniqueId = require("short-unique-id");
const { getCourseEmail } = require("./emails/courseEmail");
const { getEventEmail } = require("./emails/eventEmail");
const { emailSchedule } = require("./utils/emailScheudler");

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

//////////////////////////////////email Schedule//////////////////////////////////////////

const schedul = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "emails"));
    querySnapshot.forEach((doc) => {
      emailSchedule(doc.data().dueDateObj, doc.data().eventId, doc.data().userId, doc.data().name, doc.data().username, doc.data().dues, doc.data().dueDate, doc.data().destinationEmail, doc.data().today)
    });
  } catch (error) {
    console.log(error);
  }
}

schedul()

/////////////////////////////////////////////////////////////////////////

// to send the request to the phonepay initaition
app.post("/order", async (req, res) => {

  try {
    const mti = uid.rnd() //merchend transaction ID
    let amount = await get(req.body.id, req.body.range);
    console.log(req.body.coupen);
    let flag = false
    let discount;
    let discAm
    if (req.body.coupen) {
      const q = query(collection(db, "coupens"), where("code", "==", req.body.code.toLowerCase()));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        flag = true
        discount = doc.data().discount
      });
      if (flag) discAm = (parseInt(amount / 100) - Math.round((discount / 100) * parseInt(amount / 100))) * 100

    }
    console.log(amount)
    console.log(discAm)

    //setting data as in the phonepe documentation
    const data =
    {
      merchantId: process.env.MERCHID,
      merchantTransactionId: mti,
      merchantUserId: req.body.userId,
      amount: req.body.coupen ? discAm : amount,
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
      type: 'course',
      coupen: req.body.coupen,
      discount: req.body.coupen ? discount : null,
      discAm: req.body.coupen ? discAm / 100 : null,
      fullPay: true,
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
    const url = process.env.PHONEPE + "/pg/v1/pay"

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

    //checking status of the payment
    const endPoint = `/pg/v1/status/${process.env.MERCHID}/${data.data.merchantTransactionId}`
    const code = endPoint + process.env.MERCHKEY
    const hash = crypto.createHash('sha256');
    originalValue = hash.update(code, 'utf-8');
    hashValue = originalValue.digest('hex');
    const xverify = hashValue + "###" + process.env.MERCHINDEX

    const url = process.env.PHONEPE + endPoint

    const payload = JSON.stringify({
      merchantId: process.env.MERCHID,
      merchantTransactionId: data.data.merchantTransactionId
    })

    const config = {
      headers: {
        accept: 'application/json',
        "Content-Type": "application/json",
        "X-VERIFY": xverify,
        "X-MERCHANT-ID": process.env.MERCHID
      },
      data: payload
    };

    const status = await axios.get(url, config)

    if (!status.data.success) return res.status(500).json({
      code: status.data.code,
      message: status.data.message,
      discription: status.data.data.responseCodeDescription
    });

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

    const idref = doc(db, "invoiceid", 'nqW2Qjz2hoo2bfwikjpF')
    const snaps = await getDoc(idref)
    let num;
    if (!snaps.exists) {
      console.log("no invcoie id");
    } else {
      num = snaps.data().nid + 1
      await updateDoc(idref, {
        nid: num + 1
      })
    }

    //setting the data for the invoice pdf
    const invoiceNumber = `N-${num}`
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

    let tax;
    let wot
    tax = (order.amount * 18) / 100
    wot = order.amount - tax

    //setting other invoice details
    const invoiceDetails = {
      client,
      items: [
        {
          item: order.name,
          quantity: 1,
          amount: wot,
          subtotal: wot,
        },
      ],
      invoiceNumber,
      paid: order.amount,
      transactionId: data.data.merchantTransactionId,
      discount: order.coupen ? order.discount : null,
      fullPay: true,
      subtotal: wot,
      tax: tax,
      total: order.totalFee ? order.totalFee : order.amount,
      coupen: order.coupen,
      discAm: order.coupen ? order.discAm : null,
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

    const email = getCourseEmail(order.username, order.name, invoiceNumber, formatDate(new Date()))

    //sendign email with attached pdf invoice
    await sendGmail(
      destinationEmail,
      `${email}`,
      `Course Registration Confirmation & Invoice - Seed - A Unit of Mechnido.`,
      filePath
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
      return parseInt(docSnap.data().registerFee * 100);
    }
  } catch (error) {
    console.log(error);
  }
};

const getDue = async (id, phase) => {
  console.log(phase);
  try {
    const cityRef = doc(db, "events", id);
    const docSnap = await getDoc(cityRef);
    if (!docSnap.exists) {
      console.log("No such document!");
    } else {
      console.log("Document data:", docSnap.data().phase1num);
      switch (phase) {
        case 1: return parseInt(docSnap.data().phase1num * 100);
        case 2: return parseInt(docSnap.data().phase2num * 100);
        default: return
      }
    }
  } catch (error) {
    console.log(error);
  }
}

app.post("/register", async (req, res) => {
  try {
    const mti = uid.rnd() //merchend transaction ID
    let fee;
    let total = false
    let disc;
    let discount;
    if (req.body.fullPay) {
      fee = await getRegisterFee(req.body.eventId);
    } else {
      fee = await getDue(req.body.eventId, req.body.phase)
      total = await getRegisterFee(req.body.eventId);
    }

    if (req.body.coupen) {
      const q = query(collection(db, "coupens"), where("code", "==", req.body.code.toLowerCase()));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        flag = true
        discount = doc.data().discount
      });
      if (flag) disc = (parseInt(fee / 100) - Math.round((discount / 100) * parseInt(fee / 100))) * 100

    }
    let dueDate;
    const cityRef = doc(db, "events", req.body.eventId);
    const docSnap = await getDoc(cityRef);
    if (!docSnap.exists) {
      console.log("no date");
    } else {
      dueDate = docSnap.data().dueDate
    }

    console.log("fee:" + fee);

    //setting data as in the phonepe documentation
    const data =
    {
      merchantId: process.env.MERCHID,
      merchantTransactionId: mti,
      merchantUserId: req.body.userId,
      amount: req.body.coupen ? disc : fee,
      redirectUrl: process.env.CLIENT + "/#/processing",
      redirectMode: "REDIRECT",
      callbackUrl: process.env.SERVER + "/register-verify",
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    }

    //storing the initiated transaction details for feature use
    if (req.body.phase === 2) {
      await addDoc(collection(db, "transactions"), {
        amount: fee / 100,
        userId: req.body.userId,
        name: req.body.name,
        transactionId: mti,
        eventId: req.body.eventId,
        email: req.body.email,
        type: 'event',
        fullPay: req.body.fullPay,
        totalFee: total ? total / 100 : null,
        coupen: req.body.coupen,
        discount: req.body.coupen ? discount : null,
        discAm: req.body.coupen ? disc / 100 : null,
        phase: total ? req.body.phase : null,
        username: req.body.username,
        dueDate
      });
    } else {
      await addDoc(collection(db, "transactions"), {
        amount: fee / 100,
        userId: req.body.userId,
        name: req.body.name,
        transactionId: mti,
        eventId: req.body.eventId,
        email: req.body.email,
        teamEmail: req.body.teamEmail,
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
        type: 'event',
        fullPay: req.body.fullPay,
        totalFee: total ? total / 100 : null,
        phase: total ? req.body.phase : null,
        coupen: req.body.coupen,
        discount: req.body.coupen ? discount : null,
        discAm: req.body.coupen ? disc / 100 : null,
        dueDate
      });
    }

    const key = process.env.MERCHKEY
    const index = process.env.MERCHINDEX

    //convering the data to base64
    const buf = JSON.stringify(data)
    const payload = Buffer.from(buf).toString('base64');

    //genrating hash for the phonepe payment initiation
    const code = payload + "/pg/v1/pay" + key
    const hash = crypto.createHash('sha256');
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
    const url = process.env.PHONEPE + "/pg/v1/pay"

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

    //checking status of the payment
    const endPoint = `/pg/v1/status/${process.env.MERCHID}/${data.data.merchantTransactionId}`
    const code = endPoint + process.env.MERCHKEY
    const hash = crypto.createHash('sha256');
    originalValue = hash.update(code, 'utf-8');
    hashValue = originalValue.digest('hex');
    const xverify = hashValue + "###" + process.env.MERCHINDEX

    const url = process.env.PHONEPE + endPoint

    const payload = JSON.stringify({
      merchantId: process.env.MERCHID,
      merchantTransactionId: data.data.merchantTransactionId
    })

    const config = {
      headers: {
        accept: 'application/json',
        "Content-Type": "application/json",
        "X-VERIFY": xverify,
        "X-MERCHANT-ID": process.env.MERCHID
      },
      data: payload
    };

    const status = await axios.get(url, config)

    if (!status.data.success) return res.status(500).json({
      code: status.data.code,
      message: status.data.message,
      discription: status.data.data.responseCodeDescription
    });

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

    const idref = doc(db, "invoiceid", 'nqW2Qjz2hoo2bfwikjpF')
    const snaps = await getDoc(idref)
    let num;
    if (!snaps.exists) {
      console.log("no invcoie id");
    } else {
      num = snaps.data().nid + 1
      await updateDoc(idref, {
        nid: num + 1
      })
    }

    //setting the data for the invoice pdf
    const invoiceNumber = `N-${num}`
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
    let tax;
    let wot
    if (order.totalFee) {
      tax = (order.totalFee * 18) / 100
      wot = order.totalFee - tax
    } else {
      tax = (order.amount * 18) / 100
      wot = order.amount - tax
    }
    const invoiceDetails = {
      client,
      items: [
        {
          item: order.name,
          quantity: 1,
          amount: wot,
          subtotal: wot,
        },
      ],
      invoiceNumber,
      paid: order.phase === 2 ? order.totalFee : order.amount,
      subtotal: wot,
      tax: tax,
      total: order.totalFee ? order.totalFee : order.amount,
      coupen: order.coupen,
      discount: order.coupen ? order.discount : null,
      discAm: order.coupen ? order.discAm : null,
      transactionId: status.data.data.transactionId,
      fullPay: order.fullPay
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
      fullPay: order.fullPay,
      phase: order.fullPay ? null : order.phase,
      itemName: order.name,
      transactionId: order.transactionId,
      satus: "purchased",
      userId: order.userId,
      userName: order.username,
      timestamp: serverTimestamp(),
    });

    const eventRef = doc(db, "events", order.eventId);
    const qe = query(collection(db, "events"), where("enrolled_arr", "array-contains", order.userId));
    const event = await getDocs(qe)

    let enrolled = false;
    event.forEach(item => {
      enrolled = true
    })

    if (enrolled) {
      let full = true
      let arr = []
      console.log(event);
      event.forEach(item => {
        item.data().enrolled.forEach((i, n) => {
          if (i.userId === order.userId) {
            arr.push({ ...i, phase: 2, invoice: downloadURL, })
          } else {
            arr.push(i)
          }
        })
      })

      await updateDoc(eventRef, {
        enrolled: arr
      })

    } else {
      await updateDoc(eventRef, {
        enrolled: arrayUnion({
          userId: order.userId,
          invoice: downloadURL,
          fullPay: order.fullPay,
          phase: order.fullPay ? null : order.phase
        }),
      });

      await updateDoc(eventRef, {
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

    }

    response = { signatureIsValid: "true" };
    res.json({ response });

    //this email is for tnkc only
    const eventData = await getDoc(eventRef)
    const emailHTML = eventData.data().emailHTML

    const files = [filePath];

    if (order.fullPay) {
      await sendGmail(
        destinationEmail, `${emailHTML}`,
        ``
      );
      const mail = getEventEmail(order.username, order.name, invoiceNumber, formatDate(new Date()), 0, data.data.paymentInstrument.type, 0)
      await sendGmail(
        destinationEmail, `${mail}`,
        `Event Registration Confirmation & Invoice - Seed - A Unit of Mechnido`,
        filePath
      );
    } else {
      if (order.phase == 1) {
        await sendGmail(
          destinationEmail, `${emailHTML}`,
          ``
        );
        const mail = getEventEmail(order.username, order.name, invoiceNumber, formatDate(new Date()), invoiceDetails.total - invoiceDetails.paid, data.data.paymentInstrument.type, order.dueDate)
        await sendGmail(
          destinationEmail, `${mail}`,
          `Event Registration Confirmation & Invoice - Seed - A Unit of Mechnido`,
          filePath
        );
        const d = order.dueDate.split("/")
        const date = {
          hour: 0,
          day: d[0],
          month: d[1],
          year: d[2]
        }
        let today = {
          hour: 0,
          month: new Date().getMonth() + 1,
          day: new Date().getDate(),
          year: new Date().getFullYear()
        }
        await addDoc(collection(db, "email"), {
          dueDateObj: date,
          eventId: order.eventId,
          userId: order.userId,
          name: order.name,
          username: order.username,
          due: invoiceDetails.total - invoiceDetails.paid,
          dueDate: order.dueDate,
          destinationEmail: destinationEmail,
          today: today
        });
        emailSchedule(date, order.eventId, order.userId, order.name, order.username, invoiceDetails.total - invoiceDetails.paid, order.dueDate, destinationEmail, today)
      } else {
        const mail = getEventEmail(order.username, order.name, invoiceNumber, formatDate(new Date()), 0, data.data.paymentInstrument.type, 0)
        await sendGmail(
          destinationEmail, `${mail}`,
          `Event Registration Confirmation & Invoice - Seed - A Unit of Mechnido`,
          filePath
        );
      }
    }

  } catch (error) {
    console.log(error);
    return res.status(500).json({ error });
  }
});

app.post('/send-register-email', async (req, res) => {
  try {
    if (!req.body.email) return res.status(401).json({ error: "bad request" })

    const emailHTML = fs.readFileSync('./welcom.html', 'utf8');

    await sendGmail(
      req.body.email,
      `${emailHTML}`,
      'Welcome to Seed'
    )
    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(500).json({ error })
  }
})

app.listen(4242, () => console.log("Running on port 4242"));
