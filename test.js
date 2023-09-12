const { generateInvoicePdf } = require("./utils/pdf-generator");
const path = require("path")
const fs = require("fs")
const ShortUniqueId = require('short-unique-id');

const foo = async ()=>{
  const clientId = "hello"
    const destinationEmail = "emsil";

    const invoiceId = "hiii" ;
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

        const msg = await generateInvoicePdf(invoiceDetails, filePath, after, lol);
        async function after(wow){
        }
        console.log("ji");
        // const file = fs.readFileSync(filePath, "base64")
        // console.log(file);
}

foo()