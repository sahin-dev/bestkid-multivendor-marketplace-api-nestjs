import { registerAs } from "@nestjs/config"

export const MailerConfig = ()=> ({
    host: process.env.MAILER_HOST,
    port: process.env.MAILER_PORT,
    user:process.env.MAILER_MAIL,
    password:process.env.MAILER_PASSWORD,
    service: process.env.MAILER_SERVICE
})

export default registerAs("mailer", MailerConfig)