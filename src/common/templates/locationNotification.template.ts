const locationNotificationEmailTemplate = (data: { 
  userName?: string; 
  title: string; 
  message: string;
  location?: string;
}) => `
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

      h2 {
        color: #333;
        font-size: 20px;
        margin: 20px 0 10px 0;
      }

      p {
        font-size: 16px;
        color: #555;
        line-height: 1.7;
      }

      .notification-box {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #ffffff;
        border-radius: 8px;
        padding: 24px;
        margin: 25px 0;
      }

      .notification-box h3 {
        margin-top: 0;
        font-size: 18px;
      }

      .notification-box p {
        color: #ffffff;
        margin: 10px 0;
      }

      .location-badge {
        display: inline-block;
        background: rgba(255,255,255,0.2);
        border: 2px solid #ffffff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        color: #ffffff;
        margin-top: 10px;
      }

      .info {
        background: #f7faf7;
        border-left: 4px solid #3AAA35;
        padding: 12px 16px;
        margin: 20px 0;
        font-size: 14px;
        color: #444;
      }

      .cta-button {
        display: inline-block;
        background: #3AAA35;
        color: #ffffff !important;
        padding: 12px 24px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: bold;
        margin-top: 15px;
      }

      .footer {
        margin-top: 30px;
        text-align: center;
        font-size: 13px;
        color: #999;
        border-top: 1px solid #eee;
        padding-top: 20px;
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
        <h1>📍 Location-Based Notification</h1>
      </div>

      <p>
        <strong>Hi ${data.userName || "there"},</strong>
      </p>

      <p>
        We have an important message for you based on your location area.
      </p>

      <div class="notification-box">
        <h3>${data.title}</h3>
        <p>${data.message}</p>
        ${data.location ? `<div class="location-badge">📍 ${data.location}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="info">
        💡 This notification was sent to you because you are in the specified area. 
        You can manage your notification preferences in the app settings.
      </div>

      <p>
        If you have any questions or need assistance, please don't hesitate to reach out to our support team.
      </p>

      <div style="text-align:center;">
        <a href="#" class="cta-button">View in App</a>
      </div>

      <div class="footer">
        <p>© ${new Date().getFullYear()} PLATEChatter</p>
        <p>
          <a href="#">Privacy Policy</a> | 
          <a href="#">Settings</a> | 
          <a href="#">Support</a>
        </p>
      </div>

    </div>
  </body>
</html>
`;

export default locationNotificationEmailTemplate;
