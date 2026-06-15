import { registerAs } from "@nestjs/config"

export const awsConfigData = (()=> ({
    access_key:process.env.AWS_ACCESS_KEY_ID,
    secret_key:process.env.AWS_SECRET_ACCESS_KEY,
    bucket_name:process.env.S3_BUCKET_NAME,
    region:process.env.AWS_REGION
}))

export default registerAs("aws", awsConfigData)