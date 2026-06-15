import { registerAs } from "@nestjs/config"

export const AppConfig = () => ({
    domain:process.env.BASE_PATH
})

export default registerAs("app", AppConfig)