import { Inject, Injectable, Logger } from "@nestjs/common";
import type{ ConfigType } from "@nestjs/config";
import nodemailer, { Transporter } from 'nodemailer'
import mailerConfig, { MailerConfig } from "src/config/mailer.config";

@Injectable()
export class SMTPProvider {

    private readonly logger = new Logger(SMTPProvider.name)
    private transporter:Transporter
    constructor(@Inject(mailerConfig.KEY)private readonly mailerConfiguration:ConfigType<typeof MailerConfig>){
        try{
            const port = parseInt(this.mailerConfiguration.port!)
            this.transporter = nodemailer.createTransport({
            host: this.mailerConfiguration.host,
            port,
            secure:port === 465,
            connectionTimeout:10_000,
            socketTimeout:20_000,
            auth:{
                user: this.mailerConfiguration.user,
                pass: this.mailerConfiguration.password
            }
        })

        }catch(err){
            this.logger.error("SMTP transporter initialization failed!", err instanceof Error ? err.stack : err)
        }
    }

    async sendMail(to:string, subject:string, body:string){
        if(!this.transporter){
            this.logger.error("Cannot send mail: SMTP transporter is not initialized.")
            return
        }

        try{
            await this.transporter.sendMail({
            from:"no-reply@bestkid.eu",
            to,
            subject,
            html:body
        })
        }catch(err){
            this.logger.error(`Sending "${subject}" failed`, err instanceof Error ? err.stack : err)
        }
    }
}
