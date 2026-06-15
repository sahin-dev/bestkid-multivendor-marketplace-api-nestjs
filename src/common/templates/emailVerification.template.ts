const otpEmailTemplate = (data: { appname:string, name: string; otp: string }) => `
<html>
  <head>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f4f6f9;
        font-family: Arial, Helvetica, sans-serif;
      }

      .container {
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 10px;
        padding: 40px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.08);
      }

      .header {
        text-align: center;
        margin-bottom: 25px;
      }

      .logo {
        max-width: 160px;
        margin-bottom: 10px;
      }

      h1 {
        color: #1270B7;
        font-size: 26px;
        margin-bottom: 10px;
      }

      p {
        font-size: 16px;
        color: #555;
        line-height: 1.7;
      }

      .otp-box {
        background: #eef7ff;
        border: 2px dashed #1270B7;
        padding: 18px;
        text-align: center;
        font-size: 26px;
        letter-spacing: 4px;
        font-weight: bold;
        color: #3AAA35;
        border-radius: 8px;
        margin: 25px 0;
      }

      .info {
        background: #f7faf7;
        border-left: 4px solid #3AAA35;
        padding: 12px 16px;
        margin: 20px 0;
        font-size: 14px;
        color: #444;
      }

      .footer {
        margin-top: 30px;
        text-align: center;
        font-size: 13px;
        color: #999;
      }

      .footer a {
        color: #1270B7;
        text-decoration: none;
      }

      .divider {
        height: 1px;
        background: #eee;
        margin: 25px 0;
      }
    </style>
  </head>

  <body>
    <div class="container">

      <div class="header">
        <h1>Your Email Verification Code</h1>
      </div>

      <p>
        <strong>Hi ${data.name}, here is your OTP:</strong>
      </p>

      <div class="otp-box">
        ${data.otp}
      </div>

      <div class="divider"></div>

     

      <div class="info">
        This code is valid for a limited time and should not be shared with anyone.
      </div>

      <p>
        If you did not request this code, you can safely ignore this email.
      </p>

      <div class="footer">
        <p>© ${new Date().getFullYear()} ${data.appname}</p>
        <p>
          <a href="#">Privacy Policy</a> | 
          <a href="#">Support</a>
        </p>
      </div>

    </div>
  </body>
</html>
`;

export default otpEmailTemplate;
