// import { S3Client } from "@aws-sdk/client-s3";
// import { Inject, Injectable } from "@nestjs/common";
// import type { ConfigType } from "@nestjs/config";
// import awsConfig, { awsConfigData } from "src/config/aws.config";


// @Injectable()
// export class S3Storage{
//     private readonly s3Client:S3Client
//     constructor(@Inject(awsConfig.KEY) private readonly awsCOnfigData:ConfigType<typeof awsConfigData>){
//         try{
           
//             this.s3Client = new S3Client([{
//                 region:this.awsCOnfigData.region,
//                 credentials:{
//                     accessKeyId:this.awsCOnfigData.access_key,
//                     secretAccessKey:this.awsCOnfigData.secret_key
//                 }
//             }])
//         }catch(err){
//             console.log("Error:Configuring s3 client failed!", err)
//             throw err
//         }
//     }
    

//     getClient(){
//         return this.s3Client
//     }
// }
