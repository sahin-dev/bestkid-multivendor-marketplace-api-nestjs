import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "generated/prisma/client";
import  dbConfigObj, {dbConfig}  from "../../config/db.config";

@Injectable()
export class PrismaService extends PrismaClient {
    private readonly logger = new Logger(PrismaService.name)

    constructor(@Inject(dbConfigObj.KEY) private readonly dbConfiguration:ConfigType<typeof dbConfig>){
             
        const adapter = new PrismaPg(
            {
                user:dbConfiguration.user,
                password:dbConfiguration.password, 
                database:dbConfiguration.database
            })
        super({adapter})

        this.logger.log("Database connected successfully!")
    }
}