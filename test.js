const { generateInvoicePdf } = require("./utils/pdf-generator");
const fs = require("fs")
const ShortUniqueId = require('short-unique-id');
const crypto = require('crypto')
const axios = require('axios');
const { sendGmail } = require("./utils/send-email");
const {emailSchedule} = require("./utils/emailScheudler.js")

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
        amount: 2500,
        subtotal: 2500
      }
    ],
    invoiceNumber,
    paid: 2500,
    subtotal: 2500,
    transactionId: "TR21342551421"
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
    // const files = '/home/mishal/repo/seed-node/tnkc.html'
    const emailHTML = fs.readFileSync('./welcom.html', 'utf8');
    // const event = doc(db, "events", 'hUaPM58nSpDcAbUNXSf7');
    // const eventData = await getDoc(event)
    // const emailHTML = eventData.data().emailHTML

    await sendGmail('mail4mishal@gmail.com', `${emailHTML}`, "event mail")
  } catch (error) {
    console.log(error);
  }
}

const bar = async()=>{
  try {
    let data = JSON.stringify({
      "merchantId": "PGTESTPAYUAT",
      "merchantTransactionId": "1383465993303208461951"
    });
    
    let config = {
      headers: { 
        'X-VERIFY': 'c19a486e948e32c9e29d26cf0f47f3aaf1ba4b29a76a19be0edcf6a422938528###1', 
        'X-MERCHANT-ID': 'PGTESTPAYUAT', 
        'Content-Type': 'application/json'
      },
      data : data
    };
    const url = 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/PGTESTPAYUAT/1383465993303208461951'
    const response = await axios.get(url, config)
    console.log(response.data);
  } catch (error) {
    console.log(error);
  }
}

const remaindEmail = () => {
  const date = {
    hour: 0,
    month: 11,
    day: 30,
    year: 2023
  }
  let current = {
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    year: new Date().getFullYear()
  }
  let eventId = "hUaPM58nSpDcAbUNXSf7"
  let userId = "gaNS3LBaqgWpcg7QefWou4L1Id72"
  let name = "TNKC"
  let username = "mishal"
  let due = 15000
  let dueDate = "11/1/2023"
  let destinationEmail = "mail4mishal@gmail.com"
  console.log('started');
  emailSchedule(date, eventId, userId, name, username, due, dueDate, destinationEmail, current)
}

remaindEmail()



//tesing functions =================>

//1.Testing pdf
// foo()

//2.Testing phonepe payment
//genHash()

//3.Testing Email
// sendEmail()

// bar()