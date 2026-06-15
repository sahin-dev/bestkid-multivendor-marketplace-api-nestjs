import { SetMetadata } from "@nestjs/common"

export const ApiResponseMessageKey = 'apiResponseMessage'

export const ResponseMessage = (message:string) => SetMetadata(ApiResponseMessageKey, message)