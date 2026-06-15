const welcomeEmailTemplate = (data: { name?: string }) => `
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

      .highlight-box {
        background: #eef7ff;
        border-left: 4px solid #1270B7;
        padding: 16px;
        border-radius: 8px;
        margin: 25px 0;
        font-size: 16px;
        color: #333;
      }

      .cta-button {
        display: inline-block;
        background: #3AAA35;
        color: #ffffff !important;
        padding: 14px 24px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: bold;
        margin-top: 20px;
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
        <h1>Welcome to PLATEChatter 🎉</h1>
      </div>

      <p>
        <strong>Hi ${data.name || "there"}, welcome to PLATEChatter!</strong>
      </p>

      <p>
        We're excited to have you on board. You're now part of a growing community where you can explore, connect, and enjoy amazing experiences.
      </p>

      <div class="highlight-box">
        🚀 Get started by exploring features, connecting with others, and making the most out of PLATEChatter.
      </div>

      <div style="text-align:center;">
        <a href="#" class="cta-button">Get Started</a>
      </div>

      <div class="divider"></div>

      <div class="info">
        Need help? Our support team is always here for you.
      </div>

      <p>
        If you did not create this account, please ignore this email.
      </p>

      <div class="footer">
        <p>© ${new Date().getFullYear()} PLATEChatter</p>
        <p>
          <a href="#">Privacy Policy</a> | 
          <a href="#">Support</a>
        </p>
      </div>

    </div>
  </body>
</html>
`;

export default welcomeEmailTemplate;