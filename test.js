const { generateInvoicePdf } = require("./utils/pdf-generator");
const fs = require("fs")
const ShortUniqueId = require('short-unique-id');
const crypto = require('crypto')
const axios = require('axios');
const { sendGmail } = require("./utils/email-sender");

const { initializeApp } = require("firebase/app");
const { firebaseConfig } = require("./config");
const {
  doc,
  getDoc,
  getFirestore,
} = require("firebase/firestore");

initializeApp(firebaseConfig);
const db = getFirestore();

const foo = async () => {
  const clientId = "hello"
  const destinationEmail = "emsil";

  const invoiceId = "hiii";
  const uid = new ShortUniqueId({
    dictionary: 'number',
    length: 20,
  });
  const invoiceNumber = uid.rnd();

  const fileName = 'FACT-NDbQC65dt-pay_MFx2XFFHIVa0Lj' + '.pdf'
  const filePath = `/tmp/${fileName}`;
  const client = {
    name: "ame",
    email: "mial",
    clientId: "req.body.uid",
    pricePerSession: 1,
    address: "",
    city: "",
    state: "",
    postal_code: ""
  }
  const invoiceDetails = {
    client: {
      name: 'Mishal',
      email: 'mishalclever@gmail.com',
      clientId: 'gUQTkwVJRzVplGWSbW6GPT6zuER2',
      pricePerSession: 1,
      address: '',
      city: '',
      state: '',
      postal_code: ''
    },
    items: [
      {
        item: 'Reverse Engineering',
        quantity: 1,
        amountSum: 2500,
        subtotal: 2500
      }
    ],
    invoiceNumber,
    paid: 2500,
    subtotal: 2500
  }
  const lol = 'ui'

  const msg = await generateInvoicePdf(invoiceDetails, filePath);
  
  console.log(msg);
  // const file = fs.readFileSync(filePath, "base64")
  // console.log(file);
}

function genHash() {

  const uid = new ShortUniqueId({
    dictionary: 'number',
    length: 20,
  });
  const data = {
    "merchantId": "M1J6KDOBZOWG",
    "merchantTransactionId": uid.rnd(),
    "merchantUserId": "MUID123",
    "amount": 10000,
    "redirectUrl": "https://webhook.site/redirect-url",
    "redirectMode": "REDIRECT",
    "callbackUrl": "https://webhook.site/callback-url",
    "mobileNumber": "9999999999",
    "paymentInstrument": {
      "type": "PAY_PAGE"
    }
  }

  const key = "8efa9411-a19f-4874-9245-479b00da244d"

  const buf = JSON.stringify(data)
  let buf64 = Buffer.from(buf).toString('base64')
  let code = buf64 + "/pg/v1/pay" + key
  console.log(buf64)
  var hash = crypto.createHash('sha256');
  //Pass the original data to be hashed
  originalValue = hash.update(code, 'utf-8');
  //Creating the hash value in the specific format
  hashValue = originalValue.digest('hex');
  //Printing the output on the console
  const xverify = hashValue+"###"+'1'
  console.log(xverify)

  

const options = {
  method: 'POST',
  url: 'https://api.phonepe.com/apis/hermes/pg/v1/pay',
  headers: {
    accept: 'application/json',
    'Content-Type': 'application/json',
    'X-VERIFY': xverify
  },
  data: {
    request: buf64
   }
};

axios
  .request(options)
  .then(function (response) {
    console.log(response.data);
  })
  .catch(function (error) {
    console.error(error);
  });
}

const sendEmail = async()=>{
  try {
    // const emailHTML = fs.readFileSync('./tnkc.html', 'utf8');
    const event = doc(db, "events", 'hUaPM58nSpDcAbUNXSf7');
    const eventData = await getDoc(event)
    const emailHTML = eventData.data().emailHTML

    await sendGmail('mail4mishal@gmail.com', `${emailHTML}`, "event mail")
  } catch (error) {
    console.log(error);
  }
}

//tesing functions =================>

//1.Testing pdf
//foo()

//2.Testing phonepe payment
//genHash()

//3.Testing Email
sendEmail()