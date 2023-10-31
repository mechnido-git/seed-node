 const getCourseEmail = (name, courseName, invoiceId, invoiceDate) => {
    const email = `
    <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <style>
      .main-logo {
        width: 400px;
      }
      .b{
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <table
      role="presentation"
      border="0"
      cellspacing="0"
      width="10%"
      align="center"
    >
      <tr>
        <td align="center">
          <img
            class="main-logo"
            src="https://firebasestorage.googleapis.com/v0/b/seed-25898.appspot.com/o/seed_logo%2Flogo.png?alt=media&token=70d57028-8b93-4847-a7cd-a9f51c289e50"
            alt="/"
          />
        </td>
      </tr>
    </table>
    <p>Hello ${name},</p>
    <p>We are delighted to inform you that your registration for the ${courseName} has been successfully confirmed. Your dedication to advancing your knowledge and skills in this field is commendable, and we are excited to have you as a participant in our upcoming course.</p>
    <p>As a part of your registration, we have attached the invoice for your reference. Please find the attached invoice and details below:</p>
    <p class="b">Invoice Number: ${invoiceId}</p>
    <p class="b">Invoice Date: ${invoiceDate}</p>
    <p>If you have any questions or require any further assistance, please do not hesitate to reach out to our support team at <a href="www.mseed.in">www.mseed.in.</a> We are here to assist you in any way we can.</p>
    <p>Once again, thank you for choosing <span class="b">Seed - A Unit of Mechnido</span> for your educational journey. We look forward to seeing you at the start of the course, and we wish you all the best in your studies.</p>
    <p>Best regards,<br />
    Seed - A Unit of Mechnido.</p>
    <img
            class="main-logo"
            src="https://firebasestorage.googleapis.com/v0/b/seed-25898.appspot.com/o/seed_logo%2Flogo.png?alt=media&token=70d57028-8b93-4847-a7cd-a9f51c289e50"
            alt="/"
            style="width: 150px;"
          />

          <table role="presentation"  border="0" cellspacing="0" width="10%" align="center">
            <tr >
                <td  >
                        <a href="https://www.instagram.com/ideatechevents/">
                        <img width="48" height="48" src="https://img.icons8.com/color/48/instagram-new--v1.png" alt="instagram-new--v1"/>
                    </a>
        
                    </td>
                    <td >
                        <a href="http://www.ideatechevents.com/">
            
                            <img width="40" height="40" src="https://img.icons8.com/ultraviolet/40/domain.png" alt="domain"/>
                        </a>
                    </td>
                    <td >
                        <a href="mailto:info@ideatechevents.com">
                            <img width="48" height="48" src="https://img.icons8.com/color/48/apple-mail.png" alt="apple-mail"/>
                        </a>
                    </td>
                </tr>
        </table>

    </div>
    <hr />
 <div style="text-align: center;">
    <p >Copyright © *MECHNIDO*, All rights reserved.</p>
    <p ><span class="b">Our mailing address is:</span><br/>
    <a style="font-weight: bold;color: red;" href="mailto:info@ideatechevents.com">Support@mseed.in</a>
    </p>
    <p ><span class="b">Our website address is:</span><br/>
        <a style="font-weight: bold;color: #506A43;" href="https://www.ideatechevents.com/">www.mseed.in</a>
        </p>
</div>
        <table role="presentation" border="0" cellspacing="0" width="100%">
            <tr>
                <td align="center">
                    <img aligncenter style="display: block;text-align: center; width: 100px" src="https://static.wixstatic.com/media/f447a0_5b4b6e2dcfb041b4bae23bb150a26106~mv2.png/v1/crop/x_248,y_436,w_1872,h_1024/fill/w_199,h_109,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/mechnido%20logo%20(3).png" alt="">

                </td>
            </tr>
        </table>
</body>
</html>`

    return email
}
module.exports = {getCourseEmail}