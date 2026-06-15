import { Inject, Injectable } from "@nestjs/common";
import type{ ConfigType } from "@nestjs/config";
import nodemailer, { Transporter } from 'nodemailer'
import mailerConfig, { MailerConfig } from "src/config/mailer.config";

@Injectable()
export class SMTPProvider {


    private transporter:Transporter
    constructor(@Inject(mailerConfig.KEY)private readonly mailerConfiguration:ConfigType<typeof MailerConfig>){
        console.log(mailerConfiguration)
        try{
            this.transporter = nodemailer.createTransport({
            host: this.mailerConfiguration.host,
            port: parseInt(this.mailerConfiguration.port!),
            secure:false,
            auth:{
                user: this.mailerConfiguration.user,
                pass: this.mailerConfiguration.password
            }
        })
         console.log("SMTP transporter initialized successfully.");

        }catch(err){
            console.log("SMTP transporter initialization failed!")
        }
        
       
    }

    async sendMail(to:string, subject:string, body:string){
        if(!this.transporter){
            throw new Error("transporter does not initialized yet!")
        }

        try{
            await this.transporter.sendMail({
            to,
            subject,
            html:body
        })
        }catch(err){
            console.log(err)
            console.log("sending failed... ")
        }
    }
}